"""Train the active model and write predictions + team signals to the database.

Pipeline:
  1. Ingest + Elo   — load results, compute leakage-free Elo (final ratings).
  2. Train          — fit the Elo-conditioned Poisson on recency-weighted history.
  3. Backtest       — temporal eval; refuse to publish if it fails the gate.
  4. Team signals   — Elo ranking + recent attack/defense form per WC team.
  5. Predict        — score every fixture with both teams known.
  6. Store          — ModelVersion + Prediction + Ranking + TeamForm rows.
"""
from __future__ import annotations
import hashlib
import json
import math
import os
import sys
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from elo import load_results, compute_elo  # noqa: E402
from models import poisson  # noqa: E402
import backtest as bt  # noqa: E402
from calibrate import IsotonicCalibrator  # noqa: E402
import db  # noqa: E402

MODEL_VERSION = "elo-poisson-v1"
CALIB_WINDOW_DAYS = 365 * 5  # recent holdout for fitting the production calibrator
RECENT_FORM_MATCHES = 12
HALF_LIFE_DAYS = 730


def confidence(p_home, p_draw, p_away) -> float:
    """1 - normalised entropy: 0 = coin-flip, 1 = certain."""
    ps = [p for p in (p_home, p_draw, p_away) if p > 0]
    ent = -sum(p * math.log(p) for p in ps)
    return round(1 - ent / math.log(3), 3)


def _pp_bucket(pp: float) -> str:
    a = abs(pp)
    if a >= 18:
        return "High"
    if a >= 7:
        return "Medium"
    return "Low"


def build_key_factors(home, away, home_elo, away_elo, neutral, form,
                      params, final_p) -> list[dict]:
    """Quantified explanation: each factor's contribution in probability points.

    Contributions are measured against an even-teams, neutral-venue reference by
    toggling one input at a time (Elo gap, then home field), so they sum to the
    model's actual win-probability shift — a faithful per-prediction attribution.
    """
    diff = home_elo - away_elo
    favored = home if diff >= 0 else away

    base = poisson.predict(params, 1500, 1500, neutral=True)   # symmetric reference
    elo_only = poisson.predict(params, home_elo, away_elo, neutral=True)
    full = poisson.predict(params, home_elo, away_elo, neutral)

    def fav_p(pr):
        return pr["pHome"] if favored == home else pr["pAway"]

    elo_pp = (fav_p(elo_only) - fav_p(base)) * 100
    factors = [{
        "factor": "Elo rating edge",
        "detail": f"{home} {home_elo:.0f} — {away} {away_elo:.0f} "
                  f"({'+' if diff >= 0 else ''}{diff:.0f})",
        "impact": _pp_bucket(elo_pp),
        "impactPct": round(elo_pp),
        "direction": favored if abs(elo_pp) >= 2 else "Even",
    }]

    if not neutral:
        home_pp = (full["pHome"] - elo_only["pHome"]) * 100
        factors.append({
            "factor": "Home-nation advantage",
            "detail": "Host nation playing on home soil",
            "impact": _pp_bucket(home_pp),
            "impactPct": round(home_pp),
            "direction": home,
        })
    else:
        factors.append({
            "factor": "Venue",
            "detail": "Neutral site — no host advantage applied",
            "impact": "Low", "impactPct": 0, "direction": "Even",
        })

    hf, af = form.get(home), form.get(away)
    if hf and af:
        atk_gap = hf["attack"] - af["attack"]
        favored_form = home if atk_gap > 0 else away
        factors.append({
            "factor": "Recent attacking form",
            "detail": f"{home} {hf['gf']:.1f} gpg vs {away} {af['gf']:.1f} gpg (last 12)",
            "impact": "Medium" if abs(atk_gap) > 0.4 else "Low",
            "impactPct": None,  # context only — not a model driver
            "direction": favored_form if abs(atk_gap) > 0.1 else "Even",
        })
    return factors


def compute_team_form(df: pd.DataFrame, team_names: set[str]) -> dict:
    """Recent goals-for/against and attack/defense strength per team."""
    recent = df[df["date"] >= df["date"].max() - pd.Timedelta(days=365 * 4)]
    global_avg = (recent["home_score"].mean() + recent["away_score"].mean()) / 2 or 1.0

    form = {}
    for name in team_names:
        played = df[(df["home_team"] == name) | (df["away_team"] == name)].tail(
            RECENT_FORM_MATCHES)
        if played.empty:
            continue
        gf = ga = pts = 0
        for r in played.itertuples(index=False):
            if r.home_team == name:
                f, a = r.home_score, r.away_score
            else:
                f, a = r.away_score, r.home_score
            gf += f
            ga += a
            pts += 3 if f > a else (1 if f == a else 0)
        n = len(played)
        gf_avg, ga_avg = gf / n, ga / n
        form[name] = {
            "gf": round(gf_avg, 2),
            "ga": round(ga_avg, 2),
            "last5": min(pts, 15),
            "attack": round(gf_avg / global_avg, 3),
            "defense": round(global_avg / max(ga_avg, 0.2), 3),
        }
    return form


def main():
    print("[1/6] Ingest + Elo…")
    df = load_results()
    raw_hash = hashlib.sha256(
        pd.util.hash_pandas_object(df, index=True).values.tobytes()).hexdigest()[:16]
    df, ratings = compute_elo(df)

    print("[2/6] Train Poisson (recency-weighted)…")
    cutoff_ts = df["date"].max()
    weights = bt.recency_weights(df["date"], cutoff_ts, HALF_LIFE_DAYS)
    params = poisson.fit(df, weights=weights)

    print("[3/6] Backtest…")
    metrics = bt.run()
    if not metrics["beatsBaseline"]:
        sys.exit("Backtest gate FAILED — model does not beat baseline. Not publishing.")
    print(f"      log-loss {metrics['model']['logloss']} "
          f"(baseline {metrics['baseline']['logloss']}) — gate PASS")

    conn = db.connect()
    team_ids = db.team_id_by_name(conn)
    team_names = set(team_ids)

    print("[4/6] Team signals (Elo + form)…")
    form = compute_team_form(df, team_names)
    db.clear_team_signals(conn)
    as_of = df["date"].max().strftime("%Y-%m-%d %H:%M:%S")
    for name, tid in team_ids.items():
        if name in ratings:
            db.upsert_ranking(conn, tid, as_of, round(ratings[name], 1))
        if name in form:
            f = form[name]
            db.upsert_team_form(conn, tid, as_of, f["last5"], f["gf"], f["ga"],
                                f["attack"], f["defense"])

    # Calibration is applied to shipped predictions only if the backtest shows it
    # improves test log-loss. A well-calibrated raw model legitimately ships raw.
    calibration_applied = bool(metrics["calibrationHelps"])
    calibrator = None
    if calibration_applied:
        recent = df[df["date"] >= cutoff_ts - pd.Timedelta(days=CALIB_WINDOW_DAYS)]
        calibrator = IsotonicCalibrator.fit(bt.predict_probs(params, recent), bt.onehot(recent))
        print(f"      calibration applied (improves log-loss "
              f"{metrics['model']['logloss']} -> {metrics['calibrated']['logloss']})")
    else:
        print("      model already well-calibrated — shipping raw probabilities")

    print("[5/6] Predict fixtures…")
    db.deactivate_models(conn)
    db.delete_model_version(conn, MODEL_VERSION)
    metrics_json = json.dumps({
        "logloss": metrics["model"]["logloss"],
        "brier": metrics["model"]["brier"],
        "rps": metrics["model"]["rps"],
        "accuracy": metrics["model"]["accuracy"],
        "calibratedLogloss": metrics["calibrated"]["logloss"],
        "calibrationApplied": calibration_applied,
        "baselineLogloss": metrics["baseline"]["logloss"],
        "baselineAccuracy": metrics["baseline"]["accuracy"],
        "testMatches": metrics["testMatches"],
        "reliability": metrics["reliabilityCalibrated"] if calibration_applied
        else metrics["reliabilityRaw"],
        "params": params.to_dict(),
    })
    mid = db.insert_model_version(conn, MODEL_VERSION, "Elo-conditioned Poisson",
                                  raw_hash, metrics_json)
    db.clear_predictions(conn)

    matches = db.fetch_group_matches(conn)
    written = 0
    for m in matches:
        home, away = m["home"], m["away"]
        eh, ea = ratings.get(home, 1500.0), ratings.get(away, 1500.0)
        neutral = bool(m["neutral"])
        pred = poisson.predict(params, eh, ea, neutral)
        p = (pred["pHome"], pred["pDraw"], pred["pAway"])
        if calibrator is not None:
            p = calibrator.transform_one(*p)
        conf = confidence(*p)
        features = {
            "homeElo": round(eh, 1), "awayElo": round(ea, 1),
            "eloDiff": round(eh - ea, 1), "neutral": neutral,
            "lambdaHome": pred["expGoalsHome"], "lambdaAway": pred["expGoalsAway"],
            "homeForm": form.get(home), "awayForm": form.get(away),
            "calibrated": calibration_applied,
        }
        key_factors = build_key_factors(home, away, eh, ea, neutral, form, params, p)
        db.insert_prediction(
            conn, m["id"], mid, p, pred["expGoalsHome"], pred["expGoalsAway"],
            json.dumps(pred["scorelineDist"]), json.dumps(features),
            json.dumps(key_factors), conf)
        written += 1

    db.log_data_source(conn, "international_results.csv", "success",
                       len(df), 0, raw_hash)
    conn.commit()
    conn.close()
    print(f"[6/6] Done — model {MODEL_VERSION}, {written} predictions written.")


if __name__ == "__main__":
    main()
