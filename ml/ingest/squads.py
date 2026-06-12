#!/usr/bin/env python3
"""Ingest squad rosters + player-impact metrics into the database.

Reads a squad JSON ({ teamName: [ {name, position, club, impact}, ... ] }) and
writes Player, SquadEntry, and PlayerMetric(impact) rows. Re-runnable: clears the
prior squad/player rows first. After ingesting, re-run ml/predict.py so player
availability flows into the predictions.

Usage:
    python3 ml/ingest/squads.py [path/to/squads.json]
    (defaults to data/seed/squads_sample.json — illustrative sample data)
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT = os.path.join(ROOT, "data", "seed", "squads_sample.json")


def main(path=DEFAULT):
    with open(path) as f:
        data = json.load(f)
    data.pop("_comment", None)

    conn = db.connect()
    tournament = conn.execute("SELECT id FROM Tournament LIMIT 1").fetchone()
    if not tournament:
        sys.exit("No tournament — run the seed first.")
    tid = tournament["id"]
    team_ids = db.team_id_by_name(conn)

    # clear prior squad data
    conn.execute("DELETE FROM PlayerMetric")
    conn.execute("DELETE FROM SquadEntry")
    conn.execute("DELETE FROM Player")

    players = entries = 0
    for team_name, roster in data.items():
        team_id = team_ids.get(team_name)
        if not team_id:
            print(f"  skip unknown team: {team_name}")
            continue
        for pl in roster:
            pid = db.gen_id()
            conn.execute(
                "INSERT INTO Player (id, name, position, club, nationalTeamId) "
                "VALUES (?,?,?,?,?)",
                (pid, pl["name"], pl.get("position"), pl.get("club"), team_id),
            )
            conn.execute(
                "INSERT INTO SquadEntry (id, tournamentId, teamId, playerId, role, "
                "isAvailable) VALUES (?,?,?,?,?,1)",
                (db.gen_id(), tid, team_id, pid, pl.get("position")),
            )
            conn.execute(
                "INSERT INTO PlayerMetric (id, playerId, date, metricType, value, source) "
                "VALUES (?,?,?,?,?,?)",
                (db.gen_id(), pid, db.now_iso(), "impact", float(pl.get("impact", 0)),
                 "squads_sample"),
            )
            players += 1
            entries += 1

    db.log_data_source(conn, os.path.basename(path), "success", entries, 0, None)
    conn.commit()
    conn.close()
    print(f"Ingested {players} players across {len(data)} teams. "
          "Re-run ml/predict.py to apply availability to predictions.")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else DEFAULT)
