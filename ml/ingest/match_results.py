#!/usr/bin/env python3
"""Ingest actual WC2026 results into the database.

Reads the source dataset, finds World Cup 2026 group-stage matches that now have
real scores (no longer NA), and marks the corresponding Match rows as PLAYED with
those scores. This makes the dashboard tournament-aware: played games use real
outcomes, while the simulator only projects the matches that remain.

Group-stage matches are matched by their (home, away) team pairing, which is
unique within the tournament. Knockout results are not ingested here because the
bracket participants are resolved by simulation, not fixed in advance.

Usage:
    python3 ml/ingest/match_results.py
"""
import csv
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RESULTS = os.path.join(ROOT, "data", "raw", "results.csv")


def main():
    if not os.path.exists(RESULTS):
        sys.exit("data/raw/results.csv not found — fetch the dataset first.")

    with open(RESULTS) as f:
        rows = [
            r for r in csv.DictReader(f)
            if r["date"] >= "2026-06-01" and r["tournament"] == "FIFA World Cup"
            and r["home_score"] not in ("", "NA") and r["away_score"] not in ("", "NA")
        ]

    conn = db.connect()
    pairs = {frozenset((r["home"], r["away"])): r["id"]
             for r in db.fetch_group_team_pairs(conn)}

    updated = skipped = 0
    for r in rows:
        key = frozenset((r["home_team"], r["away_team"]))
        match_id = pairs.get(key)
        if not match_id:
            skipped += 1
            continue
        db.set_match_result(conn, match_id, int(r["home_score"]), int(r["away_score"]))
        updated += 1

    db.log_data_source(conn, "wc2026_results", "success", updated, skipped, None)
    conn.commit()
    conn.close()
    print(f"Ingested {updated} played group matches "
          f"({skipped} dataset rows had no matching group fixture).")
    if updated:
        print("Re-run ml/predict.py and ml/simulate.py to refresh projections.")


if __name__ == "__main__":
    main()
