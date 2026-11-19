# Bantay-Agapay · Location Tracking V2 (Staging Release)

**Release state:** Integrated on feature/client-compliance-integration-20261117.
**Safety:** This change is NOT applied to live Supabase and NOT deployed to Vercel production.

## Why it changed
The new visitor `/pass/[token]` displayed gate status but did not send GPS,
while the old `/visit/status/[token]` page used the unsafe anonymous
`update_visit_location(varchar,numeric,numeric)` RPC. Security displayed old
coordinates without accuracy and reinitialized Leaflet on each roster refresh.

## Visitor
- Start location sharing **only after actual gate admission** and an explicit
  button tap on the visitor's current QR pass.
- The phone must be the original browser used for SMS-verified registration;
  server signs a 72-hour HttpOnly, Secure, SameSite=Lax device cookie after
  successful registration. **A copied QR token cannot upload GPS.**
- GPS permission is requested by the browser when the visitor taps Start.
  Location sharing is voluntary and is never needed for QR, gate approval,
  campus walking directions, or checkout.
- Foreground `watchPosition` collects updates while the visitor keeps the
  page visible. Throttles uploads, filters accuracy over 150 meters, rejects
  stale or malformed samples and provides clear denial/network feedback.
- Updates suspend when page is hidden. Background or lock-screen live tracking
  is **not guaranteed** by browser geolocation.
- Stop disables collection and erases the active GPS reading. Server and DB
  enforce entry/consent/checkout rules; unconfirmed network stop is shown.
- Legacy visit pages no longer use anonymous QR-only GPS tracking.
- Reopening the pass on another phone still presents the QR but cannot send
  GPS without a newly approved device-verification flow.

## Security personnel
- Staff-only `/api/security/inside` returns location status per active visit:
  `SHARING_ACTIVE` (<=45 sec), `DELAYED` (46–120 sec),
  `STALE` (>120 sec), `LOW_ACCURACY`, `WAITING_FOR_GPS`,
  `NOT_SHARED`.
- GPS coordinates are returned **only when consented, accurate, and at most
  120 seconds old**. Never display stale or unconsented coordinates.
- Roster displays last-update time and ±accuracy. Staff can filter visitors,
  examine a recent approximate map pin, and use normal QR checkout.
- Leaflet map and accuracy circle are kept stable between roster refreshes.
  Staff polling is 15 seconds while the page is visible, rather than
  false claims of continuous tracking.
- Staff must not treat GPS as face verification, indoor floor positioning,
  emergency rescue tracking, an entry condition or child-release authority.

## Administrator
- Private diagnostics now check migration-14 location consent columns and
  verified registration browser-signing prerequisites.
- Admin retains control of approved school map, gate and destination
  walking routes independently of GPS.
- A published campus walkway is NOT derived from device latitude/longitude.

## Database migration 14
`supabase/migrations/14_opt_in_visitor_location.sql`:
1. Adds opt-in consent, accuracy, and timestamp fields to active `visits`.
2. Clears older unconsented GPS values.
3. Installs trigger to clear location on Stop, Exit and Denial.
4. Revokes public `EXECUTE` permission on the old QR-only location RPC.

**Deploy migration 14 only after staging migrations 09–13.**
Migrations 13 and 14 are NOT applied to the live school project by CI.
A database regression uses disposable PostgreSQL 16 and fictional data.
Do not backfill consent or enable sharing automatically.

## Physical school acceptance tests
- [ ] Confirm the exact **staging** Supabase project and apply migration 14
      after migrations 09–13. Verify direct public RPC invocation now fails.
- [ ] Set correct SMS/OTP configuration for staging; rotate the previously
      exposed TextBee key before activating phone verification.
- [ ] Register visitor on Phone A, verify OTP, admit using Guard B.
- [ ] See location Start on original Phone A after gate admission, not before.
- [ ] Confirm QR screenshot in another phone cannot upload location.
- [ ] Deny GPS permission and verify entry/QR remain functional.
- [ ] Start sharing outdoors, then test indoor low accuracy, 4G loss,
      page backgrounding, phone lock, network reconnect, and stale marker.
- [ ] Confirm staff GPS status changes from active to delayed to stale and
      that no coordinates appear for stale/not-shared visitors.
- [ ] Stop tracking and verify current GPS columns clear in the DB.
- [ ] Check out and verify automatic GPS erasure even on a network race.
- [ ] Test mobile Leaflet performance, campus map compatibility, strong
      permissions, retention notice and school privacy approvals.
- [ ] Rehearse rollback and record independent consent and guardian
      safeguarding review. Production remains unchanged until approved.

## Explicitly out of scope for the initial release
- Silent 24/7 location monitoring or tracking a visitor after checkout.
- Guaranteeing accurate GPS for rooms, floors, or indoor corridors.
- Unauthenticated Supabase Realtime broadcasts. Real-time streaming is
  deferred until a **private staff-authorized** channel can be reviewed.
  Approved staff polling is the safe, working fallback.
- A new-device SMS re-verification journey. Location is optional and
  currently available on the original registration device only.
- School-wide GPS movement history or child tracking.
