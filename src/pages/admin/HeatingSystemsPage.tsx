import { useState, useEffect } from 'react';
import { Flame, Plus, Trash2, Pencil, ChevronDown, ChevronRight, GripVertical, Check, X, Settings2, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { HeatingSystem, HeatingSystemOption, HeatingSystemMaterial } from '../../types/database';

type Tab = 'options' | 'materials';

interface OptionChoice {
 value: string;
 label: string;
}

export default function HeatingSystemsPage() {
 const [systems, setSystems] = useState<HeatingSystem[]>([]);
 const [options, setOptions] = useState<HeatingSystemOption[]>([]);
 const [materials, setMaterials] = useState<HeatingSystemMaterial[]>([]);
 const [loading, setLoading] = useState(true);
 const [expandedId, setExpandedId] = useState<string | null>(null);
 const [activeTab, setActiveTab] = useState<Tab>('options');
 const [editingSystem, setEditingSystem] = useState<Partial<HeatingSystem> | null>(null);
 const [editingOption, setEditingOption] = useState<Partial<HeatingSystemOption> | null>(null);
 const [editingMaterial, setEditingMaterial] = useState<Partial<HeatingSystemMaterial> | null>(null);

 const load = async () => {
 const [sysRes, optRes, matRes] = await Promise.all([
 supabase.from('heating_systems').select('*').order('sort_order'),
 supabase.from('heating_system_options').select('*').order('sort_order'),
 supabase.from('heating_system_materials').select('*').order('sort_order'),
 ]);
 setSystems(sysRes.data ?? []);
 setOptions(optRes.data ?? []);
 setMaterials(matRes.data ?? []);
 setLoading(false);
 };

 useEffect(() => { load(); }, []);

 const saveSystem = async () => {
 if (!editingSystem?.name || !editingSystem?.slug) return;
 if (editingSystem.id) {
 await supabase.from('heating_systems').update({
 name: editingSystem.name,
 slug: editingSystem.slug,
 description: editingSystem.description ?? '',
 sort_order: editingSystem.sort_order ?? 0,
 is_active: editingSystem.is_active ?? true,
 }).eq('id', editingSystem.id);
 } else {
 await supabase.from('heating_systems').insert({
 name: editingSystem.name,
 slug: editingSystem.slug,
 description: editingSystem.description ?? '',
 sort_order: editingSystem.sort_order ?? systems.length,
 is_active: true,
 });
 }
 setEditingSystem(null);
 load();
 };

 const deleteSystem = async (id: string) => {
 if (!confirm('Smazat celý systém vytápění včetně všech nastavení?')) return;
 await supabase.from('heating_systems').delete().eq('id', id);
 load();
 };

 const saveOption = async () => {
 if (!editingOption?.name || !editingOption?.slug || !editingOption?.heating_system_id) return;
 const payload = {
 heating_system_id: editingOption.heating_system_id,
 name: editingOption.name,
 slug: editingOption.slug,
 field_type: editingOption.field_type ?? 'select',
 options: editingOption.options ?? [],
 default_value: editingOption.default_value ?? '',
 unit: editingOption.unit ?? '',
 description: editingOption.description ?? '',
 sort_order: editingOption.sort_order ?? 0,
 };
 if (editingOption.id) {
 await supabase.from('heating_system_options').update(payload).eq('id', editingOption.id);
 } else {
 await supabase.from('heating_system_options').insert(payload);
 }
 setEditingOption(null);
 load();
 };

 const deleteOption = async (id: string) => {
 await supabase.from('heating_system_options').delete().eq('id', id);
 load();
 };

 const saveMaterial = async () => {
 if (!editingMaterial?.name || !editingMaterial?.heating_system_id) return;
 const payload = {
 heating_system_id: editingMaterial.heating_system_id,
 name: editingMaterial.name,
 unit: editingMaterial.unit ?? 'm',
 price_per_unit: editingMaterial.price_per_unit ?? 0,
 quantity_per_m2: editingMaterial.quantity_per_m2 ?? 0,
 quantity_per_m_perimeter: editingMaterial.quantity_per_m_perimeter ?? 0,
 quantity_fixed: editingMaterial.quantity_fixed ?? 0,
 condition_option_slug: editingMaterial.condition_option_slug ?? '',
 condition_option_value: editingMaterial.condition_option_value ?? '',
 waste_percent: editingMaterial.waste_percent ?? 0,
 sort_order: editingMaterial.sort_order ?? 0,
 is_active: editingMaterial.is_active ?? true,
 };
 if (editingMaterial.id) {
 await supabase.from('heating_system_materials').update(payload).eq('id', editingMaterial.id);
 } else {
 await supabase.from('heating_system_materials').insert(payload);
 }
 setEditingMaterial(null);
 load();
 };

 const deleteMaterial = async (id: string) => {
 await supabase.from('heating_system_materials').delete().eq('id', id);
 load();
 };

 if (loading) {
 return (
 <div className="p-8 flex justify-center">
 <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin"/>
 </div>
 );
 }

 return (
 <div className="p-4 sm:p-8 max-w-6xl">
 <div className="flex items-center justify-between mb-8">
 <div>
 <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
 <Flame className="w-7 h-7 text-red-500"/>
 Systémy vytápění
 </h1>
 <p className="text-sm text-slate-500 mt-1">Konfigurace typů vytápění, parametrů a materiálů</p>
 </div>
 <button
 onClick={() => setEditingSystem({ name: '', slug: '', description: '', sort_order: systems.length, is_active: true })}
 className="bg-red-600 text-white px-4 py-2.5 rounded-xl font-extrabold text-sm hover:bg-red-700 transition flex items-center gap-2"
 >
 <Plus className="w-4 h-4"/> Nový systém
 </button>
 </div>

 <div className="space-y-3">
 {systems.map((sys) => {
 const isExpanded = expandedId === sys.id;
 const sysOptions = options.filter((o) => o.heating_system_id === sys.id);
 const sysMaterials = materials.filter((m) => m.heating_system_id === sys.id);

 return (
 <div key={sys.id} className="bg-navy-800/60 border border-white/[0.08] rounded-2xl overflow-hidden">
 <div
 className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-white/[0.04] transition"
 onClick={() => setExpandedId(isExpanded ? null : sys.id)}
 >
 <GripVertical className="w-4 h-4 text-slate-300 shrink-0"/>
 {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400"/> : <ChevronRight className="w-4 h-4 text-slate-400"/>}
 <div className="flex-1 min-w-0">
 <div className="font-extrabold text-white">{sys.name}</div>
 <div className="text-xs text-slate-500 mt-0.5">{sys.description || sys.slug}</div>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <span className="text-[10px] font-extrabold bg-white/[0.06] text-slate-500 px-2 py-0.5 rounded-full">
 {sysOptions.length} parametrů
 </span>
 <span className="text-[10px] font-extrabold bg-white/[0.06] text-slate-500 px-2 py-0.5 rounded-full">
 {sysMaterials.length} materiálů
 </span>
 {!sys.is_active && (
 <span className="text-[10px] font-extrabold bg-amber-500/20 text-amber-700 px-2 py-0.5 rounded-full">Neaktivní</span>
 )}
 <button
 onClick={(e) => { e.stopPropagation(); setEditingSystem({ ...sys }); }}
 className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/100/10 transition"
 >
 <Pencil className="w-3.5 h-3.5"/>
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); deleteSystem(sys.id); }}
 className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/100/10 transition"
 >
 <Trash2 className="w-3.5 h-3.5"/>
 </button>
 </div>
 </div>

 {isExpanded && (
 <div className="border-t border-white/[0.06]">
 <div className="flex border-b border-white/[0.06]">
 <button
 onClick={() => setActiveTab('options')}
 className={`flex-1 py-2.5 text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
 activeTab === 'options' ? 'text-blue-400 bg-blue-500/10 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-white/[0.04]'
 }`}
 >
 <Settings2 className="w-3.5 h-3.5"/> Parametry ({sysOptions.length})
 </button>
 <button
 onClick={() => setActiveTab('materials')}
 className={`flex-1 py-2.5 text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
 activeTab === 'materials' ? 'text-blue-400 bg-blue-500/10 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-white/[0.04]'
 }`}
 >
 <Package className="w-3.5 h-3.5"/> Materiály ({sysMaterials.length})
 </button>
 </div>

 <div className="p-4">
 {activeTab === 'options' && (
 <OptionsPanel
 systemId={sys.id}
 options={sysOptions}
 onEdit={setEditingOption}
 onDelete={deleteOption}
 />
 )}
 {activeTab === 'materials' && (
 <MaterialsPanel
 systemId={sys.id}
 materials={sysMaterials}
 options={sysOptions}
 onEdit={setEditingMaterial}
 onDelete={deleteMaterial}
 />
 )}
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>

 {editingSystem && (
 <SystemFormModal
 system={editingSystem}
 onChange={setEditingSystem}
 onSave={saveSystem}
 onClose={() => setEditingSystem(null)}
 />
 )}

 {editingOption && (
 <OptionFormModal
 option={editingOption}
 onChange={setEditingOption}
 onSave={saveOption}
 onClose={() => setEditingOption(null)}
 />
 )}

 {editingMaterial && (
 <MaterialFormModal
 material={editingMaterial}
 options={options.filter((o) => o.heating_system_id === editingMaterial.heating_system_id)}
 onChange={setEditingMaterial}
 onSave={saveMaterial}
 onClose={() => setEditingMaterial(null)}
 />
 )}
 </div>
 );
}

function OptionsPanel({ systemId, options: opts, onEdit, onDelete }: {
 systemId: string;
 options: HeatingSystemOption[];
 onEdit: (o: Partial<HeatingSystemOption>) => void;
 onDelete: (id: string) => void;
}) {
 return (
 <div>
 <button
 onClick={() => onEdit({ heating_system_id: systemId, name: '', slug: '', field_type: 'select', options: [], default_value: '', unit: '', description: '', sort_order: opts.length })}
 className="mb-3 bg-white/[0.06] text-slate-300 px-3 py-2 rounded-xl text-xs font-extrabold hover:bg-white/[0.08] transition flex items-center gap-1.5"
 >
 <Plus className="w-3 h-3"/> Přidat parametr
 </button>
 {opts.length === 0 ? (
 <div className="text-sm text-slate-400 text-center py-4">Zatím žádné parametry</div>
 ) : (
 <div className="space-y-2">
 {opts.map((opt) => (
 <div key={opt.id} className="flex items-start gap-3 bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]">
 <div className="flex-1 min-w-0">
 <div className="text-sm font-extrabold text-white">{opt.name}</div>
 <div className="text-[10px] text-slate-400 mt-0.5">
 slug: {opt.slug} | typ: {opt.field_type} | výchozí: {opt.default_value || '—'}
 </div>
 {opt.field_type === 'select' && Array.isArray(opt.options) && opt.options.length > 0 && (
 <div className="flex flex-wrap gap-1 mt-1.5">
 {(opt.options as OptionChoice[]).map((ch) => (
 <span key={ch.value} className="text-[10px] bg-navy-800/60 border border-white/[0.08] rounded px-1.5 py-0.5 text-slate-400">
 {ch.label} <span className="text-slate-400">({ch.value})</span>
 </span>
 ))}
 </div>
 )}
 </div>
 <button onClick={() => onEdit({ ...opt })} className="p-1 rounded text-slate-400 hover:text-blue-400 transition">
 <Pencil className="w-3.5 h-3.5"/>
 </button>
 <button onClick={() => onDelete(opt.id)} className="p-1 rounded text-slate-400 hover:text-red-500 transition">
 <Trash2 className="w-3.5 h-3.5"/>
 </button>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}

function MaterialsPanel({ systemId, materials: mats, options: opts, onEdit, onDelete }: {
 systemId: string;
 materials: HeatingSystemMaterial[];
 options: HeatingSystemOption[];
 onEdit: (m: Partial<HeatingSystemMaterial>) => void;
 onDelete: (id: string) => void;
}) {
 return (
 <div>
 <button
 onClick={() => onEdit({ heating_system_id: systemId, name: '', unit: 'm', price_per_unit: 0, quantity_per_m2: 0, quantity_per_m_perimeter: 0, quantity_fixed: 0, condition_option_slug: '', condition_option_value: '', waste_percent: 0, sort_order: mats.length, is_active: true })}
 className="mb-3 bg-white/[0.06] text-slate-300 px-3 py-2 rounded-xl text-xs font-extrabold hover:bg-white/[0.08] transition flex items-center gap-1.5"
 >
 <Plus className="w-3 h-3"/> Přidat materiál
 </button>
 {mats.length === 0 ? (
 <div className="text-sm text-slate-400 text-center py-4">Zatím žádné materiály</div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-xs">
 <thead>
 <tr className="border-b border-white/10">
 <th className="text-left py-2 px-2 font-extrabold text-slate-500">Materiál</th>
 <th className="text-left py-2 px-2 font-extrabold text-slate-500">Jedn.</th>
 <th className="text-right py-2 px-2 font-extrabold text-slate-500">Kč/j.</th>
 <th className="text-right py-2 px-2 font-extrabold text-slate-500">ks/m2</th>
 <th className="text-right py-2 px-2 font-extrabold text-slate-500">ks/bm</th>
 <th className="text-right py-2 px-2 font-extrabold text-slate-500">fixní</th>
 <th className="text-left py-2 px-2 font-extrabold text-slate-500">Podmínka</th>
 <th className="text-right py-2 px-2 font-extrabold text-slate-500">Prořez</th>
 <th className="py-2 px-2"></th>
 </tr>
 </thead>
 <tbody>
 {mats.map((mat) => {
 const condOpt = opts.find((o) => o.slug === mat.condition_option_slug);
 const condLabel = condOpt
 ? `${condOpt.name} = ${(condOpt.options as OptionChoice[])?.find((c) => c.value === mat.condition_option_value)?.label ?? mat.condition_option_value}`
 : '';
 return (
 <tr key={mat.id} className="border-b border-white/[0.06] hover:bg-white/[0.04]">
 <td className="py-2 px-2 font-extrabold text-white">{mat.name}</td>
 <td className="py-2 px-2 text-slate-500">{mat.unit}</td>
 <td className="py-2 px-2 text-right font-semibold">{mat.price_per_unit}</td>
 <td className="py-2 px-2 text-right">{mat.quantity_per_m2 || '—'}</td>
 <td className="py-2 px-2 text-right">{mat.quantity_per_m_perimeter || '—'}</td>
 <td className="py-2 px-2 text-right">{mat.quantity_fixed || '—'}</td>
 <td className="py-2 px-2 text-slate-500">{condLabel || '—'}</td>
 <td className="py-2 px-2 text-right">{mat.waste_percent ? `${mat.waste_percent}%` : '—'}</td>
 <td className="py-2 px-2">
 <div className="flex gap-1">
 <button onClick={() => onEdit({ ...mat })} className="p-1 rounded text-slate-400 hover:text-blue-400 transition">
 <Pencil className="w-3 h-3"/>
 </button>
 <button onClick={() => onDelete(mat.id)} className="p-1 rounded text-slate-400 hover:text-red-500 transition">
 <Trash2 className="w-3 h-3"/>
 </button>
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </div>
 );
}

function SystemFormModal({ system, onChange, onSave, onClose }: {
 system: Partial<HeatingSystem>;
 onChange: (s: Partial<HeatingSystem> | null) => void;
 onSave: () => void;
 onClose: () => void;
}) {
 return (
 <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
 <div className="bg-navy-800/60 rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4">
 <h3 className="text-lg font-extrabold text-white">{system.id ? 'Upravit systém' : 'Nový systém'}</h3>
 <div className="space-y-3">
 <div>
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Název</label>
 <input value={system.name ?? ''} onChange={(e) => onChange({ ...system, name: e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
 </div>
 <div>
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Slug</label>
 <input value={system.slug ?? ''} onChange={(e) => onChange({ ...system, slug: e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
 </div>
 <div>
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Popis</label>
 <textarea value={system.description ?? ''} onChange={(e) => onChange({ ...system, description: e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"rows={2} />
 </div>
 <div className="flex items-center gap-3">
 <label className="text-xs font-extrabold text-slate-400">Pořadí</label>
 <input type="number"value={system.sort_order ?? 0} onChange={(e) => onChange({ ...system, sort_order: +e.target.value })}
 className="w-20 px-2 py-1.5 rounded-lg border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
 <label className="flex items-center gap-2 ml-auto text-xs font-extrabold text-slate-400">
 <input type="checkbox"checked={system.is_active ?? true} onChange={(e) => onChange({ ...system, is_active: e.target.checked })} />
 Aktivní
 </label>
 </div>
 </div>
 <div className="flex justify-end gap-2 pt-2">
 <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-extrabold text-slate-400 hover:bg-white/[0.06] transition">Zrušit</button>
 <button onClick={onSave} className="px-4 py-2 rounded-xl text-sm font-extrabold bg-blue-600 text-white hover:bg-blue-700 transition flex items-center gap-1.5">
 <Check className="w-3.5 h-3.5"/> Uložit
 </button>
 </div>
 </div>
 </div>
 );
}

function OptionFormModal({ option, onChange, onSave, onClose }: {
 option: Partial<HeatingSystemOption>;
 onChange: (o: Partial<HeatingSystemOption> | null) => void;
 onSave: () => void;
 onClose: () => void;
}) {
 const choices = (option.options ?? []) as OptionChoice[];

 const addChoice = () => {
 onChange({ ...option, options: [...choices, { value: '', label: '' }] as unknown as { value: string; label: string }[] });
 };

 const updateChoice = (idx: number, key: 'value' | 'label', val: string) => {
 const updated = [...choices];
 updated[idx] = { ...updated[idx], [key]: val };
 onChange({ ...option, options: updated as unknown as { value: string; label: string }[] });
 };

 const removeChoice = (idx: number) => {
 onChange({ ...option, options: choices.filter((_, i) => i !== idx) as unknown as { value: string; label: string }[] });
 };

 return (
 <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
 <div className="bg-navy-800/60 rounded-2xl max-w-lg w-full shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
 <h3 className="text-lg font-extrabold text-white">{option.id ? 'Upravit parametr' : 'Nový parametr'}</h3>
 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Název</label>
 <input value={option.name ?? ''} onChange={(e) => onChange({ ...option, name: e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
 </div>
 <div>
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Slug</label>
 <input value={option.slug ?? ''} onChange={(e) => onChange({ ...option, slug: e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
 </div>
 </div>
 <div className="grid grid-cols-3 gap-3">
 <div>
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Typ pole</label>
 <select value={option.field_type ?? 'select'} onChange={(e) => onChange({ ...option, field_type: e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20">
 <option value="select">Výběr</option>
 <option value="number">Číslo</option>
 <option value="boolean">Ano/Ne</option>
 </select>
 </div>
 <div>
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Výchozí</label>
 <input value={option.default_value ?? ''} onChange={(e) => onChange({ ...option, default_value: e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
 </div>
 <div>
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Jednotka</label>
 <input value={option.unit ?? ''} onChange={(e) => onChange({ ...option, unit: e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
 </div>
 </div>
 <div>
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Popis</label>
 <input value={option.description ?? ''} onChange={(e) => onChange({ ...option, description: e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
 </div>

 {(option.field_type ?? 'select') === 'select' && (
 <div>
 <div className="flex items-center justify-between mb-2">
 <label className="text-xs font-extrabold text-slate-400">Možnosti</label>
 <button onClick={addChoice} className="text-xs font-extrabold text-blue-400 hover:text-blue-800 flex items-center gap-1">
 <Plus className="w-3 h-3"/> Přidat
 </button>
 </div>
 <div className="space-y-1.5">
 {choices.map((ch, idx) => (
 <div key={idx} className="flex items-center gap-2">
 <input value={ch.value} onChange={(e) => updateChoice(idx, 'value', e.target.value)}
 placeholder="Hodnota"className="flex-1 px-2 py-1.5 rounded-lg border border-white/10 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500/20"/>
 <input value={ch.label} onChange={(e) => updateChoice(idx, 'label', e.target.value)}
 placeholder="Popisek"className="flex-1 px-2 py-1.5 rounded-lg border border-white/10 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500/20"/>
 <button onClick={() => removeChoice(idx)} className="p-1 text-slate-400 hover:text-red-500 transition">
 <X className="w-3 h-3"/>
 </button>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 <div className="flex justify-end gap-2 pt-2">
 <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-extrabold text-slate-400 hover:bg-white/[0.06] transition">Zrušit</button>
 <button onClick={onSave} className="px-4 py-2 rounded-xl text-sm font-extrabold bg-blue-600 text-white hover:bg-blue-700 transition flex items-center gap-1.5">
 <Check className="w-3.5 h-3.5"/> Uložit
 </button>
 </div>
 </div>
 </div>
 );
}

function MaterialFormModal({ material, options: opts, onChange, onSave, onClose }: {
 material: Partial<HeatingSystemMaterial>;
 options: HeatingSystemOption[];
 onChange: (m: Partial<HeatingSystemMaterial> | null) => void;
 onSave: () => void;
 onClose: () => void;
}) {
 const selectedOpt = opts.find((o) => o.slug === material.condition_option_slug);
 const condChoices = selectedOpt ? (selectedOpt.options as OptionChoice[]) : [];

 return (
 <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
 <div className="bg-navy-800/60 rounded-2xl max-w-lg w-full shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
 <h3 className="text-lg font-extrabold text-white">{material.id ? 'Upravit materiál' : 'Nový materiál'}</h3>
 <div className="space-y-3">
 <div className="grid grid-cols-3 gap-3">
 <div className="col-span-2">
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Název</label>
 <input value={material.name ?? ''} onChange={(e) => onChange({ ...material, name: e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
 </div>
 <div>
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Jednotka</label>
 <input value={material.unit ?? 'm'} onChange={(e) => onChange({ ...material, unit: e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
 </div>
 </div>
 <div className="grid grid-cols-4 gap-3">
 <div>
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Cena/j.</label>
 <input type="number"value={material.price_per_unit ?? 0} onChange={(e) => onChange({ ...material, price_per_unit: +e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
 </div>
 <div>
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Na m2</label>
 <input type="number"step="0.1"value={material.quantity_per_m2 ?? 0} onChange={(e) => onChange({ ...material, quantity_per_m2: +e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
 </div>
 <div>
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Na bm</label>
 <input type="number"step="0.1"value={material.quantity_per_m_perimeter ?? 0} onChange={(e) => onChange({ ...material, quantity_per_m_perimeter: +e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
 </div>
 <div>
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Fixní ks</label>
 <input type="number"step="0.1"value={material.quantity_fixed ?? 0} onChange={(e) => onChange({ ...material, quantity_fixed: +e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Podmínka - parametr</label>
 <select value={material.condition_option_slug ?? ''} onChange={(e) => onChange({ ...material, condition_option_slug: e.target.value, condition_option_value: '' })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20">
 <option value="">Bez podmínky</option>
 {opts.map((o) => (
 <option key={o.id} value={o.slug}>{o.name}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Podmínka - hodnota</label>
 {condChoices.length > 0 ? (
 <select value={material.condition_option_value ?? ''} onChange={(e) => onChange({ ...material, condition_option_value: e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20">
 <option value="">—</option>
 {condChoices.map((ch) => (
 <option key={ch.value} value={ch.value}>{ch.label}</option>
 ))}
 </select>
 ) : (
 <input value={material.condition_option_value ?? ''} onChange={(e) => onChange({ ...material, condition_option_value: e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
 )}
 </div>
 </div>
 <div className="grid grid-cols-3 gap-3">
 <div>
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Prořez %</label>
 <input type="number"value={material.waste_percent ?? 0} onChange={(e) => onChange({ ...material, waste_percent: +e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
 </div>
 <div>
 <label className="text-xs font-extrabold text-slate-400 mb-1 block">Pořadí</label>
 <input type="number"value={material.sort_order ?? 0} onChange={(e) => onChange({ ...material, sort_order: +e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
 </div>
 <div className="flex items-end pb-1">
 <label className="flex items-center gap-2 text-xs font-extrabold text-slate-400">
 <input type="checkbox"checked={material.is_active ?? true} onChange={(e) => onChange({ ...material, is_active: e.target.checked })} />
 Aktivní
 </label>
 </div>
 </div>
 </div>
 <div className="flex justify-end gap-2 pt-2">
 <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-extrabold text-slate-400 hover:bg-white/[0.06] transition">Zrušit</button>
 <button onClick={onSave} className="px-4 py-2 rounded-xl text-sm font-extrabold bg-blue-600 text-white hover:bg-blue-700 transition flex items-center gap-1.5">
 <Check className="w-3.5 h-3.5"/> Uložit
 </button>
 </div>
 </div>
 </div>
 );
}
