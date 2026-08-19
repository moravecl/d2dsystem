/*
  # Add Contract Template Type

  Extends the template_type check constraint to include 'contract' type
  for employment contracts and other contract documents.
*/

ALTER TABLE document_templates DROP CONSTRAINT IF EXISTS valid_template_type;

ALTER TABLE document_templates ADD CONSTRAINT valid_template_type 
  CHECK (template_type IN ('obecny', 'predavaci_protokol', 'servisni_protokol', 'zapis_stavba', 'contract'));

INSERT INTO document_templates (name, description, template_type, content, is_active, organization_id)
SELECT 
  'Pracovni smlouva',
  'Vzorova pracovni smlouva pro zamestnance',
  'contract',
  '<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px;">

<h1 style="text-align: center; font-size: 24px; margin-bottom: 10px;">PRACOVNI SMLOUVA</h1>
<p style="text-align: center; color: #666; margin-bottom: 40px;">uzavrena podle zakona c. 262/2006 Sb., zakonik prace</p>

<h2 style="font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 8px;">Smluvni strany</h2>

<p style="margin: 20px 0;"><strong>Zamestnavatel:</strong><br>
{{company_name}}<br>
ICO: {{company_ico}}<br>
Sidlo: {{company_address}}</p>

<p style="margin: 20px 0;"><strong>Zamestnanec:</strong><br>
{{employee_name}}<br>
Datum narozeni: {{employee_birth_date}}<br>
Adresa: {{employee_address}}</p>

<h2 style="font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 8px; margin-top: 30px;">Predmet smlouvy</h2>

<p style="margin: 15px 0;">1. Zamestnavatel prijima zamestnance do pracovniho pomeru na pozici: <strong>{{job_position}}</strong></p>

<p style="margin: 15px 0;">2. Mistem vykonu prace je: {{work_location}}</p>

<p style="margin: 15px 0;">3. Dnem nastupu do prace je: {{start_date}}</p>

<p style="margin: 15px 0;">4. Pracovni pomer se uzavira na dobu: {{contract_duration}}</p>

<h2 style="font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 8px; margin-top: 30px;">Pracovni doba a odmena</h2>

<p style="margin: 15px 0;">5. Tydenni pracovni doba cini: {{weekly_hours}} hodin</p>

<p style="margin: 15px 0;">6. Mesicni hruba mzda cini: {{salary}} Kc</p>

<p style="margin: 15px 0;">7. Narok na dovolenou: {{vacation_days}} dnu za rok</p>

<h2 style="font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 8px; margin-top: 30px;">Zaverecna ustanoveni</h2>

<p style="margin: 15px 0;">8. Zkusebni doba cini 3 mesice.</p>

<p style="margin: 15px 0;">9. Tato smlouva je vyhotovena ve dvou stejnopisech, z nichz kazda smluvni strana obdrzi po jednom.</p>

<p style="margin-top: 50px;">V __________________ dne __________________</p>

<div style="display: flex; justify-content: space-between; margin-top: 80px;">
<div style="text-align: center; width: 45%;">
<div style="border-top: 1px solid #333; padding-top: 10px;">Zamestnavatel</div>
</div>
<div style="text-align: center; width: 45%;">
<div style="border-top: 1px solid #333; padding-top: 10px;">Zamestnanec</div>
</div>
</div>

</div>',
  true,
  om.organization_id
FROM organization_members om
WHERE om.role = 'owner'
AND NOT EXISTS (
  SELECT 1 FROM document_templates dt 
  WHERE dt.name = 'Pracovni smlouva' 
  AND dt.organization_id = om.organization_id
)
GROUP BY om.organization_id;