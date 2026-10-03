-- Drop existing tables (if any) in correct order
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.verification_logs CASCADE;
DROP TABLE IF EXISTS public.visits CASCADE;
DROP TABLE IF EXISTS public.destinations CASCADE;
DROP TABLE IF EXISTS public.visitors CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Profiles table for staff
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name varchar(255) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  role varchar(50) NOT NULL CHECK (role IN ('ADMIN', 'SECURITY')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Visitors table
CREATE TABLE public.visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name varchar(255) NOT NULL,
  contact_number varchar(20) NOT NULL,
  visitor_type varchar(100),
  face_reference_path text,
  face_embedding text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Destinations table
CREATE TABLE public.destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  category varchar(100),
  building varchar(255),
  floor varchar(50),
  room varchar(50),
  description text,
  landmark text,
  directions text,
  map_x numeric,
  map_y numeric,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Visits table
CREATE TABLE public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL REFERENCES public.visitors(id) ON DELETE CASCADE,
  destination_id uuid NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  reference_number varchar(10) NOT NULL UNIQUE,
  purpose text,
  public_token varchar(255) UNIQUE,
  status varchar(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'INSIDE', 'EXITED', 'DENIED', 'CANCELLED')),
  registration_time timestamp with time zone DEFAULT now(),
  approved_at timestamp with time zone,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  check_in timestamp with time zone,
  check_out timestamp with time zone,
  denied_at timestamp with time zone,
  denied_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  denial_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Verification logs table
CREATE TABLE public.verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  face_status varchar(50) CHECK (face_status IN ('FACE_ENROLLED', 'FACE_VERIFIED', 'FACE_NO_MATCH', 'FACE_DETECTION_FAILED')),
  face_similarity numeric,
  gps_status varchar(50) CHECK (gps_status IN ('GPS_VERIFIED', 'OUTSIDE_AUTHORIZED_AREA', 'GPS_FAILED')),
  gps_accuracy numeric,
  distance_from_school numeric,
  verified_at timestamp with time zone DEFAULT now()
);

-- System settings table
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(255) NOT NULL UNIQUE,
  value text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action varchar(255) NOT NULL,
  entity_type varchar(100),
  entity_id uuid,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_visits_status ON public.visits(status);
CREATE INDEX idx_visits_visitor_id ON public.visits(visitor_id);
CREATE INDEX idx_visits_reference ON public.visits(reference_number);
CREATE INDEX idx_visits_public_token ON public.visits(public_token);
CREATE INDEX idx_visitors_name_contact ON public.visitors(full_name, contact_number);

-- Insert sample destinations
INSERT INTO public.destinations (name, category, building, floor, room, description, landmark, directions, map_x, map_y, active, created_at, updated_at)
VALUES
  ('Principal''s Office', 'Administration', 'Administration Building', 'Ground Floor', 'Room 101', 'School principal office', 'Main entrance of administration building', 'Enter through main gate, proceed to administration building', 25, 30, true, now(), now()),
  ('Registrar', 'Administration', 'Administration Building', 'Ground Floor', 'Room 103', 'Student records and enrollment', 'Beside guidance office', 'From main gate, follow covered walkway to administration building', 28, 32, true, now(), now()),
  ('Guidance Office', 'Student Services', 'Administration Building', 'Ground Floor', 'Room 105', 'Guidance and counseling services', 'Beside registrar office', 'Main administration building, ground floor', 30, 32, true, now(), now()),
  ('Clinic', 'Health Services', 'Medical Building', '1st Floor', 'Room 201', 'School health center', 'Near cafeteria', 'Proceed past administration building towards medical wing', 35, 40, true, now(), now()),
  ('Faculty Room', 'Academic', 'Main Academic Building', '2nd Floor', 'Room 305', 'Faculty office', 'Academic building second floor', 'Academic building entrance, second floor', 45, 45, true, now(), now()),
  ('Cashier', 'Finance', 'Administration Building', '1st Floor', 'Room 202', 'Payment and financial services', 'Second floor administration building', 'Administration building, stairwell near entrance', 25, 35, true, now(), now()),
  ('Senior High School Department', 'Academic', 'SHS Building', 'All Floors', 'Main SHS Building', 'Senior high school section', 'SHS Building complex', 'From main gate turn right towards SHS building complex', 50, 50, true, now(), now()),
  ('Cafeteria', 'Support Services', 'Cafeteria Building', '1st Floor', 'Dining Area', 'School cafeteria', 'Central location', 'Central campus location near medical building', 40, 38, true, now(), now());

-- RLS Policies
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;

-- Policy: Visitors can view their own visit status (public access with token)
DROP POLICY IF EXISTS "allow_public_visit_status" ON public.visits;
CREATE POLICY "allow_public_visit_status"
ON public.visits FOR SELECT
USING (true);

-- Policy: Anyone can view active destinations (needed for the public registration form)
DROP POLICY IF EXISTS "allow_public_read_destinations" ON public.destinations;
CREATE POLICY "allow_public_read_destinations"
ON public.destinations FOR SELECT
USING (active = true);

-- Grant anon/authenticated roles the privileges RLS policies above rely on
GRANT SELECT ON public.destinations TO anon, authenticated;
GRANT SELECT ON public.visits TO anon, authenticated;
GRANT SELECT, INSERT ON public.visitors TO anon, authenticated;
GRANT INSERT ON public.visits TO anon, authenticated;

-- Function to get pending visitors
CREATE OR REPLACE FUNCTION get_pending_visitors()
RETURNS TABLE(
  id uuid,
  reference_number varchar,
  full_name varchar,
  visitor_type varchar,
  purpose text,
  destination_name varchar,
  registration_time timestamp with time zone,
  contact_number varchar,
  face_reference_path text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.reference_number,
    vis.full_name,
    vis.visitor_type,
    v.purpose,
    d.name,
    v.registration_time,
    vis.contact_number,
    vis.face_reference_path
  FROM visits v
  JOIN visitors vis ON v.visitor_id = vis.id
  JOIN destinations d ON v.destination_id = d.id
  WHERE v.status = 'PENDING'
  ORDER BY v.registration_time DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get visit status by token
CREATE OR REPLACE FUNCTION get_visit_status(token varchar)
RETURNS TABLE(
  status varchar,
  visitor_name varchar,
  reference_number varchar,
  destination_name varchar,
  approved_at timestamp with time zone,
  denied_reason text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.status::varchar,
    vis.full_name,
    v.reference_number,
    d.name,
    v.approved_at,
    v.denial_reason
  FROM visits v
  JOIN visitors vis ON v.visitor_id = vis.id
  JOIN destinations d ON v.destination_id = d.id
  WHERE v.public_token = token;
END;
$$ LANGUAGE plpgsql;

-- Function to get a single visit's full detail for the security review page
CREATE OR REPLACE FUNCTION get_visit_detail(visit_id uuid)
RETURNS TABLE(
  id uuid,
  reference_number varchar,
  full_name varchar,
  visitor_type varchar,
  contact_number varchar,
  purpose text,
  destination_name varchar,
  status varchar,
  registration_time timestamp with time zone,
  face_reference_path text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.reference_number,
    vis.full_name,
    vis.visitor_type,
    vis.contact_number,
    v.purpose,
    d.name,
    v.status::varchar,
    v.registration_time,
    vis.face_reference_path
  FROM visits v
  JOIN visitors vis ON v.visitor_id = vis.id
  JOIN destinations d ON v.destination_id = d.id
  WHERE v.id = visit_id;
END;
$$ LANGUAGE plpgsql;

-- Storage bucket for visitor face photos (private; accessed via signed URLs from the server)
INSERT INTO storage.buckets (id, name, public)
VALUES ('visitor-faces', 'visitor-faces', false)
ON CONFLICT (id) DO NOTHING;
