# Bantay-Agapay: Three-role acceptance and release gates

> Development release candidate only. All mock tests use fictitious identities; no real
> student data, SMS charges, gate authorizations, or production migrations are exercised in CI.

## Visitor journey

1. Open the mobile pre-registration page. Required fields, purpose and destination must
   validate. New and returning visitors both verify their Philippine mobile number with
   the school's free-only Android gateway before proceeding.
2. Wrong, expired, mismatched-phone, missing and replayed OTP proofs must fail closed.
   An unavailable SMS device or quota must not silently bypass verification or switch
   to a paid provider. A school-approved assisted route is a separate policy decision.
3. Face capture creates a photo for gate identity review. This alone is not biometric
   identity verification or authorization for entry.
4. A pre-registered QR must clearly show **Pending gate approval**, even if it can
   be downloaded and displayed offline. Needs Review, Denied, Expired, Checked In and
   Checked Out states must never be confused with permission to enter or collect a child.
5. Public QR status refreshes without exposing guardian/student enrollment data.
   Offline and server-error states must identify potentially stale information.
6. The legacy visit-status page asks explicit permission before sharing precise GPS
   location, supports stopping, and never makes location sharing an entry condition.
7. After school admission, only approved campus walking directions are displayed.
   The same QR can be presented for security checkout.

## Security personnel journey

1. An approved security account can see the current active home-pre-registration queue,
   current campus visitors and open incidents without depending on retired legacy
   pending-visit RPCs. Expired passes are not shown as actionable pending entries.
2. Gate scanner accepts the presented QR, fetches private visitor photo and active
   guardian reference only through authenticated staff routes and short-lived signed URLs.
3. A valid QR is **not** approval. Staff must review actual visitor identity; student-related
   visits additionally require an active enrolled guardian-student authorization and
   approved external liveness/face-comparison result.
4. A mismatch, unavailable provider, missing reference photo or flagged registration must
   fail closed. Reasons and staff attribution are recorded for denial, admission and exit.
5. The standalone exit scanner must not mutate records on the first camera read. A
   human must explicitly confirm visitor exit after scanning.
6. Manual roster exit uses the same atomic SQL checkout function as the QR gate for
   pre-registered visitors; legacy-only checkout retains conditional update.
   Duplicate exit attempts fail safely.
7. Search, retry and last-sync feedback prevent mistaking a stale queue for an empty queue.
   A security user must not be sent to administrator-only configuration pages.

## Administrator journey

1. Dashboard metrics distinguish home pre-registrations from actual entries and exits.
   Pending and flagged counts use current pre-registration records, not only legacy visits.
   Database errors must not be represented as zero activity.
2. Manage approved staff, student and guardian registry, relationship revocation,
   current incidents, privacy requests, and authorized campus routes.
3. Admin diagnostics separate basic DB connectivity from required schema presence and
   configuration readiness for registration, free SMS, and guardian biometric comparison.
   No credential values or private records are exposed.
4. Admin-only TestBee SMS diagnostics require a fixed school-owned test number,
   explicit action, same-origin request, server-side rate limiting and inclusive SIM
   policy confirmation. Status **queued** never implies handset-delivered.
5. Only school-approved administrators can access diagnostic and registry operations.

## CI proof and tests

- Node regression: OTP proof binding, role route restrictions, QR confirmation,
  atomic exit, consent-only geolocation, SMS fail-closed behavior.
- Disposable PostgreSQL: migrations 09-13 plus guardian and OTP-proof transaction
  and RLS tests. **Does not imply live Supabase migration succeeded**.
- Browser: multiple mobile widths, new/returning SMS step, fail-closed SMS
  provider, pending QR display and scanning workflow.
- All CI SMS sends are mocked; no real number or carrier is contacted.

## Physical staging and production go/no-go

- [ ] Confirm staging Supabase project identity and apply migration 13 there;
      validate RLS, privileges, migration history and backup/restore.
- [ ] Rotate previously exposed TextBee key and configure the correct Android
      device, school-owned SIM and carrier-inclusive SMS policy.
- [ ] Verify real SMS reception, free quota handling, OTP expiration, resend
      limits, timeouts and gateway disconnects on two different phones.
- [ ] Verify school-approved face/liveness provider and child safeguarding
      policy on real enrolled test identities with consent; never accept a mock
      provider in production.
- [ ] Verify camera scanning and checkout on the actual gate devices, weak
      network, offline pass retrieval, admin/guard role separation and incidents.
- [ ] Obtain privacy, location-sharing, photo retention and accessibility approval.
- [ ] Rehearse rollback and confirm no active visitors become orphaned.
- [ ] Review pull request and explicitly approve the full production migration.
      The current production hotfix stays live until these release gates pass.
