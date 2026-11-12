# Reporting frontend handoff

Refresh is not fixed in the browser. Home.jsx currently starts with seven INITIAL_REPORTS and only prepends submissions into React state. It has no API load on mount. Do not treat sample data as live records.

## Endpoints

- POST /api/reports: optional geofix_session cookie, credentials: include. Valid sessions determine reporter identity even when the payload omits reporter_user_id. A mismatched supplied ID is 403. Without a session, RESIDENT or a supplied user ID is 401; omitted identity or GUEST creates a guest. Invalid/expired cookies return 401, never silently create a guest. Sign out/clear the invalid session before intentional guest submission. A valid session takes precedence over GUEST intent. Body retains incident_category, priority_level, description, optional latitude/longitude, landmark_description and reverse_geocoded_address. Response: {report, idempotent_replay:false}, HTTP 201. Submission is not dispatch. Repeated POSTs create distinct reports.
- GET /api/reports: authenticated cookie required (401 otherwise). Returns {reports: Report[], count}. Residents and non-admin staff see only their own records; admins may see all. Filters: status_id, incident_category, is_emergency. Broader responder access requires an explicit assignment authorization policy and is intentionally not granted.
- GET /api/reports/:id: owner cookie, admin cookie, or X-Guest-Token header for the matching guest session. Returns {report: Report with status_events and language_flags}. Missing/inaccessible reports return 404. Guest tokens are checked against hashes and ended_at/expires_at. UUIDs and guest_session_id alone grant no access.
- GET /api/reports/public: public {reports:[{id,title,description,published_at}],count}, newest 100 published, unarchived community_feed_posts. Only staff-published text is exposed; this is not an automatic feed of raw incidents. No incident identity, contact, original description, or coordinates. Publishing UI/workflow is outside this task. Empty is expected before publication.

Private Report fields include incident_id, reference_number (same UUID), title, category/incident_category, priority_code, priority_level (CRITICAL/HIGH/MEDIUM/LOW), incident_status_id/status_id, status_code, status_label, is_terminal, description_original, description_sanitized/sanitized_description, location_description/landmark_description, submitted_at/received_at, updated_at, latitude, longitude, reported_by_user_id/reporter_user_id, guest_session_id and callback_mobile_number. These private responses must never populate the public feed. New guest creation additionally returns guest_access_token once; later reads never return it.

## Screen mapping and lifecycle

Private card: id = incident_id, reportNumber = reference_number, title = title, category = incident_category, description = sanitized_description, location = location_description, urgency = priority_level, reportedAt = received_at, statusLabel = status_label. Use is_terminal/status_code for lifecycle, never assume submitted means dispatched. Map lat/lng from latitude/longitude only when both are finite and non-null. Do not coerce NULL to zero or fabricate random coordinates. Public cards use their separate published-summary shape and have no map marker.

On mount load the intended endpoint with loading/error/empty states. Replace sample data, do not merge hardcoded reports into live results. After submission refresh the authorized list; guests load the created detail. Keep private 'My reports' separate from public community updates. Handle 401 by prompting sign-in; preserve retryable errors without claiming success.

For guest refresh tracking, retain incident_id and the one-time guest_access_token in sessionStorage (same-tab refresh; closing the tab loses access). Send token only in X-Guest-Token, never URLs, analytics or logs. A credential must be retained for each guest submission. Existing guest_session_id reuse is rejected by POST; each guest submission creates a new credential. Do not promise recovery after token loss. CORS permits this header for the configured frontend origin. Report responses use Cache-Control: no-store.

Location storage combines nonempty trimmed landmark first, then reverse-geocoded address separated by an em dash; identical values appear once. Either alone survives. Neither gives NULL. Missing coordinates stay NULL.

## Backend verification

From repository root: node server/tests/report.integration.mjs (Node 24, installed server dependencies). Uses in-memory SQLite and actual reporting migrations, never the local/remote application database. Exercises HTTP handlers and session verification with minimal auth-table fixtures.

PR target: staging. No main merge. origin/staging has frontend Home/map work and wrangler.jsonc changes; coordinate this handoff with the frontend teammate. Backend report files do not overlap the currently fetched staging changes.
