/*
  Vzorova sablona "Smlouva o dilo" pro projektove dokumenty (typ 'smlouva').

  UPOZORNENI: jde o obecny vzor podle par. 2586+ obcanskeho zakoniku,
  urceny k upravam - pred ostrym pouzitim nechte zkontrolovat pravnikem.
  Mista k doplneni jsou oznacena [DOPLNTE: ...]. Text lze kdykoli upravit
  v Administraci -> Sablony dokumentu.

  Vlozi sablonu organizaci uzivatele admin@housesmart.cz. Opakovane
  spusteni druhou kopii nezaklada.
*/
INSERT INTO document_templates (name, description, template_type, content, version, is_active, organization_id)
SELECT
  'Smlouva o dílo',
  'Vzorová smlouva o dílo s placeholdery projektu, klienta a nabídky. Před použitím doplňte označená místa.',
  'smlouva',
  '<div style="font-family: Georgia, ''Times New Roman'', serif; line-height: 1.55; color: #1a1a1a;">
<h1 style="text-align: center; font-size: 22px; margin-bottom: 4px;">SMLOUVA O DÍLO</h1>
<p style="text-align: center; font-size: 12px; color: #555; margin-bottom: 24px;">uzavřená podle § 2586 a násl. zákona č. 89/2012 Sb., občanský zákoník</p>

<h2 style="font-size: 14px; margin: 18px 0 8px;">Smluvní strany</h2>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
  <tr>
    <td style="width: 50%; vertical-align: top; padding-right: 16px;">
      <p style="margin: 0 0 2px;"><strong>Zhotovitel:</strong></p>
      <p style="margin: 0;">{{company.name}}</p>
      <p style="margin: 0;">{{company.address}}, {{company.zip}} {{company.city}}</p>
      <p style="margin: 0;">IČO: {{company.ico}}, DIČ: {{company.dic}}</p>
      <p style="margin: 0;">tel.: {{company.phone}}, e-mail: {{company.email}}</p>
    </td>
    <td style="width: 50%; vertical-align: top;">
      <p style="margin: 0 0 2px;"><strong>Objednatel:</strong></p>
      <p style="margin: 0;">{{client.name}}</p>
      <p style="margin: 0;">{{client.address}}</p>
      <p style="margin: 0;">IČO: {{client.ico}}, DIČ: {{client.dic}}</p>
      <p style="margin: 0;">tel.: {{client.phone}}, e-mail: {{client.email}}</p>
    </td>
  </tr>
</table>

<h2 style="font-size: 14px; margin: 18px 0 8px;">I. Předmět díla</h2>
<p style="margin: 0 0 6px;">1. Zhotovitel se zavazuje na svůj náklad a nebezpečí provést pro objednatele dílo: <strong>{{project.name}}</strong>.</p>
<p style="margin: 0 0 6px;">2. Popis díla: {{project.description}}</p>
<p style="margin: 0 0 6px;">3. Místo plnění: {{project.address}}.</p>
<p style="margin: 0 0 6px;">4. Rozsah díla je vymezen cenovou nabídkou č. <strong>{{quote.name}}</strong> ({{quote.version}}), která tvoří přílohu č. 1 této smlouvy.</p>

<h2 style="font-size: 14px; margin: 18px 0 8px;">II. Cena díla</h2>
<p style="margin: 0 0 6px;">1. Cena díla je sjednána dle nabídky dle čl. I. odst. 4 ve výši <strong>{{quote.total}}</strong> bez DPH. K ceně bude připočtena DPH v zákonné sazbě platné ke dni uskutečnění zdanitelného plnění.</p>
<p style="margin: 0 0 6px;">2. Cena zahrnuje veškeré práce, dodávky a materiál uvedené v nabídce. Práce a dodávky nad rámec nabídky (vícepráce) budou provedeny pouze po předchozím písemném odsouhlasení objednatelem dle čl. VI.</p>

<h2 style="font-size: 14px; margin: 18px 0 8px;">III. Termín provedení</h2>
<p style="margin: 0 0 6px;">1. Zhotovitel provede dílo v termínu do <strong>{{project.deadline}}</strong>.</p>
<p style="margin: 0 0 6px;">2. Termín se prodlužuje o dobu, po kterou nemohl zhotovitel dílo provádět z důvodů na straně objednatele, z důvodu vyšší moci nebo nevhodných klimatických podmínek.</p>

<h2 style="font-size: 14px; margin: 18px 0 8px;">IV. Platební podmínky</h2>
<p style="margin: 0 0 6px;">1. Cena díla bude hrazena na základě faktur – daňových dokladů vystavených zhotovitelem, a to formou dílčích faktur dle skutečně provedených prací a dodaného materiálu, případně zálohových faktur dle dohody stran.</p>
<p style="margin: 0 0 6px;">2. Splatnost faktur činí <strong>14 dní</strong> ode dne doručení objednateli.</p>
<p style="margin: 0 0 6px;">3. Konečná faktura bude vystavena po předání a převzetí díla.</p>

<h2 style="font-size: 14px; margin: 18px 0 8px;">V. Provádění díla</h2>
<p style="margin: 0 0 6px;">1. Objednatel předá zhotoviteli místo plnění způsobilé k provádění díla a zajistí přístup, přívod elektrické energie a možnost sociálního zázemí.</p>
<p style="margin: 0 0 6px;">2. O průběhu provádění díla vede zhotovitel zápisy (stavební deník), do kterých je objednatel oprávněn nahlížet.</p>
<p style="margin: 0 0 6px;">3. Zhotovitel odpovídá za dodržování předpisů BOZP a PO svými pracovníky v místě plnění.</p>

<h2 style="font-size: 14px; margin: 18px 0 8px;">VI. Vícepráce a méněpráce</h2>
<p style="margin: 0 0 6px;">1. Požadavky na změny rozsahu díla se sjednávají písemně (včetně elektronického odsouhlasení v klientském portálu zhotovitele) před jejich provedením, včetně dopadu na cenu a termín.</p>

<h2 style="font-size: 14px; margin: 18px 0 8px;">VII. Předání díla</h2>
<p style="margin: 0 0 6px;">1. O předání a převzetí díla sepíší strany předávací protokol. Drobné vady a nedodělky nebránící užívání díla nejsou důvodem k odmítnutí převzetí; uvedou se v protokolu spolu s termínem odstranění.</p>
<p style="margin: 0 0 6px;">2. Součástí předání je předání dokumentace (revizní zprávy, návody) a zaškolení obsluhy.</p>

<h2 style="font-size: 14px; margin: 18px 0 8px;">VIII. Záruka</h2>
<p style="margin: 0 0 6px;">1. Zhotovitel poskytuje na dílo záruku v délce <strong>24 měsíců</strong> od předání díla. Záruka se nevztahuje na vady způsobené neodborným zásahem, běžným opotřebením nebo užíváním v rozporu s návodem.</p>
<p style="margin: 0 0 6px;">2. Na dodaná zařízení platí záruční podmínky jejich výrobců, jsou-li delší.</p>

<h2 style="font-size: 14px; margin: 18px 0 8px;">IX. Sankce</h2>
<p style="margin: 0 0 6px;">1. Při prodlení zhotovitele s provedením díla je objednatel oprávněn požadovat smluvní pokutu ve výši [DOPLŇTE: např. 0,05] % z ceny díla za každý započatý den prodlení.</p>
<p style="margin: 0 0 6px;">2. Při prodlení objednatele s úhradou faktury je zhotovitel oprávněn požadovat smluvní pokutu ve výši [DOPLŇTE: např. 0,05] % z dlužné částky za každý započatý den prodlení.</p>

<h2 style="font-size: 14px; margin: 18px 0 8px;">X. Závěrečná ustanovení</h2>
<p style="margin: 0 0 6px;">1. Smlouva nabývá platnosti a účinnosti dnem podpisu oběma stranami. Měnit ji lze pouze písemnými dodatky.</p>
<p style="margin: 0 0 6px;">2. Práva a povinnosti touto smlouvou výslovně neupravené se řídí občanským zákoníkem.</p>
<p style="margin: 0 0 6px;">3. Smlouva je vyhotovena ve dvou stejnopisech, z nichž každá strana obdrží po jednom.</p>

<table style="width: 100%; border-collapse: collapse; margin-top: 40px;">
  <tr>
    <td style="width: 50%; text-align: center; padding-top: 40px;">
      <p style="border-top: 1px solid #333; display: inline-block; padding: 6px 40px 0; margin: 0;">za zhotovitele<br>{{company.name}}</p>
    </td>
    <td style="width: 50%; text-align: center; padding-top: 40px;">
      <p style="border-top: 1px solid #333; display: inline-block; padding: 6px 40px 0; margin: 0;">za objednatele<br>{{client.name}}</p>
    </td>
  </tr>
</table>
<p style="margin-top: 24px; font-size: 12px;">V {{company.city}} dne {{today}}</p>
</div>',
  1,
  true,
  om.organization_id
FROM organization_members om
JOIN auth.users u ON u.id = om.user_id
WHERE u.email = 'admin@housesmart.cz'
  AND NOT EXISTS (
    SELECT 1 FROM document_templates dt
    WHERE dt.template_type = 'smlouva' AND dt.name = 'Smlouva o dílo'
  )
LIMIT 1;

-- Kontrola: select name, template_type, is_active from document_templates where template_type = 'smlouva';
