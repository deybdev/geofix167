# Resident report notifications

## Local setup

From `server`, run `npx.cmd wrangler d1 migrations apply geofix167_db --local`.
Use the complete ordered migration chain in a normal development database.
Do not edit applied migrations or run this command with `--remote`.
This change was tested only with isolated SQLite and ephemeral Miniflare D1 databases.

`0019_resident_report_notifications.sql` adds the inbox and event trigger.
Its schema dependencies are users, incident_reports, incident_statuses and
incident_status_events (0001/0005); normal report execution also requires the
existing dispatch schema (0007/0015), audit schema (0012), and reference/intake
schema (0018_guest_report_intake). Existing attachments require 0017_report_attachments.
The integration fixtures explicitly load those dependencies as needed.

`alert_deliveries` is a transport-attempt log without content/read state and has
no current runtime consumers. `auth_notifications` is a registration email outbox.
Neither is a resident report inbox. The new table serves only in-app report updates.
There is no historical backfill, email, SMS, push, or announcement delivery.

## API

All routes require an authenticated resident. Browser requests use the existing
session cookie with credentials; native clients may use the existing Bearer token.
Recipient identity always comes from the authenticated session. Write routes use
the existing `assertOrigin` policy: reject a supplied origin differing from
FRONTEND_ORIGIN; absent Origin remains permitted for native clients.

`GET /api/notifications?limit=20&cursor=<url-encoded-next_cursor>`

```json
{
  "notifications": [{
    "id": "32-character-hex-notification-id",
    "title": "Report update",
    "body": "Your report has been verified.",
    "type": "report_update",
    "ref_id": "actual-incident-id",
    "is_read": 0,
    "created_at": "2026-11-16T10:00:00.000Z"
  }],
  "unread_count": 4,
  "next_cursor": null
}
```

Limit defaults to 20 and must be 1–50. Ordering is descending `(created_at, id)`;
the opaque cursor continues strictly below the last row. Timestamp ties are stable.
New arrivals above the cursor appear on refresh. List and total unread count are
read in one D1 batch; unread count covers every unread row for this recipient.
Invalid pagination returns 400. Responses are not cached.

`PATCH /api/notifications/:id/read` and `PATCH /api/notifications/read-all` have no
required body and return `{"ok":true}`. Both are idempotent and retain existing
read timestamps. A foreign or missing notification ID returns 404. Read-all only
affects the current recipient. Missing/invalid sessions return 401; other roles
return 403. The literal read-all route is registered before the parameter route.

## Responder integration contract

The integration point is **inserting a new incident_status_events row inside the
same authorized, guarded D1 batch as the status change**. The database trigger
`notify_resident_report_event` then creates the resident notification. No additional
notification service call or after-response job is needed.

Existing paths already covered without route/repository edits:

- `createIncidentReportBundle` in `server/src/repositories/report.repository.ts`.
- `updateIncidentReportStatus` in that repository (generic progress/closure).
- Verification, rejection, dispatch and DRRMO batches in
  `server/src/routes/admin-dispatch.route.ts`.

For example, after existing authorization/assignment checks, the generic service
in `server/src/services/report.service.ts` calls:

```ts
const changed = await updateIncidentReportStatus(
  db, incidentId, expectedStatusId, 7, false, actor.id, note,
);
// false means stale: return the existing conflict response.
// true means status, event and resident notification all committed.
```

This helper does not authorize callers or validate the transition graph itself;
retain those checks in the existing service. New responder endpoints should reuse
that service where applicable. If a new batch also updates assignments, preserve
its existing guard, create one event only when that guard succeeds, and commit all
statements in the same `db.batch`. Do not update the status alone, insert an event
after responding, or use INSERT OR REPLACE for event identity.

`incident_status_event_id` identifies the logical event. Preserve it on an event
retry, or use existing guarded/idempotent request handling to avoid creating a
second event. A new legitimate transition, even to a previously visited status,
gets a new event ID. The inbox enforces UNIQUE(recipient_user_id, source_event_id).
Duplicate event IDs are rejected by the event PK; creation replay returns the
existing report without inserting another event. Do not suppress arbitrary
notification constraint errors: they must roll back the event transaction.

The trigger derives the recipient from the report and skips reports without a
resident user. Content comes from fixed public wording, never event notes, staff
names or internal details. Closure review explicitly says the report is not yet
closed. New status codes receive generic safe wording until an additive migration
updates the trigger's mapping. Keep status events immutable.

Trigger writes preserve the caller's SQL `changes()` value. This is verified with
real local D1, including zero-row stale updates and notification-error rollback.
References: [SQLite changes semantics](https://www.sqlite.org/c3ref/changes.html),
[D1 SQL support](https://developers.cloudflare.com/d1/sql-api/sql-statements/).

## Resident client

`NotificationProvider` owns list, cursor, unread count, requests and read errors.
One provider wraps ResidentLayout and is keyed by account. It polls every 60 seconds
while visible and refreshes on focus/visibility; requests do not overlap.
Unmount/account switch aborts pending work and clears state. Polling, focus, manual
Refresh and post-read refresh merge the newest page by ID while retaining older
loaded pages and their continuation cursor. Load more advances that cursor. Rows
stay in descending timestamp/ID order. Successful reads update loaded rows and
refresh the server-authoritative unread count (the previous count remains until GET succeeds);
failed reads leave rows unread and display an error with retryable controls.
Buttons provide mouse, Enter and Space activation. Notification navigation uses
the actual incident ID and never passes My Reports provenance metadata.

## Files and teammate coordination

| File | Change / shared-code impact |
| --- | --- |
| server/src/migrations/0019_resident_report_notifications.sql | New shared report-event integration; adds atomic inbox side effect, no transition or authorization changes |
| server/src/index.ts | Shared backend entry: registers notification routes only; existing response contracts unchanged |
| server/src/routes/notification.route.ts | New resident API only |
| client/src/services/residentService.js | Replaces notification samples with API calls; report/announcement contracts retained |
| client/src/shared/context/NotificationProvider.jsx | New shared resident inbox state/polling |
| client/src/shared/hooks/useNotifications.js | New shared resident context hook |
| client/src/layouts/ResidentLayout.jsx | Uses shared unread count/provider; preserves navigation changes |
| client/src/features/resident/Alerts.jsx | Persistent inbox, pagination, errors, read actions, report links |
| server/tests/notifications.integration.mjs | New real database/API integration coverage |
| server/tests/notifications-d1.integration.mjs | New ephemeral D1 trigger/transaction coverage |
| server/tests/report.integration.mjs | Migration dependency and stale-notification assertion |
| server/tests/admin-dispatch.integration.mjs | Migration dependencies and current required guest fixture fields |
| server/tests/attachments.integration.mjs | Migration dependencies only |
| client/tests/resident-report.integration.mjs | Migration dependencies, exact current reference/address expectations |
| RESIDENT_NOTIFICATIONS.md | Integration contract and setup |

No production edits to report.repository.ts, report.service.ts or
admin-dispatch.route.ts. No admin or responder frontend edits. Existing navigation
and upload recovery files are preserved. The two pre-existing lockfile edits are
unrelated and excluded from the notification review patch.

## Verification commands

From repository root:

```powershell
node server/tests/notifications.integration.mjs
node server/tests/notifications-d1.integration.mjs
node server/tests/report.integration.mjs
node server/tests/admin-dispatch.integration.mjs
node server/tests/attachments.integration.mjs
node client/tests/resident-report.integration.mjs
node --test client/tests/report-navigation.test.mjs
npm.cmd --prefix server run typecheck
npm.cmd --prefix client run build
git diff --check
```

From client:

```powershell
npx.cmd eslint src/services/residentService.js src/layouts/ResidentLayout.jsx src/features/resident/Alerts.jsx src/shared/context/NotificationProvider.jsx src/shared/hooks/useNotifications.js
```

All above passed. Build reports the existing large-chunk warning. Attachment tests
deliberately log simulated database/R2 failures while passing recovery assertions.
No browser verification was performed. Visual/accessibility interaction, live
polling across tabs and authenticated staging use still need browser acceptance.

Fixture issues corrected: missing incident_report_references dependency (previously
reproduced on pre-navigation HEAD), outdated UUID reference assertion (now GF-008),
old concatenated address expectation (address takes precedence over landmark), and
admin test guest payload lacking fields required by current intake validation.
No production behavior was changed to make these tests pass.
