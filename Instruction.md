# BANTAY-AGAPAY
## COMPLETE CLAUDE CODE MASTER DEVELOPMENT PROMPT

You are the lead full-stack developer responsible for building **Bantay-Agapay**, a web-based QR, Face Verification, GPS-Based Visitor Monitoring and Campus Wayfinding System for:

**Assemblywoman Felicita G. Bernardino Memorial Trade School (AFGBMTS)**

This is a school/thesis project.

Your responsibility is not merely to generate pages or mockups.

You must build a functional end-to-end system.

The highest priority is:

**FOUNDATION FIRST → CORE FUNCTIONALITY → COMPLETE WORKFLOW → TEST → POLISH**

We need to finish the functional MVP as quickly as reasonably possible without creating a weak technical foundation.

---

# 1. PRIMARY SYSTEM OBJECTIVE

Bantay-Agapay improves the school's visitor-management process by providing:

- QR-based visitor registration
- Digital visitor registration
- Visitor profile management
- Face capture and face verification
- GPS-based location verification
- Security approval
- Digital check-in
- Real-time visitor status
- Digital check-out
- Centralized visitor records
- Visitor history
- Security monitoring
- Administrative monitoring
- Destination management
- Campus wayfinding
- Visitor directions

The system should make visitor registration MORE convenient than a manual logbook.

Technology must reduce friction rather than create additional unnecessary steps.

---

# 2. CORE USER EXPERIENCE

The primary visitor journey is:

**SCAN → REGISTER → DESTINATION → FACE → GPS → SUBMIT → APPROVAL → DIRECTIONS → ENTER → CHECK OUT**

Detailed:

Visitor arrives at AFGBMTS

↓

Visitor scans permanent QR at Security desk

↓

Bantay-Agapay website opens

↓

Visitor completes short registration form

↓

Visitor selects destination

↓

Visitor performs face capture/verification

↓

System performs one-time GPS location verification

↓

Visitor submits registration

↓

Security receives registration

↓

Security reviews visitor

↓

Security approves or denies entry

↓

If approved, visitor receives destination information and campus directions

↓

Visitor enters school

↓

Security sees visitor as currently INSIDE

↓

Visitor completes purpose of visit

↓

Visitor returns/leaves through Security

↓

Security checks visitor out

↓

Status becomes EXITED

↓

Complete visit remains in visitor history

This workflow is the HEART of the application.

---

# 3. DEVELOPMENT PHILOSOPHY

We need to finish this quickly.

Therefore:

DO NOT overengineer.

DO NOT spend the first stages creating elaborate animations.

DO NOT build unnecessary features.

DO NOT rewrite working functionality simply because you personally prefer another architecture.

DO NOT introduce services that are unnecessary.

DO NOT create dozens of abstraction layers.

DO NOT stop constantly for minor implementation decisions.

Make sensible engineering decisions and continue.

Ask for clarification only when a critical requirement cannot safely be inferred.

Prioritize:

1. Working functionality
2. Security
3. Data integrity
4. Usability
5. Maintainability
6. Performance
7. Visual polish

---

# 4. ZERO-COST / FREE-TIER REQUIREMENT

The MVP must be capable of running at approximately:

**₱0 / $0 infrastructure cost**

for reasonable thesis/testing usage.

Primary infrastructure:

## Deployment

**Vercel Free/Hobby**

Use for:

- Next.js application
- Server-side Next.js functionality
- Route handlers where required

## Backend

**Supabase Free**

Use for:

- PostgreSQL database
- Authentication
- Storage
- Realtime
- Row Level Security

## Repository

**GitHub**

Use for:

- Source control
- Version history
- Vercel deployment

Before introducing ANY additional external service, determine whether it:

1. Has a genuinely usable free tier.
2. Requires billing information.
3. Has usage limits that could break the thesis demonstration.
4. Can instead be implemented locally/client-side.
5. Can instead use existing Supabase/Next.js functionality.

Prefer free/open-source implementations.

Do NOT introduce paid dependencies into the MVP.

---

# 5. DO NOT USE PAID SERVICES

Do NOT require:

- Google Maps API
- Paid mapping APIs
- Paid face recognition APIs
- AWS
- Azure
- Paid Firebase services
- OpenAI API
- Claude API
- Gemini API
- Paid AI APIs
- Paid SMS APIs
- Paid email APIs
- Paid geolocation APIs
- Paid analytics platforms
- Paid image hosting
- Paid database services
- Paid dedicated servers
- Paid VPS
- Paid Python hosting

If functionality can be implemented using:

- Browser APIs
- Next.js
- Supabase
- Open-source libraries
- Static assets

use those first.

---

# 6. CORE TECH STACK

Use this architecture unless the existing repository already contains a compatible implementation that should be preserved.

## Framework

Use:

**Next.js + TypeScript**

Use the stable App Router architecture.

Next.js should handle:

- Visitor interface
- Security interface
- Administrator interface
- Server-side logic
- Route handlers
- Protected routes
- Authentication integration
- Form processing
- Deployment

Do NOT create a separate Express backend unless there is a genuine technical requirement.

---

# 7. UI STACK

Use:

- Tailwind CSS
- shadcn/ui
- Lucide Icons

Forms:

- React Hook Form
- Zod

Use shared validation schemas wherever practical.

Validate important input on both the client and trusted server/database boundary.

---

# 8. SUPABASE ARCHITECTURE

Supabase is the primary backend platform.

Use:

## PostgreSQL

For relational application data.

## Supabase Auth

Only:

- Security Personnel
- Administrator

require authenticated staff accounts.

Visitors do NOT require accounts.

## Supabase Storage

Use private storage where sensitive images must be stored.

Never expose visitor face images through a public bucket.

## Supabase Realtime

Use only where realtime functionality provides actual value.

Examples:

- New visitor appears on Security Dashboard
- Visitor approval changes
- Visitor waiting page receives approval
- Currently Inside list updates

Do NOT unnecessarily subscribe every page to Realtime.

Properly unsubscribe from channels.

---

# 9. USER ROLES

There are THREE primary operational roles.

# ROLE 1 — VISITOR

Visitor does NOT need:

- Account
- Password
- Application installation

Visitor can:

- Scan Security QR
- Open visitor registration
- Enter visitor information
- Select destination
- Capture face
- Perform location verification
- Submit visit
- View approval status
- View destination
- View campus directions

---

# ROLE 2 — SECURITY PERSONNEL

Security requires authentication.

Security can:

- Log in
- View pending visitors
- Receive new visitor registrations
- Review visitor information
- Review face verification status
- Review GPS verification status
- Approve visitor
- Deny visitor
- View Currently Inside
- Check visitor out
- View today's activity
- Search operational visitor records

Security CANNOT:

- Create administrators
- Modify sensitive system configuration without permission
- Delete historical records arbitrarily
- Bypass audit logging

---

# ROLE 3 — ADMINISTRATOR

Administrator requires authentication.

Administrator can:

- View dashboard
- View visitor records
- Search visitor history
- View pending visitors
- View currently inside visitors
- View exited visitors
- View denied visits
- Manage Security accounts
- Manage destinations
- Manage campus wayfinding information
- Manage system settings
- View verification records
- View audit logs
- View basic reports/statistics

Do NOT create separate:

- Student role
- Teacher role
- Employee role

unless explicitly requested later.

Teachers/personnel may be destinations or people to visit without requiring their own system account.

---

# 10. VISITOR ENTRY QR

Security will have a permanent QR code physically displayed on the Security desk/table.

Example URL:

`https://<deployment-domain>/visit`

The QR only opens Bantay-Agapay.

Do NOT put visitor PII inside the QR.

The QR should be reusable.

Visitor process:

Open phone camera

↓

Scan QR

↓

Bantay-Agapay opens

No app installation.

No visitor login.

---

# 11. SECURITY QR POSTER

Create a printable QR poster/page.

Example:

AFGBMTS LOGO

WELCOME TO AFGBMTS

VISITOR REGISTRATION

Scan the QR code below to register your visit.

[ LARGE QR ]

SCAN TO REGISTER

Bantay-Agapay  
AFGBMTS Visitor Monitoring System

The QR must remain readable when printed.

---

# 12. VISITOR REGISTRATION

Keep the form SHORT.

Initial required fields:

- Full Name
- Contact Number
- Visitor Type
- Purpose of Visit
- Destination

Possible visitor types:

- Parent / Guardian
- Alumni
- Guest
- Supplier / Contractor
- Government / Official Visitor
- Other

Do not collect unnecessary information.

Do not add fields simply because they might be useful someday.

---

# 13. DESTINATION SELECTION

Visitor must select where they need to go.

Examples:

- Principal's Office
- Registrar
- Guidance Office
- Clinic
- Administration Office
- Faculty Room
- Cashier
- Senior High School Department
- Specific room
- Specific building
- Other authorized destination

Destinations MUST NOT be hard-coded throughout the frontend.

Create a database-backed destination system.

---

# 14. DESTINATION DATA

Create a `destinations` table.

Recommended fields:

- id
- name
- category
- building
- floor
- room
- description
- landmark
- directions
- map_x
- map_y
- active
- created_at
- updated_at

Example:

Name:
Registrar's Office

Building:
Administration Building

Floor:
Ground Floor

Room:
Room 103

Landmark:
Beside Guidance Office

Directions:
From the Main Gate, follow the covered walkway toward the Administration Building. Enter the building and proceed to Room 103.

---

# 15. FACE CAPTURE

After visitor information:

Request camera permission.

Use:

`navigator.mediaDevices.getUserMedia()`

Provide a simple camera interface.

Example:

FACE VERIFICATION

Please position your face inside the frame.

[ CAMERA ]

Face detected...

The visitor should not have to go through unnecessary:

Capture

→ Confirm

→ Submit

→ Next

screens.

Make the interaction efficient.

---

# 16. FACE PROCESSING — FREE IMPLEMENTATION

The MVP should NOT depend on a paid face-recognition service.

Prefer a maintained open-source browser-compatible solution.

A suitable architecture is a reusable:

`FaceVerificationService`

Possible implementation:

`@vladmandic/human`

or another appropriate free/open-source browser-compatible solution after checking compatibility.

The architecture must allow the implementation to be replaced later.

Do not tightly couple the entire application to one recognition library.

---

# 17. FIRST-TIME VISITOR FACE LOGIC

IMPORTANT:

A first-time visitor does not yet have a trusted previous facial reference.

Therefore do NOT falsely label first enrollment as:

"Identity Verified"

when nothing has actually been compared.

For a first-time visitor:

Capture face

↓

Detect valid face

↓

Create face descriptor/embedding/reference

↓

Store appropriate reference

↓

Security physically reviews visitor

↓

Reference becomes available for future visits

Possible status:

`FACE_ENROLLED`

not:

`FACE_VERIFIED`

---

# 18. RETURNING VISITOR FACE VERIFICATION

For a returning visitor:

Retrieve existing visitor profile

↓

Capture current face

↓

Generate current descriptor

↓

Compare against registered reference

↓

Calculate similarity

↓

Return:

`MATCH`

or

`NO_MATCH`

Store verification result.

Security remains the final gatekeeper.

Automated face verification assists Security rather than independently granting physical access.

---

# 19. RETURNING VISITOR OPTIMIZATION

The system should eventually recognize/retrieve returning visitor records so repeat visitors do not completely re-register.

Possible flow:

Scan QR

↓

Have you visited before?

↓

Enter identifying information

↓

Retrieve visitor profile

↓

Confirm basic information

↓

Enter new Purpose

↓

Select Destination

↓

Face verification

↓

GPS verification

↓

Submit

Do NOT require repeat visitors to re-enter every profile field.

Build the data model from the beginning to support this.

---

# 20. FACE STORAGE STRATEGY

Free-tier storage must be protected.

Do:

- Resize reference images
- Compress images
- Prefer WebP/JPEG
- Store only necessary reference material
- Store embeddings where appropriate
- Remove temporary camera frames
- Use private storage

Do NOT:

- Record video
- Save camera streams
- Save every frame
- Save unnecessary repeated selfies
- Store huge full-resolution photos

---

# 21. GPS LOCATION VERIFICATION

Use:

`navigator.geolocation.getCurrentPosition()`

Do NOT continuously track visitors.

Do NOT use continuous visitor movement monitoring.

The system only needs to verify whether the visitor is within the configured authorized AFGBMTS area during the relevant registration/verification process.

Store:

- GPS verification status
- GPS accuracy
- Distance from school
- Verification timestamp

Avoid permanently storing exact coordinates unless necessary.

---

# 22. GEOFENCE CALCULATION

Store configurable school:

- Latitude
- Longitude
- Allowed radius

Use an appropriate distance calculation such as the Haversine formula.

Process:

Visitor coordinates

↓

Compare with AFGBMTS configured coordinates

↓

Calculate distance

↓

Inside permitted radius?

YES:

`GPS_VERIFIED`

NO:

`OUTSIDE_AUTHORIZED_AREA`

Display a clear result.

---

# 23. NO CONTINUOUS GPS

THIS IS A NON-NEGOTIABLE SCOPE RULE.

Do NOT create:

- Live visitor location tracking
- Continuous GPS tracking
- Movement history
- Visitor path tracking
- Background location monitoring
- Live dots moving around campus

GPS is used for location verification only.

---

# 24. VISIT SUBMISSION

Once visitor has:

- Completed information
- Selected destination
- Completed face process
- Completed GPS verification

show a short summary.

Example:

VISIT SUMMARY

Juan Dela Cruz

Parent / Guardian

Purpose:
Submit Documents

Destination:
Registrar

Face:
Completed

Location:
Verified

[ SUBMIT VISIT ]

When submitted:

Create visit record.

Status:

`PENDING`

Generate human-readable reference:

Example:

`A-014`

Visitor sees:

REGISTRATION COMPLETE

Reference:
A-014

Please wait for Security approval.

---

# 25. DO NOT GENERATE ANOTHER VISITOR QR

The visitor already scanned the Security QR.

Do NOT unnecessarily generate another QR for the visitor to show Security.

Instead:

Visitor submits

↓

Supabase

↓

Security Dashboard receives registration

This eliminates duplicate steps.

---

# 26. SECURITY REALTIME WORKFLOW

When visitor submits:

Security should see:

NEW VISITOR

A-014

Juan Dela Cruz

Parent / Guardian

Purpose:
Submit Documents

Destination:
Registrar

Face:
Enrolled / Match / Review Required

Location:
Verified

Submitted:
10:42 AM

[ VIEW ]

Use Supabase Realtime where appropriate.

---

# 27. SECURITY REVIEW

Visitor detail should display:

- Reference number
- Face/reference photo where authorized
- Full name
- Visitor type
- Contact
- Purpose
- Destination
- Face status
- GPS status
- Registration time

Actions:

`APPROVE ENTRY`

`DENY ENTRY`

Security physically sees the visitor standing at the gate and can perform final visual confirmation.

---

# 28. APPROVAL

When Security approves:

Change:

`PENDING → INSIDE`

Store:

- approved_by
- approved_at
- check_in
- status

Visitor waiting page updates automatically.

Visitor sees:

ENTRY APPROVED

You may now enter AFGBMTS.

Then immediately show:

YOUR DESTINATION

and campus directions.

---

# 29. DENIAL

If Security denies:

Change:

`PENDING → DENIED`

Store:

- denied_by
- denied_at
- denial_reason where applicable

Visitor sees a respectful message indicating that entry was not approved and to speak with Security if necessary.

Do not expose sensitive internal notes.

---

# 30. CAMPUS WAYFINDING

This is a CORE visitor feature.

After approval, Bantay-Agapay should help visitors find their destination.

Example:

YOUR DESTINATION

Registrar's Office

Administration Building  
Ground Floor  
Room 103

Landmark:

Beside Guidance Office

[ VIEW CAMPUS MAP ]

---

# 31. CUSTOM AFGBMTS CAMPUS MAP

Do NOT use Google Maps API.

Create a custom campus map.

Preferred implementation:

**SVG-based AFGBMTS campus map**

Benefits:

- Free
- Lightweight
- Interactive
- Scalable
- Works on mobile
- Destination markers can be positioned programmatically

Store map as project/static asset.

Destinations contain normalized coordinates:

Example:

`map_x = 42`

`map_y = 65`

Use them to position destination markers.

---

# 32. CAMPUS DIRECTIONS

Example:

MAIN GATE

↓

Covered Walkway

↓

Administration Building

↓

Registrar's Office

Show:

YOU ARE HERE

and:

YOUR DESTINATION

Do NOT build complex indoor GPS navigation.

Use:

- Campus map
- Building
- Floor
- Room
- Landmarks
- Written instructions
- Highlighted destination
- Optional predefined route

This is sufficient for the MVP.

---

# 33. WAYFINDING PAGE

Suggested route:

`/visit/directions/[visitId]`

Display:

YOUR DESTINATION

Registrar's Office

Administration Building  
Ground Floor  
Room 103

Landmark:
Beside Guidance Office

Directions:
Main Gate → Covered Walkway → Administration Building → Registrar

[ CAMPUS MAP ]

Make this extremely easy for visitors of different ages to understand.

---

# 34. CURRENTLY INSIDE

Security Dashboard should contain:

CURRENTLY INSIDE

Example:

Juan Dela Cruz

Destination:
Registrar

Purpose:
Submit Documents

Entered:
10:43 AM

Duration:
34 minutes

Status:
INSIDE

No live GPS position.

Realtime refers to current visit STATUS, not physical movement tracking.

---

# 35. CHECKOUT

When visitor leaves:

Security opens Currently Inside.

Select visitor.

Click:

`CHECK OUT`

Store:

- check_out
- duration
- processed_by

Change:

`INSIDE → EXITED`

Visitor does not need their phone during checkout.

This ensures checkout still works if:

- Phone battery dies
- Browser was closed
- Visitor has no internet
- Visitor lost the registration page

---

# 36. STATUS MODEL

Keep statuses simple.

Use:

`PENDING`

`INSIDE`

`EXITED`

`DENIED`

Optional:

`CANCELLED`

Do NOT create excessive statuses.

Face/GPS verification statuses should be separate from the main visit lifecycle.

---

# 37. DATABASE FOUNDATION

Design a clean relational schema.

At minimum:

## profiles

Authenticated staff.

Fields:

- id
- full_name
- email
- role
- active
- created_at
- updated_at

Roles:

`ADMIN`

`SECURITY`

---

## visitors

Reusable visitor identity/profile.

Fields:

- id
- full_name
- contact_number
- visitor_type
- face_reference_path
- face_embedding or appropriate reference
- created_at
- updated_at

One visitor can have MANY visits.

Do not create a completely new visitor identity every time the same person visits if the existing visitor can safely be matched.

---

## destinations

Fields:

- id
- name
- category
- building
- floor
- room
- description
- landmark
- directions
- map_x
- map_y
- active
- created_at
- updated_at

---

## visits

Fields:

- id
- visitor_id
- destination_id
- reference_number
- purpose
- status
- registration_time
- approved_at
- approved_by
- check_in
- check_out
- denied_at
- denied_by
- denial_reason
- created_at
- updated_at

---

## verification_logs

Fields:

- id
- visit_id
- face_status
- face_similarity
- gps_status
- gps_accuracy
- distance_from_school
- verified_at

Add other verification metadata only when justified.

---

## system_settings

Store configuration such as:

- School name
- School coordinates
- Geofence radius
- Main gate map location
- Registration configuration

Do not scatter configuration values across source code.

---

## audit_logs

Fields:

- id
- user_id
- action
- entity_type
- entity_id
- metadata
- created_at

Important administrative/security actions should be auditable.

---

# 38. DATABASE RELATIONSHIPS

Conceptually:

VISITOR

1 → MANY VISITS

DESTINATION

1 → MANY VISITS

VISIT

1 → MANY VERIFICATION LOGS where appropriate

PROFILE / SECURITY

1 → MANY APPROVAL/CHECKOUT ACTIONS

This allows:

Juan Dela Cruz

├── Visit 001
├── Visit 002
├── Visit 003
└── Visit 004

without duplicating the visitor profile unnecessarily.

---

# 39. SECURITY AND ROW LEVEL SECURITY

Implement Supabase RLS properly.

Do NOT rely only on frontend UI restrictions.

Visitors:

- Can submit authorized registration data
- Can access only appropriate temporary/public status information
- Cannot browse visitor database
- Cannot access dashboards

Security:

- Can access operational visitor information
- Can approve/deny
- Can check out
- Cannot manage Admin accounts
- Cannot access unauthorized configuration

Admin:

- Authorized administrative access

Never expose privileged Supabase secrets in client-side code.

---

# 40. PUBLIC STATUS SECURITY

Do NOT expose sequential database IDs publicly if avoidable.

Visitor status URLs should use a sufficiently random/unpredictable public reference/token.

Example:

`/visit/status/<secure-token>`

The human-readable:

`A-014`

may still be shown in the UI but should not necessarily be the authorization mechanism for accessing visitor data.

Public visitor status pages should expose only the minimum information required.

---

# 41. AFGBMTS BRANDING

The entire system should visually represent AFGBMTS.

Use the **official AFGBMTS school logo provided by the project/school**.

Do NOT invent a replacement logo.

Do NOT download random unofficial replacements if an official asset is available.

Recommended asset location:

`/public/branding/afgbmts-logo.png`

If the logo is not present:

Create a clear placeholder and tell me where the official logo should be placed.

Do NOT block core development because the final logo file is missing.

---

# 42. LOGO RULES

Maintain original logo proportions.

Do NOT:

- Stretch
- Distort
- Crop incorrectly
- Recolor unnecessarily
- Redesign
- Add random effects
- Generate an AI replacement

Use it consistently.

---

# 43. COLOR SYSTEM

Derive the primary UI palette from the official AFGBMTS logo when the actual logo asset is available.

Create reusable variables/tokens such as:

- primary
- primary foreground
- secondary
- accent
- background
- surface
- muted
- border
- success
- warning
- danger

Do NOT make every component heavily colored.

Use school colors strategically.

Main content should remain clean and readable.

Accessibility and contrast are mandatory.

---

# 44. VISITOR BRANDING

Visitor screens can use:

AFGBMTS LOGO

AFGBMTS

**Bantay-Agapay**

Visitor Monitoring & Assistance System

Example landing:

WELCOME TO AFGBMTS

Visitor Registration

Please complete the following steps before entering.

1. Information
2. Face
3. Location
4. Submit

[ START ]

---

# 45. SECURITY/ADMIN BRANDING

Dashboard header/sidebar:

AFGBMTS Logo

Bantay-Agapay

Navigation:

Dashboard

Pending Visitors

Currently Inside

Visitor Records

Destinations

Reports

Settings

Navigation items must respect role permissions.

---

# 46. UI PRINCIPLES

Visitor UI:

- Mobile first
- Large tap targets
- Large readable text
- Short forms
- Clear progress
- Clear permissions
- Clear errors
- Minimal distractions

Security/Admin:

- Responsive dashboard
- Fast information scanning
- Clear statuses
- Search
- Filters
- Tables/cards where appropriate
- Mobile/tablet compatibility

---

# 47. LOADING AND FEEDBACK

Never leave the user wondering whether something is happening.

Use states such as:

Opening camera...

Detecting face...

Face captured.

Checking location...

Location verified.

Submitting registration...

Waiting for Security approval...

Entry approved.

Checking visitor out...

Use skeleton loaders where appropriate.

Avoid excessive animations.

---

# 48. ACCESSIBILITY

Use:

- Semantic HTML
- Proper labels
- Keyboard accessibility
- Sufficient contrast
- Visible focus states
- Accessible dialogs
- Large mobile controls
- Meaningful error messages

Do not rely only on color to communicate status.

Example:

Do not only show green.

Show:

✓ LOCATION VERIFIED

---

# 49. SUGGESTED ROUTES

Use something similar to:

`/`

Landing

`/visit`

Visitor registration

`/visit/status/[token]`

Visitor waiting/approval

`/visit/directions/[token]`

Campus directions

`/login`

Staff login

`/security`

Security dashboard

`/security/pending`

Pending visitors

`/security/inside`

Currently inside

`/security/history`

Operational history

`/admin`

Admin dashboard

`/admin/visitors`

Visitor records

`/admin/destinations`

Destination management

`/admin/personnel`

Security account management

`/admin/reports`

Reports

`/admin/settings`

System configuration

Do not create unnecessary routes if a cleaner implementation exists.

---

# 50. SUGGESTED CODE ORGANIZATION

Keep organization understandable.

Example:

`app/`

- visit
- login
- security
- admin
- api where needed

`components/`

- visitor
- security
- admin
- map
- shared
- ui

`lib/`

- supabase
- face
- gps
- permissions
- validation
- utils

`types/`

- visitor
- visit
- destination
- verification
- database

Do not create hundreds of tiny files without purpose.

---

# 51. FREE-TIER OPTIMIZATION

The system must respect free-tier limits.

Optimize:

- Database queries
- Storage
- Realtime subscriptions
- Image size
- Network requests
- Server executions

Avoid polling when Realtime already solves the requirement.

Avoid Realtime where normal queries are sufficient.

Avoid unnecessary large assets.

Avoid duplicate face images.

Avoid excessive database reads.

---

# 52. ERROR HANDLING

Handle important failures.

Examples:

## Camera denied

Explain how visitor can allow camera access.

Provide Security-assisted fallback where appropriate.

## GPS denied

Explain why location is required and how to enable it.

Do not crash.

## GPS inaccurate

Display:

Unable to reliably verify location.

Allow retry.

## Internet interrupted

Preserve form state locally where practical.

Allow retry.

Do not silently create duplicate visits.

## Face detection failed

Allow retry.

Give simple instructions:

- Face camera directly
- Improve lighting
- Remove obstruction where appropriate

## Supabase unavailable

Show meaningful temporary error.

Do not expose technical stack traces to visitor.

---

# 53. PRIVACY

Face information and location information are sensitive.

Collect only what is necessary.

Before face/location processing, clearly explain what is being requested.

Example:

FACE VERIFICATION

Bantay-Agapay uses your face to assist Security in confirming visitor identity.

LOCATION VERIFICATION

Your current location is checked to confirm that registration is being completed within the authorized AFGBMTS area.

Do not imply continuous tracking.

Implement appropriate consent/acknowledgement in the visitor process.

---

# 54. AUDITABILITY

Record important staff actions.

Examples:

- Security approved visitor
- Security denied visitor
- Security checked visitor out
- Admin created Security account
- Admin disabled Security account
- Admin changed destination
- Admin changed system settings

Audit logs should not be casually editable through the normal interface.

---

# 55. REPORTING

Initial reports should remain SIMPLE.

Examples:

- Visitors today
- Visitors by date
- Visitors by type
- Visitors by destination
- Approved visits
- Denied visits
- Completed visits
- Average visit duration if useful

Do NOT spend significant development time building complex analytics before the core workflow works.

---

# 56. DASHBOARD

Admin dashboard may show:

Visitors Today

Currently Inside

Pending Approval

Completed Today

Denied Today

Popular Destinations

Recent Activity

Security dashboard should prioritize operational actions over analytics.

---

# 57. MVP BUILD ORDER

FOLLOW THIS ORDER.

Do not jump directly to cosmetic work.

---

# PHASE 0 — REPOSITORY INSPECTION

Before modifying code:

Inspect the entire repository.

Determine:

- Current framework
- Existing dependencies
- Existing routes
- Existing components
- Existing Supabase setup
- Existing database files
- Existing environment variables
- Existing branding assets
- Existing AFGBMTS logo
- Existing campus map
- Existing working functionality
- Existing errors

Preserve useful working code.

Do not blindly initialize a new project over existing work.

---

# PHASE 1 — FOUNDATION

Build/fix:

1. Next.js
2. TypeScript
3. Tailwind
4. shadcn/ui
5. Supabase clients
6. Environment configuration
7. Database schema/migrations
8. Staff authentication
9. ADMIN/SECURITY authorization
10. RLS
11. Shared TypeScript types
12. Shared validation
13. Base layouts
14. Error handling foundation
15. AFGBMTS branding component
16. Production build

At the end:

Run:

- TypeScript checking
- Lint
- Production build

Fix errors before proceeding.

---

# PHASE 2 — VISITOR CORE

Build the complete visitor path:

`/visit`

↓

Registration

↓

Destination selection

↓

Face capture/enrollment/verification

↓

GPS verification

↓

Review

↓

Submit

↓

Pending status

This must work end-to-end.

---

# PHASE 3 — SECURITY CORE

Build:

Login

↓

Security Dashboard

↓

Pending Visitors

↓

Visitor Details

↓

Approve / Deny

↓

Currently Inside

↓

Check Out

↓

History

Test complete workflow.

---

# PHASE 4 — REALTIME

Connect:

Visitor submission

→ Security Dashboard

Security approval

→ Visitor status page

Checkout

→ Currently Inside list

Do not overuse Realtime.

---

# PHASE 5 — CAMPUS WAYFINDING

Build:

Destination database

↓

Admin destination configuration

↓

AFGBMTS campus map

↓

Map coordinates

↓

Destination marker

↓

Written directions

↓

Approval screen directions

↓

Mobile wayfinding page

---

# PHASE 6 — ADMIN

Build:

Admin Dashboard

Visitor Records

Destination Management

Personnel Management

Settings

Basic Reports

Audit Log Viewer where appropriate

---

# PHASE 7 — RETURNING VISITORS

Optimize repeat visitors.

Build safe visitor lookup.

Reuse visitor profile.

Perform face comparison.

Require only visit-specific information again.

---

# PHASE 8 — POLISH

ONLY after the workflow works:

Improve:

- Responsive layout
- Loading states
- Skeletons
- Empty states
- Accessibility
- Form UX
- Error UX
- Dashboard visualization
- Performance
- Branding consistency
- Small animations

Do not let polish delay functionality.

---

# 58. TESTING CHECKLIST

Test at minimum:

## Visitor

- QR opens website
- Registration works
- Validation works
- Destination loads
- Camera permission works
- Camera denial handled
- Face capture works
- GPS permission works
- GPS denial handled
- Outside radius handled
- Submission works
- Duplicate submission prevented
- Pending screen works
- Approval updates
- Directions display

## Security

- Login works
- Unauthorized user blocked
- Pending visitors display
- Visitor details display
- Approval works
- Denial works
- Currently Inside updates
- Checkout works
- History works

## Admin

- Admin route protection
- Visitor search
- Destination CRUD
- Security account management
- Settings
- Reports

## Security

- RLS tested
- Public user cannot query visitor database
- Security cannot perform Admin-only action
- Private face storage inaccessible publicly
- Secrets absent from client bundle

---

# 59. PRODUCTION BUILD RULE

After every major phase:

Run appropriate:

- Type check
- Lint
- Tests if available
- Production build

Do not accumulate dozens of errors and attempt to fix everything at the end.

Keep the application deployable.

---

# 60. DEPLOYMENT TARGET

Deployment architecture:

GitHub

↓

Vercel Free/Hobby

↓

Next.js

↓

Supabase Free

No VPS.

No Docker production requirement.

No dedicated server.

No paid face API.

No paid maps.

No paid database.

No paid AI.

Document:

- Environment variables
- Supabase setup
- Database migration/setup
- Vercel deployment
- Required configuration

Create/update:

`.env.example`

Never commit actual secrets.

---

# 61. MVP DEFINITION OF DONE

Do NOT tell me the MVP is complete because pages exist.

The MVP is complete when the following REAL workflow works:

Visitor arrives

↓

Scans Security QR

↓

Website opens

↓

Visitor registers

↓

Visitor selects destination

↓

Face process completes

↓

GPS verification completes

↓

Visitor submits

↓

Visit becomes PENDING

↓

Security receives registration

↓

Security reviews visitor

↓

Security approves

↓

Visit becomes INSIDE

↓

Visitor receives approval

↓

Visitor receives destination information

↓

Visitor can view AFGBMTS campus map

↓

Visitor can follow directions

↓

Security sees visitor as Currently Inside

↓

Visitor finishes visit

↓

Visitor returns/leaves

↓

Security checks visitor out

↓

Visit becomes EXITED

↓

Complete visit is stored

↓

Admin can search/review the visit

↓

Returning visitor can eventually reuse profile

↓

System builds successfully

↓

System can deploy using Vercel + Supabase free-tier architecture

That is the definition of a functional Bantay-Agapay MVP.

---

# 62. NON-GOALS

DO NOT build these unless explicitly requested later:

- Native Android app
- Native iOS app
- Live visitor GPS tracking
- Student tracking
- Teacher tracking
- Employee tracking
- Facial surveillance
- Unknown-person identification
- CCTV integration
- SMS system
- Paid email service
- AI chatbot
- Generative AI
- Google Maps API
- Complex indoor GPS navigation
- Microservices architecture
- Kubernetes
- Redis
- Dedicated Express backend
- Dedicated Python production server
- Visitor passwords
- Separate teacher accounts
- Blockchain
- Unnecessary AI functionality

Stay focused.

---

# 63. IMPORTANT UX PRINCIPLE

Never make the digital system more troublesome than the manual logbook.

Every visitor step must have a reason.

Avoid duplicate actions.

Do not ask visitors for information the system already knows.

Do not make visitors scan multiple QR codes unnecessarily.

Do not make visitors repeatedly capture their face.

Do not make visitors manually refresh for approval.

Do not require visitors to use their phone for checkout.

For returning visitors, reduce repeated information entry.

The system should feel FAST.

---

# 64. IMPORTANT SECURITY PRINCIPLE

Convenience must not mean insecure implementation.

Use:

- RLS
- Server-side authorization where necessary
- Private storage
- Input validation
- Secure tokens
- Minimal public data
- Audit logs
- Proper role permissions
- Environment variables
- Least-privilege access

Never solve a development problem by disabling security globally.

---

# 65. IMPORTANT DATA PRINCIPLE

Visitor Profile and Visit Record are DIFFERENT.

Visitor:

Juan Dela Cruz

can have:

Visit 001 — Registrar

Visit 002 — Guidance

Visit 003 — Principal

Visit 004 — Registrar

Do not create four completely unrelated Juan Dela Cruz identities unnecessarily.

Design relationships correctly from the beginning.

---

# 66. IMPORTANT WAYFINDING PRINCIPLE

Bantay-Agapay is not only:

"Who entered the school?"

It should also help answer:

"Why are they here?"

"Where are they supposed to go?"

"How can they find it?"

The system should reduce the need for visitors to repeatedly ask Security:

"Where is the Registrar?"

or:

"Where is the Guidance Office?"

Destination information and campus directions are part of the visitor experience.

---

# 67. IMPORTANT THESIS SCOPE PRINCIPLE

Preserve the intended system scope.

Bantay-Agapay uses:

- QR
- Face verification
- GPS location verification
- Digital visitor records

GPS does NOT mean continuous tracking.

Real-time visitor status means the system knows operational states such as:

PENDING

INSIDE

EXITED

It does NOT mean continuously watching the visitor's physical location.

Do not silently expand the system into surveillance.

---

# 68. IF SOMETHING IS MISSING

If something like:

- AFGBMTS logo
- Exact school GPS coordinates
- Campus map
- Actual destination list
- Room numbers

is unavailable:

DO NOT stop all development.

Create the architecture and use clearly marked temporary placeholders/configuration.

Example:

`TODO: Replace with verified AFGBMTS coordinates`

Do NOT invent factual school information and present it as real.

Tell me what real information/assets need to be supplied.

Continue building everything else that does not depend on it.

---

# 69. CLAUDE CODE WORKING BEHAVIOR

You are operating as an implementation agent.

Do not spend the majority of your response explaining what you COULD build.

BUILD IT.

Use this cycle:

Inspect

↓

Implement

↓

Run

↓

Test

↓

Fix

↓

Continue

Avoid repeated planning loops.

Do not repeatedly regenerate the same plan.

Keep explanations concise while coding.

When you encounter an error:

Investigate root cause.

Do not immediately replace the entire implementation.

Fix the underlying issue.

---

# 70. FIRST ACTION

START NOW.

First inspect the existing repository thoroughly.

Then give me a SHORT assessment containing:

### Existing

What already exists and works.

### Missing

What foundation/core functionality is missing.

### Reusable

What existing code/components/configuration can be preserved.

### Blockers

Only actual blockers requiring information from me.

Then immediately begin **PHASE 1 — FOUNDATION**.

Do not wait for another confirmation unless there is a genuine blocker.

---

# 71. DEVELOPMENT PRIORITY

If forced to choose between:

Beautiful UI but incomplete workflow

OR

Simple UI with complete working workflow

choose:

**SIMPLE UI WITH COMPLETE WORKING WORKFLOW.**

We can polish the UI later.

---

# 72. FINAL DEVELOPMENT PRINCIPLES

Remember these throughout the entire implementation:

**Foundation first.**

**Complete the core flow quickly.**

**Keep the visitor experience simple.**

**Three roles only: Visitor, Security, Admin.**

**Visitors do not need accounts.**

**Security controls entry and checkout.**

**Admin controls the system.**

**Face verification assists identity verification.**

**GPS verifies location but does not continuously track visitors.**

**Campus wayfinding helps visitors reach their destination.**

**AFGBMTS official logo and identity drive the visual design.**

**Use Vercel and Supabase free tiers.**

**Prefer browser-native and open-source functionality.**

**Do not introduce paid dependencies.**

**Do not overengineer.**

**Do not sacrifice security.**

**Do not invent missing AFGBMTS information.**

**Keep the project buildable and deployable throughout development.**

**FUNCTIONALITY FIRST. POLISH LAST.**

Now inspect the repository and begin implementation.
