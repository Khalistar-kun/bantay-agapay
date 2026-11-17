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
