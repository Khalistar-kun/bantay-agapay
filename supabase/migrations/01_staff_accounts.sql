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
