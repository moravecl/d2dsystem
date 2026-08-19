/*
  # Bathroom Symbols Schema

  ## Overview
  Creates a library of bathroom fixture symbols (WC, sinks, bathtubs, showers, etc.)
  that can be placed in a bathroom mini-designer, and extends the Room data structure
  to store bathroom layouts.

  ## New Tables

  ### bathroom_symbols
  - `id` (uuid, PK) - Unique identifier
  - `name` (text) - Display name of the symbol (e.g. "Sprchový kout 90x90")
  - `category` (text) - Category for grouping: 'wc', 'umyvadlo', 'vana', 'sprcha', 'bidet', 'ostatni'
  - `width_mm` (integer) - Real-world width in millimeters
  - `height_mm` (integer) - Real-world depth/height in millimeters
  - `svg_content` (text) - Inline SVG path/shape data (viewBox matches width_mm x height_mm)
  - `description` (text, nullable) - Optional notes
  - `org_id` (uuid, nullable) - Organization-specific symbols; null = global/shared
  - `sort_order` (integer) - Display order within category
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on bathroom_symbols
  - All authenticated users can read global symbols (org_id IS NULL)
  - Org members can read their org-specific symbols
  - Only org admins can manage org-specific symbols

  ## Notes
  - Room layouts are stored as JSON inside projects.floorplan_url (via Room.bathroomLayout)
  - SVG content uses mm coordinates matching width_mm x height_mm viewBox
*/

CREATE TABLE IF NOT EXISTS bathroom_symbols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'ostatni',
  width_mm integer NOT NULL DEFAULT 600,
  height_mm integer NOT NULL DEFAULT 600,
  svg_content text NOT NULL DEFAULT '',
  description text,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bathroom_symbols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read global bathroom symbols"
  ON bathroom_symbols FOR SELECT
  TO authenticated
  USING (org_id IS NULL);

CREATE POLICY "Org members can read org bathroom symbols"
  ON bathroom_symbols FOR SELECT
  TO authenticated
  USING (
    org_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bathroom_symbols.org_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can insert bathroom symbols"
  ON bathroom_symbols FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IS NULL OR
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bathroom_symbols.org_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can update bathroom symbols"
  ON bathroom_symbols FOR UPDATE
  TO authenticated
  USING (
    org_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bathroom_symbols.org_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    org_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bathroom_symbols.org_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can delete bathroom symbols"
  ON bathroom_symbols FOR DELETE
  TO authenticated
  USING (
    org_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bathroom_symbols.org_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_bathroom_symbols_category ON bathroom_symbols(category);
CREATE INDEX IF NOT EXISTS idx_bathroom_symbols_org_id ON bathroom_symbols(org_id);

INSERT INTO bathroom_symbols (name, category, width_mm, height_mm, sort_order, svg_content) VALUES

('WC závěsné', 'wc', 360, 540,  10,
'<rect x="10" y="10" width="340" height="520" rx="30" fill="#f0f4f8" stroke="#64748b" stroke-width="12"/>
<ellipse cx="180" cy="280" rx="140" ry="180" fill="#e2e8f0" stroke="#64748b" stroke-width="10"/>
<ellipse cx="180" cy="190" rx="90" ry="40" fill="#cbd5e1" stroke="#64748b" stroke-width="8"/>
<rect x="90" y="10" width="180" height="60" rx="10" fill="#cbd5e1" stroke="#64748b" stroke-width="8"/>'),

('WC stojící', 'wc', 380, 680, 20,
'<rect x="10" y="10" width="360" height="660" rx="30" fill="#f0f4f8" stroke="#64748b" stroke-width="12"/>
<ellipse cx="190" cy="380" rx="155" ry="220" fill="#e2e8f0" stroke="#64748b" stroke-width="10"/>
<ellipse cx="190" cy="230" rx="100" ry="45" fill="#cbd5e1" stroke="#64748b" stroke-width="8"/>
<rect x="60" y="10" width="260" height="80" rx="12" fill="#cbd5e1" stroke="#64748b" stroke-width="8"/>'),

('Umyvadlo 60cm', 'umyvadlo', 600, 480, 10,
'<rect x="10" y="10" width="580" height="460" rx="20" fill="#f0f4f8" stroke="#64748b" stroke-width="12"/>
<ellipse cx="300" cy="260" rx="240" ry="180" fill="#e2e8f0" stroke="#64748b" stroke-width="10"/>
<circle cx="300" cy="290" r="25" fill="#cbd5e1" stroke="#64748b" stroke-width="8"/>
<rect x="240" y="50" width="120" height="30" rx="8" fill="#cbd5e1" stroke="#64748b" stroke-width="6"/>'),

('Umyvadlo 50cm', 'umyvadlo', 500, 420, 20,
'<rect x="10" y="10" width="480" height="400" rx="20" fill="#f0f4f8" stroke="#64748b" stroke-width="12"/>
<ellipse cx="250" cy="230" rx="200" ry="155" fill="#e2e8f0" stroke="#64748b" stroke-width="10"/>
<circle cx="250" cy="255" r="22" fill="#cbd5e1" stroke="#64748b" stroke-width="8"/>
<rect x="195" y="45" width="110" height="28" rx="8" fill="#cbd5e1" stroke="#64748b" stroke-width="6"/>'),

('Dvojumyvadlo 120cm', 'umyvadlo', 1200, 480, 30,
'<rect x="10" y="10" width="1180" height="460" rx="20" fill="#f0f4f8" stroke="#64748b" stroke-width="12"/>
<ellipse cx="340" cy="260" rx="270" ry="170" fill="#e2e8f0" stroke="#64748b" stroke-width="10"/>
<circle cx="340" cy="285" r="22" fill="#cbd5e1" stroke="#64748b" stroke-width="8"/>
<ellipse cx="870" cy="260" rx="270" ry="170" fill="#e2e8f0" stroke="#64748b" stroke-width="10"/>
<circle cx="870" cy="285" r="22" fill="#cbd5e1" stroke="#64748b" stroke-width="8"/>
<rect x="50" y="45" width="1100" height="30" rx="8" fill="#cbd5e1" stroke="#64748b" stroke-width="6"/>'),

('Vana 170cm', 'vana', 1700, 750, 10,
'<rect x="10" y="10" width="1680" height="730" rx="40" fill="#f0f4f8" stroke="#64748b" stroke-width="14"/>
<rect x="50" y="50" width="1600" height="650" rx="30" fill="#e2e8f0" stroke="#64748b" stroke-width="10"/>
<ellipse cx="850" cy="375" rx="700" ry="260" fill="#dde6ef" stroke="#94a3b8" stroke-width="6"/>
<circle cx="1560" cy="375" r="35" fill="#cbd5e1" stroke="#64748b" stroke-width="8"/>
<line x1="1540" y1="375" x2="1580" y2="375" stroke="#64748b" stroke-width="8"/>
<line x1="1560" y1="355" x2="1560" y2="395" stroke="#64748b" stroke-width="8"/>'),

('Vana 160cm', 'vana', 1600, 700, 20,
'<rect x="10" y="10" width="1580" height="680" rx="40" fill="#f0f4f8" stroke="#64748b" stroke-width="14"/>
<rect x="50" y="50" width="1500" height="600" rx="30" fill="#e2e8f0" stroke="#64748b" stroke-width="10"/>
<ellipse cx="800" cy="350" rx="650" ry="240" fill="#dde6ef" stroke="#94a3b8" stroke-width="6"/>
<circle cx="1460" cy="350" r="32" fill="#cbd5e1" stroke="#64748b" stroke-width="8"/>
<line x1="1442" y1="350" x2="1478" y2="350" stroke="#64748b" stroke-width="8"/>
<line x1="1460" y1="332" x2="1460" y2="368" stroke="#64748b" stroke-width="8"/>'),

('Sprchový kout 90x90', 'sprcha', 900, 900, 10,
'<rect x="10" y="10" width="880" height="880" rx="20" fill="#f0f4f8" stroke="#64748b" stroke-width="14"/>
<rect x="50" y="50" width="800" height="800" rx="15" fill="#e2e8f0" stroke="#64748b" stroke-width="8"/>
<circle cx="450" cy="450" r="80" fill="#cbd5e1" stroke="#64748b" stroke-width="10"/>
<line x1="450" y1="370" x2="450" y2="530" stroke="#64748b" stroke-width="8"/>
<line x1="370" y1="450" x2="530" y2="450" stroke="#64748b" stroke-width="8"/>
<circle cx="120" cy="450" r="28" fill="#cbd5e1" stroke="#64748b" stroke-width="8"/>
<line x1="120" y1="240" x2="120" y2="660" stroke="#64748b" stroke-width="6" stroke-dasharray="20,12"/>
<line x1="10" y1="240" x2="120" y2="240" stroke="#64748b" stroke-width="14"/>
<line x1="10" y1="660" x2="120" y2="660" stroke="#64748b" stroke-width="14"/>'),

('Sprchový kout 80x80', 'sprcha', 800, 800, 20,
'<rect x="10" y="10" width="780" height="780" rx="20" fill="#f0f4f8" stroke="#64748b" stroke-width="14"/>
<rect x="50" y="50" width="700" height="700" rx="15" fill="#e2e8f0" stroke="#64748b" stroke-width="8"/>
<circle cx="400" cy="400" r="70" fill="#cbd5e1" stroke="#64748b" stroke-width="10"/>
<line x1="400" y1="330" x2="400" y2="470" stroke="#64748b" stroke-width="8"/>
<line x1="330" y1="400" x2="470" y2="400" stroke="#64748b" stroke-width="8"/>
<circle cx="110" cy="400" r="25" fill="#cbd5e1" stroke="#64748b" stroke-width="8"/>
<line x1="110" y1="210" x2="110" y2="590" stroke="#64748b" stroke-width="6" stroke-dasharray="18,10"/>
<line x1="10" y1="210" x2="110" y2="210" stroke="#64748b" stroke-width="14"/>
<line x1="10" y1="590" x2="110" y2="590" stroke="#64748b" stroke-width="14"/>'),

('Sprchový kout 120x80', 'sprcha', 1200, 800, 30,
'<rect x="10" y="10" width="1180" height="780" rx="20" fill="#f0f4f8" stroke="#64748b" stroke-width="14"/>
<rect x="50" y="50" width="1100" height="700" rx="15" fill="#e2e8f0" stroke="#64748b" stroke-width="8"/>
<circle cx="600" cy="400" r="70" fill="#cbd5e1" stroke="#64748b" stroke-width="10"/>
<line x1="600" y1="330" x2="600" y2="470" stroke="#64748b" stroke-width="8"/>
<line x1="530" y1="400" x2="670" y2="400" stroke="#64748b" stroke-width="8"/>
<circle cx="110" cy="400" r="25" fill="#cbd5e1" stroke="#64748b" stroke-width="8"/>
<line x1="110" y1="210" x2="110" y2="590" stroke="#64748b" stroke-width="6" stroke-dasharray="18,10"/>
<line x1="10" y1="210" x2="110" y2="210" stroke="#64748b" stroke-width="14"/>
<line x1="10" y1="590" x2="110" y2="590" stroke="#64748b" stroke-width="14"/>'),

('Bidet', 'bidet', 380, 560, 10,
'<rect x="10" y="10" width="360" height="540" rx="30" fill="#f0f4f8" stroke="#64748b" stroke-width="12"/>
<ellipse cx="190" cy="320" rx="150" ry="190" fill="#e2e8f0" stroke="#64748b" stroke-width="10"/>
<ellipse cx="190" cy="200" rx="95" ry="42" fill="#cbd5e1" stroke="#64748b" stroke-width="8"/>
<rect x="100" y="10" width="180" height="55" rx="10" fill="#cbd5e1" stroke="#64748b" stroke-width="8"/>
<circle cx="190" cy="345" r="20" fill="#94a3b8" stroke="#64748b" stroke-width="6"/>'),

('Prádelní koš', 'ostatni', 500, 400, 10,
'<rect x="10" y="10" width="480" height="380" rx="20" fill="#f0f4f8" stroke="#64748b" stroke-width="12"/>
<rect x="40" y="40" width="420" height="320" rx="15" fill="#e2e8f0" stroke="#64748b" stroke-width="8"/>
<line x1="40" y1="120" x2="460" y2="120" stroke="#94a3b8" stroke-width="6" stroke-dasharray="15,10"/>
<circle cx="250" cy="80" r="18" fill="#cbd5e1" stroke="#64748b" stroke-width="6"/>'),

('Pračka', 'ostatni', 600, 600, 20,
'<rect x="10" y="10" width="580" height="580" rx="20" fill="#f0f4f8" stroke="#64748b" stroke-width="12"/>
<rect x="40" y="40" width="520" height="520" rx="15" fill="#e2e8f0" stroke="#64748b" stroke-width="8"/>
<circle cx="300" cy="320" r="180" fill="#dde6ef" stroke="#64748b" stroke-width="10"/>
<circle cx="300" cy="320" r="120" fill="#e2e8f0" stroke="#94a3b8" stroke-width="6"/>
<circle cx="300" cy="320" r="30" fill="#cbd5e1" stroke="#64748b" stroke-width="6"/>
<rect x="120" y="60" width="100" height="30" rx="8" fill="#cbd5e1" stroke="#64748b" stroke-width="6"/>'),

('Sušička', 'ostatni', 600, 600, 30,
'<rect x="10" y="10" width="580" height="580" rx="20" fill="#f0f4f8" stroke="#64748b" stroke-width="12"/>
<rect x="40" y="40" width="520" height="520" rx="15" fill="#e2e8f0" stroke="#64748b" stroke-width="8"/>
<circle cx="300" cy="320" r="180" fill="#dde6ef" stroke="#64748b" stroke-width="10"/>
<circle cx="300" cy="320" r="130" fill="#e2e8f0" stroke="#94a3b8" stroke-width="6"/>
<circle cx="300" cy="320" r="25" fill="#cbd5e1" stroke="#64748b" stroke-width="6"/>
<rect x="380" y="60" width="100" height="30" rx="8" fill="#cbd5e1" stroke="#64748b" stroke-width="6"/>
<rect x="240" y="70" width="60" height="16" rx="4" fill="#94a3b8"/>');
