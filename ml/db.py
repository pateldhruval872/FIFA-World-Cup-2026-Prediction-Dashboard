"""Thin SQLite helpers for writing model output back into the Prisma database.

Python and the Next.js app share the same SQLite file (prisma/dev.db). Table and
column names match the Prisma schema exactly. IDs are generated app-side here
with a short random token (Prisma uses cuid; any unique string is acceptable).
"""
from __future__ import annotations
import os
import secrets
import sqlite3
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(ROOT, "prisma", "dev.db")


def gen_id(prefix: str = "c") -> str:
    return prefix + secrets.token_hex(12)


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def deactivate_models(conn):
    conn.execute("UPDATE ModelVersion SET isActive = 0")


def delete_model_version(conn, version):
    """Idempotent re-runs: drop a prior version and everything referencing it."""
    rows = conn.execute("SELECT id FROM ModelVersion WHERE version = ?", (version,)).fetchall()
    for r in rows:
        conn.execute("DELETE FROM Prediction WHERE modelVersionId = ?", (r["id"],))
        conn.execute("DELETE FROM SimulationRun WHERE modelVersionId = ?", (r["id"],))
    conn.execute("DELETE FROM ModelVersion WHERE version = ?", (version,))


def insert_model_version(conn, version, algorithm, train_data_hash, metrics_json) -> str:
    mid = gen_id()
    conn.execute(
        "INSERT INTO ModelVersion (id, version, algorithm, trainedAt, trainDataHash, "
        "metrics, isActive) VALUES (?,?,?,?,?,?,1)",
        (mid, version, algorithm, now_iso(), train_data_hash, metrics_json),
    )
    return mid


def clear_predictions(conn, model_version_id=None):
    if model_version_id:
        conn.execute("DELETE FROM Prediction WHERE modelVersionId = ?", (model_version_id,))
    else:
        conn.execute("DELETE FROM Prediction")


def insert_prediction(conn, match_id, model_version_id, p, exp_h, exp_a,
                      scoreline_json, features_json, key_factors_json, confidence):
    conn.execute(
        "INSERT INTO Prediction (id, matchId, modelVersionId, pHome, pDraw, pAway, "
        "expGoalsHome, expGoalsAway, scorelineDist, featuresSnapshot, keyFactors, "
        "confidence, generatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (gen_id(), match_id, model_version_id, p[0], p[1], p[2], exp_h, exp_a,
         scoreline_json, features_json, key_factors_json, confidence, now_iso()),
    )


def upsert_ranking(conn, team_id, date_iso, elo):
    conn.execute(
        "INSERT INTO Ranking (id, teamId, date, elo, source) VALUES (?,?,?,?,?)",
        (gen_id(), team_id, date_iso, elo, "computed-elo"),
    )


def upsert_team_form(conn, team_id, as_of, last5, gf, ga, atk, df):
    conn.execute(
        "INSERT INTO TeamForm (id, teamId, asOfDate, last5Points, goalsForAvg, "
        "goalsAgainstAvg, attackStrength, defenseStrength) VALUES (?,?,?,?,?,?,?,?)",
        (gen_id(), team_id, as_of, last5, gf, ga, atk, df),
    )


def clear_team_signals(conn):
    conn.execute("DELETE FROM Ranking")
    conn.execute("DELETE FROM TeamForm")


def log_data_source(conn, source, status, ingested, rejected, data_hash, error=None):
    conn.execute(
        "INSERT INTO DataSourceLog (id, source, runAt, status, rowsIngested, "
        "rowsRejected, dataHash, error) VALUES (?,?,?,?,?,?,?,?)",
        (gen_id(), source, now_iso(), status, ingested, rejected, data_hash, error),
    )


def fetch_group_matches(conn):
    return conn.execute(
        "SELECT m.id, m.stage, ht.name AS home, at.name AS away, m.neutral "
        "FROM \"Match\" m "
        "JOIN Team ht ON ht.id = m.homeTeamId "
        "JOIN Team at ON at.id = m.awayTeamId "
        "WHERE m.homeTeamId IS NOT NULL AND m.awayTeamId IS NOT NULL"
    ).fetchall()


def team_id_by_name(conn):
    return {r["name"]: r["id"] for r in conn.execute("SELECT id, name FROM Team")}
