-- Switch visitor directions from the GPS lat/lon pin to the illustrated
-- campus map image (public/campus-map.png) with a pixel-position marker.

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
  map_x numeric,
  map_y numeric
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
    d.map_x,
    d.map_y
  FROM visits v
  JOIN destinations d ON v.destination_id = d.id
  WHERE v.public_token = token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_visit_directions(varchar) TO anon, authenticated;
