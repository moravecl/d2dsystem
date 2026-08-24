import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Users, Award, Briefcase, Calendar, CheckCircle2, XCircle, Clock,
  Shield, Palmtree,
} from 'lucide-react';
import SortControl, { sortItems, type SortDir } from '../../components/ui/SortControl';
import { useHeader } from '../../contexts/HeaderContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import Tabs from '../../components/ui/Tabs';
import type { Profile } from '../../types/database';

interface Certification {
  id: string;
  profile_id: string;
  name: string;
  issuer: string;
  valid_from: string;
  valid_to: string | null;
  document_url: string;
}

interface Equipment {
  id: string;
  profile_id: string;
  name: string;
  serial_number: string;
  assigned_at: string;
  returned_at: string | null;
}

interface Vacation {
  id: string;
  profile_id: string;
  start_date: string;
  end_date: string;
  type: string;
  status: string;
  note: string;
}

const tabs = [
  { key: 'overview', label: 'Přehled' },
  { key: 'certifications', label: 'Certifikace' },
  { key: 'equipment', label: 'Vybavení' },
  { key: 'vacations', label: 'Dovolené' },
];

const VACATION_TYPES: Record<string, string> = { vacation: 'Dovolená', sick: 'Nemoc', personal: 'Osobní' };
const VACATION_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Čeká', color: 'text-amber-400 bg-amber-500/10' },
  approved: { label: 'Schváleno', color: 'text-emerald-400 bg-emerald-500/10' },
  rejected: { label: 'Zamítnuto', color: 'text-red-400 bg-red-500/10' },
};

export default function EmployeesPage() {
  const { setConfig } = useHeader();
  const { user } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<(Profile & { is_employee?: boolean })[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showCertModal, setShowCertModal] = useState(false);
  const [showEquipModal, setShowEquipModal] = useState(false);
  const [showVacModal, setShowVacModal] = useState(false);
  const [certForm, setCertForm] = useState({ profile_id: '', name: '', issuer: '', valid_from: '', valid_to: '', document_url: '' });
  const [equipForm, setEquipForm] = useState({ profile_id: '', name: '', serial_number: '', assigned_at: new Date().toISOString().split('T')[0] });
  const [vacForm, setVacForm] = useState({ profile_id: '', start_date: '', end_date: '', type: 'vacation', note: '' });
  const [timeByUser, setTimeByUser] = useState<Record<string, number>>({});
  const [vacationUsedByUser, setVacationUsedByUser] = useState<Record<string, number>>({});
  const [sortKey, setSortKey] = useState('display_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    setConfig({ breadcrumbs: [{ label: 'Zaměstnanci' }] });
  }, [setConfig]);

  const loadData = useCallback(async () => {
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;

    const [profRes, certRes, equipRes, vacRes, timeRes, attendanceRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('employee_certifications').select('*').order('valid_to', { ascending: true }),
      supabase.from('employee_equipment').select('*').order('assigned_at', { ascending: false }),
      supabase.from('employee_vacations').select('*').order('start_date', { ascending: false }),
      supabase.from('time_entries').select('user_id, duration_minutes'),
      supabase.from('attendance_records')
        .select('employee_id, date, leave_type')
        .eq('leave_type', 'vacation')
        .gte('date', yearStart)
        .lte('date', yearEnd),
    ]);
    setProfiles((profRes.data || []) as (Profile & { is_employee?: boolean; vacation_days_per_year?: number })[]);
    setCertifications((certRes.data || []) as Certification[]);
    setEquipment((equipRes.data || []) as Equipment[]);
    setVacations((vacRes.data || []) as Vacation[]);

    const byUser: Record<string, number> = {};
    ((timeRes.data || []) as any[]).forEach(e => {
      byUser[e.user_id] = (byUser[e.user_id] || 0) + e.duration_minutes;
    });
    setTimeByUser(byUser);

    const vacUsed: Record<string, number> = {};
    ((attendanceRes.data || []) as any[]).forEach(r => {
      vacUsed[r.employee_id] = (vacUsed[r.employee_id] || 0) + 1;
    });
    setVacationUsedByUser(vacUsed);

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getProfileName = (id: string) => {
    const p = profiles.find(pr => pr.id === id);
    return p?.display_name || p?.email || '';
  };

  const fmtH = (min: number) => `${Math.floor(min / 60)}h`;

  const handleAddCert = async () => {
    if (!certForm.profile_id || !certForm.name) return;
    const { error } = await supabase.from('employee_certifications').insert({
      profile_id: certForm.profile_id, name: certForm.name, issuer: certForm.issuer,
      valid_from: certForm.valid_from || new Date().toISOString().split('T')[0],
      valid_to: certForm.valid_to || null, document_url: certForm.document_url,
    });
    if (error) { toast('Chyba', 'error'); return; }
    toast('Certifikace přidána');
    setShowCertModal(false);
    loadData();
  };

  const handleAddEquip = async () => {
    if (!equipForm.profile_id || !equipForm.name) return;
    const { error } = await supabase.from('employee_equipment').insert({
      profile_id: equipForm.profile_id, name: equipForm.name,
      serial_number: equipForm.serial_number, assigned_at: equipForm.assigned_at,
    });
    if (error) { toast('Chyba', 'error'); return; }
    toast('Vybavení přiřazeno');
    setShowEquipModal(false);
    loadData();
  };

  const handleAddVacation = async () => {
    if (!vacForm.profile_id || !vacForm.start_date || !vacForm.end_date) return;
    const { error } = await supabase.from('employee_vacations').insert({
      profile_id: vacForm.profile_id, start_date: vacForm.start_date,
      end_date: vacForm.end_date, type: vacForm.type, note: vacForm.note,
    });
    if (error) { toast('Chyba', 'error'); return; }
    toast('Dovolená zaznamenána');
    setShowVacModal(false);
    loadData();
  };

  const handleApproveVacation = async (id: string, status: string) => {
    await supabase.from('employee_vacations').update({ status, approved_by: user!.id, updated_at: new Date().toISOString() }).eq('id', id);
    toast(status === 'approved' ? 'Schvaleno' : 'Zamitnuto');
    loadData();
  };

  const expiringSoon = certifications.filter(c => {
    if (!c.valid_to) return false;
    const diff = new Date(c.valid_to).getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  });

  if (loading) return <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-32 bg-navy-700/50 rounded-xl border border-white/[0.08] animate-pulse" />)}</div>;

  return (
    <div className="space-y-6">
      <div data-tour="employees-stats" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Zaměstnanců', value: profiles.length, Icon: Users, gradient: 'from-blue-500 to-blue-600' },
          { label: 'Certifikací', value: certifications.length, Icon: Award, gradient: 'from-emerald-500 to-emerald-600' },
          { label: 'Přiřazené vybavení', value: equipment.filter(e => !e.returned_at).length, Icon: Briefcase, gradient: 'from-amber-500 to-amber-600' },
          { label: 'Expirující cert.', value: expiringSoon.length, Icon: Shield, gradient: expiringSoon.length > 0 ? 'from-red-500 to-rose-600' : 'from-slate-600 to-slate-700' },
        ].map((card, idx) => (
          <div key={card.label} className={`relative overflow-hidden bg-gradient-to-br ${card.gradient} rounded-2xl p-5 hover:-translate-y-0.5 transition-all duration-300 group animate-count-up`} style={{ animationDelay: `${idx * 0.05}s` }}>
            <div className="absolute inset-0 bg-white/[0.04] opacity-0 group-hover:opacity-100 transition-opacity" />
            <svg className="absolute bottom-0 left-0 right-0 h-[55%] opacity-[0.15] pointer-events-none" viewBox="0 0 400 160" preserveAspectRatio="none">
              <path d="M0,160L26.7,144C53.3,128,107,96,160,90.7C213.3,85,267,107,320,117.3C373.3,128,400,128,400,128L400,160L0,160Z" fill="white" />
            </svg>
            <div className="absolute bottom-0 right-0 w-20 h-20 bg-white/[0.08] rounded-full blur-2xl translate-x-1/3 translate-y-1/3" />
            <div className="relative flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <card.Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">{card.label}</div>
                <div className="text-lg font-extrabold text-white">{card.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div data-tour="employees-tabs-section" className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] panel-3d">
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
        <div className="p-5">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <SortControl
                  options={[
                    { key: 'display_name', label: 'Jméno' },
                    { key: 'email', label: 'Email' },
                    { key: 'role', label: 'Role' },
                  ]}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onChange={(k, d) => { setSortKey(k); setSortDir(d); }}
                />
              </div>
              {(sortItems(profiles, sortKey, sortDir) as (typeof profiles[0] & { vacation_days_per_year?: number })[]).map(p => {
                const vacUsed = vacationUsedByUser[p.id] || 0;
                const vacTotal = (p as any).vacation_days_per_year || 20;
                const vacRemaining = Math.max(0, vacTotal - vacUsed);
                return (
                  <div key={p.id} className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] hover:border-white/[0.10] hover:bg-white/[0.04] transition group">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {(p.display_name || p.email)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white">{p.display_name || p.email}</div>
                      <div className="text-xs text-slate-400">{p.email} &middot; {p.role}</div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Award className="w-3 h-3" />{certifications.filter(c => c.profile_id === p.id).length}</span>
                      <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{equipment.filter(e => e.profile_id === p.id && !e.returned_at).length}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtH(timeByUser[p.id] || 0)}</span>
                      <span className={`flex items-center gap-1 ${vacRemaining <= 3 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        <Palmtree className="w-3 h-3" />{vacUsed}/{vacTotal}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'certifications' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => { setCertForm({ profile_id: '', name: '', issuer: '', valid_from: '', valid_to: '', document_url: '' }); setShowCertModal(true); }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"><Plus className="w-4 h-4" /> Nová certifikace</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-white/[0.08]">
                    <th className="pb-3 pr-4">Zaměstnanec</th><th className="pb-3 pr-4">Certifikace</th><th className="pb-3 pr-4">Vydavatel</th><th className="pb-3 pr-4">Platnost do</th><th className="pb-3">Stav</th>
                  </tr></thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {certifications.map(c => {
                      const expired = c.valid_to && new Date(c.valid_to) < new Date();
                      const expiring = c.valid_to && !expired && (new Date(c.valid_to).getTime() - Date.now()) < 30 * 24 * 60 * 60 * 1000;
                      return (
                        <tr key={c.id} className="hover:bg-white/[0.06]/[0.04] transition">
                          <td className="py-3 pr-4 font-semibold text-white">{getProfileName(c.profile_id)}</td>
                          <td className="py-3 pr-4 text-slate-300">{c.name}</td>
                          <td className="py-3 pr-4 text-slate-400">{c.issuer}</td>
                          <td className="py-3 pr-4 text-slate-400">{c.valid_to ? new Date(c.valid_to).toLocaleDateString('cs-CZ') : 'Bezlimitní'}</td>
                          <td className="py-3">
                            {expired ? <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">Expirovaná</span>
                              : expiring ? <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">Brzy expiruje</span>
                              : <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Platná</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {certifications.length === 0 && <div className="text-center py-12 text-sm text-slate-500">Žádné certifikace</div>}
              </div>
            </div>
          )}

          {activeTab === 'equipment' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => { setEquipForm({ profile_id: '', name: '', serial_number: '', assigned_at: new Date().toISOString().split('T')[0] }); setShowEquipModal(true); }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"><Plus className="w-4 h-4" /> Přidat vybavení</button>
              </div>
              <div className="space-y-2">
                {equipment.map(e => (
                  <div key={e.id} className="flex items-center gap-4 p-3 rounded-lg border border-white/[0.06] hover:bg-white/[0.06]/[0.04] transition">
                    <Briefcase className="w-5 h-5 text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{e.name}</div>
                      <div className="text-xs text-slate-400">{e.serial_number ? `SN: ${e.serial_number} | ` : ''}{getProfileName(e.profile_id)}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${e.returned_at ? 'text-slate-400 bg-white/[0.06]/[0.07]' : 'text-emerald-400 bg-emerald-500/10'}`}>
                      {e.returned_at ? 'Vráceno' : 'Aktivní'}
                    </span>
                  </div>
                ))}
                {equipment.length === 0 && <div className="text-center py-12 text-sm text-slate-500">Žádné vybavení</div>}
              </div>
            </div>
          )}

          {activeTab === 'vacations' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => { setVacForm({ profile_id: user!.id, start_date: '', end_date: '', type: 'vacation', note: '' }); setShowVacModal(true); }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"><Plus className="w-4 h-4" /> Nový záznam</button>
              </div>
              <div className="space-y-2">
                {vacations.map(v => {
                  const st = VACATION_STATUS[v.status] || VACATION_STATUS.pending;
                  return (
                    <div key={v.id} className="flex items-center gap-4 p-3 rounded-lg border border-white/[0.06] hover:bg-white/[0.06]/[0.04] transition">
                      <Calendar className="w-5 h-5 text-slate-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white">{getProfileName(v.profile_id)}</div>
                        <div className="text-xs text-slate-400">
                          {VACATION_TYPES[v.type] || v.type} | {new Date(v.start_date).toLocaleDateString('cs-CZ')} - {new Date(v.end_date).toLocaleDateString('cs-CZ')}
                          {v.note ? ` | ${v.note}` : ''}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${st.color}`}>{st.label}</span>
                      {v.status === 'pending' && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleApproveVacation(v.id, 'approved')} className="p-1.5 rounded-lg hover:bg-emerald-500/100/10 text-slate-500 hover:text-emerald-500 transition"><CheckCircle2 className="w-4 h-4" /></button>
                          <button onClick={() => handleApproveVacation(v.id, 'rejected')} className="p-1.5 rounded-lg hover:bg-red-500/100/100/10 text-slate-500 hover:text-red-400 transition"><XCircle className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {vacations.length === 0 && <div className="text-center py-12 text-sm text-slate-500">Žádné záznamy</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={showCertModal} onClose={() => setShowCertModal(false)} title="Nová certifikace" size="md" footer={
        <><button onClick={() => setShowCertModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06]/[0.04] rounded-lg transition">Zrušit</button>
        <button onClick={handleAddCert} disabled={!certForm.profile_id || !certForm.name} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">Přidat</button></>
      }><div className="space-y-4">
        <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Zaměstnanec *</label><select value={certForm.profile_id} onChange={e => setCertForm({ ...certForm, profile_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"><option value="">Vyberte...</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.display_name || p.email}</option>)}</select></div>
        <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Název certifikace *</label><input value={certForm.name} onChange={e => setCertForm({ ...certForm, name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
        <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Vydavatel</label><input value={certForm.issuer} onChange={e => setCertForm({ ...certForm, issuer: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Platnost od</label><input type="date" value={certForm.valid_from} onChange={e => setCertForm({ ...certForm, valid_from: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Platnost do</label><input type="date" value={certForm.valid_to} onChange={e => setCertForm({ ...certForm, valid_to: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
        </div>
      </div></Modal>

      <Modal open={showEquipModal} onClose={() => setShowEquipModal(false)} title="Přidat vybavení" size="md" footer={
        <><button onClick={() => setShowEquipModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06]/[0.04] rounded-lg transition">Zrušit</button>
        <button onClick={handleAddEquip} disabled={!equipForm.profile_id || !equipForm.name} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">Přidat</button></>
      }><div className="space-y-4">
        <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Zaměstnanec *</label><select value={equipForm.profile_id} onChange={e => setEquipForm({ ...equipForm, profile_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"><option value="">Vyberte...</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.display_name || p.email}</option>)}</select></div>
        <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Název *</label><input value={equipForm.name} onChange={e => setEquipForm({ ...equipForm, name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
        <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Sériové číslo</label><input value={equipForm.serial_number} onChange={e => setEquipForm({ ...equipForm, serial_number: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
      </div></Modal>

      <Modal open={showVacModal} onClose={() => setShowVacModal(false)} title="Nový záznam dovolené" size="md" footer={
        <><button onClick={() => setShowVacModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.04] rounded-lg transition">Zrušit</button>
        <button onClick={handleAddVacation} disabled={!vacForm.start_date || !vacForm.end_date} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">Přidat</button></>
      }><div className="space-y-4">
        <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Typ</label><select value={vacForm.type} onChange={e => setVacForm({ ...vacForm, type: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">{Object.entries(VACATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Od *</label><input type="date" value={vacForm.start_date} onChange={e => setVacForm({ ...vacForm, start_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Do *</label><input type="date" value={vacForm.end_date} onChange={e => setVacForm({ ...vacForm, end_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
        </div>
        <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámka</label><input value={vacForm.note} onChange={e => setVacForm({ ...vacForm, note: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
      </div></Modal>

    </div>
  );
}
