import { useState, useEffect } from 'react';
import { Clock, Palmtree, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface WidgetData {
  monthlyHours: number;
  monthlyFund: number;
  avgHoursPerDay: number;
  workDays: number;
  vacationUsed: number;
  vacationTotal: number;
  vacationRemaining: number;
  overtime: number;
  fulfillmentPercent: number;
}

export default function AttendanceVacationWidget() {
  const { user } = useAuth();
  const [data, setData] = useState<WidgetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const monthEnd = new Date(year, month, 0).toISOString().split('T')[0];
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const [profileRes, monthlyRes, yearlyVacRes] = await Promise.all([
        supabase.from('profiles')
          .select('vacation_days_per_year, monthly_work_hours_fund')
          .eq('id', user.id)
          .maybeSingle(),
        supabase.from('attendance_records')
          .select('start_time, end_time, break_minutes, leave_type')
          .eq('employee_id', user.id)
          .gte('date', monthStart)
          .lte('date', monthEnd),
        supabase.from('attendance_records')
          .select('id')
          .eq('employee_id', user.id)
          .eq('leave_type', 'vacation')
          .gte('date', yearStart)
          .lte('date', yearEnd),
      ]);

      const vacationTotal = profileRes.data?.vacation_days_per_year ?? 20;
      const monthlyFund = profileRes.data?.monthly_work_hours_fund ?? 160;
      const vacationUsed = yearlyVacRes.data?.length || 0;

      let monthlyHours = 0;
      let workDays = 0;
      (monthlyRes.data || []).forEach((r: any) => {
        if (r.leave_type === 'work' && r.end_time) {
          const [sh, sm] = r.start_time.split(':').map(Number);
          const [eh, em] = r.end_time.split(':').map(Number);
          const minutes = (eh * 60 + em) - (sh * 60 + sm) - (r.break_minutes || 0);
          monthlyHours += Math.max(0, minutes / 60);
          workDays++;
        }
      });

      const overtime = Math.max(0, monthlyHours - monthlyFund);
      const fulfillmentPercent = monthlyFund > 0 ? (monthlyHours / monthlyFund) * 100 : 0;

      setData({
        monthlyHours,
        monthlyFund,
        avgHoursPerDay: workDays > 0 ? monthlyHours / workDays : 0,
        workDays,
        vacationUsed,
        vacationTotal,
        vacationRemaining: Math.max(0, vacationTotal - vacationUsed),
        overtime,
        fulfillmentPercent,
      });
      setLoading(false);
    };

    loadData();
  }, [user]);

  if (loading) {
    return (
      <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-5 animate-pulse">
        <div className="h-6 bg-white/[0.06] rounded w-48 mb-4" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white/[0.06] rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const monthName = new Date().toLocaleDateString('cs-CZ', { month: 'long' });
  const vacPercent = data.vacationTotal > 0 ? (data.vacationUsed / data.vacationTotal) * 100 : 0;
  const isUnderFund = data.monthlyHours < data.monthlyFund && new Date().getDate() > 20;
  const hasOvertime = data.overtime > 0;

  return (
    <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-400" />
          Docházka a dovolená
        </h3>
        <span className="text-xs text-slate-400">{monthName} {new Date().getFullYear()}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-4 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-white">
            {data.monthlyHours.toFixed(1)}
            <span className="text-sm font-normal text-slate-400">/{data.monthlyFund}h</span>
          </div>
          <div className="text-[10px] text-blue-400 uppercase tracking-wider">Odpracováno/fond</div>
          <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${data.fulfillmentPercent >= 100 ? 'bg-emerald-500' : data.fulfillmentPercent >= 80 ? 'bg-blue-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(100, data.fulfillmentPercent)}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-400 mt-1">{data.fulfillmentPercent.toFixed(0)}% fondu</div>
        </div>

        <div className={`bg-gradient-to-br ${hasOvertime ? 'from-rose-500/20 to-rose-600/10 border-rose-500/20' : 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20'} rounded-xl p-4 border`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg ${hasOvertime ? 'bg-rose-500/20' : 'bg-emerald-500/20'} flex items-center justify-center`}>
              {hasOvertime ? (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              ) : (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              )}
            </div>
          </div>
          {hasOvertime ? (
            <>
              <div className="text-xl font-extrabold text-rose-400">+{data.overtime.toFixed(1)}h</div>
              <div className="text-[10px] text-rose-400 uppercase tracking-wider">Přesčasy</div>
            </>
          ) : (
            <>
              <div className="text-xl font-extrabold text-white">{data.avgHoursPerDay.toFixed(1)}h</div>
              <div className="text-[10px] text-emerald-400 uppercase tracking-wider">Průměr/den ({data.workDays} dní)</div>
            </>
          )}
          {isUnderFund && !hasOvertime && (
            <div className="text-[10px] text-amber-400 mt-2">
              Zbývá {(data.monthlyFund - data.monthlyHours).toFixed(1)}h do fondu
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 rounded-xl p-4 border border-cyan-500/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Palmtree className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-white">
            {data.vacationRemaining}
            <span className="text-sm font-normal text-slate-400">/{data.vacationTotal}</span>
          </div>
          <div className="text-[10px] text-cyan-400 uppercase tracking-wider">Zbývá dní dovolené</div>
          <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${vacPercent > 80 ? 'bg-amber-500' : 'bg-cyan-500'}`}
              style={{ width: `${Math.min(100, vacPercent)}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-400 mt-1">{data.vacationUsed} vyčerpáno</div>
        </div>

        <div className="bg-gradient-to-br from-slate-500/20 to-slate-600/10 rounded-xl p-4 border border-slate-500/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-slate-500/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-slate-400" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-white">{data.workDays}</div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Odpracovaných dní</div>
          <div className="text-[10px] text-slate-500 mt-2">
            Průměr {data.avgHoursPerDay.toFixed(1)}h/den
          </div>
        </div>
      </div>
    </div>
  );
}
