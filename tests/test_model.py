"""Model output + invariant tests. Run: python3 tests/test_model.py

Covers: probability validity, scoreline-matrix normalisation, monotonicity
(stronger team => higher win prob), and the leakage-free backtest gate.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml"))
import numpy as np  # noqa: E402
from models import poisson  # noqa: E402
import backtest as bt  # noqa: E402
from elo import load_results, compute_elo  # noqa: E402

# Fit the real shipped parameters once so invariant tests reflect production.
_df, _ = compute_elo(load_results())
PARAMS = poisson.fit(_df)
failures = []


def check(name, cond):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if not cond:
        failures.append(name)


def test_probabilities_valid():
    p = poisson.predict(PARAMS, 1900, 1700, neutral=True)
    s = p["pHome"] + p["pDraw"] + p["pAway"]
    check("probabilities sum to 1", abs(s - 1.0) < 1e-6)
    check("probabilities non-negative", all(p[k] >= 0 for k in ("pHome", "pDraw", "pAway")))
    check("expected goals positive", p["expGoalsHome"] > 0 and p["expGoalsAway"] > 0)


def test_scoreline_matrix():
    m = poisson.scoreline_matrix(1.5, 1.1)
    check("scoreline matrix normalised", abs(m.sum() - 1.0) < 1e-9)
    check("scoreline matrix non-negative", bool((m >= 0).all()))


def test_monotonic_strength():
    strong = poisson.predict(PARAMS, 2100, 1500, neutral=True)
    weak = poisson.predict(PARAMS, 1600, 1500, neutral=True)
    check("higher Elo => higher win prob", strong["pHome"] > weak["pHome"])


def test_symmetry_on_equal_teams():
    p = poisson.predict(PARAMS, 1800, 1800, neutral=True)
    check("equal teams => near-symmetric W/L", abs(p["pHome"] - p["pAway"]) < 0.05)


def test_backtest_gate():
    r = bt.run()
    check("backtest beats baseline log-loss", r["beatsBaseline"])
    check("backtest accuracy > 0.5", r["model"]["accuracy"] > 0.5)


if __name__ == "__main__":
    print("Model tests:")
    for fn in [test_probabilities_valid, test_scoreline_matrix, test_monotonic_strength,
               test_symmetry_on_equal_teams, test_backtest_gate]:
        fn()
    if failures:
        sys.exit(f"\n{len(failures)} test(s) failed: {failures}")
    print("\nAll model tests passed.")
