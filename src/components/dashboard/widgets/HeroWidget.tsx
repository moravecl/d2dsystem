import { Sparkles } from 'lucide-react';
import type { DashboardData } from '../dashboardTypes';

interface Props {
  data: DashboardData;
  editMode: boolean;
}

export default function HeroWidget({ data, editMode }: Props) {
  const { profile, stats } = data;
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Dobré ráno';
    if (hour < 18) return 'Dobré odpoledne';
    return 'Dobrý večer';
  };
  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-6 sm:p-8 ${editMode ? 'ring-2 ring-blue-400/30 ring-offset-2 ring-offset-navy-950' : ''}`}
      style={{
        background: 'linear-gradient(135deg, rgba(30,60,120,0.55) 0%, rgba(15,35,75,0.45) 50%, rgba(20,50,100,0.50) 100%)',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 80px -20px rgba(74,125,255,0.15)',
      }}
    >
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute -top-16 -right-16 w-[420px] h-[420px] rounded-full blur-[80px] animate-float" style={{ background: 'radial-gradient(circle, rgba(74,125,255,0.35) 0%, rgba(74,125,255,0.10) 45%, transparent 65%)' }} />
        <div className="absolute -bottom-12 -left-20 w-[350px] h-[350px] rounded-full blur-[70px] animate-float-delayed" style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.25) 0%, rgba(0,180,255,0.08) 45%, transparent 65%)' }} />
        <div className="absolute top-1/3 right-1/4 w-[280px] h-[280px] rounded-full blur-[60px] animate-float-slow" style={{ background: 'radial-gradient(circle, rgba(100,180,255,0.20) 0%, rgba(60,120,255,0.06) 45%, transparent 65%)' }} />
        <div className="absolute top-0 left-1/4 w-[220px] h-[180px] rounded-full blur-[50px] animate-float" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 55%)', animationDelay: '1s' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 35%, rgba(74,125,255,0.05) 100%)' }} />
      </div>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right, transparent 10%, rgba(255,255,255,0.25) 50%, transparent 90%)' }} />
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right, transparent 20%, rgba(74,125,255,0.12) 50%, transparent 80%)' }} />
      <div className="absolute top-0 left-0 bottom-0 w-px" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/25">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">HouseSmart</span>
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1.5 tracking-tight">{getGreeting()}, {profile?.display_name || 'uživateli'}</h1>
        <p className="text-sm text-slate-400 font-medium">{new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <div className="flex items-center gap-8 mt-7 flex-wrap">
          <div className="animate-count-up">
            <div className="text-3xl font-extrabold text-white">{stats.activeProjects}</div>
            <div className="text-xs text-slate-400 mt-0.5 font-medium">aktivních projektů</div>
          </div>
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-white/15 to-transparent" />
          <div className="animate-count-up" style={{ animationDelay: '0.1s' }}>
            <div className="text-3xl font-extrabold text-white">{stats.pendingQuotes}</div>
            <div className="text-xs text-slate-400 mt-0.5 font-medium">čekajících nabídek</div>
          </div>
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-white/15 to-transparent" />
          <div className="animate-count-up" style={{ animationDelay: '0.2s' }}>
            <div className="text-3xl font-extrabold text-white">{fmt(stats.totalPaid)} Kc</div>
            <div className="text-xs text-slate-400 mt-0.5 font-medium">zaplaceno celkem</div>
          </div>
        </div>
      </div>
    </div>
  );
}
