-- Store the visitor's actual GPS coordinates captured during registration,
-- so security/admin can see exactly where a visitor registered from
-- (previously the coordinates were checked against the geofence and then
-- discarded, only distance/accuracy had columns to persist them).

ALTER TABLE public.verification_logs
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

-- Function to get the latest verification log (GPS + face status) for a visit
DROP FUNCTION IF EXISTS get_visit_verification(uuid);
CREATE OR REPLACE FUNCTION get_visit_verification(p_visit_id uuid)
RETURNS TABLE(
  gps_status varchar,
  gps_accuracy numeric,
  distance_from_school numeric,
  latitude numeric,
  longitude numeric,
  verified_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vl.gps_status,
    vl.gps_accuracy,
    vl.distance_from_school,
    vl.latitude,
    vl.longitude,
    vl.verified_at
  FROM verification_logs vl
  WHERE vl.visit_id = p_visit_id
  ORDER BY vl.verified_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
