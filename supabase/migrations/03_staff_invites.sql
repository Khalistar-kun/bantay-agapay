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
