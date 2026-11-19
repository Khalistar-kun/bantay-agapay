-- M13: Required one-use, phone-bound proof for all visitor registration (STAGING FIRST).
-- Must run AFTER migrations 09-12; do NOT run against school production without review.
BEGIN;
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
COMMIT;
