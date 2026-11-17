-- Ephemeral PostgreSQL fixture: fictional records only, never connected to Supabase.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
  id text PRIMARY KEY, name text NOT NULL, public boolean NOT NULL DEFAULT false
);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  role text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'APPROVED'
);
CREATE TABLE public.visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  contact_number varchar(20) NOT NULL,
  visitor_type varchar(100),
  face_reference_path text
);
CREATE TABLE public.destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL REFERENCES public.visitors(id),
  destination_id uuid NOT NULL REFERENCES public.destinations(id),
  reference_number varchar(10) NOT NULL UNIQUE,
  purpose text,
  public_token varchar(255) UNIQUE,
  status text NOT NULL DEFAULT 'PENDING',
  registration_time timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  check_in timestamptz,
  check_out timestamptz
);
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  action varchar(255) NOT NULL,
  entity_type varchar(100),
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
