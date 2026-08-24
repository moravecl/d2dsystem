import { useEffect, useState } from 'react';
import { Building2, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';

interface CompanyInfo {
 id: string;
 company_name: string;
 company_id: string;
 tax_id: string;
 address: string;
 city: string;
 zip: string;
 phone: string;
 email: string;
 logo_url: string;
 initials: string;
 bank_name: string;
 bank_account: string;
 iban: string;
 swift: string;
}

export default function CompanyInfoPage() {
 const { toast } = useToast();
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [form, setForm] = useState<CompanyInfo>({
 id: '',
 company_name: '',
 company_id: '',
 tax_id: '',
 address: '',
 city: '',
 zip: '',
 phone: '',
 email: '',
 logo_url: '',
 initials: '',
 bank_name: '',
 bank_account: '',
 iban: '',
 swift: '',
 });

 useEffect(() => {
 loadData();
 }, []);

 const loadData = async () => {
 setLoading(true);
 const { data, error } = await supabase
 .from('company_info')
 .select('*')
 .limit(1)
 .maybeSingle();

 if (data) {
 setForm(data);
 } else if (error) {
 toast('Chyba při načítání dat', 'error');
 }
 setLoading(false);
 };

 const handleSave = async () => {
 setSaving(true);
 const { error } = await supabase
 .from('company_info')
 .update({
 company_name: form.company_name,
 company_id: form.company_id,
 tax_id: form.tax_id,
 address: form.address,
 city: form.city,
 zip: form.zip,
 phone: form.phone,
 email: form.email,
 logo_url: form.logo_url,
 initials: form.initials,
 bank_name: form.bank_name,
 bank_account: form.bank_account,
 iban: form.iban,
 swift: form.swift,
 })
 .eq('id', form.id);

 setSaving(false);

 if (error) {
 toast('Chyba při ukládání', 'error');
 return;
 }

 toast('Informace o firmě uloženy');
 };

 if (loading) {
 return (
 <div className="p-8">
 <div className="h-64 bg-navy-700/50 rounded-xl border border-white/[0.06] animate-pulse"/>
 </div>
 );
 }

 return (
 <div className="p-8">
 <div className="mb-6">
 <div className="flex items-center gap-3 mb-2">
 <Building2 className="w-6 h-6 text-slate-300"/>
 <h1 className="text-2xl font-extrabold text-white">Informace o firmě</h1>
 </div>
 <p className="text-sm text-slate-400">Nastavení základních informací o vaší firmě</p>
 </div>

 <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-6">
 <div className="space-y-5">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
 Název firmy *
 </label>
 <input
 value={form.company_name}
 onChange={(e) => setForm({ ...form, company_name: e.target.value })}
 className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
 placeholder="HouseSmart s.r.o."
 />
 </div>

 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
 IČO
 </label>
 <input
 value={form.company_id}
 onChange={(e) => setForm({ ...form, company_id: e.target.value })}
 className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
 placeholder="12345678"
 />
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
 DIČ
 </label>
 <input
 value={form.tax_id}
 onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
 className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
 placeholder="CZ12345678"
 />
 </div>

 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
 Iniciály (pro dokumenty)
 </label>
 <input
 value={form.initials}
 onChange={(e) => setForm({ ...form, initials: e.target.value })}
 className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
 placeholder="HS"
 maxLength={5}
 />
 <p className="text-xs text-slate-500 mt-1">Např. HS pro HouseSmart</p>
 </div>
 </div>

 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
 Adresa
 </label>
 <input
 value={form.address}
 onChange={(e) => setForm({ ...form, address: e.target.value })}
 className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
 placeholder="Příkladná 123"
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
 Město
 </label>
 <input
 value={form.city}
 onChange={(e) => setForm({ ...form, city: e.target.value })}
 className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
 placeholder="Praha"
 />
 </div>

 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
 PSČ
 </label>
 <input
 value={form.zip}
 onChange={(e) => setForm({ ...form, zip: e.target.value })}
 className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
 placeholder="110 00"
 />
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
 Telefon
 </label>
 <input
 value={form.phone}
 onChange={(e) => setForm({ ...form, phone: e.target.value })}
 className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
 placeholder="+420 123 456 789"
 />
 </div>

 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
 Email
 </label>
 <input
 type="email"
 value={form.email}
 onChange={(e) => setForm({ ...form, email: e.target.value })}
 className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
 placeholder="info@housesmart.cz"
 />
 </div>
 </div>

 <div className="pt-4 border-t border-white/[0.08]">
 <h3 className="text-sm font-bold text-slate-300 mb-4">Bankovní spojení</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
 Název banky
 </label>
 <input
 value={form.bank_name}
 onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
 className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
 placeholder="Fio banka"
 />
 </div>

 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
 Číslo účtu
 </label>
 <input
 value={form.bank_account}
 onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
 className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
 placeholder="2901234567/2010"
 />
 <p className="text-xs text-slate-500 mt-1">Číslo účtu se automaticky propisuje do nových faktur</p>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
 IBAN
 </label>
 <input
 value={form.iban}
 onChange={(e) => setForm({ ...form, iban: e.target.value })}
 className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
 placeholder="CZ6520100000002901234567"
 />
 </div>

 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
 SWIFT / BIC
 </label>
 <input
 value={form.swift}
 onChange={(e) => setForm({ ...form, swift: e.target.value })}
 className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
 placeholder="FIOBCZPPXXX"
 />
 </div>
 </div>
 </div>

 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
 Logo URL
 </label>
 <input
 value={form.logo_url}
 onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
 className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
 placeholder="https://..."
 />
 <p className="text-xs text-slate-500 mt-1">URL na logo firmy pro dokumenty</p>
 {form.logo_url && (
 <div className="mt-3">
 <img src={form.logo_url} alt="Logo firmy"className="h-16 object-contain"onError={(e) => {
 e.currentTarget.style.display = 'none';
 }} />
 </div>
 )}
 </div>

 <div className="flex justify-end pt-4 border-t border-white/[0.08]">
 <button
 onClick={handleSave}
 disabled={saving || !form.company_name.trim()}
 className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500/100/100 transition disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <Save className="w-4 h-4"/>
 {saving ? 'Ukládám...' : 'Uložit změny'}
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}
