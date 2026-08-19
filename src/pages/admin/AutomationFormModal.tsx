import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import AutomationConditionFields from './AutomationConditionFields';
import AutomationActionConfig from './AutomationActionConfig';
import {
 TRIGGER_ENTITIES, TRIGGER_EVENTS, ACTION_TYPES, EMPTY_RULE,
 type AutomationRule, type AutomationAction,
} from './automationDefinitions';

export type { AutomationRule, AutomationAction };
export { TRIGGER_ENTITIES, TRIGGER_EVENTS, ACTION_TYPES };

interface Props {
 open: boolean;
 onClose: () => void;
 onSave: (rule: AutomationRule) => void;
 initial?: AutomationRule | null;
 projectStatuses: { key: string; label: string }[];
 taskStatuses: { key: string; label: string }[];
 teamMembers: { id: string; display_name: string; email: string }[];
}

export default function AutomationFormModal({
 open, onClose, onSave, initial,
 projectStatuses, taskStatuses, teamMembers,
}: Props) {
 const [rule, setRule] = useState<AutomationRule>(EMPTY_RULE);
 const [expandedAction, setExpandedAction] = useState<number | null>(null);

 useEffect(() => {
 if (open) {
 setRule(initial ?? { ...EMPTY_RULE });
 setExpandedAction(null);
 }
 }, [open, initial]);

 const update = (patch: Partial<AutomationRule>) => setRule(prev => ({ ...prev, ...patch }));

 const updateCondition = (key: string, value: unknown) => {
 setRule(prev => ({ ...prev, trigger_conditions: { ...prev.trigger_conditions, [key]: value } }));
 };

 const addAction = () => {
 const newAction: AutomationAction = { type: 'create_task', config: {} };
 const next = [...rule.actions, newAction];
 setRule(prev => ({ ...prev, actions: next }));
 setExpandedAction(next.length - 1);
 };

 const removeAction = (idx: number) => {
 setRule(prev => ({ ...prev, actions: prev.actions.filter((_, i) => i !== idx) }));
 setExpandedAction(null);
 };

 const updateAction = (idx: number, patch: Partial<AutomationAction>) => {
 setRule(prev => ({
 ...prev,
 actions: prev.actions.map((a, i) => i === idx ? { ...a, ...patch } : a),
 }));
 };

 const updateActionConfig = (idx: number, key: string, value: unknown) => {
 setRule(prev => ({
 ...prev,
 actions: prev.actions.map((a, i) =>
 i === idx ? { ...a, config: { ...a.config, [key]: value } } : a
 ),
 }));
 };

 const events = TRIGGER_EVENTS[rule.trigger_entity] ?? [];
 const selectedEvent = events.find(e => e.value === rule.trigger_event);

 const handleSave = () => {
 if (!rule.name.trim()) return;
 if (rule.actions.length === 0) return;
 onSave(rule);
 };

 const isValid = rule.name.trim().length > 0 && rule.actions.length > 0;

 return (
 <Modal
 open={open}
 onClose={onClose}
 title={initial ? 'Upravit automatizaci' : 'Nova automatizace'}
 size="lg"
 >
 <div className="space-y-5 max-h-[70vh] overflow-y-auto px-1">
 <div>
 <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Nazev automatizace</label>
 <input
 type="text"
 value={rule.name}
 onChange={e => update({ name: e.target.value })}
 placeholder="Napr. Pri dokonceni projektu odeslat email klientovi"
 className="w-full border border-white/10 rounded-xl px-3 py-2.5 text-sm font-extrabold text-slate-300 bg-white/[0.06] focus:outline-none focus:border-blue-400"
 />
 </div>

 <div>
 <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Popis (volitelny)</label>
 <textarea
 value={rule.description}
 onChange={e => update({ description: e.target.value })}
 rows={2}
 placeholder="Co tato automatizace dela?"
 className="w-full border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 bg-white/[0.06] focus:outline-none focus:border-blue-400 resize-none"
 />
 </div>

 <div className="bg-blue-500/10 border-2 border-blue-200 rounded-xl p-4 space-y-3">
 <div className="text-[10px] font-extrabold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
 <span className="w-5 h-5 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-extrabold">1</span>
 Kdyz... (Trigger)
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Entita</label>
 <select
 value={rule.trigger_entity}
 onChange={e => update({
 trigger_entity: e.target.value,
 trigger_event: (TRIGGER_EVENTS[e.target.value] ?? [])[0]?.value ?? 'created',
 trigger_conditions: {},
 })}
 className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm font-extrabold text-slate-300 bg-white/[0.06] focus:outline-none focus:border-blue-400"
 >
 {TRIGGER_ENTITIES.map(e => (
 <option key={e.value} value={e.value}>{e.label}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Udalost</label>
 <select
 value={rule.trigger_event}
 onChange={e => update({ trigger_event: e.target.value, trigger_conditions: {} })}
 className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm font-extrabold text-slate-300 bg-white/[0.06] focus:outline-none focus:border-blue-400"
 >
 {events.map(e => (
 <option key={e.value} value={e.value}>{e.label}</option>
 ))}
 </select>
 </div>
 </div>

 {selectedEvent?.description && (
 <p className="text-[10px] text-blue-500 font-extrabold">{selectedEvent.description}</p>
 )}

 <AutomationConditionFields
 triggerEntity={rule.trigger_entity}
 triggerEvent={rule.trigger_event}
 conditions={rule.trigger_conditions}
 onChange={updateCondition}
 projectStatuses={projectStatuses}
 taskStatuses={taskStatuses}
 teamMembers={teamMembers}
 />
 </div>

 <div className="bg-emerald-500/10 border-2 border-emerald-200 rounded-xl p-4 space-y-3">
 <div className="flex items-center justify-between">
 <div className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
 <span className="w-5 h-5 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-extrabold">2</span>
 Pak proved... (Akce)
 </div>
 <button
 onClick={addAction}
 className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-400 hover:text-emerald-700 bg-emerald-500/20 hover:bg-emerald-200 px-2 py-1 rounded-lg transition"
 >
 <Plus className="w-3 h-3"/> Pridat akci
 </button>
 </div>

 {rule.actions.length === 0 && (
 <div className="text-center py-6 text-xs font-extrabold text-emerald-400">
 Zatim zadne akce. Kliknete "Pridat akci".
 </div>
 )}

 <div className="space-y-2">
 {rule.actions.map((action, idx) => {
 const isExpanded = expandedAction === idx;
 return (
 <div key={idx} className="bg-navy-800/60 rounded-xl border border-emerald-200 overflow-hidden">
 <div
 className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-emerald-500/10/50 transition"
 onClick={() => setExpandedAction(isExpanded ? null : idx)}
 >
 <span className="w-5 h-5 rounded-md bg-emerald-500/20 flex items-center justify-center text-[10px] font-extrabold text-emerald-400 shrink-0">
 {idx + 1}
 </span>
 <select
 value={action.type}
 onClick={e => e.stopPropagation()}
 onChange={e => { updateAction(idx, { type: e.target.value, config: {} }); setExpandedAction(idx); }}
 className="flex-1 text-sm font-extrabold text-slate-300 bg-transparent border-0 focus:outline-none cursor-pointer"
 >
 {ACTION_TYPES.map(a => (
 <option key={a.value} value={a.value}>{a.label}</option>
 ))}
 </select>
 <button
 onClick={e => { e.stopPropagation(); removeAction(idx); }}
 className="p-1 rounded-lg text-red-400 hover:text-red-400 hover:bg-red-500/100/10 transition"
 >
 <Trash2 className="w-3.5 h-3.5"/>
 </button>
 <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
 </div>
 {isExpanded && (
 <div className="px-3 pb-3 pt-1 border-t border-emerald-500/20">
 <AutomationActionConfig
 actionType={action.type}
 config={action.config}
 onConfigChange={(key, value) => updateActionConfig(idx, key, value)}
 triggerEntity={rule.trigger_entity}
 projectStatuses={projectStatuses}
 taskStatuses={taskStatuses}
 teamMembers={teamMembers}
 />
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 </div>

 <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/[0.06]">
 <label className="flex items-center gap-2 cursor-pointer select-none">
 <input
 type="checkbox"
 checked={rule.is_active}
 onChange={e => update({ is_active: e.target.checked })}
 className="rounded border-slate-300 text-blue-400 focus:ring-blue-400"
 />
 <span className="text-xs font-extrabold text-slate-400">Aktivni</span>
 </label>
 <div className="flex items-center gap-2">
 <button
 onClick={onClose}
 className="px-4 py-2 text-sm font-extrabold text-slate-400 hover:bg-white/[0.06] rounded-xl transition"
 >
 Zrušit
 </button>
 <button
 onClick={handleSave}
 disabled={!isValid}
 className="px-5 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {initial ? 'Uložit změny' : 'Vytvořit automatizaci'}
 </button>
 </div>
 </div>
 </Modal>
 );
}
