"""World-Football-style Elo ratings computed in a single chronological pass.

The pass records each match's PRE-match ratings before applying the update, so
the resulting columns are leakage-free and can be used directly as features for
backtesting. The final ratings dict is the as-of-today rating for prediction.
"""
from __future__ import annotations
import os
import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS = os.path.join(ROOT, "data", "raw", "results.csv")

BASE_RATING = 1500.0
HOME_ADVANTAGE = 65.0  # Elo points added to the home side when not on neutral ground

# K-factor base weight by tournament importance (substring match, first hit wins).
TOURNAMENT_WEIGHT = [
    ("FIFA World Cup", 60),
    ("Confederations Cup", 45),
    ("UEFA Euro", 50),
    ("Copa América", 50),
    ("African Cup of Nations", 45),
    ("AFC Asian Cup", 45),
    ("Gold Cup", 40),
    ("qualification", 40),
    ("Nations League", 40),
    ("Friendly", 20),
]
DEFAULT_WEIGHT = 30


def _k_base(tournament: str) -> float:
    for key, w in TOURNAMENT_WEIGHT:
        if key.lower() in tournament.lower():
            return w
    return DEFAULT_WEIGHT


def _goal_multiplier(margin: int) -> float:
    if margin <= 1:
        return 1.0
    if margin == 2:
        return 1.5
    return (11 + margin) / 8.0


def _expected(rating_a: float, rating_b: float) -> float:
    return 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / 400.0))


def load_results(until: str | None = None) -> pd.DataFrame:
    df = pd.read_csv(RESULTS)
    df = df[df["home_score"].notna() & df["away_score"].notna()].copy()
    df["date"] = pd.to_datetime(df["date"])
    if until is not None:
        df = df[df["date"] < pd.to_datetime(until)]
    df["home_score"] = df["home_score"].astype(int)
    df["away_score"] = df["away_score"].astype(int)
    df["neutral"] = df["neutral"].astype(str).str.upper() == "TRUE"
    return df.sort_values("date").reset_index(drop=True)


def compute_elo(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, float]]:
    """Returns (df augmented with pre-match elo columns, final ratings dict)."""
    ratings: dict[str, float] = {}
    home_elo = np.empty(len(df))
    away_elo = np.empty(len(df))

    for i, row in enumerate(df.itertuples(index=False)):
        h, a = row.home_team, row.away_team
        rh = ratings.get(h, BASE_RATING)
        ra = ratings.get(a, BASE_RATING)
        home_elo[i] = rh
        away_elo[i] = ra

        ha = 0.0 if row.neutral else HOME_ADVANTAGE
        we_home = _expected(rh + ha, ra)
        if row.home_score > row.away_score:
            w_home = 1.0
        elif row.home_score < row.away_score:
            w_home = 0.0
        else:
            w_home = 0.5

        margin = abs(row.home_score - row.away_score)
        k = _k_base(row.tournament) * _goal_multiplier(margin)
        delta = k * (w_home - we_home)
        ratings[h] = rh + delta
        ratings[a] = ra - delta

    df = df.copy()
    df["home_elo"] = home_elo
    df["away_elo"] = away_elo
    return df, ratings


if __name__ == "__main__":
    df = load_results()
    df, ratings = compute_elo(df)
    top = sorted(ratings.items(), key=lambda kv: -kv[1])[:20]
    print("Top 20 by Elo (as of latest result):")
    for name, r in top:
        print(f"  {r:7.1f}  {name}")
