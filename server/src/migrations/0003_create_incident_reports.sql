CREATE TABLE IF NOT EXISTS INCIDENT_STATUSES (
    status_id INTEGER PRIMARY KEY,
    status_code TEXT UNIQUE NOT NULL,
    status_label TEXT NOT NULL,
    is_terminal INTEGER NOT NULL DEFAULT 0 CHECK (is_terminal IN (0, 1))
);

INSERT OR IGNORE INTO INCIDENT_STATUSES (status_id, status_code, status_label, is_terminal)
VALUES
    (1, 'PENDING', 'Pending', 0),
    (2, 'VERIFIED', 'Verified', 0),
    (3, 'CLOSED', 'Closed', 1);

CREATE TABLE IF NOT EXISTS GUEST_SESSIONS (
    guest_session_id TEXT PRIMARY KEY,
    guest_alias TEXT,
    session_token_hash TEXT UNIQUE,
    recovery_code_hash TEXT UNIQUE,
    callback_contact TEXT,
    last_report_submitted_at TEXT,
    cooldown_until TEXT,
    guest_voluntarily_ended INTEGER DEFAULT 0,
    session_expires_at TEXT,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS INCIDENT_REPORTS (
    incident_id TEXT PRIMARY KEY,
    reference_number TEXT UNIQUE,
    reporter_user_id TEXT NULL,
    guest_session_id TEXT NULL,
    master_incident_id TEXT NULL,
    duplicate_linked_by_id TEXT NULL,
    status_id INTEGER NOT NULL DEFAULT 1 REFERENCES INCIDENT_STATUSES(status_id),
    current_review_owner_id TEXT NULL,
    closed_by_user_id TEXT NULL,
    idempotency_key TEXT UNIQUE,
    idempotency_fingerprint TEXT,
    reporter_type TEXT CHECK(reporter_type IN ('RESIDENT', 'GUEST')),
    is_emergency INTEGER NOT NULL DEFAULT 0 CHECK(is_emergency IN (0, 1)),
    incident_category TEXT NOT NULL,
    priority_level TEXT NOT NULL DEFAULT 'MEDIUM',
    sanitized_description TEXT,
    original_description_enc TEXT,
    has_language_flag INTEGER NOT NULL DEFAULT 0 CHECK(has_language_flag IN (0, 1)),
    latitude REAL NULL,
    longitude REAL NULL,
    barangay_zone TEXT NULL,
    within_barangay_boundary INTEGER NULL,
    reverse_geocoded_address TEXT NULL,
    location_source TEXT NULL,
    pin_manually_adjusted INTEGER DEFAULT 0,
    landmark_description TEXT NULL,
    call_fallback_used INTEGER DEFAULT 0,
    recorded_offline_during_outage INTEGER DEFAULT 0,
    received_at TEXT NOT NULL,
    reminder_30s_due_at TEXT NULL,
    reminder_30s_sent_at TEXT NULL,
    takeover_60s_due_at TEXT NULL,
    escalated_60s_at TEXT NULL,
    escalation_check_status_code INTEGER NOT NULL DEFAULT 0,
    last_escalation_checked_at TEXT NULL,
    verified_at TEXT NULL,
    duplicate_linked_at TEXT NULL,
    duplicate_link_reason TEXT NULL,
    closed_at TEXT NULL,
    guest_tracking_expires_at TEXT NULL,
    closure_outcome TEXT NULL,
    closure_remarks TEXT NULL,
    updated_at TEXT NOT NULL,
    retention_until TEXT NULL
);

CREATE TABLE IF NOT EXISTS INCIDENT_STATUS_EVENTS (
    status_event_id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL REFERENCES INCIDENT_REPORTS(incident_id),
    from_status_id INTEGER NULL,
    to_status_id INTEGER NOT NULL REFERENCES INCIDENT_STATUSES(status_id),
    actor_user_id TEXT NULL,
    actor_guest_session_id TEXT NULL,
    reason TEXT,
    occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS LANGUAGE_FLAGS (
    flag_id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL REFERENCES INCIDENT_REPORTS(incident_id),
    user_id TEXT NULL,
    guest_session_id TEXT NULL,
    matched_terms_summary TEXT,
    action_taken TEXT,
    strike_candidate INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incident_reports_status_id ON INCIDENT_REPORTS(status_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_is_emergency ON INCIDENT_REPORTS(is_emergency);
CREATE INDEX IF NOT EXISTS idx_incident_reports_category ON INCIDENT_REPORTS(incident_category);
CREATE INDEX IF NOT EXISTS idx_incident_status_events_incident_id ON INCIDENT_STATUS_EVENTS(incident_id);
CREATE INDEX IF NOT EXISTS idx_language_flags_incident_id ON LANGUAGE_FLAGS(incident_id);
