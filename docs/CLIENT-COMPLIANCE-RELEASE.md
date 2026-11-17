# Client-compliance development release gates

Branch: feature/client-compliance-integration-20261117

**Do not release to Vercel or merge main until ALL checks pass.** Build in a separate branch.
Do not run these migrations on the connected live Supabase project.

## Release gates
- [ ] Staging DB restored from sanitized schema, migration runs with no failures
- [ ] Guardian student relationship integrity and fail-closed mismatch scenarios tested
- [ ] Reference images and student data are inaccessible through anonymous clients
- [ ] School staff authorizes enrollment records and enrollment updates are audited
- [ ] Pre-register from home; no GPS requirement, saved QR and offline presentation
- [ ] Guard scans QR, checks reference and details, records both entry and exit
- [ ] No guardian mismatch / missing relationship can be approved by standard guard
- [ ] Face capture vs actual reference comparison and anti-spoof safeguards evaluated on real phone
- [ ] Returning visitor cannot claim another person's saved identity by phone alone
- [ ] Map route only after entry and verified admin-published walkway
- [ ] Admin reports and alerts, audit, privacy retention and incident workflows
- [ ] Mobile 320 / 375 / 390 / 768 / desktop visual QA; no overflow
- [ ] All automated tests including RLS and E2E, and physical gate acceptance
- [ ] Staging backup, restore rehearsal, production migration and rollback documented
- [ ] One reviewed final release to main and Vercel

## Important distinctions
- A captured selfie and blink/turn prompts are NOT biometric identity matching.
- **No automatic identity-verified status** without independently tested comparison.
- For child emergency releases, QR entry does NOT authorize taking a child out of school.
- Pre-registered does not count as physically inside. Gate entry timestamps start only when approved.
- Any school-student or guardian personally identifying data requires authorized school governance.


## Progress checkpoint: November 17, 2026
Implementation includes a student/guardian registry, pre-registration from home with an
offline-presentable QR, data and relationship verification, atomic entry/exit processing,
manual photo review, an optional approved-provider biometric comparison adapter,
faculty office mapping, mobile visitor/security/admin screens, audit and incident reports,
privacy request registers, and safeguarded rejection of legacy security-bypassing routes.

**Still required before release**:
- School-approved biometric comparison and liveness provider, calibrated threshold and bias/error testing with consented participants. Code fails closed while unconfigured.
- Secure returning-visitor identity-based prefill (e.g. school-approved OTP); phone-only lookup has been retired.
- Isolated Supabase staging database to apply and test migrations 09/10, storage access and transaction RPCs, then rehearse backup/rollback.
- Approved retention and erasure enforcement. Current retention settings are only policy targets.
- Rate limiter has been added, but its server secret and database RPC must be configured and verified in staging; a WAF policy is also needed.
- Real smartphone camera, QR, GPS and actual campus route tests, plus school policy/legal review.
- Final change freeze, one reviewed merge into main and one production deployment.


### School-approved biometric comparison setup
Comparison is disabled until server-only BA_FACE_COMPARISON_URL (HTTPS), BA_FACE_COMPARISON_SECRET and
BA_FACE_MIN_CONFIDENCE are configured for an approved service with an independently tested liveness check.
Without this service or a confident match, guardians cannot be approved by ordinary gate operations.

### Abuse limit setup
BA_RATE_LIMIT_SECRET must be provisioned as a server-only HMAC key of at least 32 characters.
The private rate-limit table and service-role-only RPC must be applied in staging and tested.


### Returning visitor SMS OTP (development-only)
The request and confirmation endpoints are implemented, but not activated in production.
BA_OTP_HMAC_SECRET (min 32 characters), BA_SMS_GATEWAY_URL (approved HTTPS school gateway),
and BA_SMS_GATEWAY_SECRET (min 24 characters) must be configured before staging tests.
The provider must accept JSON {to, message} using a server-side Bearer token.
Codes expire after five minutes, cannot be replayed, and do not authorize guardian status.
Unknown phone numbers receive the same generic acknowledgement. Phone possession only
unlocks minimal profile prefill; child data and previous face images are never returned.
Add reviewed costs, SMS privacy authorization, phone recycling policy, and gateway reliability tests before release.


### Zero-paid-SMS release policy (November 2026)
The default returning-visitor route is manual pre-registration without any SMS or OTP charges.
Only optionally enable textbee's **Free** plan with an Android phone already owned by the school,
and a SIM whose existing plan includes SMS. Carrier SMS charges are NOT covered by textbee's
free gateway; setting the flag does not prove the carrier tariff is free.
Free tier provider limits: 1 phone, 50 combined messages daily, 300 monthly. No auto-upgrade.
The free SMS provider is **strictly** limited to https://api.textbee.dev/api/v1/gateway/send-sms.
Required server-only settings for optional SMS: `TEXTBEE_API_KEY`,
`BA_FREE_SMS_ONLY=true`, and `BA_SMS_CARRIER_INCLUDED=true`; optionally `TEXTBEE_DEVICE_ID`.
`BA_OTP_HMAC_SECRET` and `BA_RATE_LIMIT_SECRET` remain mandatory for OTP and throttling.
Do **not** set `BA_SMS_CARRIER_INCLUDED` without checking the SIM plan and its fair-use rules.
If the phone, SIM, free tier, or internet connection is unavailable, visitors still register
normally with a new face capture and QR; guards perform identity and guardian validation at gate.
The previous generic paid external SMS gateway configuration is not used by the adapter.
