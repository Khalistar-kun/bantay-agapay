-- BANTAY-AGAPAY: Returning visitor SMS verification challenges (STAGING ONLY).
-- No raw phone numbers, OTP codes, school ID photographs or child details are persisted here.
BEGIN;

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
COMMIT;
