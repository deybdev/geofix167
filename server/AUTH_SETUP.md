# Registration and login

## Local setup

1. Run `npm run db:migrate` from `server/`.
2. Set the values shown in `.dev.vars.example` in your ignored `.dev.vars`.
   Keep the generated `AUTH_HASH_SECRET`; use a separate random secret in production.
3. In Google Cloud Console, create an OAuth **Web application** client. Configure
   the consent screen and add your test Google accounts if the app is in testing.
   Add this exact authorized redirect URI:
   `http://localhost:5173/api/auth/google/callback`.
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`.
5. Configure Brevo transactional email credentials. The existing email service uses
   `rainopinion0@gmail.com` as sender; verify/authorize that sender in Brevo or
   change it to your verified sender in `src/services/email.service.ts`.
6. Restart `npm run dev`, run the client, and browse **http://localhost:5173**.
   Do not mix `localhost` with `127.0.0.1` for sign-in: OAuth cookies belong to the
   frontend host. The callback goes through Vite's `/api` proxy.

Google sign-in cannot work until real Google client credentials are configured.
Email codes cannot be delivered until Brevo is configured. The server does not
pretend to send codes or log them as a substitute. No Gmail inbox/read/send scopes
are requested; outbound status emails use Brevo, not the applicant's Google account.

## Flow

- Verify email using an emailed six-digit code, or **Continue with Google**.
- The server keeps a short-lived, HttpOnly identity cookie. Google verifies email
  ownership; that email is **not** compared with the barangay masterlist.
- Fill in the legal name, birth date, mobile number and Barangay ID number.
  Email/password registrations set a password; Google registrations use Google
  to log in and do not receive a generated password.
- Review both current policy documents and explicitly accept their versions.
  Scrolling is a UI aid, not proof that someone understood/read the documents.
  The server records explicit consent versions and its own acceptance timestamp.
- An active, unexpired, exact ID/name/birth-date match with an **unclaimed**
  masterlist record gets `APPROVED` + `ACTIVE` automatically.
- Other submissions remain `UNVERIFIED` + `NEEDS_CORRECTION`. Only the verified
  email owner can see the next step and upload an ID. Uploading changes verification
  to `PENDING` for admin review. Account login remains blocked.
- Admins use `/admin/registrations` to download a private document and approve,
  request correction, or reject. Approval activates the account; other decisions
  keep it unverified. No masterlist record is silently created or overwritten.
- Decisions generate notification records. Pending/failed emails can be retried
  from the admin screen. Email failures do not roll back the review decision.
- Duplicate mobile/email/Google identities get the same public `202 RECEIVED`
  response, without overwriting or automatically linking existing accounts.
  Existing password accounts continue to use password login; provider linking
  to pre-existing accounts is not implemented.
- Google-linked active residents can sign in with Google. Existing password
  login, seven-day server-side sessions, `/me`, and logout remain supported.

## Limits

- Registration: 3 valid submissions per email/mobile/Barangay-ID per 24 hours.
- Email code sends: 60-second cooldown and 10 per email per 24 hours.
- Email code verification: 5 attempts, 10-minute expiry, single use.
- ID uploads: 5 attempts per verified email per 10 minutes; JPEG/PNG/PDF up to 5 MB.
- Password login: 10 attempts per mobile per 15 minutes.
- Coarse source-IP ceilings also limit endpoint abuse (30 per 10 minutes,
  60 for login), without making IP the sole identifier.
- D1 atomic counters persist across refreshes and return `429` + `Retry-After`.
  Identifier keys use HMAC with `AUTH_HASH_SECRET`.

## Storage and deployment

Migration `0017_registration_identity.sql` adds provider/email-verification fields,
short-lived auth flows, registration request/document metadata, consent versions,
and email delivery tracking. It reuses the existing account/verification statuses,
rate-limit table, and audit table.

The R2 bucket containing ID documents must have public `r2.dev` and custom-domain
access disabled. Documents are downloaded through the admin-only endpoint, with
`private, no-store`, attachment disposition, and no content sniffing. Uploaded IDs
are not exposed through incident-media routes. Set a document-retention policy
before handling real residents; automatic retention deletion is not implemented.

In production, configure the HTTPS frontend origin and Google callback URI for
your deployment; proxy `/api` to the Worker on that frontend origin. Store secret
values with `wrangler secret put`, and apply migrations explicitly to the target
database. Local migration commands never migrate the remote database.

## Verification

`npm run test:auth` bundles the Worker and runs isolated Miniflare/D1/R2 integration
tests. It does not write to the development database or call real Google/Brevo.
Google callback responses are mocked in tests; test the real consent/callback and
email delivery with configured test accounts before deployment.
