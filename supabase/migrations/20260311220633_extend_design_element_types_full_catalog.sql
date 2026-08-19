/*
  # Extended Design Element Types - Complete Schematic Symbol Catalog

  ## Summary
  This migration extends the design_element_types table with a comprehensive catalog
  of schematic symbols following Czech and European standards (CSN EN 60617 for electrical,
  CSN 01 3450 for plumbing/gas).

  ## New Element Types Added

  ### ELEKTRO - Sockets Extended
  - outlet_antenna (TV/SAT socket)
  - outlet_phone (telephone socket)
  - outlet_motor (motor outlet for blinds/gates)
  - outlet_appliance (appliance outlet - washing machine, dishwasher)
  - outlet_floor (floor outlet)
  - outlet_furniture (furniture integrated outlet)

  ### ELEKTRO - Switches Extended
  - switch_staircase (staircase/timer switch)
  - switch_cross (cross switch / 4-way)
  - switch_motion (motion activated switch)
  - switch_touch (touch panel switch)
  - switch_key (key switch)
  - switch_pull (pull cord switch)
  - doorbell_button (doorbell push button)

  ### ELEKTRO - Lighting Extended
  - light_emergency (emergency lighting)
  - light_dimmable (dimmable light point)
  - light_track (track lighting)
  - light_recessed (recessed light)
  - light_pendant (pendant light)
  - light_under_cabinet (under cabinet lighting)

  ### HVAC - Heating
  - radiator (wall radiator)
  - radiator_towel (towel radiator)
  - underfloor_heating_zone (floor heating zone)
  - thermostatic_head (thermostatic valve head)
  - boiler_gas (gas boiler)
  - boiler_electric (electric boiler)
  - heat_pump (heat pump unit)
  - heating_manifold (heating manifold/distributor)
  - expansion_vessel (expansion vessel)

  ### HVAC - Ventilation/Recuperation Extended
  - recuperation_unit (heat recovery unit)
  - supply_diffuser (supply air diffuser)
  - exhaust_diffuser (exhaust air diffuser)
  - bypass_damper (bypass damper)
  - silencer (acoustic silencer)
  - air_handling_unit (AHU)
  - exhaust_fan (exhaust fan)
  - supply_fan (supply fan)

  ### WATER - Plumbing
  - water_cold_outlet (cold water outlet)
  - water_hot_outlet (hot water outlet)
  - drain_floor (floor drain)
  - drain_sink (sink drain)
  - cleanout (cleanout/access door)
  - water_main_shutoff (main water shutoff valve)
  - water_meter (water meter)
  - water_heater (water heater/boiler)
  - circulation_pump (hot water circulation pump)
  - pressure_reducer (pressure reducing valve)
  - check_valve (check valve)
  - mixing_valve (thermostatic mixing valve)

  ### GAS
  - gas_boiler (gas boiler connection)
  - gas_stove (gas stove connection)
  - gas_meter (gas meter)
  - gas_shutoff (gas shutoff valve)
  - gas_detector (gas leak detector)

  ### SLABOPROUD - Low Voltage
  - speaker_ceiling (ceiling speaker)
  - speaker_wall (wall speaker)
  - intercom_indoor (indoor intercom unit)
  - intercom_outdoor (outdoor intercom panel)
  - access_terminal (access control terminal)
  - card_reader (card/fob reader)
  - fingerprint_reader (biometric reader)
  - doorbell (doorbell/chime)
  - emergency_button (emergency/panic button)

  ### SMART HOME
  - smart_hub (smart home hub/controller)
  - scene_controller (scene controller panel)
  - occupancy_sensor (occupancy/presence sensor)
  - light_sensor (ambient light sensor)
  - humidity_sensor (humidity sensor)
  - air_quality_sensor (air quality/CO2 sensor)

  ## Icons Mapping
  All icons map to existing iconLibrary.tsx entries or use generic fallbacks.
*/

INSERT INTO design_element_types (org_id, slug, name, category, subcategory, icon, default_params, sort_order)
VALUES
  -- ELEKTRO — Sockets Extended
  (NULL, 'outlet_antenna',    'Antenní zásuvka TV/SAT',    'elektro', 'sockets',   'tv',             '{"type": "antenna"}'::jsonb, 15),
  (NULL, 'outlet_phone',      'Telefonní zásuvka',         'elektro', 'sockets',   'radio',          '{"type": "phone"}'::jsonb, 16),
  (NULL, 'outlet_motor',      'Motorový vývod',            'elektro', 'sockets',   'zap',            '{"type": "motor", "use": "blinds/gates"}'::jsonb, 17),
  (NULL, 'outlet_appliance',  'Vývod pro spotřebič',       'elektro', 'sockets',   'power',          '{"type": "appliance"}'::jsonb, 18),
  (NULL, 'outlet_floor',      'Podlahová zásuvka',         'elektro', 'sockets',   'plug',           '{"type": "floor"}'::jsonb, 19),
  (NULL, 'outlet_furniture',  'Zásuvka do nábytku',        'elektro', 'sockets',   'plug',           '{"type": "furniture"}'::jsonb, 20),

  -- ELEKTRO — Switches Extended
  (NULL, 'switch_staircase',  'Schodišťový vypínač',       'elektro', 'switches',  'timer',          '{"type": "staircase", "timed": true}'::jsonb, 25),
  (NULL, 'switch_cross',      'Křížový přepínač',          'elektro', 'switches',  'toggle',         '{"type": "cross", "ways": 4}'::jsonb, 26),
  (NULL, 'switch_motion',     'Pohybový spínač',           'elektro', 'switches',  'eye',            '{"type": "motion"}'::jsonb, 27),
  (NULL, 'switch_touch',      'Dotykový panel',            'elektro', 'switches',  'monitor',        '{"type": "touch"}'::jsonb, 28),
  (NULL, 'switch_key',        'Klíčový spínač',            'elektro', 'switches',  'lock',           '{"type": "key"}'::jsonb, 29),
  (NULL, 'switch_pull',       'Tahový spínač',             'elektro', 'switches',  'toggle',         '{"type": "pull_cord"}'::jsonb, 30),
  (NULL, 'doorbell_button',   'Zvonkové tlačítko',         'elektro', 'switches',  'bell',           '{"type": "doorbell"}'::jsonb, 31),

  -- ELEKTRO — Lighting Extended
  (NULL, 'light_emergency',   'Nouzové osvětlení',         'elektro', 'lighting',  'zap',            '{"type": "emergency", "battery": true}'::jsonb, 35),
  (NULL, 'light_dimmable',    'Stmívatelné světlo',        'elektro', 'lighting',  'sun',            '{"type": "dimmable"}'::jsonb, 36),
  (NULL, 'light_track',       'Kolejnicové osvětlení',     'elektro', 'lighting',  'lamp-ceiling',   '{"type": "track"}'::jsonb, 37),
  (NULL, 'light_recessed',    'Zápustné svítidlo',         'elektro', 'lighting',  'sun',            '{"type": "recessed"}'::jsonb, 38),
  (NULL, 'light_pendant',     'Závěsné svítidlo',          'elektro', 'lighting',  'lamp',           '{"type": "pendant"}'::jsonb, 39),
  (NULL, 'light_under_cabinet', 'Podlinkové osvětlení',    'elektro', 'lighting',  'light_strip',    '{"type": "under_cabinet"}'::jsonb, 40),

  -- HVAC — Heating
  (NULL, 'radiator',          'Radiátor',                  'hvac',    'heating',   'heater',         '{"type": "wall_radiator"}'::jsonb, 100),
  (NULL, 'radiator_towel',    'Žebříkový radiátor',        'hvac',    'heating',   'heater',         '{"type": "towel_radiator"}'::jsonb, 101),
  (NULL, 'underfloor_heating_zone', 'Zóna podlah. topení', 'hvac',    'heating',   'flame-heat',     '{"type": "underfloor_zone"}'::jsonb, 102),
  (NULL, 'thermostatic_head', 'Termostatická hlavice',     'hvac',    'heating',   'thermostat',     '{"type": "thermostatic_valve"}'::jsonb, 103),
  (NULL, 'boiler_gas',        'Plynový kotel',             'hvac',    'heating',   'flame-heat',     '{"type": "gas_boiler"}'::jsonb, 104),
  (NULL, 'boiler_electric',   'Elektrický kotel',          'hvac',    'heating',   'zap',            '{"type": "electric_boiler"}'::jsonb, 105),
  (NULL, 'heat_pump',         'Tepelné čerpadlo',          'hvac',    'heating',   'thermo-heat',    '{"type": "heat_pump"}'::jsonb, 106),
  (NULL, 'heating_manifold',  'Rozdělovač topení',         'hvac',    'heating',   'circuit',        '{"type": "manifold"}'::jsonb, 107),
  (NULL, 'expansion_vessel',  'Expanzní nádoba',           'hvac',    'heating',   'gauge',          '{"type": "expansion"}'::jsonb, 108),

  -- HVAC — Ventilation Extended
  (NULL, 'recuperation_unit', 'Rekuperační jednotka',      'hvac',    'ventilation', 'wind',         '{"type": "hrv_unit"}'::jsonb, 110),
  (NULL, 'supply_diffuser',   'Přívodní vyústka',          'hvac',    'ventilation', 'air-vent',     '{"type": "supply", "direction": "in"}'::jsonb, 111),
  (NULL, 'exhaust_diffuser',  'Odtahová vyústka',          'hvac',    'ventilation', 'air-vent',     '{"type": "exhaust", "direction": "out"}'::jsonb, 112),
  (NULL, 'bypass_damper',     'Obtokový ventil',           'hvac',    'ventilation', 'toggle',       '{"type": "bypass"}'::jsonb, 113),
  (NULL, 'silencer',          'Tlumič hluku',              'hvac',    'ventilation', 'speaker',      '{"type": "silencer"}'::jsonb, 114),
  (NULL, 'air_handling_unit', 'VZT jednotka',              'hvac',    'ventilation', 'wind',         '{"type": "ahu"}'::jsonb, 115),
  (NULL, 'exhaust_fan',       'Odtahový ventilátor',       'hvac',    'ventilation', 'fan',          '{"type": "exhaust_fan"}'::jsonb, 116),
  (NULL, 'supply_fan',        'Přívodní ventilátor',       'hvac',    'ventilation', 'fan',          '{"type": "supply_fan"}'::jsonb, 117),

  -- WATER — Plumbing
  (NULL, 'water_cold_outlet', 'Vývod studené vody',        'water',   'plumbing',  'droplets-water', '{"type": "cold_water"}'::jsonb, 130),
  (NULL, 'water_hot_outlet',  'Vývod teplé vody',          'water',   'plumbing',  'droplets-water', '{"type": "hot_water"}'::jsonb, 131),
  (NULL, 'drain_floor',       'Podlahová vpusť',           'water',   'drainage',  'droplets',       '{"type": "floor_drain"}'::jsonb, 132),
  (NULL, 'drain_sink',        'Odpad umyvadla/dřezu',      'water',   'drainage',  'droplets',       '{"type": "sink_drain"}'::jsonb, 133),
  (NULL, 'cleanout',          'Čistící dvířka',            'water',   'drainage',  'door-closed',    '{"type": "cleanout"}'::jsonb, 134),
  (NULL, 'water_main_shutoff', 'Hlavní uzávěr vody',       'water',   'valves',    'toggle',         '{"type": "main_shutoff"}'::jsonb, 135),
  (NULL, 'water_meter',       'Vodoměr',                   'water',   'metering',  'gauge',          '{"type": "water_meter"}'::jsonb, 136),
  (NULL, 'water_heater',      'Ohřívač vody / bojler',     'water',   'equipment', 'thermo-heat',    '{"type": "water_heater"}'::jsonb, 137),
  (NULL, 'circulation_pump',  'Cirkulační čerpadlo',       'water',   'equipment', 'fan',            '{"type": "circulation"}'::jsonb, 138),
  (NULL, 'pressure_reducer',  'Redukční ventil',           'water',   'valves',    'gauge',          '{"type": "pressure_reducer"}'::jsonb, 139),
  (NULL, 'check_valve',       'Zpětná klapka',             'water',   'valves',    'toggle',         '{"type": "check_valve"}'::jsonb, 140),
  (NULL, 'mixing_valve',      'Směšovací ventil',          'water',   'valves',    'thermostat',     '{"type": "mixing_valve"}'::jsonb, 141),

  -- GAS
  (NULL, 'gas_boiler',        'Připojení plynového kotle', 'gas',     'equipment', 'flame',          '{"type": "gas_boiler"}'::jsonb, 150),
  (NULL, 'gas_stove',         'Připojení plynového sporáku', 'gas',   'equipment', 'flame',          '{"type": "gas_stove"}'::jsonb, 151),
  (NULL, 'gas_meter',         'Plynoměr',                  'gas',     'metering',  'gauge',          '{"type": "gas_meter"}'::jsonb, 152),
  (NULL, 'gas_shutoff',       'Uzávěr plynu',              'gas',     'valves',    'toggle',         '{"type": "gas_shutoff"}'::jsonb, 153),
  (NULL, 'gas_detector',      'Detektor úniku plynu',      'gas',     'safety',    'alarm-smoke',    '{"type": "gas_detector"}'::jsonb, 154),

  -- SLABOPROUD — Low Voltage Audio/Intercom
  (NULL, 'speaker_ceiling',   'Stropní reproduktor',       'slaboproud', 'audio',    'speaker',      '{"type": "ceiling_speaker"}'::jsonb, 160),
  (NULL, 'speaker_wall',      'Nástěnný reproduktor',      'slaboproud', 'audio',    'speaker',      '{"type": "wall_speaker"}'::jsonb, 161),
  (NULL, 'intercom_indoor',   'Domácí telefon - vnitřní',  'slaboproud', 'intercom', 'monitor',      '{"type": "indoor_station"}'::jsonb, 162),
  (NULL, 'intercom_outdoor',  'Domácí telefon - venkovní', 'slaboproud', 'intercom', 'monitor',      '{"type": "outdoor_panel"}'::jsonb, 163),
  (NULL, 'doorbell',          'Zvonek / gong',             'slaboproud', 'intercom', 'bell',         '{"type": "chime"}'::jsonb, 164),

  -- SLABOPROUD — Access Control
  (NULL, 'access_terminal',   'Přístupový terminál',       'slaboproud', 'access',   'lock',         '{"type": "access_terminal"}'::jsonb, 170),
  (NULL, 'card_reader',       'Čtečka karet / čipů',       'slaboproud', 'access',   'lock',         '{"type": "card_reader"}'::jsonb, 171),
  (NULL, 'fingerprint_reader', 'Biometrická čtečka',       'slaboproud', 'access',   'lock',         '{"type": "fingerprint"}'::jsonb, 172),
  (NULL, 'emergency_button',  'Nouzové / panik tlačítko',  'slaboproud', 'safety',   'shield-alert', '{"type": "panic_button"}'::jsonb, 173),

  -- SMART HOME
  (NULL, 'smart_hub',         'Smart home centrála',       'smart',   'control',   'server',         '{"type": "hub"}'::jsonb, 180),
  (NULL, 'scene_controller',  'Ovladač scén',              'smart',   'control',   'monitor',        '{"type": "scene_panel"}'::jsonb, 181),
  (NULL, 'occupancy_sensor',  'Senzor přítomnosti',        'smart',   'sensors',   'eye',            '{"type": "occupancy"}'::jsonb, 182),
  (NULL, 'light_sensor',      'Senzor osvětlení',          'smart',   'sensors',   'sun',            '{"type": "light_sensor"}'::jsonb, 183),
  (NULL, 'humidity_sensor',   'Senzor vlhkosti',           'smart',   'sensors',   'droplets',       '{"type": "humidity"}'::jsonb, 184),
  (NULL, 'air_quality_sensor', 'Senzor kvality vzduchu',   'smart',   'sensors',   'wind',           '{"type": "air_quality", "measures": ["CO2", "VOC"]}'::jsonb, 185)

ON CONFLICT (org_id, slug) DO NOTHING;
