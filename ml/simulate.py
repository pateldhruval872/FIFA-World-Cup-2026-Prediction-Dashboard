"""Full-tournament Monte Carlo: group stage + knockout -> champion odds.

Single source of truth for both the group simulator and the knockout pages. One
seeded run produces, per team:

  group:    pFirst, pTop2, expected points, expected goal difference
  knockout: probability of reaching each round and of winning the tournament

Match scorelines are sampled from the active model's Poisson rates (Elo-driven,
neutral venues). The knockout bracket is strength-seeded (group winners, then
runners-up, then the eight best third-placed teams, ordered by Elo) into a
standard 32-slot single-elimination bracket. This is a representative seeding,
not FIFA's exact best-third slot table — champion odds are dominated by team
strength and are robust to that simplification.

Run: python3 ml/simulate.py   (writes a SimulationRun row, scope=FULL)
"""
from __future__ import annotations
import json
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models import poisson  # noqa: E402
import db  # noqa: E402

ITERATIONS = 20000
SEED = 2026
ROUNDS = ["pKO", "pR16", "pQF", "pSF", "pFinal", "pChampion"]


def bracket_order(n: int) -> list[int]:
    """Standard single-elimination seeding order (1 vs n, 2 vs n-1, …)."""
    order = [1, 2]
    while len(order) < n:
        m = len(order) * 2
        order = [x for s in order for x in (s, m + 1 - s)]
    return order


def play(elo_a, elo_b, params, rng) -> int:
    """Return 0 if A wins, 1 if B wins (knockout: a winner is forced)."""
    lam_a, lam_b = poisson.lambdas(params, elo_a, elo_b, neutral=True)
    ga, gb = rng.poisson(lam_a), rng.poisson(lam_b)
    if ga > gb:
        return 0
    if gb > ga:
        return 1
    # penalties: weight by the model's non-draw win share
    pa = lam_a / (lam_a + lam_b)
    return 0 if rng.random() < pa else 1


def simulate(groups, elo, params, played=None, iterations=ITERATIONS, seed=SEED):
    """Tournament-aware Monte Carlo.

    `played` is { frozenset({home, away}): (homeName, homeScore, awayScore) } for
    group matches that have actually been played; those use the real score every
    iteration, while remaining matches are sampled from the model.
    """
    played = played or {}
    rng = np.random.default_rng(seed)
    teams = [t for g in groups.values() for t in g]
    n = len(teams)

    # accumulators
    first = {t: 0 for t in teams}
    top2 = {t: 0 for t in teams}
    pts_sum = {t: 0.0 for t in teams}
    gd_sum = {t: 0.0 for t in teams}
    reach = {t: {r: 0 for r in ROUNDS} for t in teams}

    group_labels = list(groups.keys())
    seed_slots = bracket_order(32)

    for _ in range(iterations):
        winners, runners, thirds = [], [], []
        for label in group_labels:
            gteams = groups[label]
            pts = {t: 0 for t in gteams}
            gd = {t: 0 for t in gteams}
            gf = {t: 0 for t in gteams}
            for i in range(len(gteams)):
                for j in range(i + 1, len(gteams)):
                    a, b = gteams[i], gteams[j]
                    actual = played.get(frozenset((a, b)))
                    if actual is not None:
                        home_name, hs, as_ = actual
                        sa, sb = (hs, as_) if home_name == a else (as_, hs)
                    else:
                        la, lb = poisson.lambdas(params, elo[a], elo[b], neutral=True)
                        sa, sb = rng.poisson(la), rng.poisson(lb)
                    gd[a] += sa - sb
                    gd[b] += sb - sa
                    gf[a] += sa
                    gf[b] += sb
                    if sa > sb:
                        pts[a] += 3
                    elif sb > sa:
                        pts[b] += 3
                    else:
                        pts[a] += 1
                        pts[b] += 1
            ranked = sorted(
                gteams,
                key=lambda t: (pts[t], gd[t], gf[t], rng.random()),
                reverse=True,
            )
            for t in gteams:
                pts_sum[t] += pts[t]
                gd_sum[t] += gd[t]
            first[ranked[0]] += 1
            top2[ranked[0]] += 1
            top2[ranked[1]] += 1
            winners.append(ranked[0])
            runners.append(ranked[1])
            thirds.append((ranked[2], pts[ranked[2]], gd[ranked[2]], gf[ranked[2]]))

        best_thirds = [t[0] for t in sorted(
            thirds, key=lambda x: (x[1], x[2], x[3], rng.random()), reverse=True)[:8]]

        qualifiers = winners + runners + best_thirds
        for t in qualifiers:
            reach[t]["pKO"] += 1

        # strength seed: winners, then runners, then thirds; Elo within tier
        tier = {t: 0 for t in winners}
        tier.update({t: 1 for t in runners})
        tier.update({t: 2 for t in best_thirds})
        ranking = sorted(qualifiers, key=lambda t: (tier[t], -elo[t]))
        slot_to_team = {slot: ranking[i] for i, slot in enumerate(seed_slots)}
        bracket = [slot_to_team[s] for s in range(1, 33)]

        # knockout rounds
        round_keys = ["pR16", "pQF", "pSF", "pFinal", "pChampion"]
        survivors = bracket
        for rk in round_keys:
            nxt = []
            for i in range(0, len(survivors), 2):
                a, b = survivors[i], survivors[i + 1]
                w = a if play(elo[a], elo[b], params, rng) == 0 else b
                reach[w][rk] += 1
                nxt.append(w)
            survivors = nxt

    out = []
    for t in teams:
        row = {"team": t, "elo": round(elo[t], 1),
               "pFirst": first[t] / iterations, "pTop2": top2[t] / iterations,
               "expPoints": round(pts_sum[t] / iterations, 2),
               "expGoalDiff": round(gd_sum[t] / iterations, 2)}
        for r in ROUNDS:
            row[r] = reach[t][r] / iterations
        out.append(row)
    out.sort(key=lambda r: r["pChampion"], reverse=True)
    return out


def main():
    conn = db.connect()
    model = db.fetch_active_model(conn)
    if not model:
        sys.exit("No active model — run ml/predict.py first.")
    params = poisson.PoissonParams.from_dict(json.loads(model["metrics"])["params"])
    elo = db.fetch_team_elo(conn)
    groups = db.fetch_groups(conn)
    played = db.fetch_played_group_results(conn)

    note = f" ({len(played)} group matches played)" if played else " (pre-tournament)"
    print(f"Simulating {ITERATIONS:,} tournaments (seed {SEED}){note}…")
    rows = simulate(groups, elo, params, played=played)

    results = {
        "seed": SEED, "iterations": ITERATIONS, "playedGroupMatches": len(played),
        "groups": {g: [r["team"] for r in rows if r["team"] in groups[g]]
                   for g in groups},
        "teams": rows,
    }
    db.replace_simulation_run(conn, model["id"], SEED, ITERATIONS, "FULL",
                              json.dumps(results))
    conn.commit()
    conn.close()

    print("\nTop 10 title favourites:")
    for r in rows[:10]:
        print(f"  {r['pChampion']*100:5.1f}%  {r['team']:<16} "
              f"(reach final {r['pFinal']*100:4.1f}%, Elo {r['elo']:.0f})")


if __name__ == "__main__":
    main()
