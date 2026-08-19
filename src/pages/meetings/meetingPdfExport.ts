function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface ExportParams {
  meeting: {
    title: string;
    type: string;
    start_date: string;
    start_time: string | null;
    end_time: string | null;
    location: string;
    description: string;
    status: string;
  };
  agendaItems: { title: string; duration_minutes: number; status: string; responsible_user_id: string | null; sort_order: number }[];
  minutes: { content: string; decisions: string; notes: string; duration_minutes: number } | null;
  actionItems: { title: string; assigned_to: string | null; due_date: string | null; status: string }[];
  attendees: { user_id: string; role: string; attendance_status: string }[];
  projectName: string;
  clientName: string;
  getProfileName: (id: string) => string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ceka',
  discussed: 'Projednano',
  skipped: 'Preskoceno',
  deferred: 'Odlozeno',
  open: 'Otevreno',
  completed: 'Splneno',
};

const ROLE_LABELS: Record<string, string> = {
  organizer: 'Organizator',
  attendee: 'Ucastnik',
  notetaker: 'Zapisovatel',
};

const ATT_LABELS: Record<string, string> = {
  invited: 'Pozvan',
  confirmed: 'Potvrzeno',
  present: 'Pritomen',
  absent: 'Nepritomen',
};

export function exportMeetingPdf(params: ExportParams) {
  const { meeting, agendaItems, minutes, actionItems, attendees, projectName, clientName, getProfileName } = params;

  const dateStr = new Date(meeting.start_date + 'T00:00:00').toLocaleDateString('cs-CZ');
  const timeStr = meeting.start_time ? `${meeting.start_time.slice(0, 5)}${meeting.end_time ? ' - ' + meeting.end_time.slice(0, 5) : ''}` : '';

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(meeting.title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #1e293b; line-height: 1.6; padding: 24px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 14px; margin: 20px 0 8px 0; padding-bottom: 4px; border-bottom: 2px solid #e2e8f0; color: #334155; }
  .meta { color: #64748b; font-size: 11px; margin-bottom: 16px; }
  .meta span { margin-right: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
  th { background: #f8fafc; font-weight: 600; color: #475569; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
  .badge-green { background: #ecfdf5; color: #059669; }
  .badge-gray { background: #f1f5f9; color: #475569; }
  .badge-blue { background: #eff6ff; color: #2563eb; }
  .badge-amber { background: #fffbeb; color: #d97706; }
  .section { margin-bottom: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; }
  .section-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px; }
  .content { font-size: 12px; }
  .content p { margin-bottom: 6px; }
  .content strong { font-weight: 700; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 10px; text-align: center; }
  @media print { body { padding: 0; } }
</style></head><body>`;

  html += `<h1>${esc(meeting.title)}</h1>`;
  html += `<div class="meta">`;
  html += `<span>${meeting.type === 'schuzka' ? 'Schuzka s klientem' : 'Interni porada'}</span>`;
  html += `<span>${dateStr} ${timeStr}</span>`;
  if (meeting.location) html += `<span>${esc(meeting.location)}</span>`;
  if (projectName) html += `<span>Projekt: ${esc(projectName)}</span>`;
  if (clientName) html += `<span>Klient: ${esc(clientName)}</span>`;
  html += `</div>`;

  if (meeting.description) {
    html += `<p style="margin-bottom:16px;color:#475569">${esc(meeting.description)}</p>`;
  }

  if (attendees.length > 0) {
    html += `<h2>Ucastnici</h2><table><tr><th>Jmeno</th><th>Role</th><th>Ucast</th></tr>`;
    attendees.forEach(a => {
      html += `<tr><td>${esc(getProfileName(a.user_id))}</td><td>${ROLE_LABELS[a.role] || a.role}</td><td>${ATT_LABELS[a.attendance_status] || a.attendance_status}</td></tr>`;
    });
    html += `</table>`;
  }

  if (agendaItems.length > 0) {
    const sorted = [...agendaItems].sort((a, b) => a.sort_order - b.sort_order);
    html += `<h2>Agenda</h2><table><tr><th>#</th><th>Bod</th><th>Cas</th><th>Zodpovedny</th><th>Stav</th></tr>`;
    sorted.forEach((item, i) => {
      const badgeClass = item.status === 'discussed' ? 'badge-green' : item.status === 'skipped' ? 'badge-amber' : item.status === 'deferred' ? 'badge-blue' : 'badge-gray';
      html += `<tr><td>${i + 1}</td><td>${esc(item.title)}</td><td>${item.duration_minutes} min</td><td>${item.responsible_user_id ? esc(getProfileName(item.responsible_user_id)) : ''}</td><td><span class="badge ${badgeClass}">${STATUS_LABELS[item.status] || item.status}</span></td></tr>`;
    });
    const total = sorted.reduce((s, i) => s + i.duration_minutes, 0);
    html += `<tr><td colspan="2" style="font-weight:600">Celkem</td><td style="font-weight:600">${total} min</td><td colspan="2"></td></tr></table>`;
  }

  if (minutes) {
    if (minutes.content) {
      html += `<h2>Zapis z jednani</h2><div class="section"><div class="content">${minutes.content}</div></div>`;
    }
    if (minutes.decisions) {
      html += `<h2>Klicova rozhodnuti</h2><div class="section" style="background:#ecfdf5"><div class="content">${minutes.decisions}</div></div>`;
    }
    if (minutes.notes) {
      html += `<h2>Doplnkove poznamky</h2><div class="section" style="background:#fffbeb"><div class="content">${minutes.notes}</div></div>`;
    }
  }

  if (actionItems.length > 0) {
    html += `<h2>Ukoly</h2><table><tr><th>Ukol</th><th>Zodpovedny</th><th>Termin</th><th>Stav</th></tr>`;
    actionItems.forEach(item => {
      const badgeClass = item.status === 'completed' ? 'badge-green' : 'badge-gray';
      html += `<tr><td>${esc(item.title)}</td><td>${item.assigned_to ? esc(getProfileName(item.assigned_to)) : ''}</td><td>${item.due_date ? new Date(item.due_date + 'T00:00:00').toLocaleDateString('cs-CZ') : ''}</td><td><span class="badge ${badgeClass}">${STATUS_LABELS[item.status] || item.status}</span></td></tr>`;
    });
    html += `</table>`;
  }

  html += `<div class="footer">Vygenerovano ${new Date().toLocaleString('cs-CZ')}</div>`;
  html += `</body></html>`;

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
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:210mm;height:297mm';
    document.body.appendChild(iframe);
    const iDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iDoc) {
      iDoc.open();
      iDoc.write(html);
      iDoc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 3000);
      }, 600);
    }
    URL.revokeObjectURL(url);
  }
}
