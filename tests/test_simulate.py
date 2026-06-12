"""Full-tournament simulation tests. Run: python3 tests/test_simulate.py

Covers determinism (fixed seed), probability validity, round monotonicity
(reaching a later round is never more likely than an earlier one), and the
champion-odds normalisation (exactly one champion => sums to ~1).
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml"))
from models import poisson  # noqa: E402
import simulate as sim  # noqa: E402

# Realistic structure: 12 groups of 4 (48 teams) with tiered Elo, matching the
# 32-team knockout the simulator builds. "T00" is the strongest team overall.
LABELS = [chr(ord("A") + i) for i in range(12)]
GROUPS = {lab: [f"T{i:02d}{lab}" for i in range(4)] for lab in LABELS}
_names = [t for g in GROUPS.values() for t in g]
ELO = {name: 2100 - rank * 12 for rank, name in enumerate(sorted(_names))}
STRONGEST = min(ELO, key=lambda k: -ELO[k])
PARAMS = poisson.PoissonParams(a=0.2, b=0.4, g=0.0)
ROUND_ORDER = ["pKO", "pR16", "pQF", "pSF", "pFinal", "pChampion"]
failures = []


def check(name, cond):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if not cond:
        failures.append(name)


def test_determinism():
    a = sim.simulate(GROUPS, ELO, PARAMS, iterations=1000, seed=99)
    b = sim.simulate(GROUPS, ELO, PARAMS, iterations=1000, seed=99)
    check("same seed => identical results", a == b)


def test_probability_validity():
    rows = sim.simulate(GROUPS, ELO, PARAMS, iterations=3000, seed=7)
    ok = all(0 <= r[k] <= 1 for r in rows for k in ROUND_ORDER)
    check("all probabilities in [0,1]", ok)


def test_round_monotonicity():
    rows = sim.simulate(GROUPS, ELO, PARAMS, iterations=3000, seed=7)
    mono = all(
        all(r[ROUND_ORDER[i]] >= r[ROUND_ORDER[i + 1]] - 1e-9 for i in range(len(ROUND_ORDER) - 1))
        for r in rows
    )
    check("reaching later rounds is never more likely", mono)


def test_champion_normalisation():
    rows = sim.simulate(GROUPS, ELO, PARAMS, iterations=4000, seed=3)
    total = sum(r["pChampion"] for r in rows)
    check("champion probabilities sum to ~1", abs(total - 1.0) < 1e-6)


def test_stronger_team_more_likely_champion():
    rows = sim.simulate(GROUPS, ELO, PARAMS, iterations=4000, seed=3)
    champ = max(rows, key=lambda r: r["pChampion"])
    check("strongest team is the favourite", champ["team"] == STRONGEST)


def test_played_results_respected():
    # weakest team in group A is T03A; force it to beat the two strongest in its group
    weak = "T03A"
    others = [t for t in GROUPS["A"] if t != weak]
    strong_two = sorted(others, key=lambda t: -ELO[t])[:2]
    played = {frozenset((weak, s)): (weak, 3, 0) for s in strong_two}

    base = {r["team"]: r for r in sim.simulate(GROUPS, ELO, PARAMS, iterations=4000, seed=5)}
    withres = {r["team"]: r for r in
               sim.simulate(GROUPS, ELO, PARAMS, played=played, iterations=4000, seed=5)}
    check("forced wins raise the weak team's qualification odds",
          withres[weak]["pTop2"] > base[weak]["pTop2"] + 0.1)


if __name__ == "__main__":
    print("Simulation tests:")
    for fn in [test_determinism, test_probability_validity, test_round_monotonicity,
               test_champion_normalisation, test_stronger_team_more_likely_champion,
               test_played_results_respected]:
        fn()
    if failures:
        sys.exit(f"\n{len(failures)} test(s) failed: {failures}")
    print("\nAll simulation tests passed.")
