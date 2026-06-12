#!/usr/bin/env python3
"""Build canonical WC2026 seed JSON from the open international-results dataset.

Reads:
  data/raw/results.csv          (martj42/international_results — includes WC2026 fixtures)
  data/seed/venues_meta.json    (hand-authored confirmed host-venue metadata)
  data/seed/teams_meta.json     (team confederation / home-base metadata)

Writes (all consumed by prisma/seed.ts):
  data/seed/tournament.json
  data/seed/venues.json
  data/seed/teams.json
  data/seed/groups.json
  data/seed/fixtures.json       (72 real group fixtures + generated knockout skeleton)

The group-stage fixtures, teams, groups and venues are REAL (from the official
draw, as tracked by the dataset). The knockout bracket is a structural skeleton
with placeholder slots — actual knockout participants come from simulation.
"""
import csv
import json
import os
from collections import defaultdict
from datetime import datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "data", "raw", "results.csv")
SEED = os.path.join(ROOT, "data", "seed")


def load_meta(name):
    with open(os.path.join(SEED, name)) as f:
        data = json.load(f)
    data.pop("_comment", None)
    return data


def main():
    venues_meta = load_meta("venues_meta.json")
    teams_meta = load_meta("teams_meta.json")

    with open(RAW) as f:
        rows = [
            r for r in csv.DictReader(f)
            if r["date"] >= "2026-06-01" and r["tournament"] == "FIFA World Cup"
        ]
    if not rows:
        raise SystemExit("No WC2026 fixtures found in results.csv — check the dataset.")

    # --- derive groups via connected components over group-stage opponents ---
    adj = defaultdict(set)
    for r in rows:
        adj[r["home_team"]].add(r["away_team"])
        adj[r["away_team"]].add(r["home_team"])

    seen, comps = set(), []
    for t in adj:
        if t in seen:
            continue
        stack, comp = [t], []
        while stack:
            x = stack.pop()
            if x in seen:
                continue
            seen.add(x)
            comp.append(x)
            stack.extend(adj[x] - seen)
        comps.append(frozenset(comp))

    # --- authoritative group labels (official FIFA schedule) ---
    official = load_meta("official_groups.json")
    group_of = {}
    groups = []
    for label in sorted(official):
        members = sorted(official[label])
        groups.append({"label": label, "teams": members})
        for t in members:
            group_of[t] = label

    # validate: the official groupings must match the fixtures (who plays whom)
    official_sets = {frozenset(v) for v in official.values()}
    derived_sets = set(comps)
    if official_sets != derived_sets:
        missing = derived_sets - official_sets
        extra = official_sets - derived_sets
        raise SystemExit(
            "Official groups do not match the fixture-derived groupings.\n"
            f"  In fixtures but not official: {missing}\n"
            f"  In official but not fixtures: {extra}\n"
            "Check team names in data/seed/official_groups.json.")
    if set(group_of) != {t for c in comps for t in c}:
        raise SystemExit("official_groups.json team set differs from the fixtures.")

    # --- venues ---
    venues = []
    for city, meta in venues_meta.items():
        venues.append({"city": city, **meta})

    # --- teams ---
    teams = []
    for name in sorted(group_of):
        m = teams_meta.get(name, {})
        teams.append({
            "name": name,
            "fifaCode": m.get("code"),
            "confederation": m.get("conf"),
            "isHost": bool(m.get("host", False)),
            "homeLat": m.get("lat"),
            "homeLng": m.get("lng"),
            "homeAltitude": m.get("alt"),
            "group": group_of[name],
        })

    # --- group-stage fixtures (real) ---
    fixtures = []
    no = 1
    for r in sorted(rows, key=lambda x: (x["date"], x["city"])):
        fixtures.append({
            "matchNo": no,
            "stage": "GROUP",
            "group": group_of[r["home_team"]],
            "homeTeam": r["home_team"],
            "awayTeam": r["away_team"],
            "city": r["city"],
            "kickoff": r["date"] + "T18:00:00.000Z",
            "neutral": r["neutral"].upper() == "TRUE",
        })
        no += 1

    # --- knockout skeleton (structural; participants resolved by simulation) ---
    last_group = max(f["kickoff"] for f in fixtures)[:10]
    base = datetime.fromisoformat(last_group)
    ko_cities = list(venues_meta.keys())
    stages = [("R32", 16, 4), ("R16", 8, 8), ("QF", 4, 12), ("SF", 2, 16),
              ("THIRD", 1, 18), ("FINAL", 1, 19)]
    for stage, count, day_offset in stages:
        for i in range(count):
            kickoff = (base + timedelta(days=day_offset)).strftime("%Y-%m-%dT18:00:00.000Z")
            fixtures.append({
                "matchNo": no,
                "stage": stage,
                "group": None,
                "homeTeam": None,
                "awayTeam": None,
                "city": ko_cities[no % len(ko_cities)],
                "kickoff": kickoff,
                "neutral": True,
                "slot": f"{stage}-{i + 1}",
            })
            no += 1

    tournament = {
        "name": "FIFA World Cup 2026",
        "year": 2026,
        "hostCountries": "United States,Canada,Mexico",
        "format": "48 teams, 12 groups of 4, Round of 32 knockout",
        "startDate": min(f["kickoff"] for f in fixtures),
        "endDate": max(f["kickoff"] for f in fixtures),
    }

    out = {
        "tournament.json": tournament,
        "venues.json": venues,
        "teams.json": teams,
        "groups.json": groups,
        "fixtures.json": fixtures,
    }
    for fn, data in out.items():
        with open(os.path.join(SEED, fn), "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Seed built: {len(teams)} teams, {len(groups)} groups, "
          f"{len(venues)} venues, {len(fixtures)} fixtures "
          f"({sum(1 for x in fixtures if x['stage'] == 'GROUP')} group + "
          f"{sum(1 for x in fixtures if x['stage'] != 'GROUP')} knockout).")


if __name__ == "__main__":
    main()
