-- In-app inbox is separate from transport delivery attempts and auth emails.
CREATE TABLE resident_notifications (
  notification_id TEXT PRIMARY KEY NOT NULL,
  recipient_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  incident_id TEXT NOT NULL REFERENCES incident_reports(incident_id) ON DELETE CASCADE,
  source_event_id TEXT NOT NULL REFERENCES incident_status_events(incident_status_event_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'report_update' CHECK (type = 'report_update'),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  read_at TEXT,
  UNIQUE (recipient_user_id, source_event_id)
);
CREATE INDEX idx_resident_notifications_list
  ON resident_notifications(recipient_user_id, created_at DESC, notification_id DESC);
CREATE INDEX idx_resident_notifications_unread
  ON resident_notifications(recipient_user_id) WHERE read_at IS NULL;

-- Part of the event's transaction: failure rolls back the event and batch.
-- Trigger writes do not change the outer statement's SQL changes() value.
-- No historical backfill: only events committed after installation notify.
CREATE TRIGGER notify_resident_report_event
AFTER INSERT ON incident_status_events
BEGIN
  INSERT INTO resident_notifications
    (notification_id, recipient_user_id, incident_id, source_event_id, title, body)
  SELECT lower(hex(randomblob(16))), r.reported_by_user_id, NEW.incident_id,
    NEW.incident_status_event_id, 'Report update',
    CASE s.code
      WHEN 'SUBMITTED' THEN 'Your report has been received.'
      WHEN 'UNDER_REVIEW' THEN 'Your report is under review.'
      WHEN 'NEEDS_CLARIFICATION' THEN 'Your report needs clarification. Open the report for details.'
      WHEN 'VERIFIED' THEN 'Your report has been verified.'
      WHEN 'REJECTED' THEN 'Your report was not accepted. Open the report for details.'
      WHEN 'FORWARDED_TO_BDRRMO' THEN 'Your report has been forwarded to BDRRMO.'
      WHEN 'ASSIGNED' THEN 'A response team has been assigned to your report.'
      WHEN 'DISPATCHED' THEN 'A response team has been dispatched for your report.'
      WHEN 'EN_ROUTE' THEN 'Responders are on their way.'
      WHEN 'ON_SCENE' THEN 'Responders have arrived at the scene.'
      WHEN 'FOR_CLOSURE_REVIEW' THEN 'Your report is awaiting closure review. It is not yet closed.'
      WHEN 'CLOSED' THEN 'Your report has been closed.'
      WHEN 'LINKED_DUPLICATE' THEN 'Your report has been linked to another report about this incident.'
      WHEN 'AWAITING_DRRMO_SUPPORT' THEN 'DRRMO support has been requested for your report.'
      ELSE 'Your report status has been updated.'
    END
  FROM incident_reports r
  JOIN incident_statuses s ON s.incident_status_id = NEW.to_incident_status_id
  WHERE r.incident_id = NEW.incident_id AND r.reported_by_user_id IS NOT NULL;
END;
