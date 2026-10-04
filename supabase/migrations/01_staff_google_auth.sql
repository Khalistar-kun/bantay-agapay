-- Link staff profiles to Supabase Auth users (Google sign-in) and add an
-- approval workflow so new sign-ins can't access any dashboard until an
-- admin assigns them a role.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status varchar(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  ALTER COLUMN role DROP NOT NULL;

-- email was required+unique before; Google sign-in always provides one, so keep it,
-- but profiles can now be created before a role is chosen.
ALTER TABLE public.profiles
  ALTER COLUMN full_name DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles(auth_user_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Staff can read/update their own profile row
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = auth_user_id);

-- Function: create or fetch the profile row for the currently signed-in user.
-- Runs as the caller (not SECURITY DEFINER) so RLS above still applies.
CREATE OR REPLACE FUNCTION get_or_create_my_profile(p_full_name varchar, p_email varchar)
RETURNS TABLE(
  id uuid,
  full_name varchar,
  email varchar,
  role varchar,
  status varchar
) AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT p.id INTO v_id FROM public.profiles p WHERE p.auth_user_id = auth.uid();

  IF v_id IS NULL THEN
    INSERT INTO public.profiles (auth_user_id, full_name, email, role, status, active)
    VALUES (auth.uid(), p_full_name, p_email, NULL, 'PENDING', true)
    RETURNING public.profiles.id INTO v_id;
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.email, p.role, p.status
  FROM public.profiles p
  WHERE p.id = v_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
