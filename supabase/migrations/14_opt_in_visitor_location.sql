-- Migration 14: visitor opt-in, foreground-only location sharing (STAGING FIRST).
-- Requires migrations 09-13. No live Supabase project is modified automatically.
-- The service-role server performs authorized updates; the QR bearer must never
-- be permitted to mutate location via an anonymously callable RPC.
BEGIN;
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS current_latitude numeric,
  ADD COLUMN IF NOT EXISTS current_longitude numeric,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS location_sharing_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.visits
  ADD CONSTRAINT visitor_location_accuracy_range CHECK (
    location_accuracy_m IS NULL OR
      (location_accuracy_m >= 1 AND location_accuracy_m <= 150)
  ) NOT VALID;
ALTER TABLE public.visits VALIDATE CONSTRAINT visitor_location_accuracy_range;

-- Clear historic coordinates previously captured without a server-side
-- tracking consent flag. Preserve visitor entry/exit records.
UPDATE public.visits SET
  current_latitude=NULL,current_longitude=NULL,
  location_accuracy_m=NULL,location_updated_at=NULL
WHERE location_sharing_enabled=false
  AND (current_latitude IS NOT NULL OR current_longitude IS NOT NULL
    OR location_updated_at IS NOT NULL OR location_accuracy_m IS NOT NULL);

CREATE OR REPLACE FUNCTION public.enforce_active_visitor_location()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $location$
BEGIN
  -- STOP, CHECKOUT, DENIAL or a non-inside status always clears active location.
  IF NEW.status <> 'INSIDE' OR NOT NEW.location_sharing_enabled THEN
    NEW.location_sharing_enabled=false;
    NEW.current_latitude=NULL;
    NEW.current_longitude=NULL;
    NEW.location_accuracy_m=NULL;
    NEW.location_updated_at=NULL;
  END IF;
  RETURN NEW;
END;
$location$;
DROP TRIGGER IF EXISTS trg_enforce_active_visitor_location ON public.visits;
CREATE TRIGGER trg_enforce_active_visitor_location
  BEFORE INSERT OR UPDATE ON public.visits FOR EACH ROW
  EXECUTE FUNCTION public.enforce_active_visitor_location();

-- The legacy RPC uses only a public QR token as its authorization.
-- Retire it before activating the signed-device location API.
DO $revoke_legacy$
BEGIN
  IF to_regprocedure('public.update_visit_location(varchar,numeric,numeric)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_visit_location(varchar,numeric,numeric) FROM PUBLIC, anon, authenticated';
  END IF;
END;
$revoke_legacy$;
COMMIT;
