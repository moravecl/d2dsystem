/*
  # Seed default event types and knowledge categories

  Inserts default event types for all existing organizations:
    - Schuzka (Meeting)
    - Skoleni (Training)
    - Kontrolni den (Inspection day)
    - Predavka (Handover)
    - Interni porada (Internal meeting)
    - Jine (Other)

  Inserts default knowledge categories:
    - Navody (Guides)
    - Technicke listy (Technical sheets)
    - Bezpecnost (Safety)
    - Sablony (Templates)
    - Ostatni (Other)
*/

INSERT INTO event_types (organization_id, name, color, icon, sort_order)
SELECT o.id, t.name, t.color, t.icon, t.sort_order
FROM organizations o
CROSS JOIN (
  VALUES
    ('Schůzka',        'bg-blue-100 text-blue-700',    'users',       1),
    ('Školení',        'bg-emerald-100 text-emerald-700', 'graduation-cap', 2),
    ('Kontrolní den',  'bg-amber-100 text-amber-700',  'clipboard-check', 3),
    ('Předávka',       'bg-cyan-100 text-cyan-700',    'handshake',   4),
    ('Interní porada', 'bg-slate-100 text-slate-700',  'message-circle', 5),
    ('Jiné',           'bg-gray-100 text-gray-700',    'calendar',    6)
) AS t(name, color, icon, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM event_types et WHERE et.organization_id = o.id AND et.name = t.name
);

INSERT INTO knowledge_categories (organization_id, name, color, sort_order)
SELECT o.id, t.name, t.color, t.sort_order
FROM organizations o
CROSS JOIN (
  VALUES
    ('Návody',          'bg-blue-100 text-blue-700',    1),
    ('Technické listy', 'bg-emerald-100 text-emerald-700', 2),
    ('Bezpečnost',      'bg-red-100 text-red-700',      3),
    ('Šablony',         'bg-amber-100 text-amber-700',  4),
    ('Ostatní',         'bg-slate-100 text-slate-700',  5)
) AS t(name, color, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM knowledge_categories kc WHERE kc.organization_id = o.id AND kc.name = t.name
);
