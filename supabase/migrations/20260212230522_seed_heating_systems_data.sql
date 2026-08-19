/*
  # Seed Heating Systems Data

  Populates the heating systems with 4 main types:
  1. Mokrá cesta (Wet underfloor heating) - traditional with screed
  2. Suchá cesta (Dry underfloor heating) - without screed, with overlay boards
  3. Elektrické rohože (Electric heating mats) - electric underfloor
  4. Radiátory (Radiators) - wall-mounted radiators

  Each system includes configurable options and material rules with
  quantity calculations based on room area, perimeter, and fixed amounts.
*/

DO $$
DECLARE
  v_wet_id uuid;
  v_dry_id uuid;
  v_electric_id uuid;
  v_radiator_id uuid;
BEGIN

-- 1. Mokrá cesta (Wet underfloor heating)
INSERT INTO heating_systems (id, name, slug, description, sort_order)
VALUES (gen_random_uuid(), 'Podlahové topení – mokrá cesta', 'wet_underfloor', 'Klasické podlahové topení se systémovou deskou a anhydritovým/cementovým potěrem.', 1)
RETURNING id INTO v_wet_id;

INSERT INTO heating_system_options (heating_system_id, name, slug, field_type, options, default_value, unit, description, sort_order) VALUES
(v_wet_id, 'Rozteč trubek', 'pipe_spacing', 'select',
 '[{"value":"100","label":"10 cm"},{"value":"150","label":"15 cm"},{"value":"200","label":"20 cm"}]',
 '150', 'mm', 'Vzdálenost mezi trubkami ovlivňuje výkon a spotřebu materiálu', 1),
(v_wet_id, 'Typ systémové desky', 'board_type', 'select',
 '[{"value":"nop_board","label":"Systémová deska s nopy"},{"value":"tacker","label":"Tackerová deska (EPS + příchytky)"},{"value":"eps_raster","label":"EPS raster deska"}]',
 'nop_board', '', 'Typ izolační/fixační desky pod trubky', 2),
(v_wet_id, 'Průměr trubky', 'pipe_diameter', 'select',
 '[{"value":"16x2","label":"16×2 mm PE-RT"},{"value":"17x2","label":"17×2 mm PE-Xa"},{"value":"20x2","label":"20×2 mm PE-RT"}]',
 '16x2', '', 'Rozměr otopné trubky', 3),
(v_wet_id, 'Okrajová dilatace', 'edge_strip', 'boolean', '[]', 'true', '', 'Okrajový izolační pásek po obvodu místnosti', 4);

-- Wet: materials - pipes by spacing
INSERT INTO heating_system_materials (heating_system_id, name, unit, price_per_unit, quantity_per_m2, condition_option_slug, condition_option_value, waste_percent, sort_order) VALUES
(v_wet_id, 'Trubka 16×2 PE-RT', 'm', 28, 10.0, 'pipe_spacing', '100', 5, 1),
(v_wet_id, 'Trubka 16×2 PE-RT', 'm', 28, 6.7, 'pipe_spacing', '150', 5, 2),
(v_wet_id, 'Trubka 16×2 PE-RT', 'm', 28, 5.0, 'pipe_spacing', '200', 5, 3),
(v_wet_id, 'Trubka 17×2 PE-Xa', 'm', 35, 10.0, 'pipe_spacing', '100', 5, 4),
(v_wet_id, 'Trubka 17×2 PE-Xa', 'm', 35, 6.7, 'pipe_spacing', '150', 5, 5),
(v_wet_id, 'Trubka 17×2 PE-Xa', 'm', 35, 5.0, 'pipe_spacing', '200', 5, 6),
(v_wet_id, 'Trubka 20×2 PE-RT', 'm', 42, 10.0, 'pipe_spacing', '100', 5, 7),
(v_wet_id, 'Trubka 20×2 PE-RT', 'm', 42, 6.7, 'pipe_spacing', '150', 5, 8),
(v_wet_id, 'Trubka 20×2 PE-RT', 'm', 42, 5.0, 'pipe_spacing', '200', 5, 9);

-- Wet: materials - boards by type
INSERT INTO heating_system_materials (heating_system_id, name, unit, price_per_unit, quantity_per_m2, condition_option_slug, condition_option_value, waste_percent, sort_order) VALUES
(v_wet_id, 'Systémová deska s nopy', 'm2', 320, 1.0, 'board_type', 'nop_board', 8, 10),
(v_wet_id, 'Tackerová deska EPS 30-2', 'm2', 180, 1.0, 'board_type', 'tacker', 8, 11),
(v_wet_id, 'Příchytky tacker', 'ks', 2, 4.0, 'board_type', 'tacker', 10, 12),
(v_wet_id, 'EPS raster deska', 'm2', 290, 1.0, 'board_type', 'eps_raster', 8, 13);

-- Wet: materials - unconditional
INSERT INTO heating_system_materials (heating_system_id, name, unit, price_per_unit, quantity_per_m2, quantity_per_m_perimeter, quantity_fixed, waste_percent, sort_order) VALUES
(v_wet_id, 'PE fólie 0,2 mm', 'm2', 12, 1.0, 0, 0, 10, 20),
(v_wet_id, 'Okrajový dilatační pásek', 'bm', 18, 0, 1.0, 0, 5, 21),
(v_wet_id, 'Plastifikátor do potěru', 'l', 45, 0.2, 0, 0, 0, 22);


-- 2. Suchá cesta (Dry underfloor heating)
INSERT INTO heating_systems (id, name, slug, description, sort_order)
VALUES (gen_random_uuid(), 'Podlahové topení – suchá cesta', 'dry_underfloor', 'Podlahové topení bez mokrého procesu, s rozváděcími lamelami a suchým záklopem.', 2)
RETURNING id INTO v_dry_id;

INSERT INTO heating_system_options (heating_system_id, name, slug, field_type, options, default_value, unit, description, sort_order) VALUES
(v_dry_id, 'Rozteč trubek', 'pipe_spacing', 'select',
 '[{"value":"125","label":"12,5 cm"},{"value":"150","label":"15 cm"},{"value":"200","label":"20 cm"}]',
 '150', 'mm', 'Vzdálenost mezi trubkami', 1),
(v_dry_id, 'Typ systémové desky', 'board_type', 'select',
 '[{"value":"eps_channel","label":"EPS frézovaná deska"},{"value":"wood_fiber","label":"Dřevovláknitá deska"}]',
 'eps_channel', '', 'Typ nosné desky s kanálky', 2),
(v_dry_id, 'Záklop', 'overlay', 'select',
 '[{"value":"gypsum_fiber","label":"Sádrovláknitá deska (Fermacell)"},{"value":"osb","label":"OSB deska"},{"value":"cement_fiber","label":"Cementovláknitá deska"}]',
 'gypsum_fiber', '', 'Typ suchého záklopu nad systémovou deskou', 3);

-- Dry: pipes by spacing
INSERT INTO heating_system_materials (heating_system_id, name, unit, price_per_unit, quantity_per_m2, condition_option_slug, condition_option_value, waste_percent, sort_order) VALUES
(v_dry_id, 'Trubka 16×2 PE-RT', 'm', 28, 8.0, 'pipe_spacing', '125', 5, 1),
(v_dry_id, 'Trubka 16×2 PE-RT', 'm', 28, 6.7, 'pipe_spacing', '150', 5, 2),
(v_dry_id, 'Trubka 16×2 PE-RT', 'm', 28, 5.0, 'pipe_spacing', '200', 5, 3);

-- Dry: boards by type
INSERT INTO heating_system_materials (heating_system_id, name, unit, price_per_unit, quantity_per_m2, condition_option_slug, condition_option_value, waste_percent, sort_order) VALUES
(v_dry_id, 'EPS frézovaná deska 30mm', 'm2', 450, 1.0, 'board_type', 'eps_channel', 8, 10),
(v_dry_id, 'Dřevovláknitá systémová deska', 'm2', 520, 1.0, 'board_type', 'wood_fiber', 8, 11);

-- Dry: overlay by type
INSERT INTO heating_system_materials (heating_system_id, name, unit, price_per_unit, quantity_per_m2, condition_option_slug, condition_option_value, waste_percent, sort_order) VALUES
(v_dry_id, 'Sádrovláknitá deska Fermacell 2×10mm', 'm2', 380, 1.0, 'overlay', 'gypsum_fiber', 8, 20),
(v_dry_id, 'OSB deska 18mm', 'm2', 220, 1.0, 'overlay', 'osb', 8, 21),
(v_dry_id, 'Cementovláknitá deska 12mm', 'm2', 340, 1.0, 'overlay', 'cement_fiber', 8, 22);

-- Dry: unconditional
INSERT INTO heating_system_materials (heating_system_id, name, unit, price_per_unit, quantity_per_m2, quantity_per_m_perimeter, quantity_fixed, waste_percent, sort_order) VALUES
(v_dry_id, 'Hliníkové rozváděcí lamely', 'ks', 35, 5.0, 0, 0, 5, 30),
(v_dry_id, 'Okrajový dilatační pásek', 'bm', 18, 0, 1.0, 0, 5, 31);


-- 3. Elektrické rohože (Electric heating mats)
INSERT INTO heating_systems (id, name, slug, description, sort_order)
VALUES (gen_random_uuid(), 'Elektrické podlahové topení', 'electric_underfloor', 'Elektrické topné rohože nebo kabely pod dlažbu či do anhydritu.', 3)
RETURNING id INTO v_electric_id;

INSERT INTO heating_system_options (heating_system_id, name, slug, field_type, options, default_value, unit, description, sort_order) VALUES
(v_electric_id, 'Typ topného prvku', 'element_type', 'select',
 '[{"value":"mat","label":"Topná rohož"},{"value":"cable","label":"Topný kabel"}]',
 'mat', '', 'Rohož pro jednoduchou instalaci, kabel pro variabilní rozteč', 1),
(v_electric_id, 'Výkon', 'wattage', 'select',
 '[{"value":"100","label":"100 W/m²"},{"value":"120","label":"120 W/m²"},{"value":"150","label":"150 W/m²"},{"value":"200","label":"200 W/m²"}]',
 '150', 'W/m²', 'Příkon na m² otápěné plochy', 2),
(v_electric_id, 'Termostat', 'thermostat', 'select',
 '[{"value":"basic","label":"Základní manuální"},{"value":"programmable","label":"Programovatelný"},{"value":"wifi","label":"WiFi / Smart"}]',
 'programmable', '', 'Typ regulačního termostatu', 3);

-- Electric: mats by wattage
INSERT INTO heating_system_materials (heating_system_id, name, unit, price_per_unit, quantity_per_m2, condition_option_slug, condition_option_value, waste_percent, sort_order) VALUES
(v_electric_id, 'Topná rohož 100 W/m²', 'm2', 850, 1.0, 'wattage', '100', 5, 1),
(v_electric_id, 'Topná rohož 120 W/m²', 'm2', 920, 1.0, 'wattage', '120', 5, 2),
(v_electric_id, 'Topná rohož 150 W/m²', 'm2', 1050, 1.0, 'wattage', '150', 5, 3),
(v_electric_id, 'Topná rohož 200 W/m²', 'm2', 1280, 1.0, 'wattage', '200', 5, 4);

-- Electric: thermostats
INSERT INTO heating_system_materials (heating_system_id, name, unit, price_per_unit, quantity_fixed, condition_option_slug, condition_option_value, sort_order) VALUES
(v_electric_id, 'Termostat manuální', 'ks', 890, 1, 'thermostat', 'basic', 10),
(v_electric_id, 'Termostat programovatelný', 'ks', 1650, 1, 'thermostat', 'programmable', 11),
(v_electric_id, 'Termostat WiFi / Smart', 'ks', 2950, 1, 'thermostat', 'wifi', 12);

-- Electric: unconditional
INSERT INTO heating_system_materials (heating_system_id, name, unit, price_per_unit, quantity_per_m2, sort_order) VALUES
(v_electric_id, 'Penetrace podkladu', 'm2', 25, 1.0, 20),
(v_electric_id, 'Flexibilní lepidlo', 'kg', 18, 5.0, 21),
(v_electric_id, 'Ochranná trubka čidla', 'ks', 45, 0, 22);
UPDATE heating_system_materials SET quantity_fixed = 1 WHERE name = 'Ochranná trubka čidla' AND heating_system_id = v_electric_id;


-- 4. Radiátory (Radiators)
INSERT INTO heating_systems (id, name, slug, description, sort_order)
VALUES (gen_random_uuid(), 'Radiátory', 'radiators', 'Desková, trubková nebo designová otopná tělesa.', 4)
RETURNING id INTO v_radiator_id;

INSERT INTO heating_system_options (heating_system_id, name, slug, field_type, options, default_value, unit, description, sort_order) VALUES
(v_radiator_id, 'Typ radiátoru', 'radiator_type', 'select',
 '[{"value":"panel_11","label":"Deskový 11 (1 deska, 1 konvektor)"},{"value":"panel_22","label":"Deskový 22 (2 desky, 2 konvektory)"},{"value":"panel_33","label":"Deskový 33 (3 desky, 3 konvektory)"},{"value":"tubular","label":"Trubkový (koupelnový)"},{"value":"design","label":"Designový"}]',
 'panel_22', '', 'Typ otopného tělesa', 1),
(v_radiator_id, 'Připojení', 'connection', 'select',
 '[{"value":"side","label":"Boční"},{"value":"bottom","label":"Spodní (ventil kompakt)"}]',
 'bottom', '', 'Typ připojení radiátoru', 2),
(v_radiator_id, 'Výkon na m²', 'heat_output', 'select',
 '[{"value":"60","label":"60 W/m² (nízkoenergetický dům)"},{"value":"80","label":"80 W/m² (zateplený dům)"},{"value":"100","label":"100 W/m² (starší stavba)"},{"value":"120","label":"120 W/m² (nezateplený dům)"}]',
 '80', 'W/m²', 'Potřebný výkon vytápění na m² plochy', 3);

-- Radiator: panel types - per room fixed
INSERT INTO heating_system_materials (heating_system_id, name, unit, price_per_unit, quantity_fixed, condition_option_slug, condition_option_value, sort_order) VALUES
(v_radiator_id, 'Deskový radiátor 11', 'ks', 3500, 1, 'radiator_type', 'panel_11', 1),
(v_radiator_id, 'Deskový radiátor 22', 'ks', 5200, 1, 'radiator_type', 'panel_22', 2),
(v_radiator_id, 'Deskový radiátor 33', 'ks', 7800, 1, 'radiator_type', 'panel_33', 3),
(v_radiator_id, 'Trubkový radiátor (koupelnový)', 'ks', 4500, 1, 'radiator_type', 'tubular', 4),
(v_radiator_id, 'Designový radiátor', 'ks', 12000, 1, 'radiator_type', 'design', 5);

-- Radiator: connection types
INSERT INTO heating_system_materials (heating_system_id, name, unit, price_per_unit, quantity_fixed, condition_option_slug, condition_option_value, sort_order) VALUES
(v_radiator_id, 'Připojovací sada boční', 'ks', 350, 1, 'connection', 'side', 10),
(v_radiator_id, 'Připojovací sada spodní (H-kus)', 'ks', 650, 1, 'connection', 'bottom', 11);

-- Radiator: unconditional per room
INSERT INTO heating_system_materials (heating_system_id, name, unit, price_per_unit, quantity_fixed, sort_order) VALUES
(v_radiator_id, 'Termostatická hlavice', 'ks', 380, 1, 20),
(v_radiator_id, 'Montážní konzole', 'sada', 250, 1, 21),
(v_radiator_id, 'Odvzdušňovací ventil', 'ks', 85, 1, 22);

END $$;
