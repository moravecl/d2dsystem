/*
  # Seed initial data

  1. Categories - 5 initial categories matching the original HTML
  2. Products - 10 initial products from the static catalog
  3. Design modules - 10 insert types for design series
  4. Design presets - 7 common frame presets
*/

-- Categories
INSERT INTO categories (id, name, slug, icon, pill_color, soft_color, text_color, border_color, sort_order) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Loxone ovladani', 'loxone', 'cpu', 'bg-emerald-600', 'bg-emerald-50', 'text-emerald-900', 'border-emerald-200', 1),
  ('a1000000-0000-0000-0000-000000000002', 'Svitidla', 'svitidla', 'lightbulb', 'bg-yellow-500', 'bg-yellow-50', 'text-yellow-900', 'border-yellow-200', 2),
  ('a1000000-0000-0000-0000-000000000003', 'LED pasky', 'led_pasky', 'zap', 'bg-amber-600', 'bg-amber-50', 'text-amber-900', 'border-amber-200', 3),
  ('a1000000-0000-0000-0000-000000000004', 'Elektrokompletace', 'kompletace', 'plug-zap', 'bg-blue-600', 'bg-blue-50', 'text-blue-900', 'border-blue-200', 4),
  ('a1000000-0000-0000-0000-000000000005', 'Rekuperace - vyustky', 'rekuperace', 'wind', 'bg-cyan-600', 'bg-cyan-50', 'text-cyan-900', 'border-cyan-200', 5)
ON CONFLICT (id) DO NOTHING;

-- Products
INSERT INTO products (id, category_id, name, description, code, brand, power, kind, tag, price, image_url, exclusive_group, is_active, sort_order) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'Touch Pure (sklo)', 'Sklenene tlacitko s 5 dotykovymi plochami. Casto jako hlavni ovladac mistnosti.',
   'TP', 'Loxone', 'Tree/Air', 'normal', 'Standard', 0,
   'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&q=80&w=900',
   '', true, 1),

  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
   'Touch Tree', 'Plastova varianta Touch - casto do technickych mistnosti, skladu apod.',
   'TT', 'Loxone', 'Tree/Air', 'normal', 'Standard', 0,
   'https://images.unsplash.com/photo-1557438159-51eec7a6c9e8?auto=format&fit=crop&q=80&w=900',
   '', true, 2),

  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001',
   'Motion Sensor', 'Pohybove cidlo - chodby, WC, satny.',
   'MS', 'Loxone', 'Tree/Air', 'normal', 'Standard', 0,
   'https://images.unsplash.com/photo-1581094288338-2314dddb7ecb?auto=format&fit=crop&q=80&w=900',
   '', true, 3),

  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002',
   'LED Spot 24V (RGBW)', 'Bodovka - pocet se dopocita podle pinu.',
   'ML', 'Minalox', '24V', 'normal', 'Standard', 0,
   'https://images.unsplash.com/photo-1550985543-f47f38aee028?auto=format&fit=crop&q=80&w=900',
   '', true, 1),

  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002',
   'Linearni profil 24V (zapustny)', 'Linearni svetlo - pocet se dopocita podle pinu.',
   'KL', 'Kama Elektro', '24V', 'normal', 'Design', 0,
   'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?auto=format&fit=crop&q=80&w=900',
   '', true, 2),

  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000003',
   'LED pasek 24V (CRI95+, CCT)', 'LED pasky - i tady lze pinovat (napr. okruhy / useky).',
   'TL', 'T-LED', '24V', 'normal', 'Doporuceno', 0,
   'https://images.unsplash.com/photo-1520975958225-6c2c1a8d2f7e?auto=format&fit=crop&q=80&w=900',
   '', true, 1),

  ('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000004',
   'ABB - Designova rada', 'Umistujes ramecky (1-5) a vybiras vlozky. Pocty vlozek i ramecku se pocitaji automaticky.',
   'ABB', 'ABB', '230V', 'design_series', 'Rada', 0,
   'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=900',
   'design_line', true, 1),

  ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000004',
   'Legrand - Designova rada', 'Umistujes ramecky (1-5) a vybiras vlozky. Pocty se pocitaji automaticky.',
   'LG', 'Legrand', '230V', 'design_series', 'Rada', 0,
   'https://images.unsplash.com/photo-1580915411954-282cb1b0d780?auto=format&fit=crop&q=80&w=900',
   'design_line', true, 2),

  ('b1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000005',
   'Designova kruhova vyustka', 'Vyustky rekuperace - umistenim v pudorysu se spocita pocet.',
   'LU', 'Luftuj.cz', '', 'normal', 'Doporuceno', 0,
   'https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?auto=format&fit=crop&q=80&w=900',
   '', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Design modules
INSERT INTO design_modules (name, sort_order) VALUES
  ('Zasuvka', 1),
  ('Dvojzasuvka', 2),
  ('Vypinac c.1', 3),
  ('Vypinac c.5', 4),
  ('Vypinac c.6', 5),
  ('Vypinac c.7', 6),
  ('Vypinac 6+6', 7),
  ('Tlacitko', 8),
  ('2-tlacitko', 9),
  ('Zaluziove tlacitko', 10);

-- Design presets
INSERT INTO design_presets (name, frame_size, modules, sort_order) VALUES
  ('1x Zasuvka', 1, '["Zasuvka"]', 1),
  ('1x Dvojzasuvka', 1, '["Dvojzasuvka"]', 2),
  ('1x Vypinac c.6', 1, '["Vypinac c.6"]', 3),
  ('1x Zaluzie', 1, '["Zaluziove tlacitko"]', 4),
  ('2x Zasuvka', 2, '["Zasuvka","Zasuvka"]', 5),
  ('Zasuvka + c.6', 2, '["Zasuvka","Vypinac c.6"]', 6),
  ('c.6 + c.6', 2, '["Vypinac c.6","Vypinac c.6"]', 7);
