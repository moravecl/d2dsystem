interface ProjectRef {
  id: string;
  project_name: string;
  status: string;
  deadline: string | null;
  created_at: string;
}

interface Milestone {
  id: string;
  project_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  sort_order: number;
  color: string;
}

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function exportGanttPdf(
  projects: ProjectRef[],
  milestones: Milestone[],
  startDate: Date,
  totalDays: number,
  todayPos: string | null,
  rangeLabel: string,
  statusColors: Record<string, string>,
  statusLabels: Record<string, string>,
  msStatus: Record<string, { label: string; color: string }>,
) {
  const now = new Date();
  const fmtDate = (d: Date) => d.toLocaleDateString('cs-CZ');

  const buildBar = (start: string, end: string, color: string, opacity: number, label: string): string => {
    if (!start || !end) return '';
    const s = new Date(start);
    const e = new Date(end);
    const leftDay = Math.max(0, daysBetween(startDate, s));
    const rightDay = Math.min(totalDays, daysBetween(startDate, e));
    const width = Math.max(1, rightDay - leftDay);
    const leftPct = (leftDay / totalDays) * 100;
    const widthPct = (width / totalDays) * 100;
    return `<div class="bar" style="left:${leftPct}%;width:${widthPct}%;background:${color};opacity:${opacity}">
      ${label ? `<span class="bar-label">${escHtml(label)}</span>` : ''}
    </div>`;
  };

  const rows: string[] = [];
  for (const project of projects) {
    const projMs = milestones.filter(m => m.project_id === project.id);
    const color = statusColors[project.status] || '#64748b';
    const sLabel = statusLabels[project.status] || project.status;

    rows.push(`<tr class="proj-row">
      <td class="name-col">
        <div class="proj-name">
          <span class="dot" style="background:${color}"></span>
          ${escHtml(project.project_name)}
          <span class="status-badge" style="color:${color}">${escHtml(sLabel)}</span>
        </div>
      </td>
      <td class="time-col">
        ${project.deadline ? buildBar(project.created_at, project.deadline, color, 0.25, '') : ''}
        ${todayPos ? `<div class="today-line" style="left:${todayPos}"></div>` : ''}
      </td>
    </tr>`);

    for (const ms of projMs) {
      const st = msStatus[ms.status] || msStatus.planned;
      rows.push(`<tr class="ms-row">
        <td class="name-col">
          <div class="ms-name">
            <span class="flag" style="color:${ms.color}">●</span>
            ${escHtml(ms.name)}
            <span class="ms-status">${escHtml(st.label)}</span>
          </div>
        </td>
        <td class="time-col">
          ${buildBar(ms.start_date, ms.end_date, ms.color, 1, ms.name)}
          ${todayPos ? `<div class="today-line" style="left:${todayPos}"></div>` : ''}
        </td>
      </tr>`);
    }
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Gantt diagram</title>
<style>
@page { margin: 10mm; size: A4 landscape; }
@media print { .no-print { display: none !important; } }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1a1a2e; font-size: 9px; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.brand-bar { height: 3px; background: linear-gradient(90deg, #0f172a 0%, #1e40af 40%, #3b82f6 70%, #93c5fd 100%); margin-bottom: 14px; border-radius: 0 0 2px 2px; }
h1 { font-size: 16px; font-weight: 800; margin-bottom: 4px; color: #0f172a; }
.subtitle { font-size: 9px; color: #64748b; margin-bottom: 14px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { border: 1px solid #e2e8f0; padding: 0; }
.name-col { width: 200px; min-width: 200px; padding: 5px 8px !important; vertical-align: middle; }
.time-col { position: relative; height: 26px; padding: 0 !important; }
.header-row th { font-size: 8px; font-weight: 700; text-align: center; background: #f8fafc; padding: 4px !important; color: #475569; }
.proj-row .name-col { background: #f8fafc; }
.proj-name { font-weight: 700; font-size: 9.5px; display: flex; align-items: center; gap: 5px; }
.dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.status-badge { font-size: 7px; font-weight: 600; margin-left: auto; }
.ms-row .name-col { padding-left: 22px !important; }
.ms-name { font-size: 8.5px; display: flex; align-items: center; gap: 4px; }
.flag { font-size: 9px; }
.ms-status { font-size: 7px; color: #64748b; margin-left: auto; }
.bar { position: absolute; top: 5px; height: 16px; border-radius: 3px; overflow: hidden; }
.bar-label { font-size: 7px; font-weight: 700; color: #fff; padding: 0 4px; line-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.today-line { position: absolute; top: 0; bottom: 0; width: 1px; background: #ef4444; z-index: 5; }
.footer { margin-top: 12px; font-size: 7px; color: #94a3b8; text-align: right; }
</style></head><body>
<div class="brand-bar"></div>
<h1>Gantt diagram</h1>
<div class="subtitle">${escHtml(rangeLabel)} &bull; Vygenerováno: ${fmtDate(now)}</div>
<table>
<thead><tr class="header-row"><th class="name-col">Projekt / Milník</th><th>Časová osa</th></tr></thead>
<tbody>${rows.join('')}</tbody>
</table>
<div class="footer">HouseSmart &bull; ${fmtDate(now)}</div>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.addEventListener('load', () => {
      setTimeout(() => {
        win.print();
        URL.revokeObjectURL(url);
      }, 300);
    });
  } else {
    URL.revokeObjectURL(url);
  }
}
