"""Temporal backtest for the Elo-conditioned Poisson model.

Strict time split (train on the past, test on the future) — never random k-fold,
to avoid leakage. Reports log-loss, Brier and Ranked Probability Score (RPS) and
compares against a no-skill climatology baseline (the historical base rates).
The acceptance gate: the model must beat the baseline on log-loss.
"""
from __future__ import annotations
import os
import sys
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from elo import load_results, compute_elo  # noqa: E402
from models import poisson  # noqa: E402

EPS = 1e-15


def _onehot(home_score, away_score) -> np.ndarray:
    if home_score > away_score:
        return np.array([1, 0, 0])
    if home_score == away_score:
        return np.array([0, 1, 0])
    return np.array([0, 0, 1])


def log_loss(probs: np.ndarray, obs: np.ndarray) -> float:
    p = np.clip(probs, EPS, 1)
    return float(-np.mean(np.sum(obs * np.log(p), axis=1)))


def brier(probs: np.ndarray, obs: np.ndarray) -> float:
    return float(np.mean(np.sum((probs - obs) ** 2, axis=1)))


def rps(probs: np.ndarray, obs: np.ndarray) -> float:
    cp = np.cumsum(probs, axis=1)
    co = np.cumsum(obs, axis=1)
    return float(np.mean(np.sum((cp[:, :-1] - co[:, :-1]) ** 2, axis=1)))


def accuracy(probs: np.ndarray, obs: np.ndarray) -> float:
    return float(np.mean(np.argmax(probs, axis=1) == np.argmax(obs, axis=1)))


def recency_weights(dates: pd.Series, cutoff: pd.Timestamp, half_life_days=730) -> np.ndarray:
    age = (cutoff - dates).dt.days.clip(lower=0).values
    return 0.5 ** (age / half_life_days)


def run(train_start="2002-01-01", cutoff="2018-06-01", test_end="2025-06-01") -> dict:
    df = load_results(until=test_end)
    df, _ = compute_elo(df)

    cutoff_ts = pd.to_datetime(cutoff)
    train = df[(df["date"] >= train_start) & (df["date"] < cutoff_ts)].copy()
    test = df[(df["date"] >= cutoff_ts)].copy()

    w = recency_weights(train["date"], cutoff_ts)
    params = poisson.fit(train, weights=w)

    # model predictions on the test set
    probs, obs = [], []
    for row in test.itertuples(index=False):
        m = poisson.scoreline_matrix(
            *poisson.lambdas(params, row.home_elo, row.away_elo, row.neutral)
        )
        probs.append(poisson.outcome_probs(m))
        obs.append(_onehot(row.home_score, row.away_score))
    probs = np.array(probs)
    obs = np.array(obs)

    # no-skill baseline: historical base rates from the training set
    base = train.apply(lambda r: _onehot(r.home_score, r.away_score), axis=1)
    base_rate = np.mean(np.vstack(base.values), axis=0)
    base_probs = np.tile(base_rate, (len(test), 1))

    result = {
        "trainMatches": int(len(train)),
        "testMatches": int(len(test)),
        "cutoff": cutoff,
        "params": params.to_dict(),
        "model": {
            "logloss": round(log_loss(probs, obs), 4),
            "brier": round(brier(probs, obs), 4),
            "rps": round(rps(probs, obs), 4),
            "accuracy": round(accuracy(probs, obs), 4),
        },
        "baseline": {
            "logloss": round(log_loss(base_probs, obs), 4),
            "brier": round(brier(base_probs, obs), 4),
            "rps": round(rps(base_probs, obs), 4),
            "accuracy": round(accuracy(base_probs, obs), 4),
        },
    }
    result["beatsBaseline"] = result["model"]["logloss"] < result["baseline"]["logloss"]
    return result


if __name__ == "__main__":
    import json
    r = run()
    print(json.dumps({k: v for k, v in r.items() if k != "params"}, indent=2))
    print("\nGATE:", "PASS ✅" if r["beatsBaseline"] else "FAIL ❌",
          "(model must beat baseline log-loss)")
