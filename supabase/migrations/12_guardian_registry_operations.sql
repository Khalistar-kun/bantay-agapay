-- BANTAY-AGAPAY: atomic administrator registry revocation and relationship enrollment (STAGING ONLY).
BEGIN;

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

COMMIT;
