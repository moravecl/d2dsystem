/*
  # Seed Global Design Element Types

  Seeds the initial catalog of schematic element types used in the new 3-layer design system.
  These are global types (org_id = NULL) available to all organizations.

  ## Categories Seeded

  ### elektro — Electrical
  - Zásuvka jednoduchá (outlet_single)
  - Zásuvka dvojitá (outlet_double)
  - Zásuvka trojitá (outlet_triple)
  - Zásuvka s USB (outlet_usb)
  - Zásuvka venkovní / IP (outlet_outdoor)
  - Vypínač jednopólový (switch_single)
  - Vypínač dvojpólový (switch_double)
  - Vypínač sériový (switch_series)
  - Přepínač (switch_toggle)
  - Stmívač (dimmer)
  - Světlo bodové (light_spot)
  - Světlo nástěnné (light_wall)
  - Světlo stropní (light_ceiling)
  - Světlo venkovní (light_outdoor)
  - Jistič / rozvaděč (distribution_board)

  ### data — Data / Network
  - Datová zásuvka RJ45 (data_rj45)
  - Datová zásuvka dual (data_rj45_dual)
  - Wifi access point (wifi_ap)
  - Patch panel (patch_panel)

  ### camera — CCTV Cameras
  - Kamera vnitřní (camera_indoor)
  - Kamera venkovní (camera_outdoor)
  - Kamera PTZ (camera_ptz)
  - Kamera IP dome (camera_dome)
  - NVR / rekordér (nvr)

  ### eps — Security / Alarm
  - Detektor pohybu (eps_motion)
  - Detektor kouře (eps_smoke)
  - Detektor CO (eps_co)
  - Magnetický kontakt dveří/okna (eps_magnetic)
  - Klávesnice alarmu (eps_keypad)
  - Siréna (eps_siren)
  - Centrála alarmu (eps_control_panel)
*/

INSERT INTO design_element_types (org_id, slug, name, category, subcategory, icon, default_params, sort_order)
VALUES
  -- ELEKTRO — Zásuvky
  (NULL, 'outlet_single',   'Zásuvka jednoduchá',       'elektro', 'sockets',   'outlet',         '{"modules": 1}'::jsonb, 10),
  (NULL, 'outlet_double',   'Zásuvka dvojitá',           'elektro', 'sockets',   'outlet',         '{"modules": 2}'::jsonb, 11),
  (NULL, 'outlet_triple',   'Zásuvka trojitá',           'elektro', 'sockets',   'outlet',         '{"modules": 3}'::jsonb, 12),
  (NULL, 'outlet_usb',      'Zásuvka s USB',             'elektro', 'sockets',   'outlet_usb',     '{"modules": 2, "usb": true}'::jsonb, 13),
  (NULL, 'outlet_outdoor',  'Zásuvka venkovní IP',       'elektro', 'sockets',   'outlet_outdoor', '{"ip_rating": "IP44"}'::jsonb, 14),

  -- ELEKTRO — Vypínače
  (NULL, 'switch_single',   'Vypínač jednopólový',       'elektro', 'switches',  'switch',         '{"modules": 1, "poles": 1}'::jsonb, 20),
  (NULL, 'switch_double',   'Vypínač dvojpólový',        'elektro', 'switches',  'switch',         '{"modules": 1, "poles": 2}'::jsonb, 21),
  (NULL, 'switch_series',   'Vypínač sériový',           'elektro', 'switches',  'switch_series',  '{"modules": 2}'::jsonb, 22),
  (NULL, 'switch_toggle',   'Přepínač',                  'elektro', 'switches',  'switch_toggle',  '{"modules": 1}'::jsonb, 23),
  (NULL, 'dimmer',          'Stmívač',                   'elektro', 'switches',  'dimmer',         '{"modules": 1, "dimmable": true}'::jsonb, 24),

  -- ELEKTRO — Osvětlení
  (NULL, 'light_spot',      'Světlo bodové',             'elektro', 'lighting',  'light_spot',     '{"type": "spot"}'::jsonb, 30),
  (NULL, 'light_wall',      'Světlo nástěnné',           'elektro', 'lighting',  'light_wall',     '{"type": "wall"}'::jsonb, 31),
  (NULL, 'light_ceiling',   'Světlo stropní',            'elektro', 'lighting',  'light_ceiling',  '{"type": "ceiling"}'::jsonb, 32),
  (NULL, 'light_outdoor',   'Světlo venkovní',           'elektro', 'lighting',  'light_outdoor',  '{"type": "outdoor", "ip_rating": "IP44"}'::jsonb, 33),
  (NULL, 'light_strip',     'LED pásek',                 'elektro', 'lighting',  'light_strip',    '{"type": "strip"}'::jsonb, 34),

  -- ELEKTRO — Rozvaděče
  (NULL, 'distribution_board', 'Rozvaděč / jistič',     'elektro', 'distribution', 'panel',       '{}'::jsonb, 40),
  (NULL, 'thermostat',      'Termostat',                 'elektro', 'control',   'thermostat',     '{"voltage": "230V"}'::jsonb, 41),

  -- DATA — Síťové prvky
  (NULL, 'data_rj45',       'Datová zásuvka RJ45',       'data',    'network',   'network_port',   '{"ports": 1}'::jsonb, 50),
  (NULL, 'data_rj45_dual',  'Datová zásuvka dual',       'data',    'network',   'network_port',   '{"ports": 2}'::jsonb, 51),
  (NULL, 'wifi_ap',         'WiFi access point',         'data',    'network',   'wifi',           '{"standard": "WiFi 6"}'::jsonb, 52),
  (NULL, 'patch_panel',     'Patch panel',               'data',    'network',   'patch_panel',    '{"ports": 24}'::jsonb, 53),
  (NULL, 'tv_outlet',       'TV / SAT zásuvka',          'data',    'av',        'tv_outlet',      '{"type": "TV/SAT"}'::jsonb, 54),

  -- KAMERA — CCTV
  (NULL, 'camera_indoor',   'Kamera vnitřní',            'camera',  'cctv',      'camera',         '{"location": "indoor", "resolution_mp": 2}'::jsonb, 60),
  (NULL, 'camera_outdoor',  'Kamera venkovní',           'camera',  'cctv',      'camera_outdoor', '{"location": "outdoor", "resolution_mp": 4, "ip_rating": "IP66"}'::jsonb, 61),
  (NULL, 'camera_ptz',      'Kamera PTZ',                'camera',  'cctv',      'camera_ptz',     '{"location": "outdoor", "ptz": true, "resolution_mp": 4}'::jsonb, 62),
  (NULL, 'camera_dome',     'Kamera dome',               'camera',  'cctv',      'camera_dome',    '{"location": "indoor", "form": "dome"}'::jsonb, 63),
  (NULL, 'nvr',             'NVR / rekordér',             'camera',  'cctv',      'server',         '{"type": "nvr"}'::jsonb, 64),
  (NULL, 'poe_switch',      'PoE switch',                'camera',  'network',   'switch_network', '{"poe": true}'::jsonb, 65),

  -- EPS — Zabezpečení
  (NULL, 'eps_motion',      'Detektor pohybu',           'eps',     'detectors', 'motion_sensor',  '{"type": "PIR"}'::jsonb, 70),
  (NULL, 'eps_smoke',       'Detektor kouře',            'eps',     'detectors', 'smoke_sensor',   '{"type": "smoke"}'::jsonb, 71),
  (NULL, 'eps_co',          'Detektor CO',               'eps',     'detectors', 'co_sensor',      '{"type": "CO"}'::jsonb, 72),
  (NULL, 'eps_magnetic',    'Kontakt dveří/okna',        'eps',     'detectors', 'door_sensor',    '{"type": "magnetic"}'::jsonb, 73),
  (NULL, 'eps_glass_break', 'Detektor rozbití skla',     'eps',     'detectors', 'glass_break',    '{"type": "glass_break"}'::jsonb, 74),
  (NULL, 'eps_keypad',      'Klávesnice alarmu',         'eps',     'control',   'keypad',         '{"type": "keypad"}'::jsonb, 75),
  (NULL, 'eps_siren',       'Siréna',                    'eps',     'alert',     'siren',          '{"type": "siren", "location": "outdoor"}'::jsonb, 76),
  (NULL, 'eps_control_panel', 'Centrála alarmu',         'eps',     'control',   'control_panel',  '{"type": "central_unit"}'::jsonb, 77)

ON CONFLICT (org_id, slug) DO NOTHING;
