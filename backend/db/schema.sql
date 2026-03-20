-- MeetingMind Database Schema
-- Run this in your Supabase SQL Editor at: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────
-- MEETINGS
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    date DATE,
    attendees TEXT[],
    audio_path TEXT,
    transcript TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- PIPELINE RUNS
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id TEXT PRIMARY KEY,
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    meeting_title TEXT NOT NULL,
    status TEXT DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED')),
    tasks_created INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_seconds FLOAT,
    error_message TEXT
);

-- ─────────────────────────────────────────────────
-- DECISIONS
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    run_id TEXT REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    owner TEXT,
    deadline DATE,
    deadline_note TEXT,
    flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    is_actionable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- TASKS
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    decision_id UUID REFERENCES decisions(id) ON DELETE SET NULL,
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    run_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    owner TEXT,
    deadline DATE,
    priority TEXT DEFAULT 'MEDIUM' CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'AT_RISK', 'OVERDUE', 'DONE', 'BLOCKED')),
    acceptance_criteria TEXT[],
    source_quote TEXT,
    decision_context TEXT,
    source_meeting TEXT,
    last_status_change TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task status history
CREATE TABLE IF NOT EXISTS task_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by TEXT DEFAULT 'System',
    reason TEXT
);

-- ─────────────────────────────────────────────────
-- AUDIT EVENTS
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id TEXT,
    agent TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED', 'RETRY', 'SKIPPED')),
    duration_ms INTEGER,
    summary TEXT,
    input_payload JSONB,
    output_payload JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- ESCALATIONS
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escalations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    task_title TEXT NOT NULL,
    owner TEXT NOT NULL,
    overdue_by_days INTEGER DEFAULT 0,
    deadline DATE,
    source_meeting TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL', 'SENT', 'REJECTED')),
    approved_by TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner);
CREATE INDEX IF NOT EXISTS idx_audit_events_run_id ON audit_events(run_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_agent ON audit_events(agent);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);
CREATE INDEX IF NOT EXISTS idx_decisions_meeting_id ON decisions(meeting_id);

-- ─────────────────────────────────────────────────
-- ROW LEVEL SECURITY (enable for production)
-- ─────────────────────────────────────────────────
-- For demo purposes, disable RLS so service key can write freely:
ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE decisions DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE escalations DISABLE ROW LEVEL SECURITY;
