import { useState, useEffect, useCallback } from 'react';
import { Clock, Download, Filter, User, Calendar, FileText, Plus, X, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';

interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  start_time: string;
  end_time: string | null;
  break_minutes: number;
  activity_type: string;
  project_id: string | null;
  notes: string | null;
  leave_type: string;
  leave_date_to: string | null;
  leave_start_time: string | null;
  leave_end_time: string | null;
  created_at: string;
  employee_name?: string;
  project_name?: string;
}

interface Employee {
  id: string;
  display_name: string;
  email: string;
}

interface EmployeeVacation {
  id: string;
  profile_id: string;
  start_date: string;
  end_date: string;
  type: string;
  status: string;
  note: string;
}

const ACTIVITY_TYPES = [
  'Elektroinstalace',
  'Vodoinstalace',
  'Topenarsvi',
  'Rekuperace',
  'Administrativa',
  'Doprava',
  'Skoleni',
  'Jine',
];

const LEAVE_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  work: { label: 'Práce', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  vacation: { label: 'Dovolená', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  sick: { label: 'Nemoc', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  doctor: { label: 'Lékař', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  unpaid: { label: 'Neplac. volno', color: 'text-slate-400', bg: 'bg-slate-500/10' },
  paid_leave: { label: 'Plac. volno', color: 'text-teal-400', bg: 'bg-teal-500/10' },
};

const VACATION_TYPE_TO_LEAVE: Record<string, string> = {
  vacation: 'vacation',
  sick: 'sick',
  personal: 'paid_leave',
};

const LEAVE_TO_VACATION_TYPE: Record<string, string> = {
  vacation: 'vacation',
  sick: 'sick',
  paid_leave: 'personal',
};

function dateRange(from: string, to: string): string[] {
  const result: string[] = [];
  const cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    result.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

export default function AttendancePage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedDate, setSelectedDate] = useState('');

  const [formData, setFormData] = useState({
    employee_id: profile?.id || '',
    date: new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '16:00',
    break_minutes: 30,
    activity_type: 'Elektroinstalace',
    project_id: '',
    notes: '',
    leave_type: 'work',
  });

  const [leaveFormData, setLeaveFormData] = useState({
    employee_id: profile?.id || '',
    date_from: new Date().toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    leave_type: 'vacation',
    partial_day: false,
    start_time: '08:00',
    end_time: '12:00',
    notes: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [employeesRes, projectsRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, email').eq('is_employee', true),
        supabase.from('projects').select('id, name').order('name'),
      ]);

      if (employeesRes.data) setEmployees(employeesRes.data);
      if (projectsRes.data) setProjects(projectsRes.data);

      const [year, month] = (selectedDate ? selectedDate.slice(0, 7) : selectedMonth).split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

      const { data: vacations } = await supabase
        .from('employee_vacations')
        .select('*')
        .eq('status', 'approved')
        .lte('start_date', endDate)
        .gte('end_date', startDate);

      const { data: existingLeave } = await supabase
        .from('attendance_records')
        .select('employee_id, date')
        .gte('date', startDate)
        .lte('date', endDate)
        .neq('leave_type', 'work');

      const existingSet = new Set(
        (existingLeave || []).map((r: any) => `${r.employee_id}_${r.date}`)
      );

      const toInsert: any[] = [];
      for (const vac of (vacations || []) as EmployeeVacation[]) {
        const leaveType = VACATION_TYPE_TO_LEAVE[vac.type] || 'vacation';
        const days = dateRange(
          vac.start_date > startDate ? vac.start_date : startDate,
          vac.end_date < endDate ? vac.end_date : endDate
        );
        for (const day of days) {
          const key = `${vac.profile_id}_${day}`;
          if (!existingSet.has(key)) {
            toInsert.push({
              employee_id: vac.profile_id,
              date: day,
              start_time: '00:00',
              end_time: null,
              break_minutes: 0,
              activity_type: '',
              project_id: null,
              notes: vac.note || 'Automaticky z dovolené',
              leave_type: leaveType,
            });
          }
        }
      }

      if (toInsert.length > 0) {
        await supabase.from('attendance_records').insert(toInsert);
      }

      let query = supabase
        .from('attendance_records')
        .select('*')
        .order('date', { ascending: false })
        .order('start_time', { ascending: false });

      if (selectedEmployee !== 'all') {
        query = query.eq('employee_id', selectedEmployee);
      }

      if (selectedDate) {
        query = query.eq('date', selectedDate);
      } else if (selectedMonth) {
        query = query.gte('date', startDate).lte('date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      const employeeMap = new Map(employeesRes.data?.map(e => [e.id, e.display_name]) || []);
      const projectMap = new Map(projectsRes.data?.map(p => [p.id, p.name]) || []);

      const formatted = (data || []).map((r: any) => ({
        ...r,
        employee_name: employeeMap.get(r.employee_id) || 'Neznámý',
        project_name: r.project_id ? projectMap.get(r.project_id) || null : null,
      }));

      setRecords(formatted);
    } catch (err: any) {
      console.error('Error loading attendance:', err);
      toast('Chyba při načítání docházky: ' + (err?.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedEmployee, selectedMonth, selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: any = {
        employee_id: formData.employee_id,
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time || null,
        break_minutes: formData.break_minutes,
        activity_type: formData.activity_type,
        project_id: formData.project_id || null,
        notes: formData.notes || null,
        leave_type: 'work',
      };
      const { error } = await supabase.from('attendance_records').insert([payload]);
      if (error) throw error;
      setShowForm(false);
      setFormData({
        employee_id: profile?.id || '',
        date: new Date().toISOString().split('T')[0],
        start_time: '08:00',
        end_time: '16:00',
        break_minutes: 30,
        activity_type: 'Elektroinstalace',
        project_id: '',
        notes: '',
        leave_type: 'work',
      });
      toast('Záznam uložen');
      loadData();
    } catch (err: any) {
      console.error('Error saving attendance:', err);
      toast('Chyba při ukládání: ' + (err?.message || ''), 'error');
    }
  }

  async function handleLeaveSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const days = dateRange(leaveFormData.date_from, leaveFormData.date_to);
      const toInsert = days.map(day => ({
        employee_id: leaveFormData.employee_id,
        date: day,
        start_time: leaveFormData.partial_day ? leaveFormData.start_time : '00:00',
        end_time: leaveFormData.partial_day ? leaveFormData.end_time : null,
        break_minutes: 0,
        activity_type: '',
        project_id: null,
        notes: leaveFormData.notes || null,
        leave_type: leaveFormData.leave_type,
        leave_date_to: leaveFormData.date_to !== leaveFormData.date_from ? leaveFormData.date_to : null,
        leave_start_time: leaveFormData.partial_day ? leaveFormData.start_time : null,
        leave_end_time: leaveFormData.partial_day ? leaveFormData.end_time : null,
      }));

      const { error } = await supabase.from('attendance_records').insert(toInsert);
      if (error) throw error;

      const vacationType = LEAVE_TO_VACATION_TYPE[leaveFormData.leave_type];
      if (vacationType) {
        const { data: existing } = await supabase
          .from('employee_vacations')
          .select('id')
          .eq('profile_id', leaveFormData.employee_id)
          .eq('start_date', leaveFormData.date_from)
          .eq('end_date', leaveFormData.date_to)
          .eq('type', vacationType)
          .maybeSingle();

        if (!existing) {
          await supabase.from('employee_vacations').insert({
            profile_id: leaveFormData.employee_id,
            start_date: leaveFormData.date_from,
            end_date: leaveFormData.date_to,
            type: vacationType,
            status: 'approved',
            approved_by: profile?.id || null,
            note: leaveFormData.notes || 'Zadáno z docházky',
          });
        }
      }

      setShowLeaveForm(false);
      setLeaveFormData({
        employee_id: profile?.id || '',
        date_from: new Date().toISOString().split('T')[0],
        date_to: new Date().toISOString().split('T')[0],
        leave_type: 'vacation',
        partial_day: false,
        start_time: '08:00',
        end_time: '12:00',
        notes: '',
      });
      toast(days.length > 1 ? `Nepřítomnost zaznamenána (${days.length} dní)` : 'Nepřítomnost zaznamenána');
      loadData();
    } catch (err: any) {
      console.error('Error saving leave:', err);
      toast('Chyba při ukládání: ' + (err?.message || ''), 'error');
    }
  }

  async function handleDelete(record: AttendanceRecord) {
    const { error } = await supabase.from('attendance_records').delete().eq('id', record.id);
    if (error) {
      toast('Chyba při mazání', 'error');
      return;
    }

    const vacationType = LEAVE_TO_VACATION_TYPE[record.leave_type];
    if (vacationType) {
      const { data: vacations } = await supabase
        .from('employee_vacations')
        .select('*')
        .eq('profile_id', record.employee_id)
        .eq('type', vacationType)
        .lte('start_date', record.date)
        .gte('end_date', record.date);

      for (const vac of (vacations || [])) {
        const dayBefore = new Date(record.date);
        dayBefore.setDate(dayBefore.getDate() - 1);
        const prevDate = dayBefore.toISOString().split('T')[0];

        const dayAfter = new Date(record.date);
        dayAfter.setDate(dayAfter.getDate() + 1);
        const nextDate = dayAfter.toISOString().split('T')[0];

        const hasBefore = vac.start_date <= prevDate;
        const hasAfter = vac.end_date >= nextDate;

        await supabase.from('employee_vacations').delete().eq('id', vac.id);

        if (hasBefore) {
          await supabase.from('employee_vacations').insert({
            profile_id: vac.profile_id,
            start_date: vac.start_date,
            end_date: prevDate,
            type: vac.type,
            status: vac.status,
            approved_by: vac.approved_by,
            note: vac.note,
            organization_id: vac.organization_id,
          });
        }
        if (hasAfter) {
          await supabase.from('employee_vacations').insert({
            profile_id: vac.profile_id,
            start_date: nextDate,
            end_date: vac.end_date,
            type: vac.type,
            status: vac.status,
            approved_by: vac.approved_by,
            note: vac.note,
            organization_id: vac.organization_id,
          });
        }
      }
    }

    toast('Záznam smazán');
    loadData();
  }

  function calculateHours(start: string, end: string | null, breakMin: number): number {
    if (!end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const minutes = (eh * 60 + em) - (sh * 60 + sm) - breakMin;
    return Math.max(0, minutes / 60);
  }

  function formatLeaveInterval(record: AttendanceRecord): string {
    if (record.leave_type === 'work') return '';
    if (record.leave_start_time && record.leave_end_time) {
      return `${record.leave_start_time.slice(0, 5)}–${record.leave_end_time.slice(0, 5)}`;
    }
    if (record.leave_date_to && record.leave_date_to !== record.date) {
      return `${new Date(record.date).toLocaleDateString('cs-CZ')} – ${new Date(record.leave_date_to).toLocaleDateString('cs-CZ')}`;
    }
    return 'celý den';
  }

  const totalRecords = records.length;
  const uniqueDays = new Set(records.map(r => r.date)).size;
  const totalHours = records.reduce((sum, r) => sum + calculateHours(r.start_time, r.end_time, r.break_minutes), 0);
  const avgHoursPerDay = uniqueDays > 0 ? totalHours / uniqueDays : 0;

  function exportToCSV() {
    const headers = ['Datum', 'Zamestnanec', 'Typ', 'Prichod', 'Odchod', 'Prestavka (min)', 'Hodiny', 'Cinnost', 'Projekt', 'Poznamka'];
    const rows = records.map(r => [
      r.date,
      r.employee_name,
      LEAVE_TYPES[r.leave_type]?.label || r.leave_type,
      r.start_time,
      r.end_time || '-',
      r.break_minutes,
      calculateHours(r.start_time, r.end_time, r.break_minutes).toFixed(2),
      r.activity_type,
      r.project_name || '-',
      r.notes || '',
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dochazka_${selectedMonth || 'vse'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportToPDF() {
    if (!selectedMonth) {
      toast('Pro PDF export vyberte mesic', 'error');
      return;
    }
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const monthNames = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

      const { data: allRecords, error: recErr } = await supabase
        .from('attendance_records')
        .select('*')
        .gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
        .lte('date', `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`);
      if (recErr) throw recErr;

      const { data: profilesData, error: profErr } = await supabase
        .from('profiles')
        .select('id, display_name, email, monthly_work_hours_fund')
        .eq('is_employee', true)
        .order('display_name');
      if (profErr) throw profErr;

      const employeeList = selectedEmployee === 'all'
        ? (profilesData || [])
        : (profilesData || []).filter(e => e.id === selectedEmployee);

      if (employeeList.length === 0) { toast('Žádní zaměstnanci k exportu', 'error'); return; }

      let workingDaysInMonth = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        if (date.getDay() !== 0 && date.getDay() !== 6) workingDaysInMonth++;
      }

      const dayHeadersHtml = Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1;
        const date = new Date(year, month - 1, d);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        return `<th style="padding:3px;background:${isWeekend ? '#e8f5e9' : '#fff'};font-size:9px;text-align:center;min-width:20px">${d}</th>`;
      }).join('');

      const employeeRowsHtml = employeeList.map((emp, idx) => {
        const empRecords = (allRecords || []).filter((r: any) => r.employee_id === emp.id);
        const recordsByDate = new Map<string, any>();
        empRecords.forEach((r: any) => recordsByDate.set(r.date, r));

        const fund = emp.monthly_work_hours_fund ?? 168;
        let workHours = 0; let vacationHours = 0; let vacationDays = 0;
        const workCells: string[] = [], vacCells: string[] = [];

        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const date = new Date(year, month - 1, d);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const record = recordsByDate.get(dateStr);
          const bg = isWeekend ? '#e8f5e9' : '#fff';

          let workVal = '', vacVal = '';
          if (record) {
            const lt = record.leave_type || 'work';
            if (lt === 'work' && record.end_time) {
              const hours = calculateHours(record.start_time, record.end_time, record.break_minutes);
              workHours += hours;
              workVal = hours > 0 ? (hours % 1 === 0 ? String(hours) : hours.toFixed(1)) : '';
            } else if (lt === 'vacation') {
              let h = 8;
              if (record.leave_start_time && record.leave_end_time) {
                h = calculateHours(record.leave_start_time, record.leave_end_time, 0);
              }
              vacationHours += h;
              vacationDays++;
              vacVal = h % 1 === 0 ? String(h) : h.toFixed(1);
            }
          }

          workCells.push(`<td style="padding:2px;background:${bg};font-size:9px;text-align:center">${workVal}</td>`);
          vacCells.push(`<td style="padding:2px;background:${vacVal ? '#bbdefb' : bg};font-size:9px;text-align:center;color:${vacVal ? '#1565c0' : 'inherit'}">${vacVal}</td>`);
        }

        const paidTime = workHours + vacationHours;
        const saldo = paidTime - fund;
        const saldoStr = saldo >= 0 ? `+ ${saldo.toFixed(2)}` : `- ${Math.abs(saldo).toFixed(2)}`;
        const saldoColor = saldo >= 0 ? '#2e7d32' : '#c62828';
        const empName = emp.display_name || emp.email?.split('@')[0] || 'Neznámý';

        return `
          <tr>
            <td rowspan="2" style="padding:4px 6px;vertical-align:top;font-weight:700;font-size:10px;background:#fafafa">
              <div style="font-size:9px;color:#888">${String(idx + 1).padStart(3, '0')}</div>
              <div style="font-size:11px;margin-top:2px">${empName}</div>
              <div style="font-size:9px;font-weight:400;color:${saldoColor};margin-top:4px">Saldo: ${saldoStr} hod.</div>
            </td>
            <td style="padding:3px 6px;font-size:9px;background:#fafafa">Fond: ${fund} hod.</td>
            <td style="padding:3px;font-size:9px">V práci</td>
            <td style="padding:3px;font-size:9px;text-align:right;font-weight:600">${workHours.toFixed(1)} hod.</td>
            ${workCells.join('')}
          </tr>
          <tr>
            <td style="padding:3px 6px;font-size:9px;background:#fafafa">Placený čas: ${paidTime.toFixed(1)} hod.</td>
            <td style="padding:3px;font-size:9px;background:#bbdefb;color:#1565c0">Dovolená</td>
            <td style="padding:3px;font-size:9px;text-align:right;font-weight:600;background:#bbdefb;color:#1565c0">${vacationHours} hod. (${vacationDays} d.)</td>
            ${vacCells.join('')}
          </tr>
        `;
      }).join('');

      const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}@page{size:landscape;margin:8mm}body{font-family:Arial,Helvetica,sans-serif;color:#333;font-size:10px;padding:15px}h1{font-size:18px;text-align:center;margin-bottom:3px}.company{text-align:center;color:#666;font-size:11px;margin-bottom:15px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc}th{background:#f5f5f5}.footer{margin-top:15px;font-size:9px;color:#999;display:flex;justify-content:space-between}</style></head><body>
<h1>Rozpis pracovní doby – ${monthNames[month - 1]} ${year}</h1>
<div class="company">HouseSmart s.r.o.</div>
<table><thead><tr>
<th rowspan="2" style="padding:5px;text-align:left;width:110px;font-size:10px">Placený čas</th>
<th rowspan="2" style="padding:5px;text-align:left;width:95px;font-size:10px">Trvání / hod.</th>
<th colspan="${daysInMonth + 2}" style="padding:5px;font-size:10px;text-align:center">${monthNames[month - 1]} ${year}, pracovní dny: ${workingDaysInMonth}</th>
</tr><tr><th style="padding:3px;font-size:9px;width:55px"></th><th style="padding:3px;font-size:9px;width:65px"></th>${dayHeadersHtml}</tr></thead>
<tbody>${employeeRowsHtml}</tbody></table>
<div class="footer"><span>Vytvořeno aplikací HouseSmart</span><span>1 / 1</span></div>
</body></html>`;

      const printWindow = window.open('', '_blank');
      if (!printWindow) { toast('Nelze otevřít okno pro tisk. Povolte vyskakovací okna.', 'error'); return; }
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 300);
    } catch (err: any) {
      console.error('PDF export error:', err);
      toast('Chyba při exportu PDF', 'error');
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Docházka</h1>
          <p className="text-slate-400 text-sm mt-1">Evidence pracovní doby</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] border border-white/10 text-slate-300 rounded-lg hover:bg-white/[0.08] transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] border border-white/10 text-slate-300 rounded-lg hover:bg-white/[0.08] transition-colors"
          >
            <FileText className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={() => setShowLeaveForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Nepřítomnost
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Záznam práce
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Počet záznamů', value: totalRecords },
          { label: 'Počet dní', value: uniqueDays },
          { label: 'Celkem hodin', value: `${totalHours.toFixed(1)} h` },
          { label: 'Průměr/den', value: `${avgHoursPerDay.toFixed(1)} h` },
        ].map(stat => (
          <div key={stat.label} className="bg-navy-800/60 rounded-lg border border-white/10 p-4">
            <div className="text-sm text-slate-400 mb-1">{stat.label}</div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-navy-800/60 rounded-lg border border-white/10 p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-medium text-white">Filtry</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              <User className="w-4 h-4 inline mr-1" />Zaměstnanec
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-3 py-2 border border-white/10 bg-white/[0.06] text-white rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all" className="bg-navy-800">Všichni</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id} className="bg-navy-800">{emp.display_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />Měsíc
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(e.target.value); setSelectedDate(''); }}
              className="w-full px-3 py-2 border border-white/10 bg-white/[0.06] text-white rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />Konkrétní den
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-white/10 bg-white/[0.06] text-white rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-navy-800/60 rounded-lg border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/[0.04] border-b border-white/10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Zaměstnanec</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Typ</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Příchod</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Odchod</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Přestávka</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Hodiny</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Interval</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Činnost</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">Načítání...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">Žádné záznamy</td>
                </tr>
              ) : (
                records.map(record => {
                  const lt = LEAVE_TYPES[record.leave_type] || LEAVE_TYPES.work;
                  const isWork = record.leave_type === 'work';
                  return (
                    <tr key={record.id} className="hover:bg-white/[0.04] group">
                      <td className="px-4 py-3 text-sm text-white">
                        {new Date(record.date + 'T12:00:00').toLocaleDateString('cs-CZ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-white">{record.employee_name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${lt.bg} ${lt.color}`}>
                          {lt.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-white">{isWork ? record.start_time?.slice(0, 5) : '-'}</td>
                      <td className="px-4 py-3 text-sm text-white">{isWork ? (record.end_time?.slice(0, 5) || '-') : '-'}</td>
                      <td className="px-4 py-3 text-sm text-white">{isWork ? `${record.break_minutes} min` : '-'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-white">
                        {isWork ? `${calculateHours(record.start_time, record.end_time, record.break_minutes).toFixed(2)} h` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {!isWork ? formatLeaveInterval(record) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{record.activity_type || '-'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(record)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-navy-800 rounded-xl max-w-lg w-full p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Nový záznam práce</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Zaměstnanec</label>
                <select
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-white/10 bg-white/[0.06] text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="" className="bg-navy-800">Vyberte zaměstnance</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id} className="bg-navy-800">{emp.display_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Datum</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-white/10 bg-white/[0.06] text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Příchod</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-white/10 bg-white/[0.06] text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Odchod</label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-white/10 bg-white/[0.06] text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Přestávka (minuty)</label>
                <input
                  type="number"
                  value={formData.break_minutes}
                  onChange={(e) => setFormData({ ...formData, break_minutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-white/10 bg-white/[0.06] text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Činnost</label>
                <select
                  value={formData.activity_type}
                  onChange={(e) => setFormData({ ...formData, activity_type: e.target.value })}
                  className="w-full px-3 py-2 border border-white/10 bg-white/[0.06] text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {ACTIVITY_TYPES.map(type => (
                    <option key={type} value={type} className="bg-navy-800">{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Projekt (nepovinné)</label>
                <select
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  className="w-full px-3 py-2 border border-white/10 bg-white/[0.06] text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" className="bg-navy-800">Bez projektu</option>
                  {projects.map(proj => (
                    <option key={proj.id} value={proj.id} className="bg-navy-800">{proj.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Poznámka</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-white/10 bg-white/[0.06] text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-white/10 text-slate-300 rounded-lg hover:bg-white/[0.04]"
                >
                  Zrušit
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Uložit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLeaveForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-navy-800 rounded-xl max-w-md w-full p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Záznam nepřítomnosti</h2>
              <button onClick={() => setShowLeaveForm(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleLeaveSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Zaměstnanec</label>
                <select
                  value={leaveFormData.employee_id}
                  onChange={(e) => setLeaveFormData({ ...leaveFormData, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-white/10 bg-white/[0.06] text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="" className="bg-navy-800">Vyberte zaměstnance</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id} className="bg-navy-800">{emp.display_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Typ nepřítomnosti</label>
                <select
                  value={leaveFormData.leave_type}
                  onChange={(e) => setLeaveFormData({ ...leaveFormData, leave_type: e.target.value })}
                  className="w-full px-3 py-2 border border-white/10 bg-white/[0.06] text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {Object.entries(LEAVE_TYPES).filter(([k]) => k !== 'work').map(([key, val]) => (
                    <option key={key} value={key} className="bg-navy-800">{val.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Od data</label>
                  <input
                    type="date"
                    value={leaveFormData.date_from}
                    onChange={(e) => setLeaveFormData({
                      ...leaveFormData,
                      date_from: e.target.value,
                      date_to: leaveFormData.date_to < e.target.value ? e.target.value : leaveFormData.date_to
                    })}
                    className="w-full px-3 py-2 border border-white/10 bg-white/[0.06] text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Do data</label>
                  <input
                    type="date"
                    value={leaveFormData.date_to}
                    min={leaveFormData.date_from}
                    onChange={(e) => setLeaveFormData({ ...leaveFormData, date_to: e.target.value })}
                    className="w-full px-3 py-2 border border-white/10 bg-white/[0.06] text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {leaveFormData.date_from === leaveFormData.date_to && (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={leaveFormData.partial_day}
                      onChange={(e) => setLeaveFormData({ ...leaveFormData, partial_day: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-slate-300">Kratší než celý den (zadat hodiny)</span>
                  </label>
                </div>
              )}

              {leaveFormData.partial_day && leaveFormData.date_from === leaveFormData.date_to && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-white/[0.04] rounded-lg border border-white/[0.06]">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Od</label>
                    <input
                      type="time"
                      value={leaveFormData.start_time}
                      onChange={(e) => setLeaveFormData({ ...leaveFormData, start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-white/10 bg-white/[0.06] text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Do</label>
                    <input
                      type="time"
                      value={leaveFormData.end_time}
                      onChange={(e) => setLeaveFormData({ ...leaveFormData, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-white/10 bg-white/[0.06] text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {leaveFormData.date_from !== leaveFormData.date_to && (
                <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <p className="text-sm text-blue-300">
                    Bude vytvořeno {dateRange(leaveFormData.date_from, leaveFormData.date_to).length} záznamů
                    ({leaveFormData.date_from} – {leaveFormData.date_to})
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Poznámka</label>
                <textarea
                  value={leaveFormData.notes}
                  onChange={(e) => setLeaveFormData({ ...leaveFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-white/10 bg-white/[0.06] text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLeaveForm(false)}
                  className="px-4 py-2 border border-white/10 text-slate-300 rounded-lg hover:bg-white/[0.04]"
                >
                  Zrušit
                </button>
                <button type="submit" className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">
                  Uložit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
