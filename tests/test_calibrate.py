"""Calibration tests. Run: python3 tests/test_calibrate.py

Covers: calibrated probabilities are valid (sum to 1, in range), serialisation
round-trips, calibration improves a deliberately mis-calibrated input, and the
reliability binning is well-formed.
"""
import os
import sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml"))
from calibrate import IsotonicCalibrator, reliability_bins  # noqa: E402

rng = np.random.default_rng(0)
failures = []


def check(name, cond):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if not cond:
        failures.append(name)


def _miscalibrated(n=4000):
    """Overconfident probabilities: true prob is a shrunk version of predicted."""
    raw = rng.dirichlet([2, 2, 2], size=n)
    # true outcome drawn from a less-extreme distribution than the prediction
    true_p = raw ** 0.6
    true_p /= true_p.sum(axis=1, keepdims=True)
    obs = np.array([np.eye(3)[np.argmax(rng.multinomial(1, p))] for p in true_p])
    return raw, obs


def test_valid_output():
    raw, obs = _miscalibrated()
    cal = IsotonicCalibrator.fit(raw, obs)
    out = cal.transform(raw)
    check("calibrated rows sum to 1", np.allclose(out.sum(axis=1), 1.0))
    check("calibrated values in [0,1]", bool((out >= 0).all() and (out <= 1).all()))


def test_serialisation_roundtrip():
    raw, obs = _miscalibrated()
    cal = IsotonicCalibrator.fit(raw, obs)
    cal2 = IsotonicCalibrator.from_dict(cal.to_dict())
    check("serialise round-trips", np.allclose(cal.transform(raw), cal2.transform(raw)))


def test_calibration_improves_logloss():
    raw, obs = _miscalibrated()
    cal = IsotonicCalibrator.fit(raw, obs).transform(raw)
    ll = lambda p: -np.mean(np.sum(obs * np.log(np.clip(p, 1e-15, 1)), axis=1))
    check("calibration lowers log-loss on mis-calibrated input", ll(cal) < ll(raw))


def test_reliability_bins():
    raw, obs = _miscalibrated()
    bins = reliability_bins(raw, obs)
    ok = all(0 <= b["predicted"] <= 1 and 0 <= b["observed"] <= 1 and b["count"] > 0 for b in bins)
    check("reliability bins well-formed", len(bins) > 0 and ok)


if __name__ == "__main__":
    print("Calibration tests:")
    for fn in [test_valid_output, test_serialisation_roundtrip,
               test_calibration_improves_logloss, test_reliability_bins]:
        fn()
    if failures:
        sys.exit(f"\n{len(failures)} test(s) failed: {failures}")
    print("\nAll calibration tests passed.")
