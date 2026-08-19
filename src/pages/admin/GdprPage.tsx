import { useState } from 'react';
import { Shield, Download, Trash2, AlertTriangle, CheckCircle2, Loader2, FileJson } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';

interface ExportData {
 exported_at: string;
 organization: unknown;
 profile: unknown;
 projects: unknown[];
 clients: unknown[];
 invoices: unknown[];
 employees: unknown[];
 worklogs: unknown[];
 tasks: unknown[];
 audit_log: unknown[];
}

export default function GdprPage() {
 const { user, profile } = useAuth();
 const { organization } = useOrganization();
 const { toast } = useToast();
 const [exporting, setExporting] = useState(false);
 const [confirmDelete, setConfirmDelete] = useState('');
 const [deleting, setDeleting] = useState(false);
 const [exported, setExported] = useState(false);

 const handleExport = async () => {
 if (!user || !organization) return;
 setExporting(true);
 setExported(false);

 try {
 const [
 profileRes,
 projectsRes,
 clientsRes,
 invoicesRes,
 employeesRes,
 worklogsRes,
 tasksRes,
 auditRes,
 ] = await Promise.all([
 supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
 supabase.from('projects').select('id, project_name, status, address, created_at, updated_at'),
 supabase.from('clients').select('id, name, email, phone, created_at'),
 supabase.from('invoices').select('id, invoice_number, status, total_amount, created_at'),
 supabase.from('employees').select('id, name, email, position, created_at'),
 supabase.from('work_logs').select('id, project_id, worker_name, start_time, end_time').limit(500),
 supabase.from('tasks').select('id, title, status, created_at').limit(500),
 supabase.from('audit_log').select('id, action, entity_type, created_at').eq('user_id', user.id).limit(200),
 ]);

 const exportData: ExportData = {
 exported_at: new Date().toISOString(),
 organization: {
 id: organization.id,
 name: organization.name,
 subscription_tier: organization.subscription_tier,
 created_at: organization.created_at,
 },
 profile: profileRes.data ? {
 id: profileRes.data.id,
 email: profileRes.data.email,
 display_name: profileRes.data.display_name,
 role: profileRes.data.role,
 created_at: profileRes.data.created_at,
 } : null,
 projects: projectsRes.data ?? [],
 clients: clientsRes.data ?? [],
 invoices: invoicesRes.data ?? [],
 employees: employeesRes.data ?? [],
 worklogs: worklogsRes.data ?? [],
 tasks: tasksRes.data ?? [],
 audit_log: auditRes.data ?? [],
 };

 const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `housesmart-export-${organization.slug}-${new Date().toISOString().slice(0, 10)}.json`;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);

 setExported(true);
 toast('Export dat byl stažen.', 'success');
 } catch {
 toast('Chyba při exportu dat.', 'error');
 } finally {
 setExporting(false);
 }
 };

 const handleDeleteAccount = async () => {
 if (confirmDelete !== profile?.email) {
 toast('Email se neshoduje.', 'error');
 return;
 }
 if (!confirm('Opravdu chcete smazat svůj účet? Tato akce je nevratná.')) return;

 setDeleting(true);
 try {
 await supabase.from('profiles').update({ display_name: '[Smazaný účet]', email: `deleted_${Date.now()}@deleted.local` }).eq('id', user!.id);
 await supabase.auth.signOut();
 window.location.href = '/login';
 } catch {
 toast('Chyba při mazání účtu. Kontaktujte podporu: gdpr@housesmart.cz', 'error');
 setDeleting(false);
 }
 };

 return (
 <div className="p-6 max-w-2xl mx-auto space-y-6">
 <div>
 <h1 className="text-xl font-bold text-white flex items-center gap-2">
 <Shield className="w-5 h-5 text-slate-500"/>
 GDPR & Export dat
 </h1>
 <p className="text-sm text-slate-500 mt-1">
 Správa vašich osobních údajů v souladu s GDPR (čl. 15, 17, 20 GDPR).
 </p>
 </div>

 <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-6 space-y-4">
 <div className="flex items-start gap-3">
 <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
 <FileJson className="w-5 h-5 text-blue-400"/>
 </div>
 <div className="flex-1">
 <h2 className="text-sm font-bold text-white">Export dat (čl. 20 GDPR)</h2>
 <p className="text-sm text-slate-500 mt-0.5">
 Stáhněte všechna data vaší organizace ve strojově čitelném formátu JSON.
 Export obsahuje projekty, klienty, faktury, zaměstnance a audit log.
 </p>
 </div>
 </div>

 {exported && (
 <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-200 rounded-xl text-sm text-emerald-700">
 <CheckCircle2 className="w-4 h-4 shrink-0"/>
 Export byl úspěšně stažen.
 </div>
 )}

 <button
 onClick={handleExport}
 disabled={exporting}
 className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition disabled:opacity-50"
 >
 {exporting ? (
 <Loader2 className="w-4 h-4 animate-spin"/>
 ) : (
 <Download className="w-4 h-4"/>
 )}
 {exporting ? 'Připravuji export...' : 'Stáhnout export dat'}
 </button>
 </div>

 <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-6 space-y-4">
 <div>
 <h2 className="text-sm font-bold text-white">Jaká data uchováváme</h2>
 <div className="mt-3 space-y-2">
 {[
 { label: 'Profil', desc: 'Jméno, email, role v organizaci' },
 { label: 'Projekty', desc: 'Záznamy o projektech, kde jste zodpovědnou osobou' },
 { label: 'Audit log', desc: 'Záznamy vašich akcí v systému (posledních 200)' },
 { label: 'Pracovní záznamy', desc: 'Odpracované hodiny přiřazené vašemu účtu' },
 ].map(({ label, desc }) => (
 <div key={label} className="flex items-start gap-2 text-sm">
 <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0"/>
 <div>
 <span className="font-medium text-slate-300">{label}:</span>
 <span className="text-slate-500 ml-1">{desc}</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>

 <div className="bg-red-500/10 rounded-xl border border-red-200 p-6 space-y-4">
 <div className="flex items-start gap-3">
 <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center shrink-0">
 <Trash2 className="w-5 h-5 text-red-400"/>
 </div>
 <div>
 <h2 className="text-sm font-bold text-red-800">Smazat můj účet (čl. 17 GDPR)</h2>
 <p className="text-sm text-red-400 mt-0.5">
 Tato akce je nevratná. Váš profil bude anonymizován. Data organizace zůstanou zachována.
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-200 rounded-xl text-xs text-amber-700">
 <AlertTriangle className="w-4 h-4 shrink-0"/>
 Pokud jste majitel organizace, nejprve převeďte vlastnictví na jiného uživatele.
 </div>

 <div>
 <label className="text-xs font-bold text-red-400 block mb-1.5">
 Pro potvrzení zadejte váš email: <strong>{profile?.email}</strong>
 </label>
 <input
 type="email"
 value={confirmDelete}
 onChange={(e) => setConfirmDelete(e.target.value)}
 placeholder={profile?.email ?? ''}
 className="w-full px-4 py-2.5 rounded-xl border border-red-200 bg-white/[0.06] text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition"
 />
 </div>

 <button
 onClick={handleDeleteAccount}
 disabled={deleting || confirmDelete !== profile?.email}
 className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition disabled:opacity-40"
 >
 {deleting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
 Smazat můj účet
 </button>
 </div>

 <p className="text-xs text-slate-400 text-center">
 Pro další GDPR požadavky kontaktujte{' '}
 <a href="mailto:gdpr@housesmart.cz"className="text-slate-400 hover:underline">
 gdpr@housesmart.cz
 </a>
 </p>
 </div>
 );
}
