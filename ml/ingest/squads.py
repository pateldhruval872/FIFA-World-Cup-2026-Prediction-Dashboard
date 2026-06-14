#!/usr/bin/env python3
"""Ingest squad rosters + player-impact metrics into the database.

Loads and MERGES one or more squad JSON files ({ teamName: [ {name, position,
club, impact}, ... ] }) and writes Player, SquadEntry, and PlayerMetric(impact)
rows. By default it merges the illustrative sample squads with any confirmed
starting line-ups, with later files overriding earlier ones per team. Re-runnable:
clears prior squad/player rows first. After ingesting, re-run ml/predict.py so
player availability flows into the predictions.

Usage:
    python3 ml/ingest/squads.py [file1.json file2.json ...]
    (defaults to squads_sample.json + lineups.json)
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SEED = os.path.join(ROOT, "data", "seed")
DEFAULTS = [os.path.join(SEED, "squads_sample.json"), os.path.join(SEED, "lineups.json")]


def load_merged(paths):
    merged, sources = {}, []
    for p in paths:
        if not os.path.exists(p):
            continue
        with open(p) as f:
            data = json.load(f)
        data.pop("_comment", None)
        merged.update(data)  # later files override per team
        sources.append(os.path.basename(p))
    return merged, sources


def main(paths=None):
    paths = paths or DEFAULTS
    data, sources = load_merged(paths)

    conn = db.connect()
    tid = db.tournament_id(conn)
    if not tid:
        sys.exit("No tournament — run the seed first.")
    team_ids = db.team_id_by_name(conn)

    db.clear_squads(conn)
    players = 0
    for team_name, roster in data.items():
        team_id = team_ids.get(team_name)
        if not team_id:
            print(f"  skip unknown team: {team_name}")
            continue
        for pl in roster:
            db.insert_squad_player(conn, tid, team_id, pl["name"], pl.get("position"),
                                   pl.get("club"), pl.get("impact", 0))
            players += 1

    db.log_data_source(conn, "+".join(sources), "success", players, 0, None)
    conn.commit()
    conn.close()
    print(f"Ingested {players} players across {len(data)} teams "
          f"from {', '.join(sources)}. Re-run ml/predict.py to apply.")


if __name__ == "__main__":
    main(sys.argv[1:] or None)
