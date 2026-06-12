"""Temporal backtest for the Elo-conditioned Poisson model + calibration.

Strict three-way time split (never random k-fold), to avoid leakage:

  train  [.. cutoff)        -> fit the Poisson goal model
  calib  [cutoff .. calib)  -> fit the isotonic calibrator
  test   [calib .. end)     -> evaluate raw AND calibrated probabilities

Reports log-loss, Brier and Ranked Probability Score (RPS) against a no-skill
climatology baseline. The acceptance gate: the model must beat the baseline on
log-loss. We also report whether calibration improves log-loss on the test set.
"""
from __future__ import annotations
import os
import sys
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from elo import load_results, compute_elo  # noqa: E402
from models import poisson  # noqa: E402
from calibrate import IsotonicCalibrator, reliability_bins  # noqa: E402

EPS = 1e-15


def onehot(df: pd.DataFrame) -> np.ndarray:
    h, a = df["home_score"].values, df["away_score"].values
    return np.column_stack([(h > a).astype(int), (h == a).astype(int), (h < a).astype(int)])


def predict_probs(params, df: pd.DataFrame) -> np.ndarray:
    out = np.empty((len(df), 3))
    for i, row in enumerate(df.itertuples(index=False)):
        m = poisson.scoreline_matrix(
            *poisson.lambdas(params, row.home_elo, row.away_elo, row.neutral))
        out[i] = poisson.outcome_probs(m)
    return out


def log_loss(probs, obs):
    return float(-np.mean(np.sum(obs * np.log(np.clip(probs, EPS, 1)), axis=1)))


def brier(probs, obs):
    return float(np.mean(np.sum((probs - obs) ** 2, axis=1)))


def rps(probs, obs):
    cp, co = np.cumsum(probs, axis=1), np.cumsum(obs, axis=1)
    return float(np.mean(np.sum((cp[:, :-1] - co[:, :-1]) ** 2, axis=1)))


def accuracy(probs, obs):
    return float(np.mean(np.argmax(probs, axis=1) == np.argmax(obs, axis=1)))


def recency_weights(dates: pd.Series, cutoff: pd.Timestamp, half_life_days=730) -> np.ndarray:
    age = (cutoff - dates).dt.days.clip(lower=0).values
    return 0.5 ** (age / half_life_days)


def _metrics(probs, obs):
    return {
        "logloss": round(log_loss(probs, obs), 4),
        "brier": round(brier(probs, obs), 4),
        "rps": round(rps(probs, obs), 4),
        "accuracy": round(accuracy(probs, obs), 4),
    }


def run(train_start="2002-01-01", cutoff="2016-06-01",
        calib_cutoff="2020-06-01", test_end="2025-06-01") -> dict:
    df = load_results(until=test_end)
    df, _ = compute_elo(df)
    ts = pd.to_datetime

    train = df[(df["date"] >= train_start) & (df["date"] < ts(cutoff))].copy()
    calib = df[(df["date"] >= ts(cutoff)) & (df["date"] < ts(calib_cutoff))].copy()
    test = df[df["date"] >= ts(calib_cutoff)].copy()

    params = poisson.fit(train, weights=recency_weights(train["date"], ts(cutoff)))

    calibrator = IsotonicCalibrator.fit(predict_probs(params, calib), onehot(calib))

    raw = predict_probs(params, test)
    cal = calibrator.transform(raw)
    obs = onehot(test)

    base_rate = onehot(train).mean(axis=0)
    base_probs = np.tile(base_rate, (len(test), 1))

    result = {
        "trainMatches": int(len(train)),
        "calibMatches": int(len(calib)),
        "testMatches": int(len(test)),
        "cutoff": cutoff, "calibCutoff": calib_cutoff,
        "params": params.to_dict(),
        "calibrator": calibrator.to_dict(),
        "model": _metrics(raw, obs),
        "calibrated": _metrics(cal, obs),
        "baseline": _metrics(base_probs, obs),
        "reliabilityRaw": reliability_bins(raw, obs),
        "reliabilityCalibrated": reliability_bins(cal, obs),
    }
    result["beatsBaseline"] = result["model"]["logloss"] < result["baseline"]["logloss"]
    result["calibrationHelps"] = result["calibrated"]["logloss"] <= result["model"]["logloss"]
    return result


if __name__ == "__main__":
    import json
    r = run()
    summary = {k: r[k] for k in ("trainMatches", "calibMatches", "testMatches",
                                 "model", "calibrated", "baseline",
                                 "beatsBaseline", "calibrationHelps")}
    print(json.dumps(summary, indent=2))
    print("\nGATE:", "PASS ✅" if r["beatsBaseline"] else "FAIL ❌",
          "| calibration improves log-loss:",
          "yes" if r["calibrationHelps"] else "no")
