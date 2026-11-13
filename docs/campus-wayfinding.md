# Bantay-Agapay campus wayfinding

The route editor is available at **Admin → Destinations → Draw Campus Walking Routes** or `/admin/wayfinding`. It uses the existing `/campus-map.png` image at 2048×1536 native coordinates (not GPS).

## How an administrator publishes a route

1. Sign in with an **ADMIN** account.
2. Choose **Set Main Gate**, click the actual visitor entrance on the map and save.
3. Select a faculty office/building, use **Choose Destination Pin** and click its location. Save.
4. Choose **Edit Walking Path** and tap *each real, permitted walkway turn* in order from the gate to the destination. The first/last points are added automatically.
5. Optionally add verified, line-separated textual directions.
6. Save an unpublished draft; review for obstructions, stairs/accessible routes, forbidden areas, maintenance closures.
7. Publish only after walking the exact route and confirming it is safe.

The published path is stored per destination as JSON in the existing `public.system_settings` table (`campus_wayfinding_route_<uuid>`) and the gate location as `campus_wayfinding_gate_v1`. **No database migration or new public table permissions are required.**

Changing a pin or gate makes old paths invalid until republished. An inactive destination has no public path. Access to route editing is protected by `verifyStaff()` with the `ADMIN` role.

## Visitor experience

Only an active visit with status `INSIDE` gets a published walkway overlay in `/visit/directions/[token]`. The visitor sees the school map, a green start marker, the approved dashed maroon path with direction arrows, a destination marker, and optional administrator-written instructions. Before entry approval, after exit, and when the route is missing or stale, the page explicitly asks the visitor to consult security rather than inventing a route.

The directions **do not provide live position, navigation, accessibility guarantees or temporary closure detection**. The school must verify and update paths as conditions change. A bearer QR token grants limited read access to *that visit's destination and published route*, but not the admin editor or the settings store.

## Operational checks before using real visitor data

- Validate admin gate, map pins, and at least one route with a responsible campus representative.
- Use a test-only visit or an authorized staff account to test security approval and route visibility without exposing visitor photos/data.
- Verify all routes against physical campus obstacles, restricted areas, and emergencies.
- Do not run the original destructive `00_initial_schema.sql` migration in a live database.
