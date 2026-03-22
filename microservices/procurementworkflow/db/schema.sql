-- ── Procurement Runs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS procurement_runs (
    run_id       TEXT PRIMARY KEY,
    status       TEXT NOT NULL DEFAULT 'RUNNING',
    current_step TEXT NOT NULL DEFAULT 'start',
    state_json   TEXT NOT NULL,          -- full ProcurementState as JSON
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- ── Purchase Requests ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_requests (
    pr_id             TEXT PRIMARY KEY,
    run_id            TEXT NOT NULL,
    item_name         TEXT NOT NULL,
    quantity          REAL NOT NULL,
    unit_price        REAL NOT NULL,
    total_amount      REAL NOT NULL,
    department        TEXT NOT NULL,
    requester_id      TEXT NOT NULL,
    category          TEXT NOT NULL,
    category_code     TEXT NOT NULL,
    approval_required INTEGER NOT NULL DEFAULT 0,
    status            TEXT NOT NULL,
    required_by       TEXT,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES procurement_runs(run_id)
);

-- ── Budget Snapshots ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budget_checks (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id           TEXT NOT NULL,
    pr_id            TEXT NOT NULL,
    department       TEXT NOT NULL,
    budget_status    TEXT NOT NULL,
    allocated_budget REAL NOT NULL,
    spent_so_far     REAL NOT NULL,
    this_request     REAL NOT NULL,
    remaining_after  REAL NOT NULL,
    utilisation_pct  REAL NOT NULL,
    reason           TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES procurement_runs(run_id)
);

-- ── Vendor Selections ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_selections (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id                TEXT NOT NULL,
    pr_id                 TEXT NOT NULL,
    vendor_id             TEXT NOT NULL,
    vendor_name           TEXT NOT NULL,
    quoted_price_per_unit REAL NOT NULL,
    total_quoted          REAL NOT NULL,
    lead_time_days        INTEGER NOT NULL,
    quality_rating        REAL NOT NULL,
    score                 REAL NOT NULL,
    selection_reason      TEXT,
    status                TEXT NOT NULL,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES procurement_runs(run_id)
);

-- ── Purchase Orders ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id           TEXT PRIMARY KEY,
    run_id          TEXT NOT NULL,
    pr_id           TEXT NOT NULL,
    vendor_id       TEXT NOT NULL,
    po_document     TEXT NOT NULL,      -- JSON string
    dispatch_status TEXT NOT NULL,
    retry_count     INTEGER DEFAULT 0,
    dispatched_at   TIMESTAMP,
    error           TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES procurement_runs(run_id)
);

-- ── Goods Receipts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goods_receipts (
    gr_id               TEXT PRIMARY KEY,
    run_id              TEXT NOT NULL,
    po_id               TEXT NOT NULL,
    match_status        TEXT NOT NULL,
    received_items      TEXT NOT NULL,  -- JSON string
    discrepancy_details TEXT,
    payment_block       INTEGER NOT NULL DEFAULT 0,
    received_at         TIMESTAMP,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES procurement_runs(run_id),
    FOREIGN KEY (po_id)  REFERENCES purchase_orders(po_id)
);

-- ── Invoice Matches ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_matches (
    match_id        TEXT PRIMARY KEY,
    run_id          TEXT NOT NULL,
    po_id           TEXT NOT NULL,
    gr_id           TEXT NOT NULL,
    invoice_id      TEXT NOT NULL,
    match_result    TEXT NOT NULL,
    checks_json     TEXT NOT NULL,      -- JSON: qty/price/total/item booleans
    variance_amount REAL DEFAULT 0,
    block_reason    TEXT,
    matched_at      TIMESTAMP,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES procurement_runs(run_id)
);

-- ── Payments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    payment_id             TEXT PRIMARY KEY,
    run_id                 TEXT NOT NULL,
    po_id                  TEXT NOT NULL,
    vendor_id              TEXT NOT NULL,
    invoice_amount         REAL NOT NULL,
    scheduled_amount       REAL NOT NULL,
    early_discount_applied INTEGER DEFAULT 0,
    discount_amount        REAL DEFAULT 0,
    due_date               TEXT NOT NULL,
    payment_terms_used     TEXT,
    vendor_bank_ref        TEXT,
    status                 TEXT NOT NULL,
    scheduled_at           TIMESTAMP,
    created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES procurement_runs(run_id)
);

-- ── Audit Log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id     TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    action     TEXT NOT NULL,
    status     TEXT NOT NULL,
    payload    TEXT,                    -- JSON string
    error_msg  TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Human Review Queue ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS human_review_queue (
    review_id       TEXT PRIMARY KEY,
    run_id          TEXT NOT NULL,
    agent_name      TEXT NOT NULL,
    reason          TEXT NOT NULL,
    payload         TEXT NOT NULL,     -- JSON string
    status          TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at     TIMESTAMP,
    resolution_note TEXT,
    FOREIGN KEY (run_id) REFERENCES procurement_runs(run_id)
);

-- ── Indexes for fast lookup ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_run     ON audit_log(run_id);
CREATE INDEX IF NOT EXISTS idx_audit_agent   ON audit_log(agent_name);
CREATE INDEX IF NOT EXISTS idx_runs_status   ON procurement_runs(status);
CREATE INDEX IF NOT EXISTS idx_review_status ON human_review_queue(status);

-- ── Vendors ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
    vendor_id       TEXT PRIMARY KEY,
    vendor_name     TEXT NOT NULL,
    category_codes  TEXT NOT NULL,      -- JSON array string e.g. '["IT_HW","IT_SW"]'
    unit_price      REAL NOT NULL,
    lead_time_days  INTEGER NOT NULL,
    quality_rating  REAL NOT NULL,
    is_preferred    INTEGER DEFAULT 0,  -- 0 or 1
    is_approved     INTEGER DEFAULT 1,  -- 0 or 1
    contact_email   TEXT,
    contact_phone   TEXT,
    gstin           TEXT,               -- GST Identification Number
    payment_terms   TEXT DEFAULT 'Net-30',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Vendor Performance ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_performance (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id       TEXT NOT NULL,
    run_id          TEXT NOT NULL,
    po_id           TEXT,
    order_value     REAL,
    delivered_on_time INTEGER DEFAULT 0,   -- 0 or 1
    quantity_match    INTEGER DEFAULT 0,   -- 0 or 1
    invoice_clean     INTEGER DEFAULT 0,   -- 0 or 1
    recorded_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_perf
    ON vendor_performance(vendor_id);