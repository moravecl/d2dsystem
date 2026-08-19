import type { QuoteSection } from '../catalog/quoteHelpers';

interface ExportOptions {
  sections: QuoteSection[];
  trades: string[];
  projectName: string;
  clientName: string;
  quoteNumber: string;
}

const TRADE_LABELS: Record<string, string> = {
  electric: 'Elektro',
  water: 'Voda',
  heating: 'Topení',
  recuperation: 'Rekuperace',
  lighting: 'Svítidla',
};

function getSectionTrade(section: QuoteSection): string {
  if (section.trade && TRADE_LABELS[section.trade]) return TRADE_LABELS[section.trade];
  const nameLower = section.name.toLowerCase();
  if (nameLower.includes('elektr') || nameLower.includes('zásuvk') || nameLower.includes('vypínač')) return 'Elektro';
  if (nameLower.includes('vod') || nameLower.includes('sanit')) return 'Voda';
  if (nameLower.includes('topení') || nameLower.includes('radiátor') || nameLower.includes('podlah')) return 'Topení';
  if (nameLower.includes('rekup') || nameLower.includes('vzduchotech') || nameLower.includes('vzt')) return 'Rekuperace';
  if (nameLower.includes('svítidl') || nameLower.includes('osvětl') || nameLower.includes('light')) return 'Svítidla';
  if (nameLower.includes('audio') || nameLower.includes('chytr')) return 'Elektro';
  if (nameLower.includes('chlaz')) return 'Chlazení';
  return section.name;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildWorksheet(name: string, sections: QuoteSection[], projectName: string, clientName: string, quoteNumber: string, tradeName: string): string {
  const rows: string[] = [];

  const addRow = (cells: { value: string; type?: string; styleId?: string }[]) => {
    const cellsXml = cells.map(c => {
      const t = c.type || 'String';
      const s = c.styleId ? ` ss:StyleID="${c.styleId}"` : '';
      return `<Cell${s}><Data ss:Type="${t}">${escapeXml(c.value)}</Data></Cell>`;
    }).join('');
    rows.push(`<Row>${cellsXml}</Row>`);
  };

  addRow([{ value: 'Poptávka dodavatele', styleId: 's_title' }]);
  addRow([{ value: 'Projekt:', styleId: 's_label' }, { value: projectName }]);
  addRow([{ value: 'Klient:', styleId: 's_label' }, { value: clientName }]);
  addRow([{ value: 'Nabídka:', styleId: 's_label' }, { value: quoteNumber }]);
  addRow([{ value: 'Obor:', styleId: 's_label' }, { value: tradeName }]);
  addRow([{ value: 'Datum:', styleId: 's_label' }, { value: new Date().toLocaleDateString('cs-CZ') }]);
  addRow([]);

  addRow([
    { value: 'Sekce', styleId: 's_header' },
    { value: 'Název', styleId: 's_header' },
    { value: 'Kód', styleId: 's_header' },
    { value: 'Množství', styleId: 's_header' },
    { value: 'Jednotka', styleId: 's_header' },
    { value: 'Vaše cena/ks', styleId: 's_header' },
    { value: 'Celkem', styleId: 's_header' },
  ]);

  for (const section of sections) {
    for (const item of section.items) {
      addRow([
        { value: section.name },
        { value: item.name },
        { value: item.code || '' },
        { value: String(item.quantity), type: 'Number' },
        { value: item.unit || 'ks' },
        { value: '', styleId: 's_input' },
        { value: '', styleId: 's_input' },
      ]);
    }
  }

  addRow([]);
  addRow([{ value: 'Poznámka: Množství je orientační. Ceny prosíme dodejte do 14 dnů.' }]);

  const safeName = escapeXml(name.replace(/[[\]*?/\\:]/g, '_').substring(0, 31));

  return `<Worksheet ss:Name="${safeName}">
<Table ss:DefaultColumnWidth="120">
<Column ss:Width="140"/>
<Column ss:Width="250"/>
<Column ss:Width="100"/>
<Column ss:Width="80"/>
<Column ss:Width="70"/>
<Column ss:Width="100"/>
<Column ss:Width="100"/>
${rows.join('\n')}
</Table>
</Worksheet>`;
}

function buildExcelXml(worksheets: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="Default" ss:Name="Normal">
    <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
  <Style ss:ID="s_title">
    <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1"/>
  </Style>
  <Style ss:ID="s_label">
    <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
  </Style>
  <Style ss:ID="s_header">
    <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
    <Interior ss:Color="#2563EB" ss:Pattern="Solid"/>
    <Borders>
      <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    </Borders>
  </Style>
  <Style ss:ID="s_input">
    <Interior ss:Color="#FEF9C3" ss:Pattern="Solid"/>
    <Borders>
      <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    </Borders>
  </Style>
</Styles>
${worksheets.join('\n')}
</Workbook>`;
}

export function exportSupplierQuoteXLS({
  sections,
  trades,
  projectName,
  clientName,
  quoteNumber,
}: ExportOptions) {
  const tradeGroups: Record<string, QuoteSection[]> = {};

  for (const section of sections) {
    const sectionTrade = getSectionTrade(section);
    const matches = trades.includes('Vše') || trades.some(t => sectionTrade.includes(t) || t.includes(sectionTrade));
    if (!matches) continue;

    if (!tradeGroups[sectionTrade]) tradeGroups[sectionTrade] = [];
    tradeGroups[sectionTrade].push(section);
  }

  const tradeNames = Object.keys(tradeGroups).sort();

  if (tradeNames.length === 0) {
    const ws = buildWorksheet('Poptávka', [], projectName, clientName, quoteNumber, trades.join(', '));
    const xml = buildExcelXml([ws]);
    downloadXml(xml, projectName, trades);
    return;
  }

  const worksheets = tradeNames.map(trade =>
    buildWorksheet(trade, tradeGroups[trade], projectName, clientName, quoteNumber, trade)
  );

  const xml = buildExcelXml(worksheets);
  downloadXml(xml, projectName, trades);
}

function downloadXml(xml: string, projectName: string, trades: string[]) {
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = projectName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g, '');
  link.download = `poptavka_${safeName}_${trades.join('_')}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getAvailableTrades(sections: QuoteSection[]): string[] {
  const trades = new Set<string>();
  for (const section of sections) {
    trades.add(getSectionTrade(section));
  }
  return Array.from(trades).sort();
}
