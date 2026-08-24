import { PRIORITY_OPTIONS, getStatusesForEntity } from './automationDefinitions';

const selectClass = 'w-full border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 bg-white/[0.06] focus:outline-none focus:border-blue-400';
const labelClass = 'block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1';
const inputClass = 'w-full border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 bg-white/[0.06] focus:outline-none focus:border-blue-400';
const textareaClass = 'w-full border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 bg-white/[0.06] focus:outline-none focus:border-blue-400 resize-none';

interface Props {
 actionType: string;
 config: Record<string, unknown>;
 onConfigChange: (key: string, value: unknown) => void;
 triggerEntity: string;
 projectStatuses: { key: string; label: string }[];
 taskStatuses: { key: string; label: string }[];
 teamMembers: { id: string; display_name: string; email: string }[];
}

export default function AutomationActionConfig({
 actionType, config, onConfigChange,
 triggerEntity, projectStatuses, taskStatuses, teamMembers,
}: Props) {

 switch (actionType) {
 case 'create_task':
 return (
 <div className="space-y-3">
 <div>
 <label className={labelClass}>Název ukolu</label>
 <input
 type="text"
 value={(config.title as string) ?? ''}
 onChange={e => onConfigChange('title', e.target.value)}
 placeholder="Např. Zkontrolovat dokumentaci k projektu {{project_name}}"
 className={inputClass}
 />
 </div>
 <div>
 <label className={labelClass}>Popis úkolu (volitelný)</label>
 <textarea
 value={(config.description as string) ?? ''}
 onChange={e => onConfigChange('description', e.target.value)}
 rows={2}
 placeholder="Podrobnější instrukce..."
 className={textareaClass}
 />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className={labelClass}>Priorita</label>
 <select
 value={(config.priority as string) ?? 'medium'}
 onChange={e => onConfigChange('priority', e.target.value)}
 className={selectClass}
 >
 {PRIORITY_OPTIONS.map(p => (
 <option key={p.key} value={p.key}>{p.label}</option>
 ))}
 </select>
 </div>
 <div>
 <label className={labelClass}>Přiřadit</label>
 <select
 value={(config.assign_to as string) ?? ''}
 onChange={e => onConfigChange('assign_to', e.target.value || undefined)}
 className={selectClass}
 >
 <option value="">Nikomu</option>
 <option value="__trigger_assignee__">Přiřazena osoba (z triggeru)</option>
 <option value="__trigger_creator__">Tvůrce entity</option>
 {teamMembers.map(m => (
 <option key={m.id} value={m.id}>{m.display_name || m.email}</option>
 ))}
 </select>
 </div>
 </div>
 <div>
 <label className={labelClass}>Termín (počet dni od spuštění)</label>
 <input
 type="number"
 min={0}
 max={365}
 value={(config.due_in_days as number) ?? ''}
 onChange={e => onConfigChange('due_in_days', e.target.value ? parseInt(e.target.value) : undefined)}
 placeholder="Např. 7"
 className="w-32 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 bg-white/[0.06] focus:outline-none focus:border-blue-400"
 />
 </div>
 <div className="bg-white/[0.04] rounded-lg p-2">
 <p className="text-[10px] text-slate-400 font-extrabold">
 Proměnné: {'{{project_name}}'}, {'{{client_name}}'}, {'{{entity_name}}'}, {'{{new_status}}'}, {'{{old_status}}'}
 </p>
 </div>
 </div>
 );

 case 'change_status':
 return (
 <div className="space-y-3">
 <div>
 <label className={labelClass}>Cílová entita</label>
 <select
 value={(config.target_entity as string) ?? triggerEntity}
 onChange={e => onConfigChange('target_entity', e.target.value)}
 className={selectClass}
 >
 <option value={triggerEntity}>Stejná entita (trigger)</option>
 {triggerEntity === 'task' && <option value="project">Nadřazený projekt</option>}
 {triggerEntity === 'milestone' && <option value="project">Nadřazený projekt</option>}
 {triggerEntity === 'invoice' && <option value="project">Související projekt</option>}
 {triggerEntity === 'quote' && <option value="project">Související projekt</option>}
 </select>
 </div>
 <div>
 <label className={labelClass}>Nový stav</label>
 <select
 value={(config.new_status as string) ?? ''}
 onChange={e => onConfigChange('new_status', e.target.value)}
 className={selectClass}
 >
 <option value="">-- Vyberte --</option>
 {getStatusesForEntity(
 (config.target_entity as string) ?? triggerEntity,
 projectStatuses, taskStatuses
 ).map(s => (
 <option key={s.key} value={s.key}>{s.label}</option>
 ))}
 </select>
 </div>
 </div>
 );

 case 'send_notification':
 return (
 <div className="space-y-3">
 <div>
 <label className={labelClass}>Text notifikace</label>
 <textarea
 value={(config.message as string) ?? ''}
 onChange={e => onConfigChange('message', e.target.value)}
 rows={2}
 placeholder="Např. Projekt {{project_name}} byl změněn na stav {{new_status}}"
 className={textareaClass}
 />
 </div>
 <div>
 <label className={labelClass}>Komu</label>
 <select
 value={(config.notify_target as string) ?? 'assignee'}
 onChange={e => onConfigChange('notify_target', e.target.value)}
 className={selectClass}
 >
 <option value="assignee">Přiřazena osoba</option>
 <option value="creator">Tvůrce entity</option>
 <option value="project_manager">Odpovědná osoba projektu</option>
 <option value="all_admins">Všichni admini</option>
 <option value="specific">Konkrétní uživatel</option>
 </select>
 </div>
 {(config.notify_target as string) === 'specific' && (
 <div>
 <select
 value={(config.notify_user_id as string) ?? ''}
 onChange={e => onConfigChange('notify_user_id', e.target.value)}
 className={selectClass}
 >
 <option value="">-- Vyberte --</option>
 {teamMembers.map(m => (
 <option key={m.id} value={m.id}>{m.display_name || m.email}</option>
 ))}
 </select>
 </div>
 )}
 <div className="bg-white/[0.04] rounded-lg p-2">
 <p className="text-[10px] text-slate-400 font-extrabold">
 Proměnné: {'{{project_name}}'}, {'{{client_name}}'}, {'{{entity_name}}'}, {'{{new_status}}'}, {'{{old_status}}'}, {'{{assigned_to}}'}, {'{{due_date}}'}
 </p>
 </div>
 </div>
 );

 case 'send_email':
 return (
 <div className="space-y-3">
 <div>
 <label className={labelClass}>Předmět emailu</label>
 <input
 type="text"
 value={(config.subject as string) ?? ''}
 onChange={e => onConfigChange('subject', e.target.value)}
 placeholder="Např. Změna stavu projektu {{project_name}}"
 className={inputClass}
 />
 </div>
 <div>
 <label className={labelClass}>Tělo emailu</label>
 <textarea
 value={(config.body as string) ?? ''}
 onChange={e => onConfigChange('body', e.target.value)}
 rows={4}
 placeholder="Obsah emailu s proměnnými..."
 className={textareaClass}
 />
 </div>
 <div>
 <label className={labelClass}>Příjemce</label>
 <select
 value={(config.email_target as string) ?? 'client'}
 onChange={e => onConfigChange('email_target', e.target.value)}
 className={selectClass}
 >
 <option value="client">Klient projektu</option>
 <option value="assignee">Přiřazena osoba</option>
 <option value="project_manager">Odpovědná osoba projektu</option>
 <option value="all_admins">Všichni admini</option>
 <option value="custom">Vlastní adresa</option>
 </select>
 </div>
 {(config.email_target as string) === 'custom' && (
 <div>
 <label className={labelClass}>Emailová adresa</label>
 <input
 type="email"
 value={(config.custom_email as string) ?? ''}
 onChange={e => onConfigChange('custom_email', e.target.value)}
 placeholder="email@example.com"
 className={inputClass}
 />
 </div>
 )}
 <div className="bg-white/[0.04] rounded-lg p-2">
 <p className="text-[10px] text-slate-400 font-extrabold">
 Proměnné: {'{{project_name}}'}, {'{{client_name}}'}, {'{{entity_name}}'}, {'{{new_status}}'}, {'{{invoice_number}}'}, {'{{total}}'}, {'{{due_date}}'}, {'{{link}}'}
 </p>
 </div>
 </div>
 );

 case 'assign_user':
 return (
 <div className="space-y-3">
 <div>
 <label className={labelClass}>Přiřadit osobu</label>
 <select
 value={(config.user_id as string) ?? ''}
 onChange={e => onConfigChange('user_id', e.target.value)}
 className={selectClass}
 >
 <option value="">-- Vyberte --</option>
 <option value="__trigger_creator__">Tvůrce entity</option>
 {teamMembers.map(m => (
 <option key={m.id} value={m.id}>{m.display_name || m.email}</option>
 ))}
 </select>
 </div>
 </div>
 );

 case 'set_priority':
 return (
 <div>
 <label className={labelClass}>Nová priorita</label>
 <select
 value={(config.priority as string) ?? 'medium'}
 onChange={e => onConfigChange('priority', e.target.value)}
 className={selectClass}
 >
 {PRIORITY_OPTIONS.map(p => (
 <option key={p.key} value={p.key}>{p.label}</option>
 ))}
 </select>
 </div>
 );

 case 'add_note':
 return (
 <div className="space-y-3">
 <div>
 <label className={labelClass}>Text poznámky</label>
 <textarea
 value={(config.note as string) ?? ''}
 onChange={e => onConfigChange('note', e.target.value)}
 rows={2}
 placeholder="Např. Automaticky zapsáno: změna stavu na {{new_status}}"
 className={textareaClass}
 />
 </div>
 <div className="bg-white/[0.04] rounded-lg p-2">
 <p className="text-[10px] text-slate-400 font-extrabold">
 Proměnné: {'{{project_name}}'}, {'{{client_name}}'}, {'{{new_status}}'}, {'{{old_status}}'}, {'{{date}}'}
 </p>
 </div>
 </div>
 );

 case 'create_invoice':
 return (
 <div className="space-y-3">
 <div>
 <label className={labelClass}>Stav nové faktury</label>
 <select
 value={(config.invoice_status as string) ?? 'draft'}
 onChange={e => onConfigChange('invoice_status', e.target.value)}
 className={selectClass}
 >
 <option value="draft">Koncept</option>
 <option value="sent">Odeslána</option>
 </select>
 </div>
 <div>
 <label className={labelClass}>Splatnost (počet dni)</label>
 <input
 type="number"
 min={1}
 max={180}
 value={(config.due_in_days as number) ?? 14}
 onChange={e => onConfigChange('due_in_days', parseInt(e.target.value) || 14)}
 className="w-32 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 bg-white/[0.06] focus:outline-none focus:border-blue-400"
 />
 </div>
 <div>
 <label className={labelClass}>Poznámka k faktuře (volitelná)</label>
 <textarea
 value={(config.note as string) ?? ''}
 onChange={e => onConfigChange('note', e.target.value)}
 rows={2}
 placeholder="Např. Faktura za projekt {{project_name}}"
 className={textareaClass}
 />
 </div>
 </div>
 );

 case 'create_service_schedule':
 return (
 <div className="space-y-3">
 <div>
 <label className={labelClass}>Interval servisu (měsíce)</label>
 <input
 type="number"
 min={1}
 max={60}
 value={(config.interval_months as number) ?? 12}
 onChange={e => onConfigChange('interval_months', parseInt(e.target.value) || 12)}
 className="w-32 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 bg-white/[0.06] focus:outline-none focus:border-blue-400"
 />
 </div>
 <div>
 <label className={labelClass}>Poznámka</label>
 <input
 type="text"
 value={(config.note as string) ?? ''}
 onChange={e => onConfigChange('note', e.target.value)}
 placeholder="Např. Pravidelná roční kontrola"
 className={inputClass}
 />
 </div>
 <p className="text-[10px] text-blue-500 font-extrabold">
 Servisní plán se vytvoří automaticky pro projekt z triggeru.
 </p>
 </div>
 );

 case 'update_field':
 return (
 <div className="space-y-3">
 <div>
 <label className={labelClass}>Název pole</label>
 <input
 type="text"
 value={(config.field_name as string) ?? ''}
 onChange={e => onConfigChange('field_name', e.target.value)}
 placeholder="Např. description, note, phase"
 className={inputClass}
 />
 </div>
 <div>
 <label className={labelClass}>Nová hodnota</label>
 <input
 type="text"
 value={(config.field_value as string) ?? ''}
 onChange={e => onConfigChange('field_value', e.target.value)}
 placeholder="Hodnota k nastavení"
 className={inputClass}
 />
 </div>
 </div>
 );

 case 'webhook':
 return (
 <div className="space-y-3">
 <div>
 <label className={labelClass}>URL</label>
 <input
 type="url"
 value={(config.url as string) ?? ''}
 onChange={e => onConfigChange('url', e.target.value)}
 placeholder="https://..."
 className={inputClass}
 />
 </div>
 <div>
 <label className={labelClass}>HTTP metoda</label>
 <select
 value={(config.method as string) ?? 'POST'}
 onChange={e => onConfigChange('method', e.target.value)}
 className={selectClass}
 >
 <option value="POST">POST</option>
 <option value="GET">GET</option>
 <option value="PUT">PUT</option>
 </select>
 </div>
 <div>
 <label className={labelClass}>Hlavičky (JSON, volitelné)</label>
 <textarea
 value={(config.headers as string) ?? ''}
 onChange={e => onConfigChange('headers', e.target.value)}
 rows={2}
 placeholder='{"Authorization": "Bearer ..."}'
 className={textareaClass}
 />
 </div>
 <div className="bg-white/[0.04] rounded-lg p-2">
 <p className="text-[10px] text-slate-400 font-extrabold">
 Tělo requestu bude obsahovat všechna data o entitě a triggeru jako JSON.
 </p>
 </div>
 </div>
 );

 default:
 return (
 <div className="text-xs text-slate-400 font-extrabold py-2">
 Žádná další konfigurace
 </div>
 );
 }
}
