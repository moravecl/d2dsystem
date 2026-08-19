interface WeatherData {
  temperature_min: number;
  temperature_max: number;
  precipitation_sum: number;
  wind_speed_max: number;
  weather_code: number;
  weather_description: string;
  location?: string;
}

interface DiaryEntry {
  id: string;
  entry_date: string;
  time_from: string | null;
  time_to: string | null;
  content: string;
  people_on_site: string[];
  weather_data: WeatherData | null;
  created_by: string | null;
  created_at: string;
}

interface ExportParams {
  entries: DiaryEntry[];
  projectName: string;
  projectAddress?: string;
  getProfileName: (id: string) => string;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function weatherIcon(code: number): string {
  if (code === 0) return '&#9728;';
  if (code <= 3) return '&#9925;';
  if (code <= 48) return '&#127787;';
  if (code <= 67) return '&#127783;';
  if (code <= 77) return '&#10052;';
  if (code <= 82) return '&#127783;';
  return '&#9889;';
}

function buildWeatherHtml(w: WeatherData): string {
  return `
    <div class="weather">
      <span class="weather-icon">${weatherIcon(w.weather_code)}</span>
      <span class="weather-desc">${esc(w.weather_description)}</span>
      <span class="weather-temp">${w.temperature_min.toFixed(1)} / ${w.temperature_max.toFixed(1)} °C</span>
      ${w.precipitation_sum > 0 ? `<span class="weather-rain">${w.precipitation_sum.toFixed(1)} mm</span>` : ''}
      <span class="weather-wind">${w.wind_speed_max.toFixed(0)} km/h</span>
    </div>
  `;
}

const STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1e293b; font-size: 11px; line-height: 1.6;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  @page { size: A4 portrait; margin: 16mm 14mm; }
  @media print { .page-break { page-break-before: always; } }

  .brand-bar { height: 5px; background: linear-gradient(90deg, #0f172a 0%, #1e40af 50%, #3b82f6 100%); margin-bottom: 20px; border-radius: 0 0 3px 3px; }

  .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 2px solid #e2e8f0; }
  .header-left .doc-type { font-size: 8px; text-transform: uppercase; letter-spacing: 2px; color: #64748b; font-weight: 700; margin-bottom: 3px; }
  .header-left h1 { font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.2; }
  .header-left .address { font-size: 10px; color: #64748b; margin-top: 3px; }
  .header-right { text-align: right; font-size: 10px; color: #64748b; }
  .header-right .date { font-weight: 700; color: #0f172a; font-size: 11px; }

  .stats { display: flex; gap: 10px; margin-bottom: 22px; }
  .stat { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
  .stat .lbl { font-size: 7px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; font-weight: 700; }
  .stat .val { font-size: 15px; font-weight: 800; color: #0f172a; }

  .entry { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin-bottom: 14px; break-inside: avoid; }
  .entry-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
  .entry-header-left { display: flex; align-items: center; gap: 10px; }
  .entry-date { font-weight: 800; font-size: 11px; color: #0f172a; }
  .entry-time { font-size: 10px; font-weight: 700; color: #1d4ed8; background: #eff6ff; padding: 2px 8px; border-radius: 4px; }
  .entry-idx { font-size: 9px; font-weight: 700; color: #94a3b8; }
  .entry-body { padding: 12px 14px; }
  .entry-content { font-size: 11px; line-height: 1.7; color: #1e293b; white-space: pre-wrap; }

  .weather { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; margin-bottom: 10px; font-size: 10px; }
  .weather-icon { font-size: 16px; }
  .weather-desc { font-weight: 700; color: #1d4ed8; }
  .weather-temp { color: #475569; }
  .weather-rain { color: #2563eb; }
  .weather-wind { color: #64748b; }

  .people { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }
  .people-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 3px; width: 100%; }
  .person { font-size: 9px; font-weight: 600; color: #334155; background: #f1f5f9; padding: 2px 8px; border-radius: 10px; }
  .person-temp { color: #92400e; background: #fef3c7; }

  .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 8px; color: #94a3b8; }
`;

export function exportDiaryPdf(params: ExportParams): void {
  const { entries, projectName, projectAddress, getProfileName } = params;
  const dateStr = new Date().toLocaleDateString('cs-CZ');

  const uniqueDates = new Set(entries.map(e => e.entry_date));
  const uniquePeople = new Set(entries.flatMap(e => e.people_on_site));

  let entriesHtml = '';
  entries.forEach((entry, idx) => {
    const dateFormatted = new Date(entry.entry_date).toLocaleDateString('cs-CZ', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    let weatherHtml = '';
    if (entry.weather_data) {
      weatherHtml = buildWeatherHtml(entry.weather_data);
    }

    let peopleHtml = '';
    if (entry.people_on_site.length > 0) {
      peopleHtml = `
        <div class="people">
          <div class="people-label">Lide na stavbe</div>
          ${entry.people_on_site.map(pid => {
            const isTemp = pid.startsWith('temp:');
            const name = isTemp ? pid.slice(5) : getProfileName(pid);
            const cls = isTemp ? 'person person-temp' : 'person';
            return `<span class="${cls}">${esc(name)}</span>`;
          }).join('')}
        </div>
      `;
    }

    const timeHtml = (entry.time_from || entry.time_to)
      ? `<span class="entry-time">${(entry.time_from || '?').slice(0, 5)} – ${(entry.time_to || '?').slice(0, 5)}</span>`
      : '';

    entriesHtml += `
      <div class="entry">
        <div class="entry-header">
          <div class="entry-header-left">
            <span class="entry-date">${esc(dateFormatted)}</span>
            ${timeHtml}
          </div>
          <span class="entry-idx">#${entries.length - idx}</span>
        </div>
        <div class="entry-body">
          ${weatherHtml}
          <div class="entry-content">${esc(entry.content)}</div>
          ${peopleHtml}
        </div>
      </div>
    `;
  });

  const html = `<!DOCTYPE html>
<html lang="cs"><head><meta charset="utf-8">
<title>Stavebni denik - ${esc(projectName)}</title>
<style>${STYLES}</style></head><body>
<div class="brand-bar"></div>
<div class="header">
  <div class="header-left">
    <div class="doc-type">Stavebni denik</div>
    <h1>${esc(projectName)}</h1>
    ${projectAddress ? `<div class="address">${esc(projectAddress)}</div>` : ''}
  </div>
  <div class="header-right">
    <div class="date">Vygenerovano: ${dateStr}</div>
  </div>
</div>
<div class="stats">
  <div class="stat"><div class="lbl">Zapisu</div><div class="val">${entries.length}</div></div>
  <div class="stat"><div class="lbl">Dnu</div><div class="val">${uniqueDates.size}</div></div>
  <div class="stat"><div class="lbl">Lidi</div><div class="val">${uniquePeople.size}</div></div>
</div>
${entriesHtml}
<div class="footer">
  <span>HouseSmart - Stavebni denik</span>
  <span>${esc(projectName)} | ${dateStr}</span>
</div>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.addEventListener('load', () => {
      setTimeout(() => {
        win.print();
        URL.revokeObjectURL(url);
      }, 500);
    });
  } else {
    URL.revokeObjectURL(url);
  }
}
