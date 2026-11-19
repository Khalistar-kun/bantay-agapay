-- Disposable PostgreSQL verification; fictional HMACs only. Never contacts SMS.
DO $test_phone_proof$
DECLARE
  proof_a varchar(64):=repeat('a',64);
  proof_b varchar(64):=repeat('b',64);
  phone_a varchar(64):=repeat('c',64);
  phone_b varchar(64):=repeat('d',64);
BEGIN
  IF public.consume_phone_verification(proof_a,phone_a) THEN
    RAISE EXCEPTION 'Missing proof was accepted';
  END IF;
  INSERT INTO public.visitor_phone_verifications(proof_hash,phone_hash,expires_at)
    VALUES(proof_a,phone_a,now()+interval '10 minutes');
  IF public.consume_phone_verification(proof_a,phone_b) THEN
    RAISE EXCEPTION 'Proof accepted for wrong phone number';
  END IF;
  IF NOT public.consume_phone_verification(proof_a,phone_a) THEN
    RAISE EXCEPTION 'Valid one-use proof was rejected';
  END IF;
  IF public.consume_phone_verification(proof_a,phone_a) THEN
    RAISE EXCEPTION 'Replay accepted an already used proof';
  END IF;
  INSERT INTO public.visitor_phone_verifications(proof_hash,phone_hash,expires_at)
    VALUES(proof_b,phone_a,now()-interval '1 minute');
  IF public.consume_phone_verification(proof_b,phone_a) THEN
    RAISE EXCEPTION 'Expired proof was accepted';
  END IF;
  IF public.consume_phone_verification('invalid',phone_a) THEN
    RAISE EXCEPTION 'Malformed proof was accepted';
  END IF;
  IF has_table_privilege('anon','public.visitor_phone_verifications','SELECT')
    OR has_table_privilege('authenticated','public.visitor_phone_verifications','UPDATE')
    OR has_function_privilege('anon','public.consume_phone_verification(varchar,varchar)','EXECUTE')
    OR has_function_privilege('authenticated','public.consume_phone_verification(varchar,varchar)','EXECUTE') THEN
    RAISE EXCEPTION 'Sensitive OTP proof resources exposed to public roles';
  END IF;
  IF NOT has_function_privilege('service_role','public.consume_phone_verification(varchar,varchar)','EXECUTE') THEN
    RAISE EXCEPTION 'Server verification role cannot use the proof consumer';
  END IF;
  RAISE NOTICE 'PASS: phone-bound single-use proof, expiry, public access denied';
END;
$test_phone_proof$;
