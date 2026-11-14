# Registration and Login — Manual Testing Guide

This guide covers Google sign-in, email/password registration, resident matching,
private ID uploads, admin review, consent, and authentication limits.

**Important:** Google and email tests require real service configuration. Adding
the code alone does not configure a Google OAuth client or a Brevo sender.
Use test identities and sample documents labelled **TEST ONLY**, not real IDs.

## 1. Prepare the project

### Database

Migration `0017_registration_identity.sql` has already been applied and recorded
in this workspace's **local** database. It adds the registration/authentication
tables and columns needed below.

Earlier migrations `0015_admin_dispatch.sql` and `0016_reset_demo_passwords.sql`
were still pending when this work was performed. They were not applied as part
of this authentication change. In particular, `0016` resets demo passwords.

On a fresh clone, inspect the pending migrations before applying them:

```powershell
cd C:\Users\raino\OneDrive\Desktop\Projects\geofix167\server
npx wrangler d1 migrations list geofix167_db --local
```

For a fresh local test database, apply its migrations with `npm run db:migrate`.
Do not add `--remote` to manual testing commands.

### Google configuration

1. In Google Cloud Console, configure the OAuth consent screen.
2. Create an OAuth client of type **Web application**.
3. Add this exact **Authorized redirect URI**:

   ```text
   http://localhost:5173/api/auth/google/callback
   ```

4. If the consent screen is in Testing mode, add the Google accounts you will use
   as test users.
5. Add these settings to `server/.dev.vars`:

   ```dotenv
   GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   GOOGLE_REDIRECT_URI="http://localhost:5173/api/auth/google/callback"
   ```

The existing local `.dev.vars` already contains a generated `AUTH_HASH_SECRET`.
Keep it. Do not share or commit the file. The template is
[`server/.dev.vars.example`](server/.dev.vars.example).

**No Gmail API or permission to read the user's inbox is required.** Google
provides verified email/basic profile identity. GeoFix sends email using Brevo.

### Email configuration

Add the following to the same `server/.dev.vars` file:

```dotenv
BREVO_API_URL="https://api.brevo.com/v3/smtp/email"
BREVO_API_KEY="your-brevo-api-key"
```

Verify the sender with Brevo. The existing service uses
`rainopinion0@gmail.com`; if you use another verified sender, update
`server/src/services/email.service.ts` accordingly.

### Start both apps

Terminal 1:

```powershell
cd C:\Users\raino\OneDrive\Desktop\Projects\geofix167\server
npm run dev
```

Terminal 2:

```powershell
cd C:\Users\raino\OneDrive\Desktop\Projects\geofix167\client
npm run dev
```

Restart the backend after changing `.dev.vars`. Open the frontend at
**http://localhost:5173**. Keep the frontend on port 5173, matching
`FRONTEND_ORIGIN` and Google's redirect URI. Do not mix `localhost` and
`127.0.0.1` during authentication; cookies are hostname-specific.

Use separate browser profiles for the applicant and admin. This prevents their
session cookies from replacing one another.

## 2. View the database

In the Wrangler terminal press **e**, or open:

```text
http://127.0.0.1:8787/cdn-cgi/local/explorer/
```

Select D1 → `geofix167-db`. Relevant tables:

- `users`: account status, verified email, Google subject, linked masterlist.
- `account_statuses`: `ACTIVE`, `UNVERIFIED`, `DEACTIVATED`.
- `resident_verifications`: `PENDING`, `APPROVED`, `REJECTED`, `NEEDS_CORRECTION`.
- `registration_requests`: consent versions, birth date and document metadata.
- `auth_flows`: temporary OAuth/email-verification/identity sessions.
- `auth_notifications`: `PENDING`, `SENDING`, `SENT`, `FAILED` email delivery.
- `auth_rate_limits`: persistent counters and window end times.
- `auth_audit_events`: registration, upload, and review events.
- `user_sessions_and_devices`: hashed login sessions.

Example read-only inspection query:

```sql
SELECT u.user_id, u.first_name, u.last_name, u.email, u.mobile_number,
       s.status_code AS account_status, v.status AS verification_status,
       u.email_verified_at, q.document_uploaded_at,
       q.terms_version, q.privacy_version, q.consent_at
FROM users u
JOIN account_statuses s ON s.status_id = u.account_status_id
JOIN registration_requests q ON q.user_id = u.user_id
JOIN resident_verifications v ON v.verification_id = q.verification_id
ORDER BY q.consent_at DESC;
```

Use fake test data when capturing screenshots. Do not include password hashes,
cookies, OTPs, OAuth authorization codes, API keys, or real ID images in reports.

## 3. Prepare resident test data

The project contains these local masterlist fixtures:

| Barangay ID | First name | Last name | Birth date |
| --- | --- | --- | --- |
| `DEMO-167-0001` | Demo | Resident | `2000-01-01` |
| `DEMO-167-0002` | Test | Applicant | `1998-05-20` |

For automatic approval, the selected masterlist record must be active, unexpired,
and not already linked to another user. Inspect availability:

```sql
SELECT m.barangay_identifier, m.first_name, m.last_name, m.date_of_birth,
       m.is_active, m.card_valid_until, u.user_id AS claimed_by
FROM barangay_masterlist m
LEFT JOIN users u ON u.masterlist_id = m.masterlist_id
WHERE m.barangay_identifier IN ('DEMO-167-0001', 'DEMO-167-0002');
```

Use a different test email and unused mobile number for each new account. Use an
email address you control. For example mobile numbers can be `09910000001` and
`09910000002` if they are unused in this local database. The current new flow
verifies email, not the mobile number through SMS.

For a password-based test, use a test password such as `Test-Registration-123!`.

## 4. Google registration: automatic approval

1. Open `/register` in the applicant browser.
2. Click **Continue with Google**.
3. Select an allowed Google test account and complete Google's consent screen.
4. Confirm you return to `/register` with **Email verified: your address**.
5. Confirm the Google name is editable. Enter the legal name/birth date of an
   available fixture above, its Barangay ID, and an unused mobile number.
6. Review both policy documents and explicitly check the agreement.
7. Click **Submit registration**.

Expected:

- Google email does **not** have to match any masterlist email/mobile field.
- No password is requested for a Google registration.
- The public submission returns `202` with `status: RECEIVED`.
- The private, email-verified registration status becomes `APPROVED`.
- Database account status is `ACTIVE`, with `email_verified_at` and
  `google_subject` populated.
- An approval notification is created; delivery should become `SENT` when
  Brevo accepts it. Check inbox and spam. `SENT` means provider acceptance,
  not a guarantee the recipient read or received the message in their inbox.
- Click the Google sign-in link. You should reach `/resident`.
- Refresh the resident page: the session should remain valid.

## 5. Email/password registration

1. Use a fresh applicant browser profile and open `/register`.
2. Enter a controlled email and click **Verify email instead**.
3. Open the received email and enter its six-digit code.
4. Click **Confirm email**.
5. Complete resident details, password/confirmation and policy acceptance.
6. Use a different available masterlist fixture for automatic approval, or use
   `TEST-UNKNOWN-001` to exercise manual review below.

Expected:

- Only a valid, unexpired email code unlocks registration.
- Registration email comes from the verified server-side identity, not a
  client-supplied email field.
- Password and confirmation must match and meet the displayed password rules.
- An automatically approved account can log in at `/login` with mobile/password.
- A pending account cannot log in yet.

## 6. Unknown ID or mismatched details → document review

1. Verify a new email or use a new Google identity.
2. Register using `TEST-UNKNOWN-001`, or deliberately change a fixture's surname
   or birth date. Use an unused mobile number.
3. Submit the completed form.

Expected:

- No public “ID not found”, “mobile exists”, or masterlist lookup result.
- The public response is the same `202 RECEIVED` response.
- Only the verified applicant sees the document request.
- Account stays `UNVERIFIED`; verification is `NEEDS_CORRECTION`.
- Status email asks for additional verification without exposing masterlist data.

4. Upload a sample JPEG, PNG, or PDF labelled **TEST ONLY**, up to 5 MB.
5. Click **Submit for review**.

Expected:

- Verification changes to `PENDING`; account stays `UNVERIFIED`.
- Private R2 key/type/size/upload timestamp are recorded in
  `registration_requests`.
- The applicant gets a received/awaiting-review notification.
- No resident session is issued by submitting an application or document.

Repeat with an inactive/expired fixture if needed: it should go through review,
not automatic activation. Use only dedicated test fixture records for that test.

## 7. Admin approves a request

1. In the separate admin browser, open `/admin-login`.
2. Use a known active admin account. The README lists demo mobile
   `09123123123` and password `password`, but these depend on the local seed and
   password migrations. Do not reset existing credentials merely to run this test.
3. Open **Registrations**, or `/admin/registrations`.
4. Find the `PENDING` test applicant and click **Download ID**.
5. Click **Review**, select **Approve**, and save.

Expected:

- Verification becomes `APPROVED`; account becomes `ACTIVE`.
- Reviewer ID/time and an audit event are recorded.
- An approval email notification is created.
- Applicant clicks **Refresh status**, then signs in through their chosen method.
- Repeating a decision against an already-reviewed request is rejected with `409`.

## 8. Admin requests correction or rejects

### Correction

1. Submit another review request with a test document.
2. Admin selects **Request correction** and enters a reason.
3. Save, then refresh the applicant's status.

Expected: verification becomes `NEEDS_CORRECTION`, account stays `UNVERIFIED`,
and the applicant receives an email/reason. They can upload a replacement, which
returns the request to `PENDING`. Admin can then review again.

### Rejection

1. Review a different `PENDING` request.
2. Select **Reject**, supply a reason, and save.

Expected: verification is `REJECTED`, account stays `UNVERIFIED`, and the email
directs the applicant to the Front Desk. Login stays blocked. Rejected requests
do not currently have a self-service appeal/reopen flow.

## 9. Terms and Privacy checkbox

1. Start a fresh verified registration form.
2. Confirm the checkbox is disabled before reviewing documents.
3. Open Terms of Service, scroll to its end, then close it.
4. Confirm the checkbox is still disabled until Privacy Policy is also reviewed.
5. Open Privacy Policy, scroll to its end, then close it.
6. Confirm both have a check mark and the checkbox is now enabled.
7. Leave it unchecked: submission must stay disabled.
8. Explicitly check it and submit valid details.

Expected: accepted policy versions and server-side consent time are stored.
Scrolling is a UI prompt; it cannot prove someone actually read/understood text.
Reloading resets the in-form review progress.

## 10. Duplicates and privacy

Using a different verified email, submit details with a mobile number already
used by a test account.

Expected:

- Same public `202 RECEIVED` response; no account-existence message.
- No duplicate account and no change to the original password, Google subject,
  email or account status.
- The other applicant's private registration details are not returned.
- An already-claimed masterlist ID must not auto-approve a second account.

Google does **not** automatically link to an old password account just because
the emails match. That account should still use password login. A separate
authenticated provider-linking feature is outside this implementation.

## 11. Rate limits and expiry

Use DevTools → Network to inspect the status and `Retry-After` response header.
Do not repeatedly request real emails just to exhaust provider quotas.

| Action | Limit | Expected behavior |
| --- | --- | --- |
| Register | 3 submissions per identifier / 24 hours | Next attempt returns `429` with remaining window seconds |
| Email resend | 1 per email / 60 seconds | Countdown; backend rejects early resend |
| Email sends | 10 per email / 24 hours | `429` after daily allowance |
| Wrong email codes | 5 per challenge | Correct code also blocked after allowance; request new code |
| Email code lifetime | 10 minutes | Expired code rejected |
| Reuse correct email code | Single use | Second verification rejected |
| ID upload | 5 attempts / 10 minutes | Further uploads return `429` |
| Password login | 10 attempts per mobile / 15 minutes | Further attempts return `429` |
| Registration identity | 1 hour | Verify email/Google again after expiry |

Coarse source-IP limits also apply. Multiple testers on one connection may share
that ceiling. Reloading or opening another tab does not reset backend counters.
The retry time is the actual remaining window, not a fixed 30-minute message.

If the UI prevents rapid repeat clicks, use DevTools **Replay XHR** (where
available) for your own local request. Never copy session cookies into a report.

## 12. Upload and authorization checks

- Try a file larger than 5 MB: rejected.
- Try an unsupported type such as TXT/SVG: rejected.
- Renaming a text file to `.png` must not make it valid; the server checks
  initial file signature as well as MIME type.
- Open the admin request-list or ID-download endpoint in a logged-out browser:
  `401` and no document/data.
- Call the same admin endpoint with a resident session: `403`.
- Reuse a private document URL after admin logout: it must no longer download.
- Ensure R2 public access (`r2.dev` and public custom domains) is disabled before
  uploading real documents; application route checks do not secure a public bucket.

## 13. Login and logout regression

- Valid active mobile/password → success.
- Wrong password → generic credential error.
- Unverified/deactivated account → blocked.
- Linked, active Google resident → Google sign-in succeeds.
- Refresh while logged in → `/api/auth/me` restores the user.
- Logout → session deleted, auth cookies cleared, `/api/auth/me` returns `401`.
- Admin credentials still use the dedicated admin login screen.

## 14. Email failure and Google cancellation

- Cancel Google's consent screen: return with a sign-in error, no active login.
- Incorrect OAuth redirect URI: Google shows `redirect_uri_mismatch`; fix the
  exact authorized URI and local setting, then restart the backend.
- Missing Google configuration: the app shows a configuration/sign-in error.
- Missing/invalid Brevo credentials: email verification returns `503`, not a
  claim that a code was sent.
- A status email delivery failure leaves the review decision saved. Inspect
  `auth_notifications`, correct delivery configuration, and use **Retry email**
  on the admin page when the displayed notification is `PENDING` or `FAILED`.

## 15. Record results

For each failed case record:

```text
Test case:
Browser/profile (applicant or admin):
Steps:
Expected result:
Actual result:
API path + HTTP status:
Sanitized response/error:
Account status + verification status:
```

Useful troubleshooting:

- `no such table/column`: check the local migration and which persisted database
  your Wrangler process uses.
- `Authentication configuration is incomplete`: check `AUTH_HASH_SECRET` and
  restart Wrangler.
- Google works but registration does not auto-approve: check legal name, date of
  birth, ID validity, and whether a user already claims the fixture.
- Email verified session disappears: check hostname consistency and the one-hour
  identity expiry; return to `/register` and authenticate again.
- `401 /api/auth/me` before sign-in is expected, not a backend crash.

## Optional automated checks

If you want to run them yourself:

```powershell
# server/
npm run typecheck
npm run test:auth
```

```powershell
# client/
npm run build
```

The integration suite uses isolated Miniflare/D1/R2 storage and mocked Google/email
responses. It does not replace the real-browser OAuth and email delivery checks.

Additional configuration details: [server/AUTH_SETUP.md](server/AUTH_SETUP.md).
