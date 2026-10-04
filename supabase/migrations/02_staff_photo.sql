-- Staff profile photo, uploaded by the staff member themself on first login.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS photo_path text;

-- Storage bucket for staff profile photos (private; accessed via signed URLs from the server)
INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-photos', 'staff-photos', false)
ON CONFLICT (id) DO NOTHING;
