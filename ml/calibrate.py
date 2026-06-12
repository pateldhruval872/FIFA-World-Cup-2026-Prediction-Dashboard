"""Probability calibration for the 3-way (home/draw/away) outcome.

A stated 70% should be right ~70% of the time. We fit one isotonic regression per
class (one-vs-rest) on a held-out window, then renormalise so the three calibrated
probabilities sum to 1.

The fitted calibrator serialises to plain breakpoints (x/y thresholds) rather than
a pickled sklearn object, so it is portable, inspectable, and applied at predict
time with a simple piecewise-linear interpolation.
"""
from __future__ import annotations
from dataclasses import dataclass
import numpy as np
from sklearn.isotonic import IsotonicRegression

CLASSES = ["home", "draw", "away"]
EPS = 1e-9


@dataclass
class IsotonicCalibrator:
    # one {x:[...], y:[...]} mapping per class
    maps: list[dict]

    @staticmethod
    def fit(probs: np.ndarray, onehot: np.ndarray) -> "IsotonicCalibrator":
        maps = []
        for c in range(3):
            ir = IsotonicRegression(y_min=0.0, y_max=1.0, out_of_bounds="clip")
            ir.fit(probs[:, c], onehot[:, c])
            maps.append({
                "x": [float(v) for v in ir.X_thresholds_],
                "y": [float(v) for v in ir.y_thresholds_],
            })
        return IsotonicCalibrator(maps)

    def transform(self, probs: np.ndarray) -> np.ndarray:
        probs = np.atleast_2d(probs)
        out = np.empty_like(probs, dtype=float)
        for c in range(3):
            m = self.maps[c]
            out[:, c] = np.interp(probs[:, c], m["x"], m["y"])
        out = np.clip(out, EPS, None)
        out /= out.sum(axis=1, keepdims=True)
        return out

    def transform_one(self, p_home, p_draw, p_away) -> tuple[float, float, float]:
        r = self.transform(np.array([[p_home, p_draw, p_away]]))[0]
        return float(r[0]), float(r[1]), float(r[2])

    def to_dict(self) -> dict:
        return {"classes": CLASSES, "maps": self.maps}

    @staticmethod
    def from_dict(d: dict) -> "IsotonicCalibrator":
        return IsotonicCalibrator(d["maps"])


def reliability_bins(probs: np.ndarray, onehot: np.ndarray, n_bins=10) -> list[dict]:
    """Binned predicted-vs-observed for the home-win class (reliability diagram)."""
    p = probs[:, 0]
    y = onehot[:, 0]
    edges = np.linspace(0, 1, n_bins + 1)
    bins = []
    for i in range(n_bins):
        lo, hi = edges[i], edges[i + 1]
        mask = (p >= lo) & (p < hi) if i < n_bins - 1 else (p >= lo) & (p <= hi)
        if mask.sum() == 0:
            continue
        bins.append({
            "predicted": round(float(p[mask].mean()), 4),
            "observed": round(float(y[mask].mean()), 4),
            "count": int(mask.sum()),
        })
    return bins
