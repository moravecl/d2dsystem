import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Clock, Package, CheckCircle2, ChevronDown, User,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import type { QuickJob } from './quickJobTypes';
import { MATERIAL_UNITS } from './quickJobTypes';

interface WorkRow {
  key: string;
  worker_name: string;
  worker_id: string | null;
  hours: string;
  hourly_rate: string;
  description: string;
  work_date: string;
}

interface MaterialRow {
  key: string;
  material_name: string;
  product_id: string | null;
  unit: string;
  quantity: string;
  unit_price: string;
  purchase_price: string;
}

interface EmployeeOption {
  id: string;
  user_id: string;
  name: string;
  hourly_rate: number;
}

interface ProductOption {
  id: string;
  name: string;
  code: string;
  price: number;
  purchase_price: number;
}

interface Props {
  open: boolean;
  job: QuickJob;
  onClose: () => void;
  onCompleted: () => void;
}

const inputCls = 'w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/30';

const today = () => new Date().toISOString().slice(0, 10);

function makeWorkRow(): WorkRow {
  return { key: crypto.randomUUID(), worker_name: '', worker_id: null, hours: '', hourly_rate: '', description: '', work_date: today() };
}

function makeMaterialRow(): MaterialRow {
  return { key: crypto.randomUUID(), material_name: '', product_id: null, unit: 'ks', quantity: '', unit_price: '', purchase_price: '' };
}

export default function QuickJobCompletionModal({ open, job, onClose, onCompleted }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [workRows, setWorkRows] = useState<WorkRow[]>([makeWorkRow()]);
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [activeProductRow, setActiveProductRow] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'work' | 'material'>('work');
  const [openEmpDropdown, setOpenEmpDropdown] = useState<number | null>(null);
  const [empSearch, setEmpSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setCompletionNotes('');
    setWorkRows([makeWorkRow()]);
    setMaterialRows([]);
    setActiveTab('work');

    (async () => {
      const { data } = await supabase.from('employees').select('id, user_id, name, hourly_rate').eq('is_active', true).order('name');
      setEmployees((data || []) as EmployeeOption[]);
    })();
  }, [open]);

  useEffect(() => {
    if (productSearch.length < 2) { setProductResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('products').select('id, name, code, price, purchase_price')
        .or(`name.ilike.%${productSearch}%,code.ilike.%${productSearch}%`)
        .limit(8);
      setProductResults((data || []) as ProductOption[]);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const updateWork = (idx: number, field: keyof WorkRow, value: string) => {
    setWorkRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const selectEmployee = (idx: number, emp: EmployeeOption) => {
    setWorkRows(prev => prev.map((r, i) => i === idx ? {
      ...r,
      worker_name: emp.name,
      worker_id: emp.user_id,
      hourly_rate: String(emp.hourly_rate || ''),
    } : r));
  };

  const removeWork = (idx: number) => {
    setWorkRows(prev => prev.filter((_, i) => i !== idx));
  };

  const updateMaterial = (idx: number, field: keyof MaterialRow, value: string) => {
    setMaterialRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const selectProduct = (idx: number, prod: ProductOption) => {
    setMaterialRows(prev => prev.map((r, i) => i === idx ? {
      ...r,
      material_name: prod.name,
      product_id: prod.id,
      unit_price: String(prod.price || ''),
      purchase_price: String(prod.purchase_price || ''),
    } : r));
    setProductSearch('');
    setProductResults([]);
    setActiveProductRow(null);
  };

  const removeMaterial = (idx: number) => {
    setMaterialRows(prev => prev.filter((_, i) => i !== idx));
  };

  const totalWorkHours = workRows.reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
  const totalWorkCost = workRows.reduce((s, r) => s + (parseFloat(r.hours) || 0) * (parseFloat(r.hourly_rate) || 0), 0);
  const totalMaterialCost = materialRows.reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.unit_price) || 0), 0);
  const totalMaterialPurchase = materialRows.reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.purchase_price) || 0), 0);

  const handleSubmit = async () => {
    const validWork = workRows.filter(r => r.worker_name.trim() && parseFloat(r.hours) > 0);
    if (validWork.length === 0) {
      toast('Vyplnte alespon jednoho pracovnika a hodiny', 'error');
      return;
    }

    setSaving(true);

    const workInserts = validWork.map(r => ({
      quick_job_id: job.id,
      worker_name: r.worker_name.trim(),
      worker_id: r.worker_id,
      hours: parseFloat(r.hours) || 0,
      hourly_rate: parseFloat(r.hourly_rate) || 0,
      description: r.description,
      work_date: r.work_date || today(),
    }));

    const validMaterials = materialRows.filter(r => r.material_name.trim() && parseFloat(r.quantity) > 0);
    const materialInserts = validMaterials.map(r => ({
      quick_job_id: job.id,
      material_name: r.material_name.trim(),
      product_id: r.product_id,
      unit: r.unit,
      quantity: parseFloat(r.quantity) || 0,
      unit_price: parseFloat(r.unit_price) || 0,
      purchase_price: parseFloat(r.purchase_price) || 0,
    }));

    const { error: workError } = await supabase.from('quick_job_work_entries').insert(workInserts);
    if (workError) {
      toast('Chyba pri ukladani pracovnich zaznamu', 'error');
      setSaving(false);
      return;
    }

    if (materialInserts.length > 0) {
      const { error: matError } = await supabase.from('quick_job_material_entries').insert(materialInserts);
      if (matError) {
        toast('Chyba pri ukladani materialu', 'error');
        setSaving(false);
        return;
      }
    }

    const calcTotalWork = workInserts.reduce((s, r) => s + r.hours, 0);
    const calcTotalWorkCost = workInserts.reduce((s, r) => s + r.hours * r.hourly_rate, 0);
    const calcTotalMat = materialInserts.reduce((s, r) => s + r.quantity * r.unit_price, 0);

    await supabase.from('quick_jobs').update({
      status: 'done',
      completed_at: new Date().toISOString(),
      completion_notes: completionNotes,
      billing_status: 'ready',
      total_work_hours: calcTotalWork,
      total_work_cost: calcTotalWorkCost,
      total_material_cost: calcTotalMat,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id);

    await syncToAttendanceOrProject(validWork, workInserts);

    toast('Zakazka dokoncena s vykazem prace');
    setSaving(false);
    onCompleted();
  };

  const syncToAttendanceOrProject = async (
    rows: WorkRow[],
    inserts: { quick_job_id: string; worker_name: string; worker_id: string | null; hours: number; hourly_rate: number; description: string; work_date: string }[]
  ) => {
    if (job.project_id) {
      const timeEntries = inserts.map(w => ({
        project_id: job.project_id!,
        task_id: null,
        worker_name: w.worker_name,
        description: w.description || `Rychla zakazka: ${job.title}`,
        hours: w.hours,
        date: w.work_date,
        recorded_by: user?.id,
      }));
      await supabase.from('execution_time_entries').insert(timeEntries);

      await supabase.from('quick_job_work_entries')
        .update({ synced_to_project: true })
        .eq('quick_job_id', job.id);
    }

    for (const w of inserts) {
      if (!w.worker_id) continue;
      const startHour = 8;
      const totalMinutes = Math.round(w.hours * 60);
      const endMinutes = startHour * 60 + totalMinutes;
      const startTime = `${String(startHour).padStart(2, '0')}:00`;
      const endH = Math.floor(endMinutes / 60);
      const endM = endMinutes % 60;
      const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

      await supabase.from('attendance_records').insert({
        employee_id: w.worker_id,
        date: w.work_date,
        start_time: startTime,
        end_time: endTime,
        break_minutes: 0,
        activity_type: 'Rychla zakazka',
        project_id: job.project_id,
        notes: `${job.title}${w.description ? ' - ' + w.description : ''}`,
      });
    }

    await supabase.from('quick_job_work_entries')
      .update({ synced_to_attendance: true })
      .eq('quick_job_id', job.id)
      .not('worker_id', 'is', null);
  };

  return (
    <Modal open={open} onClose={onClose} title="Dokonceni zakazky s vykazem" size="xl" footer={
      <>
        <div className="flex-1 text-left">
          <div className="text-xs text-slate-400">
            <span className="font-bold text-white">{totalWorkHours}h</span> prace
            {totalWorkCost > 0 && <span className="ml-2 font-bold text-blue-400">{totalWorkCost.toLocaleString('cs-CZ')} Kc</span>}
            {totalMaterialCost > 0 && <span className="ml-2 font-bold text-amber-400">+ {totalMaterialCost.toLocaleString('cs-CZ')} Kc material</span>}
          </div>
        </div>
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrusit</button>
        <button onClick={handleSubmit} disabled={saving} className="px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 rounded-xl shadow-sm shadow-emerald-500/20 transition disabled:opacity-50 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {saving ? 'Ukladam...' : 'Dokoncit zakazku'}
        </button>
      </>
    }>
      <div className="space-y-5">
        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20">
          <div className="text-sm font-bold text-white">{job.title}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {job.client_name && <span>{job.client_name}</span>}
            {job.address && <span className="ml-2">| {job.address}</span>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznamky k dokonceni</label>
          <textarea value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} rows={2} placeholder="Co bylo provedeno..." className={`${inputCls} resize-none`} />
        </div>

        <div className="flex gap-1 bg-white/[0.04] rounded-lg p-0.5">
          <button onClick={() => setActiveTab('work')} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition ${activeTab === 'work' ? 'bg-white/[0.08] text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
            <Clock className="w-3.5 h-3.5" /> Vykaz prace ({workRows.length})
          </button>
          <button onClick={() => setActiveTab('material')} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition ${activeTab === 'material' ? 'bg-white/[0.08] text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
            <Package className="w-3.5 h-3.5" /> Material ({materialRows.length})
          </button>
        </div>

        {activeTab === 'work' && (
          <div className="space-y-3">
            {workRows.map((row, idx) => (
              <div key={row.key} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pracovnik {idx + 1}</span>
                  {workRows.length > 1 && (
                    <button onClick={() => removeWork(idx)} className="p-1 rounded hover:bg-red-500/15 text-slate-500 hover:text-red-400 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative col-span-2 sm:col-span-1">
                    {row.worker_id ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-sm font-medium text-blue-300 flex-1 truncate">{row.worker_name}</span>
                        <button onClick={() => { updateWork(idx, 'worker_name', ''); setWorkRows(prev => prev.map((r, i) => i === idx ? { ...r, worker_id: null, hourly_rate: '' } : r)); }} className="p-0.5 rounded hover:bg-white/10 text-slate-400">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => { setOpenEmpDropdown(openEmpDropdown === idx ? null : idx); setEmpSearch(''); }}
                          className={`${inputCls} text-left flex items-center justify-between gap-2`}
                        >
                          <span className={row.worker_name ? 'text-white' : 'text-slate-500'}>{row.worker_name || 'Vybrat zamestance...'}</span>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </button>
                        {openEmpDropdown === idx && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-navy-800 rounded-xl border border-white/10 shadow-xl max-h-52 overflow-hidden">
                            <div className="p-2 border-b border-white/[0.06]">
                              <input
                                autoFocus
                                value={empSearch}
                                onChange={e => setEmpSearch(e.target.value)}
                                placeholder="Hledat..."
                                className="w-full px-2 py-1.5 text-xs rounded-lg bg-white/[0.06] border border-white/10 text-white placeholder:text-slate-500 outline-none"
                              />
                            </div>
                            <div className="max-h-40 overflow-y-auto">
                              {employees.filter(e => !empSearch || e.name.toLowerCase().includes(empSearch.toLowerCase())).map(emp => (
                                <button
                                  key={emp.id}
                                  onClick={() => { selectEmployee(idx, emp); setOpenEmpDropdown(null); setEmpSearch(''); }}
                                  className="w-full text-left px-3 py-2 hover:bg-white/[0.06] transition flex items-center justify-between"
                                >
                                  <div>
                                    <div className="text-sm font-medium text-white">{emp.name}</div>
                                  </div>
                                  {emp.hourly_rate > 0 && <span className="text-[10px] text-slate-400">{emp.hourly_rate} Kc/h</span>}
                                </button>
                              ))}
                              {employees.filter(e => !empSearch || e.name.toLowerCase().includes(empSearch.toLowerCase())).length === 0 && (
                                <div className="px-3 py-3 text-xs text-slate-500 text-center">Zadny zamestnanec</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <input type="date" value={row.work_date} onChange={e => updateWork(idx, 'work_date', e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Hodiny *</label>
                    <input type="number" min="0" step="0.5" value={row.hours} onChange={e => updateWork(idx, 'hours', e.target.value)} placeholder="0" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Sazba/hod</label>
                    <input type="number" min="0" value={row.hourly_rate} onChange={e => updateWork(idx, 'hourly_rate', e.target.value)} placeholder="0" className={inputCls} />
                  </div>
                  <div className="flex items-end">
                    <div className="text-sm font-bold text-blue-400 pb-2">
                      {((parseFloat(row.hours) || 0) * (parseFloat(row.hourly_rate) || 0)).toLocaleString('cs-CZ')} Kc
                    </div>
                  </div>
                </div>
                <input value={row.description} onChange={e => updateWork(idx, 'description', e.target.value)} placeholder="Popis prace..." className={inputCls} />
              </div>
            ))}
            <button onClick={() => setWorkRows(prev => [...prev, makeWorkRow()])} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-white/10 text-xs font-bold text-slate-400 hover:border-blue-500/30 hover:text-blue-400 transition">
              <Plus className="w-3.5 h-3.5" /> Pridat pracovnika
            </button>
          </div>
        )}

        {activeTab === 'material' && (
          <div className="space-y-3">
            {materialRows.length === 0 && (
              <div className="text-center py-6">
                <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Zadny material</p>
              </div>
            )}
            {materialRows.map((row, idx) => (
              <div key={row.key} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Polozka {idx + 1}</span>
                  <button onClick={() => removeMaterial(idx)} className="p-1 rounded hover:bg-red-500/15 text-slate-500 hover:text-red-400 transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="relative">
                  <input
                    value={row.material_name}
                    onChange={e => {
                      updateMaterial(idx, 'material_name', e.target.value);
                      if (e.target.value.length >= 2) {
                        setProductSearch(e.target.value);
                        setActiveProductRow(idx);
                      } else {
                        setProductResults([]);
                        setActiveProductRow(null);
                      }
                    }}
                    placeholder="Nazev materialu nebo hledat v katalogu..."
                    className={inputCls}
                  />
                  {activeProductRow === idx && productResults.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-navy-800 rounded-xl border border-white/10 shadow-xl max-h-40 overflow-y-auto">
                      {productResults.map(p => (
                        <button key={p.id} onClick={() => selectProduct(idx, p)} className="w-full text-left px-3 py-2 hover:bg-white/[0.06] transition">
                          <div className="text-sm font-medium text-white">{p.name}</div>
                          <div className="text-[11px] text-slate-400">{p.code} | {p.price} Kc</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Mn.</label>
                    <input type="number" min="0" step="0.5" value={row.quantity} onChange={e => updateMaterial(idx, 'quantity', e.target.value)} placeholder="0" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Jedn.</label>
                    <select value={row.unit} onChange={e => updateMaterial(idx, 'unit', e.target.value)} className={`${inputCls} bg-white/[0.06]`}>
                      {MATERIAL_UNITS.map(u => <option key={u} value={u} className="bg-navy-800">{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Prod. cena</label>
                    <input type="number" min="0" value={row.unit_price} onChange={e => updateMaterial(idx, 'unit_price', e.target.value)} placeholder="0" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Nakup. cena</label>
                    <input type="number" min="0" value={row.purchase_price} onChange={e => updateMaterial(idx, 'purchase_price', e.target.value)} placeholder="0" className={inputCls} />
                  </div>
                  <div className="flex items-end">
                    <div className="text-sm font-bold text-amber-400 pb-2">
                      {((parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0)).toLocaleString('cs-CZ')} Kc
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setMaterialRows(prev => [...prev, makeMaterialRow()])} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-white/10 text-xs font-bold text-slate-400 hover:border-amber-500/30 hover:text-amber-400 transition">
              <Plus className="w-3.5 h-3.5" /> Pridat material
            </button>
          </div>
        )}

        {(totalWorkCost > 0 || totalMaterialCost > 0) && (
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20">
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2">Souhrn</div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-slate-400">Prace</div>
                <div className="font-bold text-white">{totalWorkCost.toLocaleString('cs-CZ')} Kc</div>
              </div>
              <div>
                <div className="text-slate-400">Material (prodejni)</div>
                <div className="font-bold text-white">{totalMaterialCost.toLocaleString('cs-CZ')} Kc</div>
              </div>
              <div>
                <div className="text-slate-400">Celkem</div>
                <div className="font-extrabold text-emerald-400">{(totalWorkCost + totalMaterialCost).toLocaleString('cs-CZ')} Kc</div>
              </div>
            </div>
            {totalMaterialPurchase > 0 && (
              <div className="text-[10px] text-slate-500 mt-1.5">
                Nakupni cena materialu: {totalMaterialPurchase.toLocaleString('cs-CZ')} Kc | Marze: {(totalMaterialCost - totalMaterialPurchase).toLocaleString('cs-CZ')} Kc
              </div>
            )}
            {job.project_id && (
              <div className="text-[10px] text-blue-400 mt-1.5 font-semibold">
                Hodiny budou propsany do nadrazeneho projektu a dochazky
              </div>
            )}
            {!job.project_id && (
              <div className="text-[10px] text-cyan-400 mt-1.5 font-semibold">
                Hodiny budou propsany do dochazky
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
