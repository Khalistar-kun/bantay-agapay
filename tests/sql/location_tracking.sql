-- Migration-14 validation in disposable PostgreSQL only; fictional GPS and users.
DO $check_location$
DECLARE
  v_id uuid;
  person uuid;
  office uuid;
  s text;
  allowed boolean;
  lat numeric;
  accuracy numeric;
BEGIN
  IF has_function_privilege('anon',
    'public.update_visit_location(varchar,numeric,numeric)','EXECUTE')
    OR has_function_privilege('authenticated',
    'public.update_visit_location(varchar,numeric,numeric)','EXECUTE') THEN
    RAISE EXCEPTION 'Old QR-only GPS mutation remains public';
  END IF;
  IF has_table_privilege('anon','public.visits','SELECT') THEN
    RAISE EXCEPTION 'Public visit coordinates leaked';
  END IF;

  INSERT INTO public.visitors(full_name,contact_number)
    VALUES('Fictional Geo Guest','09170000010') RETURNING id INTO person;
  INSERT INTO public.destinations(name) VALUES('Fictional GPS Office')
    RETURNING id INTO office;
  INSERT INTO public.visits(visitor_id,destination_id,reference_number,
    public_token,status)
    VALUES(person,office,'GPS123456',repeat('f',32),'INSIDE')
    RETURNING id INTO v_id;

  SELECT location_sharing_enabled INTO allowed FROM public.visits WHERE id=v_id;
  IF allowed THEN RAISE EXCEPTION 'GPS sharing defaults to opt-in'; END IF;
  UPDATE public.visits SET current_latitude=14.7,current_longitude=120.9,
    location_updated_at=now(),location_accuracy_m=25 WHERE id=v_id;
  SELECT current_latitude INTO lat FROM public.visits WHERE id=v_id;
  IF lat IS NOT NULL THEN
    RAISE EXCEPTION 'Non-consented visitor GPS persisted';
  END IF;

  UPDATE public.visits SET location_sharing_enabled=true,
    current_latitude=14.7,current_longitude=120.9,
    location_updated_at=now(),location_accuracy_m=25 WHERE id=v_id;
  SELECT current_latitude,location_accuracy_m INTO lat,accuracy
  FROM public.visits WHERE id=v_id;
  IF lat<>14.7 OR accuracy<>25 THEN
    RAISE EXCEPTION 'Active consented GPS was not recorded';
  END IF;

  UPDATE public.visits SET location_sharing_enabled=false WHERE id=v_id;
  IF EXISTS(SELECT 1 FROM public.visits WHERE id=v_id
    AND (location_sharing_enabled
      OR current_latitude IS NOT NULL OR current_longitude IS NOT NULL
      OR location_accuracy_m IS NOT NULL OR location_updated_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'Stop did not clear sensitive GPS';
  END IF;

  UPDATE public.visits SET location_sharing_enabled=true,
    current_latitude=14.7,current_longitude=120.9,
    location_accuracy_m=50,location_updated_at=now() WHERE id=v_id;
  UPDATE public.visits SET status='EXITED' WHERE id=v_id;
  IF EXISTS(SELECT 1 FROM public.visits WHERE id=v_id
    AND (location_sharing_enabled
      OR current_latitude IS NOT NULL OR current_longitude IS NOT NULL
      OR location_accuracy_m IS NOT NULL OR location_updated_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'Exit failed to erase GPS or disable sharing';
  END IF;

  UPDATE public.visits SET location_sharing_enabled=true,
    current_latitude=14.7 WHERE id=v_id;
  SELECT location_sharing_enabled,current_latitude INTO allowed,lat
    FROM public.visits WHERE id=v_id;
  IF allowed OR lat IS NOT NULL THEN
    RAISE EXCEPTION 'Exited visitor GPS update accepted';
  END IF;
  RAISE NOTICE 'PASS: QR-only RPC revoked, consent required, stop/checkout erases coordinates';
END;
$check_location$;
