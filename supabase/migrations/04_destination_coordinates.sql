-- Real GPS coordinates per destination, so the visitor directions page can
-- show an actual map pin instead of just text directions.

ALTER TABLE public.destinations
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

-- Update the SECURITY DEFINER directions function to also return coordinates.
DROP FUNCTION IF EXISTS get_visit_directions(varchar);
CREATE OR REPLACE FUNCTION get_visit_directions(token varchar)
RETURNS TABLE(
  status varchar,
  destination_name varchar,
  building varchar,
  floor varchar,
  room varchar,
  landmark text,
  directions text,
  latitude numeric,
  longitude numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.status::varchar,
    d.name,
    d.building,
    d.floor,
    d.room,
    d.landmark,
    d.directions,
    d.latitude,
    d.longitude
  FROM visits v
  JOIN destinations d ON v.destination_id = d.id
  WHERE v.public_token = token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_visit_directions(varchar) TO anon, authenticated;
