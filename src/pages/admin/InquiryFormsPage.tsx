import { useEffect, useState } from 'react';
import {
 Plus,
 Pencil,
 Trash2,
 Copy,
 Check,
 X,
 Eye,
 EyeOff,
 Code,
 GripVertical,
 FileText,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import InquiryFormEditor from '../../components/inquiries/InquiryFormEditor';
import EmbedScriptModal from '../../components/inquiries/EmbedScriptModal';

export type FormType = 'inquiry' | 'service';

interface InquiryForm {
 id: string;
 name: string;
 description: string;
 form_type: FormType;
 fields: FormField[];
 settings: FormSettings;
 is_active: boolean;
 created_at: string;
}

export interface FormField {
 key: string;
 label: string;
 type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'multiselect' | 'number' | 'file';
 required: boolean;
 options?: string[];
 placeholder?: string;
 accept?: string;
 maxSizeMB?: number;
}

export interface FormSettings {
 primary_color: string;
 success_message: string;
 submit_label: string;
 title: string;
 description?: string;
}

export default function InquiryFormsPage() {
 const [forms, setForms] = useState<InquiryForm[]>([]);
 const [loading, setLoading] = useState(true);
 const [editingForm, setEditingForm] = useState<InquiryForm | null>(null);
 const [showEditor, setShowEditor] = useState(false);
 const [embedForm, setEmbedForm] = useState<InquiryForm | null>(null);
 const { toast } = useToast();

 const load = async () => {
 const { data } = await supabase
 .from('inquiry_forms')
 .select('*')
 .order('created_at', { ascending: false });
 setForms((data ?? []) as InquiryForm[]);
 setLoading(false);
 };

 useEffect(() => {
 load();
 }, []);

 const openNew = () => {
 setEditingForm(null);
 setShowEditor(true);
 };

 const openEdit = (form: InquiryForm) => {
 setEditingForm(form);
 setShowEditor(true);
 };

 const toggleActive = async (form: InquiryForm) => {
 await supabase
 .from('inquiry_forms')
 .update({ is_active: !form.is_active, updated_at: new Date().toISOString() })
 .eq('id', form.id);
 toast(form.is_active ? 'Formulář deaktivován' : 'Formulář aktivován', 'success');
 load();
 };

 const deleteForm = async (id: string) => {
 if (!confirm('Opravdu smazat tento formulář?')) return;
 await supabase.from('inquiry_forms').delete().eq('id', id);
 toast('Formulář smazán', 'success');
 load();
 };

 const handleSaved = () => {
 setShowEditor(false);
 setEditingForm(null);
 load();
 };

 if (showEditor) {
 return (
 <InquiryFormEditor
 form={editingForm}
 onSave={handleSaved}
 onCancel={() => {
 setShowEditor(false);
 setEditingForm(null);
 }}
 />
 );
 }

 return (
 <div className="p-6 max-w-5xl mx-auto">
 <div className="flex items-center justify-between mb-8">
 <div>
 <h1 className="text-2xl font-extrabold text-white">Formuláře</h1>
 <p className="text-sm text-slate-500 mt-1">
 Vytvářejte poptávkové a servisní formuláře a vkládejte je na své webové stránky
 </p>
 </div>
 <button
 onClick={openNew}
 className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition"
 >
 <Plus className="w-4 h-4"/>
 Nový formulář
 </button>
 </div>

 {loading ? (
 <div className="flex items-center justify-center py-20">
 <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"/>
 </div>
 ) : forms.length === 0 ? (
 <div className="text-center py-20 bg-navy-800/60 rounded-2xl border border-white/10">
 <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4"/>
 <h3 className="text-lg font-bold text-slate-300 mb-2">Zatím nemáte žádné formuláře</h3>
 <p className="text-sm text-slate-500 mb-6">
 Vytvořte svůj první formulář a začněte sbírat poptávky nebo servisní požadavky
 </p>
 <button
 onClick={openNew}
 className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition"
 >
 <Plus className="w-4 h-4"/>
 Vytvořit formulář
 </button>
 </div>
 ) : (
 <div className="space-y-3">
 {forms.map((form) => (
 <div
 key={form.id}
 className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 hover:shadow-md transition-shadow"
 >
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-3 mb-1">
 <h3 className="text-base font-bold text-white truncate">{form.name}</h3>
 <span
 className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${
 form.form_type === 'service'
 ? 'bg-amber-500/20 text-amber-700'
 : 'bg-blue-500/20 text-blue-400'
 }`}
 >
 {form.form_type === 'service' ? 'Servis' : 'Poptávka'}
 </span>
 <span
 className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${
 form.is_active
 ? 'bg-emerald-500/20 text-emerald-700'
 : 'bg-white/[0.06] text-slate-500'
 }`}
 >
 {form.is_active ? 'Aktivní' : 'Neaktivní'}
 </span>
 </div>
 {form.description && (
 <p className="text-sm text-slate-500 truncate">{form.description}</p>
 )}
 <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
 <span>{form.fields.length} polí</span>
 <span>
 Vytvořeno{' '}
 {new Date(form.created_at).toLocaleDateString('cs-CZ')}
 </span>
 </div>
 </div>
 <div className="flex items-center gap-1 shrink-0">
 <button
 onClick={() => setEmbedForm(form)}
 className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/100/10 transition"
 title="Kód pro vložení"
 >
 <Code className="w-4 h-4"/>
 </button>
 <button
 onClick={() => toggleActive(form)}
 className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition"
 title={form.is_active ? 'Deaktivovat' : 'Aktivovat'}
 >
 {form.is_active ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
 </button>
 <button
 onClick={() => openEdit(form)}
 className="p-2 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition"
 title="Upravit"
 >
 <Pencil className="w-4 h-4"/>
 </button>
 <button
 onClick={() => deleteForm(form.id)}
 className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/100/10 transition"
 title="Smazat"
 >
 <Trash2 className="w-4 h-4"/>
 </button>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}

 {embedForm && (
 <EmbedScriptModal form={embedForm} onClose={() => setEmbedForm(null)} />
 )}
 </div>
 );
}
