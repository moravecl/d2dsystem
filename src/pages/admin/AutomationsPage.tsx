import { useState, useEffect } from 'react';
import { Zap, Plus, Loader2, ToggleLeft, ToggleRight, CreditCard as Edit2, Trash2, Play, Clock, ChevronDown, AlertCircle, Copy, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { useOrganization } from '../../contexts/OrganizationContext';
import AutomationFormModal from './AutomationFormModal';
import { getEntityLabel, getEntityColor, getActionLabel, buildTriggerSummary, type AutomationRule, type AutomationAction } from './automationDefinitions';

interface AutomationRow {
 id: string;
 org_id: string;
 name: string;
 description: string;
 is_active: boolean;
 trigger_entity: string;
 trigger_event: string;
 trigger_conditions: Record<string, unknown>;
 actions: AutomationAction[];
 sort_order: number;
 created_at: string;
 updated_at: string;
}

interface LogRow {
 id: string;
 automation_id: string;
 trigger_entity: string;
 trigger_entity_id: string;
 status: string;
 details: Record<string, unknown>;
 executed_at: string;
}

export default function AutomationsPage() {
 const { toast } = useToast();
 const { organization } = useOrganization();
 const [automations, setAutomations] = useState<AutomationRow[]>([]);
 const [logs, setLogs] = useState<LogRow[]>([]);
 const [loading, setLoading] = useState(true);
 const [showForm, setShowForm] = useState(false);
 const [editing, setEditing] = useState<AutomationRow | null>(null);
 const [activeTab, setActiveTab] = useState<'rules' | 'logs'>('rules');
 const [expandedLog, setExpandedLog] = useState<string | null>(null);
 const [filterEntity, setFilterEntity] = useState<string>('');
 const [projectStatuses, setProjectStatuses] = useState<{ key: string; label: string }[]>([]);
 const [taskStatuses, setTaskStatuses] = useState<{ key: string; label: string }[]>([]);
 const [teamMembers, setTeamMembers] = useState<{ id: string; display_name: string; email: string }[]>([]);

 useEffect(() => {
 if (!organization?.id) return;
 loadAll();
 }, [organization?.id]);

 const loadAll = async () => {
 if (!organization?.id) return;
 setLoading(true);
 const orgId = organization.id;

 const [autoRes, logsRes, psRes, tsRes, membersRes] = await Promise.all([
 supabase.from('automations').select('*').eq('org_id', orgId).order('sort_order'),
 supabase.from('automation_logs').select('*').eq('org_id', orgId).order('executed_at', { ascending: false }).limit(100),
 supabase.from('project_statuses').select('key, label').eq('is_active', true).order('sort_order'),
 supabase.from('task_statuses').select('key, label').eq('is_active', true).order('sort_order'),
 supabase.from('profiles').select('id, display_name, email').eq('organization_id', orgId),
 ]);

 setAutomations((autoRes.data ?? []) as AutomationRow[]);
 setLogs((logsRes.data ?? []) as LogRow[]);
 setProjectStatuses((psRes.data ?? []) as { key: string; label: string }[]);
 setTaskStatuses((tsRes.data ?? []) as { key: string; label: string }[]);
 setTeamMembers((membersRes.data ?? []) as { id: string; display_name: string; email: string }[]);
 setLoading(false);
 };

 const handleSave = async (rule: AutomationRule) => {
 if (!organization?.id) return;

 if (editing) {
 const { error } = await supabase
 .from('automations')
 .update({
 name: rule.name,
 description: rule.description,
 is_active: rule.is_active,
 trigger_entity: rule.trigger_entity,
 trigger_event: rule.trigger_event,
 trigger_conditions: rule.trigger_conditions,
 actions: rule.actions as unknown as Record<string, unknown>,
 updated_at: new Date().toISOString(),
 })
 .eq('id', editing.id);

 if (error) {
 toast('Chyba při ukládání.', 'error');
 return;
 }
 toast('Automatizace upravena.', 'success');
 } else {
 const { error } = await supabase
 .from('automations')
 .insert({
 org_id: organization.id,
 name: rule.name,
 description: rule.description,
 is_active: rule.is_active,
 trigger_entity: rule.trigger_entity,
 trigger_event: rule.trigger_event,
 trigger_conditions: rule.trigger_conditions,
 actions: rule.actions as unknown as Record<string, unknown>,
 sort_order: automations.length,
 created_by: (await supabase.auth.getUser()).data.user?.id,
 });

 if (error) {
 toast('Chyba při vytváření.', 'error');
 return;
 }
 toast('Automatizace vytvořena.', 'success');
 }

 setShowForm(false);
 setEditing(null);
 loadAll();
 };

 const handleToggle = async (id: string, isActive: boolean) => {
 await supabase.from('automations').update({ is_active: !isActive, updated_at: new Date().toISOString() }).eq('id', id);
 setAutomations(prev => prev.map(a => a.id === id ? { ...a, is_active: !isActive } : a));
 toast(isActive ? 'Automatizace deaktivovana.' : 'Automatizace aktivovana.', 'info');
 };

 const handleDelete = async (id: string) => {
 if (!confirm('Opravdu chcete smazat tuto automatizaci?')) return;
 await supabase.from('automation_logs').delete().eq('automation_id', id);
 await supabase.from('automations').delete().eq('id', id);
 setAutomations(prev => prev.filter(a => a.id !== id));
 toast('Automatizace smazána.', 'success');
 };

 const handleDuplicate = async (auto: AutomationRow) => {
 if (!organization?.id) return;
 const { error } = await supabase.from('automations').insert({
 org_id: organization.id,
 name: `${auto.name} (kopie)`,
 description: auto.description,
 is_active: false,
 trigger_entity: auto.trigger_entity,
 trigger_event: auto.trigger_event,
 trigger_conditions: auto.trigger_conditions,
 actions: auto.actions as unknown as Record<string, unknown>,
 sort_order: automations.length,
 created_by: (await supabase.auth.getUser()).data.user?.id,
 });
 if (!error) {
 toast('Automatizace duplikována.', 'success');
 loadAll();
 }
 };

 const openEdit = (auto: AutomationRow) => {
 setEditing(auto);
 setShowForm(true);
 };

 const openCreate = () => {
 setEditing(null);
 setShowForm(true);
 };

 const filteredAutomations = filterEntity
 ? automations.filter(a => a.trigger_entity === filterEntity)
 : automations;

 const entityCounts = automations.reduce<Record<string, number>>((acc, a) => {
 acc[a.trigger_entity] = (acc[a.trigger_entity] || 0) + 1;
 return acc;
 }, {});

 if (loading) {
 return (
 <div className="flex items-center justify-center h-96">
 <Loader2 className="w-6 h-6 animate-spin text-blue-500"/>
 </div>
 );
 }

 return (
 <div className="p-6 lg:p-8 max-w-5xl">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
 <Zap className="w-6 h-6 text-amber-500"/>
 Automatizace
 </h1>
 <p className="text-sm text-slate-500 mt-1">
 Nastavte pravidla "když tohle... tak tamto" pro automatické akce v systému.
 </p>
 </div>
 <button
 onClick={openCreate}
 className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-extrabold rounded-xl hover:bg-blue-700 transition"
 >
 <Plus className="w-4 h-4"/>
 Nová automatizace
 </button>
 </div>

 <div className="flex items-center gap-3 mb-5 flex-wrap">
 <div className="flex items-center gap-1 bg-white/[0.06] rounded-xl p-1">
 <button
 onClick={() => setActiveTab('rules')}
 className={`px-4 py-2 text-sm font-extrabold rounded-lg transition ${
 activeTab === 'rules' ? 'bg-white/[0.06] text-white ' : 'text-slate-500 hover:text-slate-300'
 }`}
 >
 <Zap className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5"/>
 Pravidla ({automations.length})
 </button>
 <button
 onClick={() => setActiveTab('logs')}
 className={`px-4 py-2 text-sm font-extrabold rounded-lg transition ${
 activeTab === 'logs' ? 'bg-white/[0.06] text-white ' : 'text-slate-500 hover:text-slate-300'
 }`}
 >
 <Clock className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5"/>
 Historie ({logs.length})
 </button>
 </div>

 {activeTab === 'rules' && automations.length > 0 && (
 <div className="flex items-center gap-1 flex-wrap">
 <button
 onClick={() => setFilterEntity('')}
 className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg transition ${
 !filterEntity ? 'bg-slate-700 text-white' : 'bg-white/[0.06] text-slate-500 hover:bg-white/[0.08]'
 }`}
 >
 Vše
 </button>
 {Object.entries(entityCounts).map(([entity, count]) => (
 <button
 key={entity}
 onClick={() => setFilterEntity(filterEntity === entity ? '' : entity)}
 className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg transition ${
 filterEntity === entity ? getEntityColor(entity) : 'bg-white/[0.06] text-slate-500 hover:bg-white/[0.08]'
 }`}
 >
 {getEntityLabel(entity)} ({count})
 </button>
 ))}
 </div>
 )}
 </div>

 {activeTab === 'rules' && (
 <div className="space-y-3">
 {filteredAutomations.length === 0 && automations.length === 0 && (
 <div className="text-center py-16 bg-navy-800/60 rounded-2xl border border-white/10">
 <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 flex items-center justify-center">
 <Zap className="w-8 h-8 text-amber-400"/>
 </div>
 <div className="text-lg font-extrabold text-slate-300 mb-1">Zatím žádné automatizace</div>
 <div className="text-sm text-slate-400 mb-5 max-w-sm mx-auto">
 Vytvořte první pravidlo. Např.: když se projekt změní na "Dokončeno", automaticky odeslat email klientovi.
 </div>
 <button
 onClick={openCreate}
 className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-extrabold rounded-xl hover:bg-blue-700 transition"
 >
 <Plus className="w-4 h-4"/> Vytvořit automatizaci
 </button>
 </div>
 )}

 {filteredAutomations.length === 0 && automations.length > 0 && (
 <div className="text-center py-10 text-sm text-slate-400 font-extrabold">
 Žádné automatizace pro tento filtr.
 </div>
 )}

 {filteredAutomations.map(auto => (
 <div
 key={auto.id}
 className={`bg-navy-800/60 rounded-xl border-2 transition group ${
 auto.is_active ? 'border-white/10 hover:border-blue-200' : 'border-white/[0.06] opacity-60'
 }`}
 >
 <div className="flex items-start gap-4 p-4">
 <button
 onClick={() => handleToggle(auto.id, auto.is_active)}
 className="mt-0.5 shrink-0"
 title={auto.is_active ? 'Deaktivovat' : 'Aktivovat'}
 >
 {auto.is_active
 ? <ToggleRight className="w-7 h-7 text-emerald-500"/>
 : <ToggleLeft className="w-7 h-7 text-slate-300"/>
 }
 </button>

 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <span className="text-sm font-extrabold text-white">{auto.name}</span>
 <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${getEntityColor(auto.trigger_entity)}`}>
 {getEntityLabel(auto.trigger_entity)}
 </span>
 {!auto.is_active && (
 <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-white/[0.06] text-slate-400">
 Neaktivní
 </span>
 )}
 </div>

 {auto.description && (
 <div className="text-xs text-slate-400 mb-2">{auto.description}</div>
 )}

 <div className="flex flex-wrap items-center gap-1.5 text-xs">
 <span className="font-extrabold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg">
 {buildTriggerSummary(
 auto.trigger_entity, auto.trigger_event, auto.trigger_conditions,
 projectStatuses, taskStatuses
 )}
 </span>
 <ArrowRight className="w-3.5 h-3.5 text-slate-300"/>
 {auto.actions.map((a, i) => (
 <span key={i} className="font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
 {getActionLabel(a.type)}
 </span>
 ))}
 </div>
 </div>

 <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition">
 <button
 onClick={() => handleDuplicate(auto)}
 className="p-2 rounded-lg text-slate-400 hover:text-slate-400 hover:bg-white/[0.06] transition"
 title="Duplikovat"
 >
 <Copy className="w-4 h-4"/>
 </button>
 <button
 onClick={() => openEdit(auto)}
 className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/100/10 transition"
 title="Upravit"
 >
 <Edit2 className="w-4 h-4"/>
 </button>
 <button
 onClick={() => handleDelete(auto.id)}
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

 {activeTab === 'logs' && (
 <div className="space-y-2">
 {logs.length === 0 && (
 <div className="text-center py-16 bg-navy-800/60 rounded-2xl border border-white/10">
 <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.04] flex items-center justify-center">
 <Clock className="w-8 h-8 text-slate-300"/>
 </div>
 <div className="text-lg font-extrabold text-slate-300 mb-1">Zatím žádné záznamy</div>
 <div className="text-sm text-slate-400">
 Zde se zobrazí historie spuštěných automatizací.
 </div>
 </div>
 )}

 {logs.map(log => {
 const auto = automations.find(a => a.id === log.automation_id);
 const isExpanded = expandedLog === log.id;
 return (
 <div
 key={log.id}
 className="bg-navy-800/60 rounded-xl border border-white/[0.08] overflow-hidden"
 >
 <div
 className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.04] transition"
 onClick={() => setExpandedLog(isExpanded ? null : log.id)}
 >
 {log.status === 'success'
 ? <Play className="w-4 h-4 text-emerald-500 shrink-0"/>
 : <AlertCircle className="w-4 h-4 text-red-500 shrink-0"/>
 }
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="text-sm font-extrabold text-slate-300 truncate">
 {auto?.name ?? 'Smazaná automatizace'}
 </span>
 <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${getEntityColor(log.trigger_entity)}`}>
 {getEntityLabel(log.trigger_entity)}
 </span>
 </div>
 <div className="text-[10px] text-slate-400">
 {new Date(log.executed_at).toLocaleString('cs-CZ')}
 </div>
 </div>
 <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${
 log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
 }`}>
 {log.status === 'success' ? 'OK' : 'Chyba'}
 </span>
 <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
 </div>
 {isExpanded && (
 <div className="px-4 pb-3 border-t border-white/[0.06]">
 <pre className="text-[11px] text-slate-500 bg-white/[0.04] rounded-lg p-3 mt-2 overflow-x-auto whitespace-pre-wrap">
 {JSON.stringify(log.details, null, 2)}
 </pre>
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}

 <AutomationFormModal
 open={showForm}
 onClose={() => { setShowForm(false); setEditing(null); }}
 onSave={handleSave}
 initial={editing ? {
 id: editing.id,
 name: editing.name,
 description: editing.description,
 is_active: editing.is_active,
 trigger_entity: editing.trigger_entity,
 trigger_event: editing.trigger_event,
 trigger_conditions: editing.trigger_conditions,
 actions: editing.actions,
 } : null}
 projectStatuses={projectStatuses}
 taskStatuses={taskStatuses}
 teamMembers={teamMembers}
 />
 </div>
 );
}
