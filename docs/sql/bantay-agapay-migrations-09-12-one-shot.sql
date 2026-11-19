-- BANTAY-AGAPAY: ONE-SHOT MIGRATION 09-12, ATOMIC (STAGING FIRST)
-- Source branch: feature/client-compliance-integration-20261117
-- Source files: supabase/migrations/09-12, concatenated in dependency order.
-- Run ONCE through the SQL Editor on the correct Bantay-Agapay staging project.
-- Confirm a RESTORABLE BACKUP and test the app before running on production.
-- Never apply 00_initial_schema.sql on existing data: it drops tables.
-- Not suitable for a database with 10-12 already partially/applied: inspect history first.
-- This script does not write to Supabase's migration history table, so reconcile
-- SQL Editor application with your future CLI migrations to avoid rerunning files.
-- WARNING: migration 09 revokes legacy direct anon/authenticated visitors/visits access.
-- The web app must use the newer server routes / public token RPCs.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $bantay_preflight$
DECLARE
  missing text[] := ARRAY[]::text[];
  obj text;
BEGIN
  FOREACH obj IN ARRAY ARRAY[
    'public.profiles','public.visitors','public.visits',
    'public.destinations','public.audit_logs','storage.buckets'
  ] LOOP
    IF to_regclass(obj) IS NULL THEN missing := array_append(missing,obj); END IF;
  END LOOP;
  IF array_length(missing,1) IS NOT NULL THEN
    RAISE EXCEPTION 'Base schema missing (%). Apply/review existing 00-08 migrations before this one-shot script.',array_to_string(missing,', ');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='status'
  ) THEN
    RAISE EXCEPTION 'Missing profiles.status. Previous staff-account migration not applied.';
  END IF;
  IF to_regprocedure('public.get_pending_visitors()') IS NULL
     OR to_regprocedure('public.get_visit_detail(uuid)') IS NULL
     OR to_regprocedure('public.get_visit_status(character varying)') IS NULL
     OR to_regprocedure('public.get_visit_directions(character varying)') IS NULL THEN
    RAISE EXCEPTION 'Required existing visit RPCs are missing; check prior migrations 00-08.';
  END IF;
  IF to_regclass('public.students') IS NOT NULL
     OR to_regclass('public.pre_registrations') IS NOT NULL
     OR to_regclass('public.auth_rate_limits') IS NOT NULL
     OR to_regclass('public.returning_otp_challenges') IS NOT NULL THEN
    RAISE EXCEPTION 'Client-compliance tables already exist; stop and inspect applied migrations before running this bundle.';
  END IF;
END;
$bantay_preflight$;


-- =============================================================================
-- MIGRATION 09_lockdown_public_visit_access.sql
-- =============================================================================
-- Review and run on an isolated Supabase staging project FIRST.
-- Do not apply to live Supabase without a tested migration/rollback plan.
--
-- Initial schema 00_initial_schema.sql grants anon SELECT on every visit,
-- including public QR tokens. A bearer QR token must not be enumerable.
-- The public status and directions pages already use SECURITY DEFINER RPCs,
-- while staff pages use authenticated server-side API routes.


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


-- =============================================================================
-- MIGRATION 10_client_guardian_preregistration.sql
-- =============================================================================
-- BANTAY-AGAPAY: CLIENT-ALIGNED REGISTRY & HOME PRE-REGISTRATION (STAGING ONLY)
-- Review against an isolated database and backup before applying to production.
-- This intentionally does NOT modify existing visits or legacy visitor photos.


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


-- =============================================================================
-- MIGRATION 11_returning_visitor_otp.sql
-- =============================================================================
-- BANTAY-AGAPAY: Returning visitor SMS verification challenges (STAGING ONLY).
-- No raw phone numbers, OTP codes, school ID photographs or child details are persisted here.


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


-- =============================================================================
-- MIGRATION 12_guardian_registry_operations.sql
-- =============================================================================
-- BANTAY-AGAPAY: atomic administrator registry revocation and relationship enrollment (STAGING ONLY).


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

-- Final checks are INSIDE the same transaction. Failure rolls back all changes.
DO $bantay_postflight$
DECLARE
  obj text;
BEGIN
  FOREACH obj IN ARRAY ARRAY[
    'public.students','public.authorized_guardians','public.faculty_directory',
    'public.student_guardians','public.pre_registrations',
    'public.identity_verification_attempts','public.privacy_requests',
    'public.security_incidents','public.auth_rate_limits',
    'public.returning_otp_challenges'
  ] LOOP
    IF to_regclass(obj) IS NULL THEN
      RAISE EXCEPTION 'Verification failed: missing %',obj;
    END IF;
  END LOOP;

  IF has_table_privilege('anon','public.visits','SELECT')
     OR has_table_privilege('anon','public.visitors','SELECT')
     OR has_table_privilege('anon','public.students','SELECT')
     OR has_table_privilege('anon','public.pre_registrations','SELECT')
     OR has_table_privilege('anon','public.returning_otp_challenges','SELECT') THEN
    RAISE EXCEPTION 'Verification failed: anonymous data access still present';
  END IF;
  IF has_function_privilege('anon','public.get_pending_visitors()','EXECUTE')
     OR has_function_privilege('anon','public.get_visit_detail(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Verification failed: staff-only RPCs callable anonymously';
  END IF;
  IF EXISTS(SELECT 1 FROM storage.buckets
            WHERE id='guardian-references' AND public = true) THEN
    RAISE EXCEPTION 'Verification failed: guardian photo storage is public';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.buckets
                WHERE id='guardian-references' AND public = false) THEN
    RAISE EXCEPTION 'Verification failed: private guardian photo storage missing';
  END IF;
END;
$bantay_postflight$;

COMMIT;
SELECT 'BANTAY-AGAPAY migrations 09-12 COMMITTED successfully' AS result;
