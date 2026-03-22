-- Contract workflow run tracking
CREATE TABLE IF NOT EXISTS workflow_runs (
    run_id          TEXT PRIMARY KEY,
    workflow_type   TEXT NOT NULL DEFAULT 'contract',
    status          TEXT NOT NULL DEFAULT 'pending',   -- pending | running | completed | recovered | failed
    input_json      TEXT,
    output_json     TEXT,
    started_at      TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at    TEXT,
    error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_status        ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_workflow_type  ON workflow_runs(workflow_type);
CREATE INDEX IF NOT EXISTS idx_runs_started_at     ON workflow_runs(started_at);

-- Per-step event / audit log
CREATE TABLE IF NOT EXISTS event_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          TEXT NOT NULL REFERENCES workflow_runs(run_id),
    step            TEXT,
    agent           TEXT,
    decision        TEXT,
    reason          TEXT,
    meta_json       TEXT,
    timestamp       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_logs_run_id ON event_logs(run_id);
