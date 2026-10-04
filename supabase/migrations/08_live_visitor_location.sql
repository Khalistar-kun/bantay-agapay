-- Live location tracking for visitors currently on campus. The visitor's
-- own browser periodically pushes updates while their status page is open
-- and their visit is INSIDE; security sees the latest position.

ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS current_latitude numeric,
  ADD COLUMN IF NOT EXISTS current_longitude numeric,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamp with time zone;

-- Function: the visitor's own browser calls this with their public_token to
-- push a location update. SECURITY DEFINER so it can bypass RLS (same
-- token-gated pattern as get_visit_status), scoped to only ever touch the
-- one row matching that token, and only while the visit is still INSIDE.
DROP FUNCTION IF EXISTS update_visit_location(varchar, numeric, numeric);
CREATE OR REPLACE FUNCTION update_visit_location(p_token varchar, p_latitude numeric, p_longitude numeric)
RETURNS boolean AS $$
DECLARE
  v_row_count integer;
BEGIN
  UPDATE public.visits
  SET current_latitude = p_latitude,
      current_longitude = p_longitude,
      location_updated_at = now()
  WHERE public_token = p_token AND status = 'INSIDE';

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION update_visit_location(varchar, numeric, numeric) TO anon, authenticated;
