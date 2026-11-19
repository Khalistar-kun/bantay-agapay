-- =======================================================================
-- BANTAY-AGAPAY 00-14 · ONE-SHOT SCHEMA BOOTSTRAP (FRESH SUPABASE ONLY)
-- =======================================================================
-- Exact ordered migration bodies from:
--   Khalistar-kun/bantay-agapay
--   feature/client-compliance-integration-20261117
--   Source commit: eb1b13d6ed235f4ad7e2a63663208586683c593d
--
-- HIGH-RISK WARNING:
--   00_initial_schema.sql contains DROP TABLE ... CASCADE.
--   05_real_campus_destinations.sql contains DELETE FROM destinations.
--   DO NOT RUN this bundle on an existing Bantay-Agapay database.
--
-- This file includes a fail-closed preflight that ABORTS if it detects
-- application tables, reserved functions or app storage buckets.
-- If you already applied any Bantay-Agapay migration, use the missing
-- *incremental* migrations instead. This is not a database reset script.
--
-- Run once as a privileged role in Supabase SQL Editor, on a new project.
-- All source migrations execute in one transaction. Any statement failure
-- rolls back the entire bootstrap, including the original 00/05 operations.
-- Verify a backup, the destination campus seeds, and school access/privacy
-- policies before using with real staff, students or visitors.
-- =======================================================================

BEGIN;

DO $fresh_install_preflight$
DECLARE
  v_name text;
BEGIN
  IF to_regclass('auth.users') IS NULL OR to_regclass('storage.buckets') IS NULL THEN
    RAISE EXCEPTION 'BANTAY-AGAPAY: Expected a Supabase project with auth and storage schemas. Aborting.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    RAISE EXCEPTION 'BANTAY-AGAPAY: Required Supabase API roles are missing. Aborting.';
  END IF;
  FOREACH v_name IN ARRAY ARRAY[
    'profiles','visitors','destinations','visits','verification_logs',
    'system_settings','audit_logs','staff_sessions','staff_invites',
    'students','authorized_guardians','faculty_directory','student_guardians',
    'pre_registrations','identity_verification_attempts','privacy_requests',
    'security_incidents','auth_rate_limits','returning_otp_challenges',
    'visitor_phone_verifications'
  ] LOOP
    IF to_regclass(format('public.%I',v_name)) IS NOT NULL THEN
      RAISE EXCEPTION 'BANTAY-AGAPAY FRESH INSTALL ONLY: existing public.% detected. Nothing changed.',v_name;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM storage.buckets
       WHERE id IN ('visitor-faces','guardian-references')) THEN
    RAISE EXCEPTION 'BANTAY-AGAPAY FRESH INSTALL ONLY: app storage bucket already exists. Nothing changed.';
  END IF;
  IF to_regprocedure('public.get_visit_status(varchar)') IS NOT NULL
     OR to_regprocedure('public.get_visit_directions(varchar)') IS NOT NULL
     OR to_regprocedure('public.get_pending_visitors()') IS NOT NULL
     OR to_regprocedure('public.update_visit_location(varchar,numeric,numeric)') IS NOT NULL THEN
    RAISE EXCEPTION 'BANTAY-AGAPAY FRESH INSTALL ONLY: app RPC already exists. Nothing changed.';
  END IF;
END;
$fresh_install_preflight$;

-- ==================== MIGRATION 00: 00_initial_schema.sql ====================
-- Drop existing tables (if any) in correct order
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.verification_logs CASCADE;
DROP TABLE IF EXISTS public.visits CASCADE;
DROP TABLE IF EXISTS public.destinations CASCADE;
DROP TABLE IF EXISTS public.visitors CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Profiles table for staff
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name varchar(255) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  role varchar(50) NOT NULL CHECK (role IN ('ADMIN', 'SECURITY')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Visitors table
CREATE TABLE public.visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name varchar(255) NOT NULL,
  contact_number varchar(20) NOT NULL,
  visitor_type varchar(100),
  face_reference_path text,
  face_embedding text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Destinations table
CREATE TABLE public.destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  category varchar(100),
  building varchar(255),
  floor varchar(50),
  room varchar(50),
  description text,
  landmark text,
  directions text,
  map_x numeric,
  map_y numeric,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Visits table
CREATE TABLE public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL REFERENCES public.visitors(id) ON DELETE CASCADE,
  destination_id uuid NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  reference_number varchar(10) NOT NULL UNIQUE,
  purpose text,
  public_token varchar(255) UNIQUE,
  status varchar(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'INSIDE', 'EXITED', 'DENIED', 'CANCELLED')),
  registration_time timestamp with time zone DEFAULT now(),
  approved_at timestamp with time zone,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  check_in timestamp with time zone,
  check_out timestamp with time zone,
  denied_at timestamp with time zone,
  denied_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  denial_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Verification logs table
CREATE TABLE public.verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  face_status varchar(50) CHECK (face_status IN ('FACE_ENROLLED', 'FACE_VERIFIED', 'FACE_NO_MATCH', 'FACE_DETECTION_FAILED')),
  face_similarity numeric,
  gps_status varchar(50) CHECK (gps_status IN ('GPS_VERIFIED', 'OUTSIDE_AUTHORIZED_AREA', 'GPS_FAILED')),
  gps_accuracy numeric,
  distance_from_school numeric,
  verified_at timestamp with time zone DEFAULT now()
);

-- System settings table
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(255) NOT NULL UNIQUE,
  value text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action varchar(255) NOT NULL,
  entity_type varchar(100),
  entity_id uuid,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_visits_status ON public.visits(status);
CREATE INDEX idx_visits_visitor_id ON public.visits(visitor_id);
CREATE INDEX idx_visits_reference ON public.visits(reference_number);
CREATE INDEX idx_visits_public_token ON public.visits(public_token);
CREATE INDEX idx_visitors_name_contact ON public.visitors(full_name, contact_number);

-- Insert sample destinations
INSERT INTO public.destinations (name, category, building, floor, room, description, landmark, directions, map_x, map_y, active, created_at, updated_at)
VALUES
  ('Principal''s Office', 'Administration', 'Administration Building', 'Ground Floor', 'Room 101', 'School principal office', 'Main entrance of administration building', 'Enter through main gate, proceed to administration building', 25, 30, true, now(), now()),
  ('Registrar', 'Administration', 'Administration Building', 'Ground Floor', 'Room 103', 'Student records and enrollment', 'Beside guidance office', 'From main gate, follow covered walkway to administration building', 28, 32, true, now(), now()),
  ('Guidance Office', 'Student Services', 'Administration Building', 'Ground Floor', 'Room 105', 'Guidance and counseling services', 'Beside registrar office', 'Main administration building, ground floor', 30, 32, true, now(), now()),
  ('Clinic', 'Health Services', 'Medical Building', '1st Floor', 'Room 201', 'School health center', 'Near cafeteria', 'Proceed past administration building towards medical wing', 35, 40, true, now(), now()),
  ('Faculty Room', 'Academic', 'Main Academic Building', '2nd Floor', 'Room 305', 'Faculty office', 'Academic building second floor', 'Academic building entrance, second floor', 45, 45, true, now(), now()),
  ('Cashier', 'Finance', 'Administration Building', '1st Floor', 'Room 202', 'Payment and financial services', 'Second floor administration building', 'Administration building, stairwell near entrance', 25, 35, true, now(), now()),
  ('Senior High School Department', 'Academic', 'SHS Building', 'All Floors', 'Main SHS Building', 'Senior high school section', 'SHS Building complex', 'From main gate turn right towards SHS building complex', 50, 50, true, now(), now()),
  ('Cafeteria', 'Support Services', 'Cafeteria Building', '1st Floor', 'Dining Area', 'School cafeteria', 'Central location', 'Central campus location near medical building', 40, 38, true, now(), now());

-- RLS Policies
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;

-- Policy: Visitors can view their own visit status (public access with token)
DROP POLICY IF EXISTS "allow_public_visit_status" ON public.visits;
CREATE POLICY "allow_public_visit_status"
ON public.visits FOR SELECT
USING (true);

-- Policy: Anyone can view active destinations (needed for the public registration form)
DROP POLICY IF EXISTS "allow_public_read_destinations" ON public.destinations;
CREATE POLICY "allow_public_read_destinations"
ON public.destinations FOR SELECT
USING (active = true);

-- Grant anon/authenticated roles the privileges RLS policies above rely on
GRANT SELECT ON public.destinations TO anon, authenticated;
GRANT SELECT ON public.visits TO anon, authenticated;
GRANT SELECT, INSERT ON public.visitors TO anon, authenticated;
GRANT INSERT ON public.visits TO anon, authenticated;

-- Function to get pending visitors
DROP FUNCTION IF EXISTS get_pending_visitors();
CREATE OR REPLACE FUNCTION get_pending_visitors()
RETURNS TABLE(
  id uuid,
  reference_number varchar,
  full_name varchar,
  visitor_type varchar,
  purpose text,
  destination_name varchar,
  registration_time timestamp with time zone,
  contact_number varchar,
  face_reference_path text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.reference_number,
    vis.full_name,
    vis.visitor_type,
    v.purpose,
    d.name,
    v.registration_time,
    vis.contact_number,
    vis.face_reference_path
  FROM visits v
  JOIN visitors vis ON v.visitor_id = vis.id
  JOIN destinations d ON v.destination_id = d.id
  WHERE v.status = 'PENDING'
  ORDER BY v.registration_time DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get visit status by token
DROP FUNCTION IF EXISTS get_visit_status(varchar);
CREATE OR REPLACE FUNCTION get_visit_status(token varchar)
RETURNS TABLE(
  status varchar,
  visitor_name varchar,
  reference_number varchar,
  destination_name varchar,
  approved_at timestamp with time zone,
  denied_reason text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.status::varchar,
    vis.full_name,
    v.reference_number,
    d.name,
    v.approved_at,
    v.denial_reason
  FROM visits v
  JOIN visitors vis ON v.visitor_id = vis.id
  JOIN destinations d ON v.destination_id = d.id
  WHERE v.public_token = token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_visit_status(varchar) TO anon, authenticated;

-- Function to get a single visit's full detail for the security review page
DROP FUNCTION IF EXISTS get_visit_detail(uuid);
CREATE OR REPLACE FUNCTION get_visit_detail(visit_id uuid)
RETURNS TABLE(
  id uuid,
  reference_number varchar,
  full_name varchar,
  visitor_type varchar,
  contact_number varchar,
  purpose text,
  destination_name varchar,
  status varchar,
  registration_time timestamp with time zone,
  face_reference_path text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.reference_number,
    vis.full_name,
    vis.visitor_type,
    vis.contact_number,
    v.purpose,
    d.name,
    v.status::varchar,
    v.registration_time,
    vis.face_reference_path
  FROM visits v
  JOIN visitors vis ON v.visitor_id = vis.id
  JOIN destinations d ON v.destination_id = d.id
  WHERE v.id = visit_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get full destination/directions detail for an approved visit, by public token
DROP FUNCTION IF EXISTS get_visit_directions(varchar);
CREATE OR REPLACE FUNCTION get_visit_directions(token varchar)
RETURNS TABLE(
  status varchar,
  destination_name varchar,
  building varchar,
  floor varchar,
  room varchar,
  landmark text,
  directions text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.status::varchar,
    d.name,
    d.building,
    d.floor,
    d.room,
    d.landmark,
    d.directions
  FROM visits v
  JOIN destinations d ON v.destination_id = d.id
  WHERE v.public_token = token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_visit_directions(varchar) TO anon, authenticated;

-- Storage bucket for visitor face photos (private; accessed via signed URLs from the server)
INSERT INTO storage.buckets (id, name, public)
VALUES ('visitor-faces', 'visitor-faces', false)
ON CONFLICT (id) DO NOTHING;

-- ==================== MIGRATION 01: 01_staff_accounts.sql ====================
-- Real staff accounts: phone number + bcrypt-hashed password, managed by
-- the developer/admin directly (no self-signup, no external auth provider).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_number varchar(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash text;

-- email was required before; staff accounts are phone-based now, so email
-- becomes optional (still unique when present).
ALTER TABLE public.profiles
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique ON public.profiles(email) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);

-- Server-tracked staff sessions, so logout and account deactivation actually
-- invalidate access instead of relying solely on an opaque signed cookie.
CREATE TABLE IF NOT EXISTS public.staff_sessions (
  token text PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_profile_id ON public.staff_sessions(profile_id);

-- No RLS policies needed here: all staff auth/account management happens
-- through server-side API routes using the service role key.

-- ==================== MIGRATION 02: 02_staff_photo.sql ====================
-- Staff profile photo, uploaded by the staff member themself on first login.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS photo_path text;

-- Storage bucket for staff profile photos (private; accessed via signed URLs from the server)
INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-photos', 'staff-photos', false)
ON CONFLICT (id) DO NOTHING;

-- ==================== MIGRATION 03: 03_staff_invites.sql ====================
-- One-time QR invite links for security guards to self-register from their
-- own phone, instead of the admin typing their phone+password in directly.

CREATE TABLE IF NOT EXISTS public.staff_invites (
  token text PRIMARY KEY,
  role varchar(50) NOT NULL DEFAULT 'SECURITY' CHECK (role IN ('ADMIN', 'SECURITY')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  used_at timestamp with time zone,
  used_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_invites_expires_at ON public.staff_invites(expires_at);

-- Self-registered accounts need admin approval before they can log in.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status varchar(50) NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'));

-- Existing accounts (created directly by an admin) are already approved;
-- only new self-registrations via invite start as PENDING.

-- ==================== MIGRATION 04: 04_destination_coordinates.sql ====================
-- Real GPS coordinates per destination, so the visitor directions page can
-- show an actual map pin instead of just text directions.

ALTER TABLE public.destinations
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

-- Update the SECURITY DEFINER directions function to also return coordinates.
DROP FUNCTION IF EXISTS get_visit_directions(varchar);
CREATE OR REPLACE FUNCTION get_visit_directions(token varchar)
RETURNS TABLE(
  status varchar,
  destination_name varchar,
  building varchar,
  floor varchar,
  room varchar,
  landmark text,
  directions text,
  latitude numeric,
  longitude numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.status::varchar,
    d.name,
    d.building,
    d.floor,
    d.room,
    d.landmark,
    d.directions,
    d.latitude,
    d.longitude
  FROM visits v
  JOIN destinations d ON v.destination_id = d.id
  WHERE v.public_token = token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_visit_directions(varchar) TO anon, authenticated;

-- ==================== MIGRATION 05: 05_real_campus_destinations.sql ====================
-- Replace placeholder seed destinations with the real campus buildings
-- shown on the admin-provided campus map (public/campus-map.png).
-- map_x/map_y store the building's pixel position on that 2048x1536 image.

DELETE FROM public.destinations;

INSERT INTO public.destinations (name, category, building, map_x, map_y, active)
VALUES
  ('Marcelo H. del Pilar', 'Academic', 'Building 1', 985, 235, true),
  ('Mariano Ponce', 'Academic', 'Building 2', 1300, 215, true),
  ('Pedro A. Paterno', 'Academic', 'Building 3', 1565, 230, true),
  ('Maximo Viola', 'Academic', 'Building 4', 1715, 565, true),
  ('Ciriaco C. Contreras', 'Academic', 'Building 5', 1665, 850, true),
  ('Trinidad P. Tecson', 'Academic', 'Building 6', 1390, 850, true),
  ('Graciano Lopez Jaena', 'Academic', 'Building 7', 1580, 400, true),
  ('Jose Maria Panganiban', 'Academic', 'Building 8', 1500, 660, true),
  ('Jose P. Rizal', 'Academic', 'Building 9', 975, 345, true),
  ('Pedro S. Laktaw', 'Academic', 'Building 10', 1400, 480, true),
  ('Juan Luna', 'Academic', 'Building 11 (Municipal)', 1300, 315, true),
  ('Antonio Luna', 'Academic', 'Building 12', 1200, 315, true),
  ('Antonio S. Bautista', 'Academic', 'Building 13', 1075, 650, true),
  ('Felipe Salvador', 'Academic', 'Building 14', 1070, 480, true),
  ('Administration Office', 'Administration', 'Building 15', 790, 490, true),
  ('Lapu Lapu', 'Academic', 'Building 16', 835, 800, true),
  ('Emilio Jacinto', 'Academic', 'Building 17', 850, 905, true),
  ('Diego Silang', 'Academic', 'Building 18', 855, 1010, true),
  ('Deodato Arellano', 'Academic', 'Building 19', 870, 1190, true),
  ('Ladislao Diwa', 'Academic', 'Building 20', 1280, 1440, true),
  ('Artemio Ricarte', 'Academic', 'Building 21', 905, 1440, true),
  ('Pio Valenzuela', 'Academic', 'Building 22 (State of the Art Building)', 865, 1335, true),
  ('Gomburza', 'Academic', 'Building 23', 695, 1440, true),
  ('Gabriela Silang', 'Academic', 'Building 24', 230, 1245, true),
  ('Melchora Aquino', 'Academic', 'Building 25', 230, 1115, true),
  ('Building 26 (Canteen 1)', 'Support Services', 'Building 26', 230, 870, true),
  ('Apolinario Mabini', 'Academic', 'Building 27', 230, 600, true),
  ('Emilio Aguinaldo', 'Academic', 'Building 28', 230, 220, true),
  ('Andres Bonifacio', 'Academic', 'Building 29', 400, 320, true),
  ('Gregorio H. del Pilar', 'Academic', 'Building 30', 520, 600, true),
  ('Teodoro Plata', 'Academic', 'Building 31', 835, 1115, true),
  ('Isidoro D. Torres', 'Academic', 'Building 32', 1175, 890, true),
  ('Eusebio Roque', 'Academic', 'Building 33', 1050, 890, true),
  ('Anacleto F. Enriquez', 'Academic', 'Building 34', 1280, 1255, true);

-- ==================== MIGRATION 06: 06_directions_map_image.sql ====================
-- Switch visitor directions from the GPS lat/lon pin to the illustrated
-- campus map image (public/campus-map.png) with a pixel-position marker.

DROP FUNCTION IF EXISTS get_visit_directions(varchar);
CREATE OR REPLACE FUNCTION get_visit_directions(token varchar)
RETURNS TABLE(
  status varchar,
  destination_name varchar,
  building varchar,
  floor varchar,
  room varchar,
  landmark text,
  directions text,
  map_x numeric,
  map_y numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.status::varchar,
    d.name,
    d.building,
    d.floor,
    d.room,
    d.landmark,
    d.directions,
    d.map_x,
    d.map_y
  FROM visits v
  JOIN destinations d ON v.destination_id = d.id
  WHERE v.public_token = token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_visit_directions(varchar) TO anon, authenticated;

-- ==================== MIGRATION 07: 07_visitor_gps_location.sql ====================
-- Store the visitor's actual GPS coordinates captured during registration,
-- so security/admin can see exactly where a visitor registered from
-- (previously the coordinates were checked against the geofence and then
-- discarded, only distance/accuracy had columns to persist them).

ALTER TABLE public.verification_logs
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

-- Function to get the latest verification log (GPS + face status) for a visit
DROP FUNCTION IF EXISTS get_visit_verification(uuid);
CREATE OR REPLACE FUNCTION get_visit_verification(p_visit_id uuid)
RETURNS TABLE(
  gps_status varchar,
  gps_accuracy numeric,
  distance_from_school numeric,
  latitude numeric,
  longitude numeric,
  verified_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vl.gps_status,
    vl.gps_accuracy,
    vl.distance_from_school,
    vl.latitude,
    vl.longitude,
    vl.verified_at
  FROM verification_logs vl
  WHERE vl.visit_id = p_visit_id
  ORDER BY vl.verified_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ==================== MIGRATION 08: 08_live_visitor_location.sql ====================
-- Live location tracking for visitors currently on campus. The visitor's
-- own browser periodically pushes updates while their status page is open
-- and their visit is INSIDE; security sees the latest position.

ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS current_latitude numeric,
  ADD COLUMN IF NOT EXISTS current_longitude numeric,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamp with time zone;

-- Function: the visitor's own browser calls this with their public_token to
-- push a location update. SECURITY DEFINER so it can bypass RLS (same
-- token-gated pattern as get_visit_status), scoped to only ever touch the
-- one row matching that token, and only while the visit is still INSIDE.
DROP FUNCTION IF EXISTS update_visit_location(varchar, numeric, numeric);
CREATE OR REPLACE FUNCTION update_visit_location(p_token varchar, p_latitude numeric, p_longitude numeric)
RETURNS boolean AS $$
DECLARE
  v_row_count integer;
BEGIN
  UPDATE public.visits
  SET current_latitude = p_latitude,
      current_longitude = p_longitude,
      location_updated_at = now()
  WHERE public_token = p_token AND status = 'INSIDE';

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION update_visit_location(varchar, numeric, numeric) TO anon, authenticated;

-- ==================== MIGRATION 09: 09_lockdown_public_visit_access.sql ====================
-- Review and run on an isolated Supabase staging project FIRST.
-- Do not apply to live Supabase without a tested migration/rollback plan.
--
-- Initial schema 00_initial_schema.sql grants anon SELECT on every visit,
-- including public QR tokens. A bearer QR token must not be enumerable.
-- The public status and directions pages already use SECURITY DEFINER RPCs,
-- while staff pages use authenticated server-side API routes.
-- [single-transaction bundle] BEGIN omitted

DROP POLICY IF EXISTS "allow_public_visit_status" ON public.visits;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.visits FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.visitors FROM anon, authenticated;

-- These staff-only RPCs are called by server routes with the service role key.
-- They should not be directly callable by public Supabase clients.
REVOKE EXECUTE ON FUNCTION public.get_pending_visitors() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_visit_detail(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_visitors() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_visit_detail(uuid) TO service_role;

-- Public bearer-token RPCs remain available for token holders:
-- get_visit_status(varchar), get_visit_directions(varchar).
-- The active destinations SELECT policy is also retained.
-- [single-transaction bundle] COMMIT omitted

-- Validation before production rollout:
-- 1. Anonymous direct SELECT from visits must fail (403 permission denied).
-- 2. get_visit_status(valid token) returns only its status; wrong token returns 0 rows.
-- 3. get_visit_directions(valid token) still works.
-- 4. Staff API /api/security/pending and /api/security/visit/:id work when signed in.
-- 5. The client-demo register -> QR -> approve -> checkout flow works on staging.
--
-- Rollback ONLY after change approval:
-- GRANT SELECT, INSERT ON public.visits TO anon, authenticated;
-- GRANT SELECT, INSERT ON public.visitors TO anon, authenticated;
-- CREATE POLICY "allow_public_visit_status" ON public.visits FOR SELECT USING (true);
-- GRANT EXECUTE ON FUNCTION public.get_pending_visitors() TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.get_visit_detail(uuid) TO PUBLIC;
-- Note: rollback reintroduces the documented public-read exposure.

-- ==================== MIGRATION 10: 10_client_guardian_preregistration.sql ====================
-- BANTAY-AGAPAY: CLIENT-ALIGNED REGISTRY & HOME PRE-REGISTRATION (STAGING ONLY)
-- Review against an isolated database and backup before applying to production.
-- This intentionally does NOT modify existing visits or legacy visitor photos.
-- [single-transaction bundle] BEGIN omitted

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position varchar(120);
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS checked_out_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS pre_registration_id uuid;

CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name varchar(200) NOT NULL,
  student_number varchar(64) UNIQUE,
  grade varchar(32) NOT NULL,
  section varchar(100) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.authorized_guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name varchar(200) NOT NULL,
  birth_date date NOT NULL,
  address text NOT NULL,
  contact_number varchar(20) NOT NULL,
  reference_photo_path text NOT NULL,
  identity_document_path text,
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(trim(full_name)) >= 3),
  CHECK (birth_date <= CURRENT_DATE),
  CHECK (length(trim(address)) >= 5)
);

CREATE TABLE IF NOT EXISTS public.faculty_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name varchar(200) NOT NULL,
  department varchar(120),
  destination_id uuid NOT NULL REFERENCES public.destinations(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  public_visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_faculty_name ON public.faculty_directory(lower(full_name));

CREATE TABLE IF NOT EXISTS public.student_guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL REFERENCES public.authorized_guardians(id) ON DELETE CASCADE,
  relationship varchar(40) NOT NULL CHECK (relationship IN ('PARENT','LEGAL_GUARDIAN','OTHER_AUTHORIZED')),
  active boolean NOT NULL DEFAULT true,
  UNIQUE(student_id,guardian_id)
);

CREATE TABLE IF NOT EXISTS public.pre_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token varchar(32) UNIQUE NOT NULL CHECK (public_token ~ '^[a-f0-9]{32}$'),
  reference_number varchar(24) UNIQUE NOT NULL,
  full_name varchar(200) NOT NULL,
  contact_number varchar(20) NOT NULL,
  visitor_type varchar(80) NOT NULL,
  purpose text NOT NULL,
  destination_id uuid NOT NULL REFERENCES public.destinations(id),
  visitor_photo_path text NOT NULL,
  guardian_birth_date date,
  guardian_address text,
  student_full_name varchar(200),
  student_grade varchar(32),
  student_section varchar(100),
  guardian_id uuid REFERENCES public.authorized_guardians(id) ON DELETE SET NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  guardian_details_status varchar(32) NOT NULL DEFAULT 'NOT_APPLICABLE'
    CHECK (guardian_details_status IN ('NOT_APPLICABLE','MATCH','MISMATCH','UNVERIFIED')),
  photo_review_status varchar(32) NOT NULL DEFAULT 'PENDING'
    CHECK (photo_review_status IN ('PENDING','PASSED','FAILED')),
  biometric_status varchar(28) NOT NULL DEFAULT 'NOT_REQUIRED'
    CHECK (biometric_status IN ('NOT_REQUIRED','PENDING','MATCH','NO_MATCH','ERROR')),
  biometric_confidence numeric,
  status varchar(28) NOT NULL DEFAULT 'PRE_REGISTERED'
    CHECK (status IN ('PRE_REGISTERED','NEEDS_REVIEW','ADMITTED','DENIED','EXITED','EXPIRED')),
  privacy_acknowledged_at timestamptz NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + INTERVAL '48 hours',
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  denial_reason text,
  visit_id uuid UNIQUE REFERENCES public.visits(id) ON DELETE SET NULL,
  CHECK (char_length(trim(full_name)) >= 3),
  CHECK (
    purpose NOT IN ('Child Emergency','Visit Student')
    OR (visitor_type IN ('Parent','Guardian')
       AND guardian_birth_date IS NOT NULL AND guardian_address IS NOT NULL
       AND student_full_name IS NOT NULL AND student_grade IS NOT NULL AND student_section IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_pre_registration_id ON public.visits(pre_registration_id)
WHERE pre_registration_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guardians_contact ON public.authorized_guardians(contact_number);
CREATE INDEX IF NOT EXISTS idx_guardians_name_birth ON public.authorized_guardians(full_name,birth_date);
CREATE INDEX IF NOT EXISTS idx_students_name_grade ON public.students(full_name,grade,section);
CREATE INDEX IF NOT EXISTS idx_prereg_status_submitted ON public.pre_registrations(status,submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_prereg_guardian ON public.pre_registrations(guardian_id);
CREATE INDEX IF NOT EXISTS idx_prereg_expires ON public.pre_registrations(expires_at);

CREATE TABLE IF NOT EXISTS public.identity_verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_registration_id uuid NOT NULL REFERENCES public.pre_registrations(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind varchar(28) NOT NULL CHECK (kind IN ('DETAILS','PHOTO_MANUAL','BIOMETRIC')),
  outcome varchar(20) NOT NULL CHECK (outcome IN ('MATCH','MISMATCH','INCONCLUSIVE')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type varchar(20) NOT NULL CHECK (request_type IN ('ACCESS','CORRECTION','DELETION')),
  subject_type varchar(24) NOT NULL CHECK (subject_type IN ('PRE_REGISTRATION','GUARDIAN','VISITOR')),
  subject_reference varchar(100) NOT NULL,
  details text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','REVIEWED','RESOLVED')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  resolution_notes text
);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_status ON public.privacy_requests(status,created_at DESC);

CREATE TABLE IF NOT EXISTS public.security_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_registration_id uuid REFERENCES public.pre_registrations(id) ON DELETE SET NULL,
  visit_id uuid REFERENCES public.visits(id) ON DELETE SET NULL,
  category varchar(40) NOT NULL
    CHECK (category IN ('INVALID_QR','GUARDIAN_MISMATCH','PHOTO_REVIEW','DUPLICATE_SCAN','MISSING_INFORMATION','OTHER')),
  details text,
  status varchar(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- Private, role-limited guardian enrollment media. No anonymous/public bucket access.
INSERT INTO storage.buckets(id,name,public) VALUES ('guardian-references','guardian-references',false)
ON CONFLICT (id) DO UPDATE SET public=false;

-- Sensitive tables are accessed ONLY from authenticated server routes with staff role checks.
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorized_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.students,public.faculty_directory,public.authorized_guardians,public.student_guardians,
 public.pre_registrations,public.identity_verification_attempts,public.security_incidents,public.privacy_requests FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.students,public.faculty_directory,public.authorized_guardians,
 public.student_guardians,public.pre_registrations,public.identity_verification_attempts,
 public.security_incidents,public.privacy_requests TO service_role;

-- Existing visits and visitor tables must be separately locked down on staging using migration 09.
-- Do not grant anonymous SELECT on these new tables or on guardian reference storage.


-- Rate limiting keys are HMAC hashes. These rows store no raw IP or phone values.
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  key_hash varchar(64) PRIMARY KEY CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  attempts integer NOT NULL DEFAULT 0,
  window_ends timestamptz NOT NULL
);
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.auth_rate_limits FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auth_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key_hash varchar,
  p_limit integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $limiter$
DECLARE
  attempt_count integer;
BEGIN
  IF p_key_hash !~ '^[a-f0-9]{64}$'
      OR p_limit NOT BETWEEN 1 AND 500
      OR p_window_seconds NOT BETWEEN 60 AND 86400 THEN
    RAISE EXCEPTION 'Invalid rate-limit parameters';
  END IF;

  INSERT INTO public.auth_rate_limits(key_hash, attempts, window_ends)
  VALUES(p_key_hash, 1, now() + make_interval(secs => p_window_seconds))
  ON CONFLICT (key_hash) DO UPDATE SET
    attempts = CASE WHEN public.auth_rate_limits.window_ends <= now()
                    THEN 1 ELSE public.auth_rate_limits.attempts + 1 END,
    window_ends = CASE WHEN public.auth_rate_limits.window_ends <= now()
                      THEN now() + make_interval(secs => p_window_seconds)
                      ELSE public.auth_rate_limits.window_ends END
  RETURNING attempts INTO attempt_count;

  RETURN attempt_count <= p_limit;
END;
$limiter$;
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(varchar, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(varchar, integer, integer)
  TO service_role;

-- Transactional school gate approval: the QR does NOT count as campus entry.
-- This function is callable only by the server's service-role connection.
CREATE OR REPLACE FUNCTION public.admit_pre_registration(p_id uuid, p_staff_id uuid)
RETURNS TABLE(visit_id uuid, visitor_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $admission$
DECLARE
  pr public.pre_registrations%ROWTYPE;
  v_id uuid;
  created_visit uuid;
BEGIN
  SELECT * INTO pr FROM public.pre_registrations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR pr.status <> 'PRE_REGISTERED' OR pr.expires_at <= now() THEN
    RAISE EXCEPTION 'Pass is expired, flagged or already used';
  END IF;

  IF pr.photo_review_status <> 'PASSED' THEN
    RAISE EXCEPTION 'Manual photo verification incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_staff_id AND p.active
      AND p.status = 'APPROVED' AND p.role IN ('ADMIN', 'SECURITY')
  ) THEN
    RAISE EXCEPTION 'Security account is not approved';
  END IF;

  IF pr.purpose IN ('Child Emergency', 'Visit Student') THEN
    IF pr.visitor_type NOT IN ('Parent', 'Guardian')
        OR pr.guardian_details_status <> 'MATCH'
        OR pr.biometric_status <> 'MATCH'
        OR pr.guardian_id IS NULL OR pr.student_id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM public.authorized_guardians g
          JOIN public.student_guardians sg ON sg.guardian_id = g.id
          JOIN public.students s ON s.id = sg.student_id
          WHERE g.id = pr.guardian_id AND s.id = pr.student_id
            AND g.active AND g.verified_at IS NOT NULL
            AND sg.active AND s.active
            AND g.birth_date = pr.guardian_birth_date
            AND g.contact_number = pr.contact_number
            AND lower(trim(g.full_name)) = lower(trim(pr.full_name))
            AND lower(trim(g.address)) = lower(trim(pr.guardian_address))
            AND lower(trim(s.full_name)) = lower(trim(pr.student_full_name))
            AND lower(trim(s.grade)) = lower(trim(pr.student_grade))
            AND lower(trim(s.section)) = lower(trim(pr.student_section))
        ) THEN
      RAISE EXCEPTION 'Guardian authorization missing, changed or unmatched';
    END IF;
  END IF;

  INSERT INTO public.visitors(full_name, contact_number, visitor_type, face_reference_path)
  VALUES(pr.full_name, pr.contact_number, pr.visitor_type, pr.visitor_photo_path)
  RETURNING id INTO v_id;

  INSERT INTO public.visits(
    visitor_id, destination_id, reference_number, purpose, public_token,
    status, registration_time, approved_at, approved_by, check_in, pre_registration_id
  ) VALUES (
    v_id, pr.destination_id, pr.reference_number, pr.purpose, pr.public_token,
    'INSIDE', now(), now(), p_staff_id, now(), pr.id
  ) RETURNING id INTO created_visit;

  UPDATE public.pre_registrations
  SET status = 'ADMITTED', visit_id = created_visit,
      reviewed_by = p_staff_id, reviewed_at = now()
  WHERE id = pr.id;

  INSERT INTO public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  VALUES(p_staff_id, 'GATE_ENTRY_APPROVED', 'visit', created_visit,
    jsonb_build_object('pre_registration_id', pr.id, 'reference', pr.reference_number));

  RETURN QUERY SELECT created_visit, pr.full_name::text;
END;
$admission$;
REVOKE EXECUTE ON FUNCTION public.admit_pre_registration(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admit_pre_registration(uuid, uuid)
  TO service_role;

-- Exit only from an active INSIDE visit, using a row-level lock to reject repeats.
CREATE OR REPLACE FUNCTION public.checkout_pre_registration(p_id uuid, p_staff_id uuid)
RETURNS TABLE(visitor_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $checkout$
DECLARE
  pr public.pre_registrations%ROWTYPE;
  v public.visits%ROWTYPE;
BEGIN
  SELECT * INTO pr FROM public.pre_registrations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR pr.status <> 'ADMITTED' OR pr.visit_id IS NULL THEN
    RAISE EXCEPTION 'No active visitor entry';
  END IF;

  SELECT * INTO v FROM public.visits WHERE id = pr.visit_id FOR UPDATE;
  IF NOT FOUND OR v.status <> 'INSIDE' THEN
    RAISE EXCEPTION 'Visit is already closed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_staff_id
      AND p.active AND p.status = 'APPROVED'
      AND p.role IN ('ADMIN', 'SECURITY')
  ) THEN
    RAISE EXCEPTION 'Security account is not approved';
  END IF;

  UPDATE public.visits
  SET status = 'EXITED', check_out = now(), checked_out_by = p_staff_id
  WHERE id = v.id;

  UPDATE public.pre_registrations SET status = 'EXITED' WHERE id = pr.id;

  INSERT INTO public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  VALUES(p_staff_id, 'GATE_EXIT_RECORDED', 'visit', v.id,
    jsonb_build_object('pre_registration_id', pr.id));

  RETURN QUERY SELECT pr.full_name::text;
END;
$checkout$;
REVOKE EXECUTE ON FUNCTION public.checkout_pre_registration(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_pre_registration(uuid, uuid)
  TO service_role;

-- [single-transaction bundle] COMMIT omitted

-- ==================== MIGRATION 11: 11_returning_visitor_otp.sql ====================
-- BANTAY-AGAPAY: Returning visitor SMS verification challenges (STAGING ONLY).
-- No raw phone numbers, OTP codes, school ID photographs or child details are persisted here.
-- [single-transaction bundle] BEGIN omitted

CREATE TABLE IF NOT EXISTS public.returning_otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash char(64) NOT NULL CHECK (phone_hash ~ '^[a-f0-9]{64}$'),
  code_hash char(64) NOT NULL CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 6),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_returning_otp_recent
  ON public.returning_otp_challenges (phone_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_returning_otp_expiration
  ON public.returning_otp_challenges (expires_at);

ALTER TABLE public.returning_otp_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.returning_otp_challenges FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.returning_otp_challenges TO service_role;

-- A TTL cleanup may be scheduled only after school-specific privacy approval.
-- Never expose this table or a read RPC to an anonymous database client.
-- [single-transaction bundle] COMMIT omitted

-- ==================== MIGRATION 12: 12_guardian_registry_operations.sql ====================
-- BANTAY-AGAPAY: atomic administrator registry revocation and relationship enrollment (STAGING ONLY).
-- [single-transaction bundle] BEGIN omitted

CREATE OR REPLACE FUNCTION public.revoke_school_registry(
  p_kind varchar,
  p_id uuid,
  p_staff_id uuid,
  p_reason text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $revoke$
DECLARE
  changed_id uuid;
BEGIN
  IF p_kind NOT IN ('guardian','student','relationship') OR p_id IS NULL
      OR length(trim(coalesce(p_reason,''))) < 3 OR length(p_reason) > 500 THEN
    RAISE EXCEPTION 'Invalid school authorization revocation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id=p_staff_id AND active
      AND status='APPROVED' AND role='ADMIN'
  ) THEN
    RAISE EXCEPTION 'Only approved administrators may revoke school access';
  END IF;

  IF p_kind='guardian' THEN
    UPDATE public.authorized_guardians SET active=false, updated_at=now()
    WHERE id=p_id AND active=true RETURNING id INTO changed_id;
  ELSIF p_kind='student' THEN
    UPDATE public.students SET active=false
    WHERE id=p_id AND active=true RETURNING id INTO changed_id;
  ELSE
    UPDATE public.student_guardians SET active=false
    WHERE id=p_id AND active=true RETURNING id INTO changed_id;
  END IF;

  IF changed_id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  VALUES (p_staff_id, 'SCHOOL_AUTHORIZATION_REVOKED', p_kind, changed_id,
    jsonb_build_object('reason',p_reason));
  RETURN true;
END;
$revoke$;
REVOKE EXECUTE ON FUNCTION public.revoke_school_registry(varchar,uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_school_registry(varchar,uuid,uuid,text)
  TO service_role;

-- Linking an existing verified guardian to another active student requires
-- fresh school administrator approval and produces a transactionally logged event.
CREATE OR REPLACE FUNCTION public.link_verified_guardian(
  p_guardian_id uuid,
  p_student_id uuid,
  p_relationship varchar,
  p_staff_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $link$
DECLARE
  link_id uuid;
BEGIN
  IF p_relationship NOT IN ('PARENT','LEGAL_GUARDIAN','OTHER_AUTHORIZED') THEN
    RAISE EXCEPTION 'Invalid guardian relationship type';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id=p_staff_id AND active
      AND status='APPROVED' AND role='ADMIN'
  ) THEN
    RAISE EXCEPTION 'Only approved administrators may link a guardian';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.authorized_guardians g
    WHERE g.id=p_guardian_id AND g.active=true AND g.verified_at IS NOT NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id=p_student_id AND s.active=true
  ) THEN
    RAISE EXCEPTION 'A verified guardian and active student are required';
  END IF;

  INSERT INTO public.student_guardians(guardian_id,student_id,relationship,active)
  VALUES(p_guardian_id,p_student_id,p_relationship,true)
  ON CONFLICT (student_id,guardian_id) DO UPDATE SET
    active=true,relationship=EXCLUDED.relationship
  RETURNING id INTO link_id;

  INSERT INTO public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  VALUES(p_staff_id,'GUARDIAN_STUDENT_LINK_APPROVED','student_guardian',link_id,
    jsonb_build_object('guardian_id',p_guardian_id,'student_id',p_student_id,
      'relationship',p_relationship));
  RETURN link_id;
END;
$link$;
REVOKE EXECUTE ON FUNCTION public.link_verified_guardian(uuid,uuid,varchar,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_verified_guardian(uuid,uuid,varchar,uuid)
  TO service_role;

-- [single-transaction bundle] COMMIT omitted

-- ==================== MIGRATION 13: 13_required_visitor_phone_otp.sql ====================
-- M13: Required one-use, phone-bound proof for all visitor registration (STAGING FIRST).
-- Must run AFTER migrations 09-12; do NOT run against school production without review.
-- [single-transaction bundle] BEGIN omitted
CREATE TABLE IF NOT EXISTS public.visitor_phone_verifications (
  proof_hash varchar(64) PRIMARY KEY CHECK (proof_hash ~ '^[a-f0-9]{64}$'),
  phone_hash varchar(64) NOT NULL CHECK (phone_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visitor_phone_verifications_expiry
  ON public.visitor_phone_verifications(expires_at);
ALTER TABLE public.visitor_phone_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.visitor_phone_verifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visitor_phone_verifications TO service_role;
-- Atomic proof consumption. Only server uses this RPC; no raw PII is stored here.
CREATE OR REPLACE FUNCTION public.consume_phone_verification(
  p_proof_hash varchar, p_phone_hash varchar
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $proof$
DECLARE
  matched varchar(64);
BEGIN
  IF p_proof_hash IS NULL OR p_proof_hash !~ '^[a-f0-9]{64}$'
     OR p_phone_hash IS NULL OR p_phone_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN false;
  END IF;
  UPDATE public.visitor_phone_verifications
  SET consumed_at = now()
  WHERE proof_hash = p_proof_hash
    AND phone_hash = p_phone_hash
    AND consumed_at IS NULL
    AND expires_at > now()
  RETURNING proof_hash INTO matched;
  RETURN matched IS NOT NULL;
END;
$proof$;
REVOKE EXECUTE ON FUNCTION public.consume_phone_verification(varchar,varchar)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_phone_verification(varchar,varchar)
  TO service_role;
-- [single-transaction bundle] COMMIT omitted

-- ==================== MIGRATION 14: 14_opt_in_visitor_location.sql ====================
-- Migration 14: visitor opt-in, foreground-only location sharing (STAGING FIRST).
-- Requires migrations 09-13. No live Supabase project is modified automatically.
-- The service-role server performs authorized updates; the QR bearer must never
-- be permitted to mutate location via an anonymously callable RPC.
-- [single-transaction bundle] BEGIN omitted
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS current_latitude numeric,
  ADD COLUMN IF NOT EXISTS current_longitude numeric,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS location_sharing_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.visits
  ADD CONSTRAINT visitor_location_accuracy_range CHECK (
    location_accuracy_m IS NULL OR
      (location_accuracy_m >= 1 AND location_accuracy_m <= 150)
  ) NOT VALID;
ALTER TABLE public.visits VALIDATE CONSTRAINT visitor_location_accuracy_range;

-- Clear historic coordinates previously captured without a server-side
-- tracking consent flag. Preserve visitor entry/exit records.
UPDATE public.visits SET
  current_latitude=NULL,current_longitude=NULL,
  location_accuracy_m=NULL,location_updated_at=NULL
WHERE location_sharing_enabled=false
  AND (current_latitude IS NOT NULL OR current_longitude IS NOT NULL
    OR location_updated_at IS NOT NULL OR location_accuracy_m IS NOT NULL);

CREATE OR REPLACE FUNCTION public.enforce_active_visitor_location()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $location$
BEGIN
  -- STOP, CHECKOUT, DENIAL or a non-inside status always clears active location.
  IF NEW.status <> 'INSIDE' OR NOT NEW.location_sharing_enabled THEN
    NEW.location_sharing_enabled=false;
    NEW.current_latitude=NULL;
    NEW.current_longitude=NULL;
    NEW.location_accuracy_m=NULL;
    NEW.location_updated_at=NULL;
  END IF;
  RETURN NEW;
END;
$location$;
DROP TRIGGER IF EXISTS trg_enforce_active_visitor_location ON public.visits;
CREATE TRIGGER trg_enforce_active_visitor_location
  BEFORE INSERT OR UPDATE ON public.visits FOR EACH ROW
  EXECUTE FUNCTION public.enforce_active_visitor_location();

-- The legacy RPC uses only a public QR token as its authorization.
-- Retire it before activating the signed-device location API.
DO $revoke_legacy$
BEGIN
  IF to_regprocedure('public.update_visit_location(varchar,numeric,numeric)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_visit_location(varchar,numeric,numeric) FROM PUBLIC, anon, authenticated';
  END IF;
END;
$revoke_legacy$;
-- [single-transaction bundle] COMMIT omitted


-- =======================================================================
-- ATOMIC BOOTSTRAP VERIFICATION (runs BEFORE COMMIT)
-- Fails and rolls back the full transaction if any invariant is missing.
-- =======================================================================
DO $bootstrap_verify$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'profiles','visitors','destinations','visits','verification_logs',
    'system_settings','audit_logs','staff_sessions','staff_invites',
    'students','authorized_guardians','faculty_directory','student_guardians',
    'pre_registrations','identity_verification_attempts','privacy_requests',
    'security_incidents','auth_rate_limits','returning_otp_challenges',
    'visitor_phone_verifications'
  ] LOOP
    IF to_regclass(format('public.%I',v_table)) IS NULL THEN
      RAISE EXCEPTION 'Missing application table: public.%', v_table;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='visits'
      AND column_name='location_sharing_enabled'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='visits'
      AND column_name='location_accuracy_m'
  ) THEN
    RAISE EXCEPTION 'Location privacy migration 14 is incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='visits'
      AND t.tgname='trg_enforce_active_visitor_location' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Visitor checkout GPS-erasure trigger missing';
  END IF;

  IF has_table_privilege('anon','public.visits','SELECT')
     OR has_table_privilege('authenticated','public.visits','SELECT') THEN
    RAISE EXCEPTION 'Unsafe public visit-data read permissions';
  END IF;
  IF has_function_privilege('anon',
        'public.consume_phone_verification(varchar,varchar)','EXECUTE')
     OR has_function_privilege('authenticated',
        'public.consume_phone_verification(varchar,varchar)','EXECUTE') THEN
    RAISE EXCEPTION 'Mandatory OTP proof function is publicly executable';
  END IF;
  IF has_function_privilege('anon',
        'public.update_visit_location(varchar,numeric,numeric)','EXECUTE')
     OR has_function_privilege('authenticated',
        'public.update_visit_location(varchar,numeric,numeric)','EXECUTE') THEN
    RAISE EXCEPTION 'Unsafe QR-only GPS tracking RPC remains publicly executable';
  END IF;

  IF (SELECT COUNT(*) FROM storage.buckets WHERE id IN
     ('visitor-faces','guardian-references') AND public=false) <> 2 THEN
    RAISE EXCEPTION 'Private visitor/guardian image buckets missing or public';
  END IF;
  IF (SELECT COUNT(*) FROM public.destinations) < 30 THEN
    RAISE EXCEPTION 'Expected campus destination seeds are missing';
  END IF;
  RAISE NOTICE 'PASS: 00-14 tables, private buckets, OTP protection, GPS consent/erasure and public-access restrictions';
END;
$bootstrap_verify$;

COMMIT;

SELECT
  'PASS - Bantay-Agapay 00-14 fresh bootstrap committed' AS result,
  15 AS source_migration_count,
  (SELECT COUNT(*) FROM public.destinations) AS seeded_destinations,
  current_timestamp AS completed_at;
