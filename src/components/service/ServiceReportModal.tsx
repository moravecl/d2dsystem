import { useState, useEffect, useMemo } from 'react';
import { X, Save, Plus, Trash2, Lock, FileText, Clock, Car, Package, Wrench, Calculator, AlertTriangle, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../ui/Toast';

interface ServiceReportModalProps {
  scheduleId: string;
  reportId?: string | null;
  onClose: () => void;
  onSave?: () => void;
}

interface ReportItem {
  id: string;
  item_type: 'work' | 'material' | 'travel' | 'other';
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  purchase_price: number;
  total_price: number;
  worker_id: string | null;
  worker_name: string;
  hours: number;
  hourly_rate: number;
  work_date: string | null;
  sort_order: number;
  isNew?: boolean;
}

interface ReportData {
  id: string;
  schedule_id: string;
  status: string;
  arrival_at: string | null;
  departure_at: string | null;
  work_minutes: number;
  travel_km: number;
  labor_rate: number;
  travel_rate: number;
  labor_total: number;
  travel_total: number;
  materials_total: number;
  other_costs_total: number;
  subtotal: number;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  total_price: number;
  work_description: string;
  findings: string;
  recommendation: string;
  internal_note: string;
  customer_note: string;
  signed_by_customer: string;
  signed_at: string | null;
  locked_at: string | null;
  protocol_stale: boolean;
  billing_stale: boolean;
}

const ITEM_TYPE_LABELS: Record<string, { label: string; icon: typeof Wrench }> = {
  work: { label: 'Práce', icon: Wrench },
  material: { label: 'Materiál', icon: Package },
  travel: { label: 'Doprava', icon: Car },
  other: { label: 'Ostatní', icon: FileText },
};

export default function ServiceReportModal({ scheduleId, reportId, onClose, onSave }: ServiceReportModalProps) {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [items, setItems] = useState<ReportItem[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);

  const [arrivalAt, setArrivalAt] = useState('');
  const [departureAt, setDepartureAt] = useState('');
  const [travelKm, setTravelKm] = useState(0);
  const [laborRate, setLaborRate] = useState(500);
  const [travelRate, setTravelRate] = useState(12);
  const [workDescription, setWorkDescription] = useState('');
  const [findings, setFindings] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [discountType, setDiscountType] = useState('none');
  const [discountValue, setDiscountValue] = useState(0);

  const isLocked = !!report?.locked_at;

  useEffect(() => {
    loadData();
  }, [scheduleId, reportId]);

  const loadData = async () => {
    setLoading(true);

    const { data: emps } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('is_portal_client', false)
      .order('display_name');
    setEmployees((emps || []).map((e: any) => ({ id: e.id, name: e.display_name })));

    if (reportId) {
      const { data: rep } = await supabase
        .from('service_reports')
        .select('*')
        .eq('id', reportId)
        .maybeSingle();

      if (rep) {
        setReport(rep);
        setArrivalAt(rep.arrival_at ? rep.arrival_at.slice(0, 16) : '');
        setDepartureAt(rep.departure_at ? rep.departure_at.slice(0, 16) : '');
        setTravelKm(rep.travel_km);
        setLaborRate(rep.labor_rate);
        setTravelRate(rep.travel_rate);
        setWorkDescription(rep.work_description);
        setFindings(rep.findings);
        setRecommendation(rep.recommendation);
        setInternalNote(rep.internal_note);
        setCustomerNote(rep.customer_note);
        setDiscountType(rep.discount_type);
        setDiscountValue(rep.discount_value);

        const { data: itemsData } = await supabase
          .from('service_report_items')
          .select('*')
          .eq('report_id', reportId)
          .order('sort_order');
        setItems((itemsData || []).map((i: any) => ({ ...i, isNew: false })));
      }
    } else {
      setReport(null);
      setItems([]);
    }

    setLoading(false);
  };

  const addItem = (type: 'work' | 'material' | 'travel' | 'other') => {
    const newItem: ReportItem = {
      id: crypto.randomUUID(),
      item_type: type,
      description: '',
      quantity: 1,
      unit: type === 'work' ? 'hod' : type === 'travel' ? 'km' : 'ks',
      unit_price: type === 'work' ? laborRate : type === 'travel' ? travelRate : 0,
      purchase_price: 0,
      total_price: 0,
      worker_id: null,
      worker_name: '',
      hours: type === 'work' ? 1 : 0,
      hourly_rate: type === 'work' ? laborRate : 0,
      work_date: new Date().toISOString().slice(0, 10),
      sort_order: items.length,
      isNew: true,
    };
    setItems([...items, newItem]);
  };

  const updateItem = (id: string, updates: Partial<ReportItem>) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, ...updates };
      if (updated.item_type === 'work') {
        updated.total_price = updated.hours * updated.hourly_rate;
      } else {
        updated.total_price = updated.quantity * updated.unit_price;
      }
      return updated;
    }));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const totals = useMemo(() => {
    const workItems = items.filter(i => i.item_type === 'work');
    const materialItems = items.filter(i => i.item_type === 'material');
    const travelItems = items.filter(i => i.item_type === 'travel');
    const otherItems = items.filter(i => i.item_type === 'other');

    const laborTotal = workItems.reduce((s, i) => s + i.total_price, 0);
    const materialsTotal = materialItems.reduce((s, i) => s + i.total_price, 0);
    const travelTotal = travelItems.reduce((s, i) => s + i.total_price, 0) + (travelKm * travelRate);
    const otherTotal = otherItems.reduce((s, i) => s + i.total_price, 0);
    const subtotal = laborTotal + materialsTotal + travelTotal + otherTotal;

    let discountAmount = 0;
    if (discountType === 'percent') {
      discountAmount = subtotal * (discountValue / 100);
    } else if (discountType === 'fixed') {
      discountAmount = discountValue;
    }

    const totalPrice = Math.max(0, subtotal - discountAmount);
    const workMinutes = workItems.reduce((s, i) => s + (i.hours * 60), 0);

    return { laborTotal, materialsTotal, travelTotal, otherTotal, subtotal, discountAmount, totalPrice, workMinutes };
  }, [items, travelKm, travelRate, discountType, discountValue]);

  const handleSave = async (lock = false) => {
    if (!user || !organization?.id) return;
    setSaving(true);

    try {
      const reportData = {
        schedule_id: scheduleId,
        org_id: organization.id,
        status: lock ? 'locked' : 'draft',
        arrival_at: arrivalAt ? new Date(arrivalAt).toISOString() : null,
        departure_at: departureAt ? new Date(departureAt).toISOString() : null,
        work_minutes: Math.round(totals.workMinutes),
        travel_km: travelKm,
        labor_rate: laborRate,
        travel_rate: travelRate,
        labor_total: totals.laborTotal,
        travel_total: totals.travelTotal,
        materials_total: totals.materialsTotal,
        other_costs_total: totals.otherTotal,
        subtotal: totals.subtotal,
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: totals.discountAmount,
        total_price: totals.totalPrice,
        work_description: workDescription,
        findings,
        recommendation,
        internal_note: internalNote,
        customer_note: customerNote,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
        locked_at: lock ? new Date().toISOString() : null,
      };

      let savedReportId = reportId;

      if (report) {
        const { error } = await supabase
          .from('service_reports')
          .update(reportData)
          .eq('id', report.id);
        if (error) throw error;
        savedReportId = report.id;
      } else {
        const { data, error } = await supabase
          .from('service_reports')
          .insert({ ...reportData, created_by: user.id })
          .select('id')
          .single();
        if (error) throw error;
        savedReportId = data.id;
      }

      await supabase
        .from('service_report_items')
        .delete()
        .eq('report_id', savedReportId);

      if (items.length > 0) {
        const itemsToInsert = items.map((item, idx) => ({
          report_id: savedReportId,
          item_type: item.item_type,
          description: item.description || '',
          quantity: item.quantity || 0,
          unit: item.unit || 'ks',
          unit_price: item.unit_price || 0,
          purchase_price: item.purchase_price || 0,
          total_price: item.total_price || 0,
          worker_id: item.worker_id || null,
          worker_name: item.worker_name || '',
          hours: item.hours || 0,
          hourly_rate: item.hourly_rate || 0,
          work_date: item.work_date || null,
          sort_order: idx,
        }));

        const { error: itemsError } = await supabase
          .from('service_report_items')
          .insert(itemsToInsert);

        if (itemsError) {
          console.error('Error saving items:', itemsError);
          throw itemsError;
        }
      }

      const newStatus = lock ? 'report_completed' : 'awaiting_report';
      await supabase
        .from('service_schedules')
        .update({ workflow_status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', scheduleId);

      toast(lock ? 'Výkaz uzamčen' : 'Výkaz uložen', 'success');
      onSave?.();
      onClose();
    } catch (err: any) {
      toast(err.message || 'Chyba při ukládání', 'error');
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-navy-800 rounded-2xl p-8">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] px-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-navy-800 rounded-2xl shadow-2xl w-full max-w-4xl mb-8 animate-modal-enter">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {report ? 'Upravit výkaz' : 'Nový výkaz'}
              </h2>
              {isLocked && (
                <div className="flex items-center gap-1 text-xs text-amber-400">
                  <Lock className="w-3 h-3" />
                  Výkaz je uzamčen
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {(report?.protocol_stale || report?.billing_stale) && (
          <div className="mx-6 mt-4 p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-300">
              {report?.protocol_stale && 'Protokol je neaktuální - výkaz byl změněn.'}
              {report?.protocol_stale && report?.billing_stale && ' '}
              {report?.billing_stale && 'Fakturační podklad je neaktuální.'}
            </div>
          </div>
        )}

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Příjezd</label>
              <input
                type="datetime-local"
                value={arrivalAt}
                onChange={(e) => setArrivalAt(e.target.value)}
                disabled={isLocked}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Odjezd</label>
              <input
                type="datetime-local"
                value={departureAt}
                onChange={(e) => setDepartureAt(e.target.value)}
                disabled={isLocked}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Km (doprava)</label>
              <input
                type="number"
                value={travelKm}
                onChange={(e) => setTravelKm(parseFloat(e.target.value) || 0)}
                disabled={isLocked}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Sazba práce (Kč/hod)</label>
              <input
                type="number"
                value={laborRate}
                onChange={(e) => setLaborRate(parseFloat(e.target.value) || 0)}
                disabled={isLocked}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Sazba km (Kč/km)</label>
              <input
                type="number"
                value={travelRate}
                onChange={(e) => setTravelRate(parseFloat(e.target.value) || 0)}
                disabled={isLocked}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-white">Položky výkazu</label>
              {!isLocked && (
                <div className="flex gap-2">
                  {Object.entries(ITEM_TYPE_LABELS).map(([key, { label, icon: Icon }]) => (
                    <button
                      key={key}
                      onClick={() => addItem(key as any)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
                    >
                      <Plus className="w-3 h-3" />
                      <Icon className="w-3 h-3" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {items.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500">
                  Žádné položky. Přidejte práci, materiál nebo dopravu.
                </div>
              ) : (
                items.map((item) => {
                  const { icon: Icon, label } = ITEM_TYPE_LABELS[item.item_type];
                  return (
                    <div key={item.id} className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="flex-1 grid grid-cols-6 gap-2">
                          <div className="col-span-2">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItem(item.id, { description: e.target.value })}
                              placeholder="Popis..."
                              disabled={isLocked}
                              className="w-full px-2 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none disabled:opacity-50"
                            />
                          </div>
                          {item.item_type === 'work' ? (
                            <>
                              <div>
                                <input
                                  type="number"
                                  value={item.hours}
                                  onChange={(e) => updateItem(item.id, { hours: parseFloat(e.target.value) || 0 })}
                                  placeholder="Hodiny"
                                  disabled={isLocked}
                                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none disabled:opacity-50"
                                />
                                <span className="text-[10px] text-slate-500">hod</span>
                              </div>
                              <div>
                                <input
                                  type="number"
                                  value={item.hourly_rate}
                                  onChange={(e) => updateItem(item.id, { hourly_rate: parseFloat(e.target.value) || 0 })}
                                  placeholder="Sazba"
                                  disabled={isLocked}
                                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none disabled:opacity-50"
                                />
                                <span className="text-[10px] text-slate-500">Kč/hod</span>
                              </div>
                              <div>
                                <select
                                  value={item.worker_id || ''}
                                  onChange={(e) => {
                                    const emp = employees.find(em => em.id === e.target.value);
                                    updateItem(item.id, { worker_id: e.target.value || null, worker_name: emp?.name || '' });
                                  }}
                                  disabled={isLocked}
                                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none disabled:opacity-50"
                                >
                                  <option value="">Technik</option>
                                  {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                  ))}
                                </select>
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                                  placeholder="Množství"
                                  disabled={isLocked}
                                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none disabled:opacity-50"
                                />
                              </div>
                              <div>
                                <input
                                  type="text"
                                  value={item.unit}
                                  onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                                  placeholder="Jednotka"
                                  disabled={isLocked}
                                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none disabled:opacity-50"
                                />
                              </div>
                              <div>
                                <input
                                  type="number"
                                  value={item.unit_price}
                                  onChange={(e) => updateItem(item.id, { unit_price: parseFloat(e.target.value) || 0 })}
                                  placeholder="Cena/ks"
                                  disabled={isLocked}
                                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none disabled:opacity-50"
                                />
                                <span className="text-[10px] text-slate-500">Kč</span>
                              </div>
                            </>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-emerald-400">
                              {item.total_price.toLocaleString('cs-CZ')} Kč
                            </span>
                            {!isLocked && (
                              <button
                                onClick={() => removeItem(item.id)}
                                className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Popis provedených prací</label>
              <textarea
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                rows={3}
                disabled={isLocked}
                placeholder="Co bylo provedeno..."
                className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Zjištění</label>
              <textarea
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
                rows={3}
                disabled={isLocked}
                placeholder="Co bylo zjištěno..."
                className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Doporučení</label>
              <textarea
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                rows={2}
                disabled={isLocked}
                placeholder="Doporučení pro zákazníka..."
                className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Poznámka pro zákazníka</label>
              <textarea
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                rows={2}
                disabled={isLocked}
                placeholder="Viditelná poznámka pro zákazníka..."
                className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Interní poznámka (neviditelná pro zákazníka)</label>
            <textarea
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              rows={2}
              disabled={isLocked}
              placeholder="Interní poznámky..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Typ slevy</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                disabled={isLocked}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none disabled:opacity-50"
              >
                <option value="none">Žádná sleva</option>
                <option value="percent">Procenta</option>
                <option value="fixed">Pevná částka</option>
              </select>
            </div>
            {discountType !== 'none' && (
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">
                  {discountType === 'percent' ? 'Sleva (%)' : 'Sleva (Kč)'}
                </label>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  disabled={isLocked}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none disabled:opacity-50"
                />
              </div>
            )}
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-400">Souhrn</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Práce:</span>
                <span className="text-white font-semibold">{totals.laborTotal.toLocaleString('cs-CZ')} Kč</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Materiál:</span>
                <span className="text-white font-semibold">{totals.materialsTotal.toLocaleString('cs-CZ')} Kč</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Doprava ({travelKm} km):</span>
                <span className="text-white font-semibold">{totals.travelTotal.toLocaleString('cs-CZ')} Kč</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ostatní:</span>
                <span className="text-white font-semibold">{totals.otherTotal.toLocaleString('cs-CZ')} Kč</span>
              </div>
              <div className="col-span-2 border-t border-emerald-500/30 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Mezisoučet:</span>
                  <span className="text-white font-semibold">{totals.subtotal.toLocaleString('cs-CZ')} Kč</span>
                </div>
                {totals.discountAmount > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Sleva:</span>
                    <span className="font-semibold">-{totals.discountAmount.toLocaleString('cs-CZ')} Kč</span>
                  </div>
                )}
                <div className="flex justify-between text-lg mt-1">
                  <span className="text-emerald-400 font-bold">Celkem:</span>
                  <span className="text-emerald-400 font-bold">{totals.totalPrice.toLocaleString('cs-CZ')} Kč</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition"
          >
            Zavřít
          </button>
          {!isLocked && (
            <div className="flex gap-3">
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Uložit koncept
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                Uzamknout výkaz
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
