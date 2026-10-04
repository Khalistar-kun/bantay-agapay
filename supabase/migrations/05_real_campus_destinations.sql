-- Replace placeholder seed destinations with the real campus buildings
-- shown on the admin-provided campus map (public/campus-map.png).
-- map_x/map_y store the building's pixel position on that 2048x1536 image.

DELETE FROM public.destinations;

INSERT INTO public.destinations (name, category, building, map_x, map_y, active)
VALUES
  ('Marcelo H. del Pilar', 'Academic', 'Building 1', 985, 235, true),
  ('Mariano Ponce', 'Academic', 'Building 2', 1300, 215, true),
  ('Pedro A. Paterno', 'Academic', 'Building 3', 1565, 230, true),
  ('Maximo Viola', 'Academic', 'Building 4', 1715, 565, true),
  ('Ciriaco C. Contreras', 'Academic', 'Building 5', 1665, 850, true),
  ('Trinidad P. Tecson', 'Academic', 'Building 6', 1390, 850, true),
  ('Graciano Lopez Jaena', 'Academic', 'Building 7', 1580, 400, true),
  ('Jose Maria Panganiban', 'Academic', 'Building 8', 1500, 660, true),
  ('Jose P. Rizal', 'Academic', 'Building 9', 975, 345, true),
  ('Pedro S. Laktaw', 'Academic', 'Building 10', 1400, 480, true),
  ('Juan Luna', 'Academic', 'Building 11 (Municipal)', 1300, 315, true),
  ('Antonio Luna', 'Academic', 'Building 12', 1200, 315, true),
  ('Antonio S. Bautista', 'Academic', 'Building 13', 1075, 650, true),
  ('Felipe Salvador', 'Academic', 'Building 14', 1070, 480, true),
  ('Administration Office', 'Administration', 'Building 15', 790, 490, true),
  ('Lapu Lapu', 'Academic', 'Building 16', 835, 800, true),
  ('Emilio Jacinto', 'Academic', 'Building 17', 850, 905, true),
  ('Diego Silang', 'Academic', 'Building 18', 855, 1010, true),
  ('Deodato Arellano', 'Academic', 'Building 19', 870, 1190, true),
  ('Ladislao Diwa', 'Academic', 'Building 20', 1280, 1440, true),
  ('Artemio Ricarte', 'Academic', 'Building 21', 905, 1440, true),
  ('Pio Valenzuela', 'Academic', 'Building 22 (State of the Art Building)', 865, 1335, true),
  ('Gomburza', 'Academic', 'Building 23', 695, 1440, true),
  ('Gabriela Silang', 'Academic', 'Building 24', 230, 1245, true),
  ('Melchora Aquino', 'Academic', 'Building 25', 230, 1115, true),
  ('Building 26 (Canteen 1)', 'Support Services', 'Building 26', 230, 870, true),
  ('Apolinario Mabini', 'Academic', 'Building 27', 230, 600, true),
  ('Emilio Aguinaldo', 'Academic', 'Building 28', 230, 220, true),
  ('Andres Bonifacio', 'Academic', 'Building 29', 400, 320, true),
  ('Gregorio H. del Pilar', 'Academic', 'Building 30', 520, 600, true),
  ('Teodoro Plata', 'Academic', 'Building 31', 835, 1115, true),
  ('Isidoro D. Torres', 'Academic', 'Building 32', 1175, 890, true),
  ('Eusebio Roque', 'Academic', 'Building 33', 1050, 890, true),
  ('Anacleto F. Enriquez', 'Academic', 'Building 34', 1280, 1255, true);
