-- BANTAY-AGAPAY: CLIENT-ALIGNED REGISTRY & HOME PRE-REGISTRATION (STAGING ONLY)
-- Review against an isolated database and backup before applying to production.
-- This intentionally does NOT modify existing visits or legacy visitor photos.
BEGIN;

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
ALTER TABLE public.authorized_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.students,public.authorized_guardians,public.student_guardians,
 public.pre_registrations,public.identity_verification_attempts,public.security_incidents FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.students,public.authorized_guardians,
 public.student_guardians,public.pre_registrations,public.identity_verification_attempts,
 public.security_incidents TO service_role;

-- Existing visits and visitor tables must be separately locked down on staging using migration 09.
-- Do not grant anonymous SELECT on these new tables or on guardian reference storage.

-- Atomic admission: called ONLY by a server route authenticated as school staff.
-- This function is not executable by public API roles.
CREATE OR REPLACE FUNCTION public.admit_pre_registration(p_id uuid,p_staff_id uuid)
RETURNS TABLE(visit_id uuid,visitor_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $
DECLARE
  pr public.pre_registrations%ROWTYPE;
  v_id uuid;
  created_visit uuid;
BEGIN
  SELECT * INTO pr FROM public.pre_registrations WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR pr.status <> 'PRE_REGISTERED' OR pr.expires_at <= now() THEN
    RAISE EXCEPTION 'Registration unavailable for admission';
  END IF;
  IF pr.photo_review_status <> 'PASSED' THEN
    RAISE EXCEPTION 'Photo review must pass before admission';
  END IF;
  IF pr.purpose IN ('Child Emergency','Visit Student') THEN
    IF pr.guardian_details_status <> 'MATCH' OR pr.biometric_status <> 'MATCH'
      OR pr.guardian_id IS NULL OR pr.student_id IS NULL
      OR NOT EXISTS(
        SELECT 1 FROM public.authorized_guardians g
        JOIN public.student_guardians sg ON sg.guardian_id=g.id
        JOIN public.students s ON s.id=sg.student_id
        WHERE g.id=pr.guardian_id AND s.id=pr.student_id
          AND g.active AND g.verified_at IS NOT NULL AND sg.active AND s.active
      ) THEN
      RAISE EXCEPTION 'Guardian authorization is incomplete';
    END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_staff_id AND p.active
    AND p.status='APPROVED' AND p.role IN ('ADMIN','SECURITY')) THEN
    RAISE EXCEPTION 'Guard account invalid';
  END IF;
  INSERT INTO public.visitors(full_name,contact_number,visitor_type,face_reference_path)
    VALUES(pr.full_name,pr.contact_number,pr.visitor_type,pr.visitor_photo_path)
    RETURNING id INTO v_id;
  INSERT INTO public.visits(visitor_id,destination_id,reference_number,purpose,public_token,
    status,registration_time,approved_at,approved_by,check_in,pre_registration_id)
    VALUES(v_id,pr.destination_id,pr.reference_number,pr.purpose,pr.public_token,
      'INSIDE',now(),now(),p_staff_id,now(),pr.id)
    RETURNING id INTO created_visit;
  UPDATE public.pre_registrations SET status='ADMITTED',visit_id=created_visit,
    reviewed_by=p_staff_id,reviewed_at=now() WHERE id=pr.id;
  INSERT INTO public.audit_logs(user_id,action,entity_type,entity_id,metadata)
    VALUES(p_staff_id,'GATE_ENTRY_APPROVED','visit',created_visit,
      jsonb_build_object('pre_registration_id',pr.id,'reference',pr.reference_number));
  RETURN QUERY SELECT created_visit,pr.full_name::text;
END;
$;
REVOKE EXECUTE ON FUNCTION public.admit_pre_registration(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admit_pre_registration(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.checkout_pre_registration(p_id uuid,p_staff_id uuid)
RETURNS TABLE(visitor_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $
DECLARE
  pr public.pre_registrations%ROWTYPE;
  v public.visits%ROWTYPE;
BEGIN
  SELECT * INTO pr FROM public.pre_registrations WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR pr.status <> 'ADMITTED' OR pr.visit_id IS NULL THEN
    RAISE EXCEPTION 'No active visitor entry';
  END IF;
  SELECT * INTO v FROM public.visits WHERE id=pr.visit_id FOR UPDATE;
  IF NOT FOUND OR v.status <> 'INSIDE' THEN
    RAISE EXCEPTION 'Visit already closed';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_staff_id AND p.active
    AND p.status='APPROVED' AND p.role IN ('ADMIN','SECURITY')) THEN
    RAISE EXCEPTION 'Guard account invalid';
  END IF;
  UPDATE public.visits SET status='EXITED',check_out=now(),checked_out_by=p_staff_id WHERE id=v.id;
  UPDATE public.pre_registrations SET status='EXITED' WHERE id=pr.id;
  INSERT INTO public.audit_logs(user_id,action,entity_type,entity_id,metadata)
    VALUES(p_staff_id,'GATE_EXIT_RECORDED','visit',v.id,jsonb_build_object('pre_registration_id',pr.id));
  RETURN QUERY SELECT pr.full_name::text;
END;
$;
REVOKE EXECUTE ON FUNCTION public.checkout_pre_registration(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_pre_registration(uuid,uuid) TO service_role;

COMMIT;
