import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Users, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Employee {
  id: string;
  name: string;
  position: string;
}

export interface WorkerEntry {
  id?: string;
  name: string;
  type: 'employee' | 'temp';
}

interface Props {
  value: WorkerEntry[];
  onChange: (workers: WorkerEntry[]) => void;
}

export default function WorkerPicker({ value, onChange }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [tempName, setTempName] = useState('');
  const [search, setSearch] = useState('');

  const loadEmployees = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .eq('is_employee', true)
      .order('display_name');
    const empData = (data || []).map((p: any) => ({
      id: p.id,
      name: p.display_name || p.email || 'Unnamed',
      position: '',
    }));
    setEmployees(empData);
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const addEmployee = (emp: Employee) => {
    if (value.some(w => w.id === emp.id)) return;
    onChange([...value, { id: emp.id, name: emp.name, type: 'employee' }]);
    setShowDropdown(false);
    setSearch('');
  };

  const addTemp = () => {
    if (!tempName.trim()) return;
    onChange([...value, { name: tempName.trim(), type: 'temp' }]);
    setTempName('');
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const selectedIds = new Set(value.filter(w => w.id).map(w => w.id));
  const filtered = employees
    .filter(e => !selectedIds.has(e.id))
    .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-slate-400">{`Pracovníci`}</label>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((w, i) => (
            <span
              key={`${w.name}-${i}`}
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg ${
                w.type === 'employee'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-200'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-200'
              }`}
            >
              {w.type === 'employee' ? <Users className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
              {w.name}
              <button onClick={() => remove(i)} className="ml-0.5 hover:text-red-500 transition">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-full px-3 py-2 rounded-xl border border-white/10 text-xs text-left text-slate-400 hover:border-blue-300 transition flex items-center gap-2"
        >
          <Users className="w-3.5 h-3.5 text-slate-400" />
          {`Vybrat zaměstnance\u2026`}
        </button>

        {showDropdown && (
          <div className="absolute z-20 mt-1 w-full bg-navy-800/60 rounded-xl border border-white/[0.08] shadow-lg max-h-48 overflow-hidden">
            <div className="p-2 border-b border-white/[0.06]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Hledat\u2026`}
                className="w-full px-2.5 py-1.5 rounded-lg border border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                autoFocus
              />
            </div>
            <div className="max-h-32 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">{`Žádní zaměstnanci`}</p>
              ) : (
                filtered.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => addEmployee(emp)}
                    className="w-full px-3 py-2 text-left hover:bg-blue-500/10 transition flex items-center gap-2"
                  >
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <div>
                      <span className="text-xs font-semibold text-white">{emp.name}</span>
                      {emp.position && (
                        <span className="text-[10px] text-slate-400 ml-1.5">{emp.position}</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          placeholder={`Jméno brigádníka\u2026`}
          className="flex-1 px-3 py-2 rounded-xl border border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          onKeyDown={(e) => e.key === 'Enter' && addTemp()}
        />
        <button
          type="button"
          onClick={addTemp}
          disabled={!tempName.trim()}
          className="px-3 py-2 rounded-xl border border-amber-200 bg-amber-500/10 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition disabled:opacity-40 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> {`Přidat`}
        </button>
      </div>
    </div>
  );
}
