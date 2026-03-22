"""
SQLite helpers for onboarding workflow run persistence.
Follows the pattern established in etgenai/db/db.py.
"""
from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Optional


_DB_PATH: str | None = None


def _get_db_path() -> str:
    global _DB_PATH
    if _DB_PATH is None:
        from config import DB_PATH
        _DB_PATH = DB_PATH
    return _DB_PATH


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_get_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, "r") as f:
        sql = f.read()
    with _connect() as conn:
        conn.executescript(sql)
    print("[DB] Onboarding schema initialised.")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Runs ──────────────────────────────────────────────────────────

def create_run(run_id: str, input_payload: dict) -> None:
    with _connect() as conn:
        conn.execute(
            """INSERT INTO workflow_runs (run_id, workflow_type, status, input_json, started_at)
               VALUES (?, 'onboarding', 'running', ?, ?)""",
            (run_id, json.dumps(input_payload, default=str), now_iso()),
        )


def update_run(
    run_id: str,
    *,
    status: str,
    output: dict | None = None,
    error_message: str | None = None,
) -> None:
    completed_at = now_iso() if status in ("completed", "recovered", "failed") else None
    with _connect() as conn:
        conn.execute(
            """UPDATE workflow_runs
               SET status=?, output_json=?, completed_at=?, error_message=?
               WHERE run_id=?""",
            (
                status,
                json.dumps(output, default=str) if output else None,
                completed_at,
                error_message,
                run_id,
            ),
        )


def get_run(run_id: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM workflow_runs WHERE run_id=?", (run_id,)
        ).fetchone()
    return dict(row) if row else None


def list_runs(limit: int = 50) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT run_id, workflow_type, status, started_at, completed_at, error_message "
            "FROM workflow_runs ORDER BY started_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


# ── Event logs ────────────────────────────────────────────────────

def append_log(
    run_id: str,
    *,
    step: str = "",
    agent: str = "",
    decision: str = "",
    reason: str = "",
    meta: dict[str, Any] | None = None,
) -> None:
    with _connect() as conn:
        conn.execute(
            """INSERT INTO event_logs (run_id, step, agent, decision, reason, meta_json, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                run_id,
                step,
                agent,
                decision,
                reason,
                json.dumps(meta, default=str) if meta else None,
                now_iso(),
            ),
        )


def get_logs(run_id: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM event_logs WHERE run_id=? ORDER BY id ASC", (run_id,)
        ).fetchall()
    results = []
    for r in rows:
        d = dict(r)
        if d.get("meta_json"):
            try:
                d["meta"] = json.loads(d.pop("meta_json"))
            except (json.JSONDecodeError, TypeError):
                d["meta"] = d.pop("meta_json")
        else:
            d.pop("meta_json", None)
            d["meta"] = None
        results.append(d)
    return results


def count_logs(run_id: str) -> int:
    with _connect() as conn:
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM event_logs WHERE run_id=?", (run_id,)
        ).fetchone()
    return row["cnt"] if row else 0
