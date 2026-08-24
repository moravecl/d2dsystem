import {
 DEFECT_SEVERITIES, DUE_ITEM_TYPES, PRIORITY_OPTIONS,
 getStatusesForEntity,
} from './automationDefinitions';

const selectClass = 'w-full border border-white/10 rounded-xl px-3 py-2 text-sm font-extrabold text-slate-300 bg-white/[0.06] focus:outline-none focus:border-blue-400';
const labelClass = 'block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1';
const inputClass = 'border border-white/10 rounded-xl px-3 py-2 text-sm font-extrabold text-slate-300 bg-white/[0.06] focus:outline-none focus:border-blue-400';

interface Props {
 triggerEntity: string;
 triggerEvent: string;
 conditions: Record<string, unknown>;
 onChange: (key: string, value: unknown) => void;
 projectStatuses: { key: string; label: string }[];
 taskStatuses: { key: string; label: string }[];
 teamMembers: { id: string; display_name: string; email: string }[];
}

export default function AutomationConditionFields({
 triggerEntity, triggerEvent, conditions, onChange,
 projectStatuses, taskStatuses, teamMembers,
}: Props) {
 const statuses = getStatusesForEntity(triggerEntity, projectStatuses, taskStatuses);

 if (triggerEvent === 'status_changed') {
 return (
 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className={labelClass}>Ze stavu (volitelné)</label>
 <select
 value={(conditions.from_status as string) ?? ''}
 onChange={e => onChange('from_status', e.target.value || undefined)}
 className={selectClass}
 >
 <option value="">Libovolný stav</option>
 {statuses.map(s => (
 <option key={s.key} value={s.key}>{s.label}</option>
 ))}
 </select>
 </div>
 <div>
 <label className={labelClass}>Do stavu (volitelné)</label>
 <select
 value={(conditions.to_status as string) ?? ''}
 onChange={e => onChange('to_status', e.target.value || undefined)}
 className={selectClass}
 >
 <option value="">Libovolný stav</option>
 {statuses.map(s => (
 <option key={s.key} value={s.key}>{s.label}</option>
 ))}
 </select>
 </div>
 </div>
 <p className="text-[10px] text-blue-500 font-extrabold">
 Pokud necháte prázdné, spustí se při jakékoliv změně stavu.
 Vyplňte "Do stavu"pro konkrétní cílový stav (např. Dokončeno).
 </p>
 </div>
 );
 }

 if (triggerEvent === 'due_date_approaching' || triggerEvent === 'deadline_approaching' ||
 triggerEvent === 'start_approaching' || triggerEvent === 'end_approaching' ||
 triggerEvent === 'due_soon' || triggerEvent === 'due_item_approaching' ||
 triggerEvent === 'warranty_expiring') {
 return (
 <div className="space-y-3">
 <div>
 <label className={labelClass}>Počet dni před termínem</label>
 <input
 type="number"
 min={1}
 max={90}
 value={(conditions.days_before as number) ?? 3}
 onChange={e => onChange('days_before', parseInt(e.target.value) || 3)}
 className={`w-32 ${inputClass}`}
 />
 </div>
 {triggerEvent === 'due_item_approaching' && (
 <div>
 <label className={labelClass}>Typ položky (volitelné)</label>
 <select
 value={(conditions.due_item_type as string) ?? ''}
 onChange={e => onChange('due_item_type', e.target.value || undefined)}
 className={selectClass}
 >
 <option value="">Všechny typy</option>
 {DUE_ITEM_TYPES.map(t => (
 <option key={t.key} value={t.key}>{t.label}</option>
 ))}
 </select>
 </div>
 )}
 </div>
 );
 }

 if (triggerEvent === 'overdue' || triggerEvent === 'deadline_overdue' || triggerEvent === 'due_item_overdue') {
 return (
 <div className="space-y-3">
 <div>
 <label className={labelClass}>Počet dni po termínu (volitelné, 0 = hned)</label>
 <input
 type="number"
 min={0}
 max={90}
 value={(conditions.days_after as number) ?? 0}
 onChange={e => onChange('days_after', parseInt(e.target.value) || 0)}
 className={`w-32 ${inputClass}`}
 />
 </div>
 {(triggerEvent === 'due_item_overdue') && (
 <div>
 <label className={labelClass}>Typ položky (volitelné)</label>
 <select
 value={(conditions.due_item_type as string) ?? ''}
 onChange={e => onChange('due_item_type', e.target.value || undefined)}
 className={selectClass}
 >
 <option value="">Všechny typy</option>
 {DUE_ITEM_TYPES.map(t => (
 <option key={t.key} value={t.key}>{t.label}</option>
 ))}
 </select>
 </div>
 )}
 </div>
 );
 }

 if (triggerEvent === 'assigned') {
 return (
 <div>
 <label className={labelClass}>Přiřazen komu (volitelné)</label>
 <select
 value={(conditions.assigned_to as string) ?? ''}
 onChange={e => onChange('assigned_to', e.target.value || undefined)}
 className={selectClass}
 >
 <option value="">Komukoliv</option>
 {teamMembers.map(m => (
 <option key={m.id} value={m.id}>{m.display_name || m.email}</option>
 ))}
 </select>
 </div>
 );
 }

 if (triggerEvent === 'priority_changed') {
 return (
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className={labelClass}>Na prioritu (volitelné)</label>
 <select
 value={(conditions.to_priority as string) ?? ''}
 onChange={e => onChange('to_priority', e.target.value || undefined)}
 className={selectClass}
 >
 <option value="">Libovolnou</option>
 {PRIORITY_OPTIONS.map(p => (
 <option key={p.key} value={p.key}>{p.label}</option>
 ))}
 </select>
 </div>
 </div>
 );
 }

 if (triggerEvent === 'severity_critical') {
 return (
 <div>
 <label className={labelClass}>Minimální závažnost</label>
 <select
 value={(conditions.min_severity as string) ?? 'critical'}
 onChange={e => onChange('min_severity', e.target.value)}
 className={selectClass}
 >
 {DEFECT_SEVERITIES.map(s => (
 <option key={s.key} value={s.key}>{s.label}</option>
 ))}
 </select>
 </div>
 );
 }

 if (triggerEvent === 'open_too_long' || triggerEvent === 'no_activity' || triggerEvent === 'approval_pending') {
 const label = triggerEvent === 'no_activity'
 ? 'Pocet dni bez aktivity'
 : triggerEvent === 'approval_pending'
 ? 'Pocet dni cekani na schvaleni'
 : 'Pocet dni od nahlaseni';
 return (
 <div>
 <label className={labelClass}>{label}</label>
 <input
 type="number"
 min={1}
 max={90}
 value={(conditions.days_threshold as number) ?? 7}
 onChange={e => onChange('days_threshold', parseInt(e.target.value) || 7)}
 className={`w-32 ${inputClass}`}
 />
 </div>
 );
 }

 if (triggerEvent === 'amount_threshold') {
 return (
 <div>
 <label className={labelClass}>Částka přesahuje (Kc)</label>
 <input
 type="number"
 min={0}
 value={(conditions.amount as number) ?? 100000}
 onChange={e => onChange('amount', parseInt(e.target.value) || 0)}
 className={`w-48 ${inputClass}`}
 />
 </div>
 );
 }

 if (triggerEvent === 'progress_threshold') {
 return (
 <div>
 <label className={labelClass}>Postup dosáhne (%)</label>
 <input
 type="number"
 min={0}
 max={100}
 value={(conditions.progress as number) ?? 50}
 onChange={e => onChange('progress', parseInt(e.target.value) || 0)}
 className={`w-32 ${inputClass}`}
 />
 </div>
 );
 }

 if (triggerEvent === 'hours_exceeded') {
 return (
 <div>
 <label className={labelClass}>Limit hodin na projektu</label>
 <input
 type="number"
 min={1}
 value={(conditions.hours as number) ?? 100}
 onChange={e => onChange('hours', parseInt(e.target.value) || 100)}
 className={`w-32 ${inputClass}`}
 />
 </div>
 );
 }

 if (triggerEvent === 'cost_overrun') {
 return (
 <div>
 <label className={labelClass}>Překročení rozpočtu o (%)</label>
 <input
 type="number"
 min={1}
 max={200}
 value={(conditions.percent as number) ?? 10}
 onChange={e => onChange('percent', parseInt(e.target.value) || 10)}
 className={`w-32 ${inputClass}`}
 />
 </div>
 );
 }

 if (triggerEvent === 'low_stock') {
 return (
 <p className="text-[10px] text-blue-500 font-extrabold">
 Spustí se když množství na skladě klesne pod nastavené minimum u dane položky.
 </p>
 );
 }

 if (triggerEvent === 'unplanned_material') {
 return (
 <p className="text-[10px] text-blue-500 font-extrabold">
 Spustí se když je na projekt použit materiál, který nebyl v plánu.
 </p>
 );
 }

 if (triggerEvent === 'created_from_portal') {
 return (
 <p className="text-[10px] text-blue-500 font-extrabold">
 Spustí se když klient vytvoří tiket přes klientský portál.
 </p>
 );
 }

 if (triggerEvent === 'paid') {
 return (
 <p className="text-[10px] text-blue-500 font-extrabold">
 Spustí se jakmile je faktura označena jako plne uhrazena.
 </p>
 );
 }

 return null;
}
