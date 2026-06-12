"""Elo-conditioned, neutral-aware Poisson goal model.

A single pooled rate equation models the goals a team scores against an opponent:

    λ_team = exp(a + b * (elo_self - elo_opp) / 100 + g * home_field)

where home_field is 1 only when that team plays on home soil (never at a neutral
venue). Because there is ONE intercept shared by both teams, two equally-rated
sides at a neutral venue get identical scoring rates — symmetric by construction,
which is the correct behaviour for World Cup matches.

Parameters (a, b, g) are fit by Poisson regression on historical matches in long
format (two rows per match) using PRE-match Elo (leakage-free). From the two
rates we build an independent-Poisson scoreline matrix and derive win/draw/loss
probabilities, expected goals, and the most likely scorelines.
"""
from __future__ import annotations
from dataclasses import dataclass
import numpy as np
from scipy.stats import poisson
from sklearn.linear_model import PoissonRegressor

MAX_GOALS = 10


@dataclass
class PoissonParams:
    a: float  # base scoring rate (log)
    b: float  # Elo-difference coefficient
    g: float  # home-field coefficient (applied only on home soil)

    def to_dict(self) -> dict:
        return {"a": self.a, "b": self.b, "g": self.g}

    @staticmethod
    def from_dict(d: dict) -> "PoissonParams":
        return PoissonParams(d["a"], d["b"], d["g"])


def _long_design(df):
    """Two rows per match (home perspective, away perspective)."""
    eh = df["home_elo"].values.astype(float)
    ea = df["away_elo"].values.astype(float)
    on_home_soil = (~df["neutral"].values.astype(bool)).astype(float)

    # home perspective: scores home_score, has home field when not neutral
    d_home = (eh - ea) / 100.0
    # away perspective: scores away_score, never has home field
    d_away = (ea - eh) / 100.0

    X = np.vstack([
        np.column_stack([d_home, on_home_soil]),
        np.column_stack([d_away, np.zeros_like(d_away)]),
    ])
    y = np.concatenate([df["home_score"].values, df["away_score"].values])
    return X, y


def fit(df, weights=None) -> PoissonParams:
    """Fit on a DataFrame with home_elo, away_elo, neutral, home_score, away_score."""
    X, y = _long_design(df)
    w = np.concatenate([weights, weights]) if weights is not None else None
    m = PoissonRegressor(alpha=1e-6, max_iter=1000)
    m.fit(X, y, sample_weight=w)
    return PoissonParams(a=float(m.intercept_), b=float(m.coef_[0]), g=float(m.coef_[1]))


def lambdas(params: PoissonParams, home_elo, away_elo, neutral) -> tuple[float, float]:
    d = (float(home_elo) - float(away_elo)) / 100.0
    hf = 0.0 if neutral else 1.0
    lam_h = float(np.exp(params.a + params.b * d + params.g * hf))
    lam_a = float(np.exp(params.a - params.b * d))
    return lam_h, lam_a


def scoreline_matrix(lam_h: float, lam_a: float) -> np.ndarray:
    ph = poisson.pmf(np.arange(MAX_GOALS + 1), lam_h)
    pa = poisson.pmf(np.arange(MAX_GOALS + 1), lam_a)
    m = np.outer(ph, pa)
    return m / m.sum()


def outcome_probs(matrix: np.ndarray) -> tuple[float, float, float]:
    p_home = float(np.tril(matrix, -1).sum())
    p_draw = float(np.trace(matrix))
    p_away = float(np.triu(matrix, 1).sum())
    return p_home, p_draw, p_away


def top_scorelines(matrix: np.ndarray, k: int = 5) -> list[dict]:
    idx = np.dstack(np.unravel_index(np.argsort(-matrix, axis=None), matrix.shape))[0]
    out = []
    for h, a in idx[:k]:
        out.append({"score": f"{h}-{a}", "p": round(float(matrix[h, a]), 4)})
    return out


def predict(params: PoissonParams, home_elo, away_elo, neutral) -> dict:
    lam_h, lam_a = lambdas(params, home_elo, away_elo, neutral)
    m = scoreline_matrix(lam_h, lam_a)
    p_home, p_draw, p_away = outcome_probs(m)
    return {
        "pHome": p_home, "pDraw": p_draw, "pAway": p_away,
        "expGoalsHome": round(lam_h, 3), "expGoalsAway": round(lam_a, 3),
        "scorelineDist": top_scorelines(m, 6),
    }
