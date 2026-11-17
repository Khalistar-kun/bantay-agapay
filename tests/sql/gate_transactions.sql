-- Functional tests against isolated PostgreSQL 16.
-- ON_ERROR_STOP ensures any assertion failure fails the GitHub Actions job.
DO $schooltest$
DECLARE
  school_admin uuid;
  guard uuid;
  student uuid;
  guardian uuid;
  office uuid;
  guest_pr uuid;
  guardian_pr uuid;
  revoked_pr uuid;
  created_visit uuid;
  v_status text;
  linked uuid;
  rate_key varchar(64) := repeat('a',64);
BEGIN
  INSERT INTO public.profiles(full_name,role) VALUES('Fictional Administrator','ADMIN') RETURNING id INTO school_admin;
  INSERT INTO public.profiles(full_name,role) VALUES('Fictional Guard','SECURITY') RETURNING id INTO guard;
  INSERT INTO public.students(full_name,grade,section) VALUES('Fictional Child','7','A') RETURNING id INTO student;
  INSERT INTO public.authorized_guardians(
    full_name,birth_date,address,contact_number,reference_photo_path,
    verified_by,verified_at,active
  ) VALUES (
    'Fictional Guardian','1980-01-02','Fictional Street','09170000000',
    'references/test.jpg',school_admin,now(),true
  ) RETURNING id INTO guardian;
  INSERT INTO public.student_guardians(student_id,guardian_id,relationship,active)
    VALUES(student,guardian,'PARENT',true);
  INSERT INTO public.destinations(name,active) VALUES('Fictional Faculty Office',true)
    RETURNING id INTO office;

  -- A guest's home registration MUST NOT create an INSIDE campus visit.
  INSERT INTO public.pre_registrations(
    public_token,reference_number,full_name,contact_number,visitor_type,
    purpose,destination_id,visitor_photo_path,photo_review_status,
    biometric_status,privacy_acknowledged_at
  ) VALUES (
    repeat('a',32),'B12345678','Fictional Guest','09179999999','Guest',
    'Teacher Appointment',office,'photo/guest.jpg','PASSED','NOT_REQUIRED',now()
  ) RETURNING id INTO guest_pr;
  IF EXISTS(SELECT 1 FROM public.visits WHERE pre_registration_id=guest_pr) THEN
    RAISE EXCEPTION 'Home pre-registration incorrectly counted as campus entry';
  END IF;

  SELECT visit_id INTO created_visit
  FROM public.admit_pre_registration(guest_pr,guard);
  IF created_visit IS NULL THEN RAISE EXCEPTION 'Approved guest did not enter'; END IF;
  SELECT status INTO v_status FROM public.visits WHERE id=created_visit;
  IF v_status<>'INSIDE' THEN RAISE EXCEPTION 'Actual check-in was not recorded'; END IF;

  PERFORM public.checkout_pre_registration(guest_pr,guard);
  SELECT status INTO v_status FROM public.visits WHERE id=created_visit;
  IF v_status<>'EXITED' THEN RAISE EXCEPTION 'Exit status was not saved'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.visits WHERE id=created_visit
    AND checked_out_by=guard AND check_out IS NOT NULL) THEN
    RAISE EXCEPTION 'Checkout missing guard attribution';
  END IF;

  -- Exit attempts must be idempotent: a second checkout must fail.
  BEGIN
    PERFORM public.checkout_pre_registration(guest_pr,guard);
    RAISE EXCEPTION 'Duplicate exit was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%No active visitor entry%' THEN RAISE; END IF;
  END;

  -- A pre-enrolled verified guardian with a matching reference can be admitted.
  INSERT INTO public.pre_registrations(
    public_token,reference_number,full_name,contact_number,visitor_type,purpose,
    destination_id,visitor_photo_path,guardian_birth_date,guardian_address,
    student_full_name,student_grade,student_section,guardian_id,student_id,
    guardian_details_status,biometric_status,photo_review_status,privacy_acknowledged_at
  ) VALUES(
    repeat('b',32),'B12345679','Fictional Guardian','09170000000','Parent',
    'Child Emergency',office,'photo/guardian.jpg','1980-01-02','Fictional Street',
    'Fictional Child','7','A',guardian,student,'MATCH','MATCH','PASSED',now()
  ) RETURNING id INTO guardian_pr;

  SELECT visit_id INTO created_visit FROM public.admit_pre_registration(guardian_pr,guard);
  IF created_visit IS NULL THEN RAISE EXCEPTION 'Verified guardian was not admitted'; END IF;
  IF (SELECT status FROM public.pre_registrations WHERE id=guardian_pr)<>'ADMITTED' THEN
    RAISE EXCEPTION 'Pre-registration admission status not updated';
  END IF;

  -- A second student relationship can be approved only by a school administrator.
  linked := public.link_verified_guardian(guardian,student,'PARENT',school_admin);
  IF linked IS NULL THEN RAISE EXCEPTION 'Admin relationship linking failed'; END IF;
  IF (SELECT count(*) FROM public.student_guardians
      WHERE student_id=student AND guardian_id=guardian)<>1 THEN
    RAISE EXCEPTION 'Relationship link created a duplicate';
  END IF;

  -- A guardian who was authorized when pre-registering is now revoked:
  -- the pre-existing saved QR cannot bypass the updated school roster.
  INSERT INTO public.pre_registrations(
    public_token,reference_number,full_name,contact_number,visitor_type,purpose,
    destination_id,visitor_photo_path,guardian_birth_date,guardian_address,
    student_full_name,student_grade,student_section,guardian_id,student_id,
    guardian_details_status,biometric_status,photo_review_status,privacy_acknowledged_at
  ) VALUES(
    repeat('c',32),'B12345670','Fictional Guardian','09170000000','Parent',
    'Child Emergency',office,'photo/guardian-again.jpg','1980-01-02','Fictional Street',
    'Fictional Child','7','A',guardian,student,'MATCH','MATCH','PASSED',now()
  ) RETURNING id INTO revoked_pr;

  IF NOT public.revoke_school_registry('guardian',guardian,school_admin,'School guardian authority withdrawn') THEN
    RAISE EXCEPTION 'Guardian revocation did not take effect';
  END IF;
  BEGIN
    PERFORM public.admit_pre_registration(revoked_pr,guard);
    RAISE EXCEPTION 'Revoked guardian was admitted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Guardian authorization missing%' THEN RAISE; END IF;
  END;

  -- A guard must never be permitted to reinstate or revoke the school roster.
  BEGIN
    PERFORM public.revoke_school_registry('student',student,guard,'Unauthorized guard action');
    RAISE EXCEPTION 'Guard was allowed to revoke a student record';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Only approved administrators%' THEN RAISE; END IF;
  END;

  IF NOT public.consume_rate_limit(rate_key,2,3600) THEN
    RAISE EXCEPTION 'First permitted rate limit request blocked';
  END IF;
  IF NOT public.consume_rate_limit(rate_key,2,3600) THEN
    RAISE EXCEPTION 'Second permitted rate limit request blocked';
  END IF;
  IF public.consume_rate_limit(rate_key,2,3600) THEN
    RAISE EXCEPTION 'Third request improperly bypassed rate limit';
  END IF;

  -- Migration 09 removes direct anonymous access to bearer QR tokens.
  IF has_table_privilege('anon','public.visits','SELECT')
    OR has_table_privilege('anon','public.visitors','SELECT')
    OR has_function_privilege('anon','public.get_pending_visitors()','EXECUTE')
    OR has_function_privilege('anon','public.get_visit_detail(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Legacy public visitor enumeration survived migration 09';
  END IF;
  IF NOT has_function_privilege('anon','public.get_visit_status(varchar)','EXECUTE')
    OR NOT has_function_privilege('anon','public.get_visit_directions(varchar)','EXECUTE') THEN
    RAISE EXCEPTION 'Bearer QR status/directions RPC permissions were revoked unexpectedly';
  END IF;
  IF NOT has_function_privilege('service_role','public.get_pending_visitors()','EXECUTE')
    OR NOT has_function_privilege('service_role','public.get_visit_detail(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Staff service-role RPC permissions missing';
  END IF;

  IF has_table_privilege('anon','public.students','SELECT')
     OR has_table_privilege('anon','public.pre_registrations','SELECT')
     OR has_table_privilege('anon','public.returning_otp_challenges','SELECT') THEN
    RAISE EXCEPTION 'Anonymous access to student, visitor, or OTP records detected';
  END IF;
  IF (SELECT count(*) FROM public.audit_logs WHERE action='GATE_ENTRY_APPROVED')<>2
     OR (SELECT count(*) FROM public.audit_logs WHERE action='GATE_EXIT_RECORDED')<>1
     OR (SELECT count(*) FROM public.audit_logs WHERE action='SCHOOL_AUTHORIZATION_REVOKED')<>1 THEN
    RAISE EXCEPTION 'Missing school security audit event';
  END IF;
  RAISE NOTICE 'PASS: isolated SQL gate transactions, revocation, RLS grants, audit, rate limiting';
END;
$schooltest$;
