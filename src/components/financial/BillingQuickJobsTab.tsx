import { useState, useEffect } from 'react';
import {
  Zap, User, Package, Clock, CheckCircle2, DollarSign, Eye, MapPin, Wrench,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCZK } from '../../lib/invoiceUtils';

interface BillingQuickJob {
  id: string;
  title: string;
  client_name: string;
  client_id: string | null;
  project_id: string | null;
  address: string;
  completed_at: string;
  billing_status: string;
  total_work_hours: number;
  total_work_cost: number;
  total_material_cost: number;
}

interface BillingServiceSchedule {
  id: string;
  type_name: string;
  client_name: string;
  client_address: string;
  project_id: string | null;
  project_name: string;
  last_completed_date: string | null;
  agreed_price: number | null;
  final_price: number | null;
  billing_status: string;
}

interface ProjectRef { id: string; project_name: string; }

interface WorkEntry {
  id: string;
  worker_name: string;
  hours: number;
  hourly_rate: number;
  description: string;
  work_date: string;
}

interface MaterialEntry {
  id: string;
  material_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  purchase_price: number;
}

interface Props {
  jobs: BillingQuickJob[];
  services?: BillingServiceSchedule[];
  projects: ProjectRef[];
  onMarkInvoiced: (jobId: string) => void;
  onCreateInvoice: (jobId: string) => void;
  onMarkServiceInvoiced?: (serviceId: string) => void;
  onCreateServiceInvoice?: (serviceId: string) => void;
}

export default function BillingQuickJobsTab({ jobs, services = [], projects, onMarkInvoiced, onCreateInvoice, onMarkServiceInvoiced, onCreateServiceInvoice }: Props) {
  const [billingFilter, setBillingFilter] = useState<'ready' | 'invoiced' | 'all'>('ready');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedType, setExpandedType] = useState<'job' | 'service' | null>(null);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [materialEntries, setMaterialEntries] = useState<MaterialEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const filtered = jobs.filter(j => billingFilter === 'all' || j.billing_status === billingFilter);
  const filteredServices = services.filter(s => {
    if (billingFilter === 'ready') return s.billing_status === 'ready_for_invoicing';
    if (billingFilter === 'invoiced') return s.billing_status === 'invoiced';
    return true;
  });

  const readyJobsTotal = jobs.filter(j => j.billing_status === 'ready').reduce((s, j) => s + Number(j.total_work_cost) + Number(j.total_material_cost), 0);
  const readyServicesTotal = services.filter(s => s.billing_status === 'ready_for_invoicing').reduce((s, svc) => s + (svc.final_price ?? svc.agreed_price ?? 0), 0);
  const readyTotal = readyJobsTotal + readyServicesTotal;
  const readyJobsCount = jobs.filter(j => j.billing_status === 'ready').length;
  const readyServicesCount = services.filter(s => s.billing_status === 'ready_for_invoicing').length;
  const readyCount = readyJobsCount + readyServicesCount;

  const getProjectName = (id: string | null) => {
    if (!id) return '';
    return projects.find(p => p.id === id)?.project_name || '';
  };

  useEffect(() => {
    if (!expandedId) { setWorkEntries([]); setMaterialEntries([]); return; }
    setDetailLoading(true);
    (async () => {
      if (expandedType === 'job') {
        const [wRes, mRes] = await Promise.all([
          supabase.from('quick_job_work_entries').select('id, worker_name, hours, hourly_rate, description, work_date').eq('quick_job_id', expandedId).order('work_date'),
          supabase.from('quick_job_material_entries').select('id, material_name, unit, quantity, unit_price, purchase_price').eq('quick_job_id', expandedId).order('created_at'),
        ]);
        setWorkEntries((wRes.data || []) as WorkEntry[]);
        setMaterialEntries((mRes.data || []) as MaterialEntry[]);
      } else if (expandedType === 'service') {
        const { data: reportData } = await supabase
          .from('service_reports')
          .select('id')
          .eq('schedule_id', expandedId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (reportData?.id) {
          const { data: itemsData } = await supabase
            .from('service_report_items')
            .select('id, item_type, description, quantity, unit, unit_price, purchase_price, total_price, worker_name, hours, hourly_rate, work_date')
            .eq('report_id', reportData.id)
            .order('sort_order');

          const workItems = (itemsData || [])
            .filter((i: any) => i.item_type === 'work')
            .map((i: any) => ({
              id: i.id,
              worker_name: i.worker_name || 'Technik',
              hours: i.hours || 0,
              hourly_rate: i.hourly_rate || 0,
              description: i.description || '',
              work_date: i.work_date || new Date().toISOString().slice(0, 10),
            }));

          const matItems = (itemsData || [])
            .filter((i: any) => i.item_type !== 'work')
            .map((i: any) => ({
              id: i.id,
              material_name: i.description || (i.item_type === 'travel' ? 'Doprava' : 'Ostatni'),
              unit: i.unit || 'ks',
              quantity: i.quantity || 0,
              unit_price: i.unit_price || 0,
              purchase_price: i.purchase_price || 0,
            }));

          setWorkEntries(workItems);
          setMaterialEntries(matItems);
        } else {
          setWorkEntries([]);
          setMaterialEntries([]);
        }
      }
      setDetailLoading(false);
    })();
  }, [expandedId, expandedType]);

  return (
    <>
      {readyCount > 0 && (
        <div className="border-b border-white/[0.07] px-5 py-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/20">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-white">{readyCount} {readyCount === 1 ? 'zakázka' : readyCount < 5 ? 'zakázky' : 'zakázek'} k fakturaci</div>
              <div className="text-xs text-amber-300 font-semibold">{formatCZK(readyTotal)} Kč celkem</div>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-white/[0.07] px-5 py-2.5 flex gap-2">
        {([
          { key: 'ready' as const, label: 'K fakturaci', count: readyCount },
          { key: 'invoiced' as const, label: 'Vyfakturováno', count: jobs.filter(j => j.billing_status === 'invoiced').length + services.filter(s => s.billing_status === 'invoiced').length },
          { key: 'all' as const, label: 'Vše', count: jobs.length + services.length },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setBillingFilter(t.key)}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
              billingFilter === t.key
                ? 'bg-amber-600 text-white'
                : 'bg-white/[0.07] text-slate-400 hover:bg-white/[0.12]'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="p-5">
        {filtered.length === 0 && filteredServices.length === 0 ? (
          <div className="text-center py-12">
            <Zap className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">
              {billingFilter === 'ready' ? 'Žádné položky k fakturaci' : 'Žádné položky'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(job => {
              const total = Number(job.total_work_cost) + Number(job.total_material_cost);
              const isReady = job.billing_status === 'ready';
              const isExpanded = expandedId === job.id && expandedType === 'job';

              return (
                <div key={job.id} className={`rounded-xl border transition ${isReady ? 'border-amber-500/20 bg-amber-500/[0.03]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/[0.03] transition"
                    onClick={() => { setExpandedId(isExpanded ? null : job.id); setExpandedType(isExpanded ? null : 'job'); }}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isReady ? 'bg-amber-500/15' : 'bg-emerald-500/10'}`}>
                      {isReady ? <Zap className="w-5 h-5 text-amber-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{job.title}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isReady ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                          {isReady ? 'K fakturaci' : 'Vyfakturováno'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        {job.client_name && <span>{job.client_name}</span>}
                        {job.project_id && <span>| {getProjectName(job.project_id)}</span>}
                        {job.completed_at && <span>| {new Date(job.completed_at).toLocaleDateString('cs-CZ')}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-extrabold text-white tabular-nums">{formatCZK(total)} Kc</div>
                      <div className="text-[10px] text-slate-500">
                        {Number(job.total_work_hours)}h práce
                      </div>
                    </div>
                    <Eye className={`w-4 h-4 shrink-0 transition ${isExpanded ? 'text-blue-400' : 'text-slate-500'}`} />
                  </div>

                  {isExpanded && (
                    <div className="border-t border-white/[0.06] px-4 py-3 space-y-3">
                      {detailLoading ? (
                        <div className="flex justify-center py-4">
                          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <>
                          {job.address && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <MapPin className="w-3 h-3" /> {job.address}
                            </div>
                          )}

                          {workEntries.length > 0 && (
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Práce
                              </div>
                              <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.06]">
                                {workEntries.map(w => (
                                  <div key={w.id} className="flex items-center gap-2 px-3 py-2">
                                    <User className="w-3 h-3 text-blue-400 shrink-0" />
                                    <span className="text-xs font-semibold text-white flex-1">{w.worker_name}</span>
                                    <span className="text-[10px] text-slate-500">{new Date(w.work_date).toLocaleDateString('cs-CZ')}</span>
                                    <span className="text-xs font-bold text-white">{w.hours}h</span>
                                    {w.hourly_rate > 0 && (
                                      <span className="text-xs font-bold text-blue-400">{(w.hours * w.hourly_rate).toLocaleString('cs-CZ')} Kč</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {materialEntries.length > 0 && (
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <Package className="w-3 h-3" /> Materiál
                              </div>
                              <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.06]">
                                {materialEntries.map(m => (
                                  <div key={m.id} className="flex items-center gap-2 px-3 py-2">
                                    <Package className="w-3 h-3 text-amber-400 shrink-0" />
                                    <span className="text-xs font-semibold text-white flex-1">{m.material_name}</span>
                                    <span className="text-[10px] text-slate-500">{m.quantity} {m.unit}</span>
                                    <span className="text-xs font-bold text-amber-400">{(m.quantity * m.unit_price).toLocaleString('cs-CZ')} Kč</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                            <div className="text-xs text-slate-400">
                              Práce: <span className="font-bold text-blue-400">{formatCZK(Number(job.total_work_cost))} Kč</span>
                              {Number(job.total_material_cost) > 0 && (
                                <> | Materiál: <span className="font-bold text-amber-400">{formatCZK(Number(job.total_material_cost))} Kč</span></>
                              )}
                            </div>
                          </div>

                          {isReady && (
                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); onCreateInvoice(job.id); }}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl shadow-sm shadow-blue-500/20 transition"
                              >
                                <DollarSign className="w-3.5 h-3.5" /> Vytvořit fakturu
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); onMarkInvoiced(job.id); }}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Označit jako vyfakturováno
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredServices.map(svc => {
              const price = svc.final_price ?? svc.agreed_price ?? 0;
              const isReady = svc.billing_status === 'ready_for_invoicing';
              const isExpanded = expandedId === svc.id && expandedType === 'service';

              return (
                <div key={`svc-${svc.id}`} className={`rounded-xl border transition ${isReady ? 'border-cyan-500/20 bg-cyan-500/[0.03]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/[0.03] transition"
                    onClick={() => { setExpandedId(isExpanded ? null : svc.id); setExpandedType(isExpanded ? null : 'service'); }}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isReady ? 'bg-cyan-500/15' : 'bg-emerald-500/10'}`}>
                      {isReady ? <Wrench className="w-5 h-5 text-cyan-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{svc.type_name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">Servis</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isReady ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                          {isReady ? 'K fakturaci' : 'Vyfakturováno'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        {svc.client_name && <span>{svc.client_name}</span>}
                        {svc.project_name && <span>| {svc.project_name}</span>}
                        {svc.last_completed_date && <span>| {new Date(svc.last_completed_date).toLocaleDateString('cs-CZ')}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-extrabold text-white tabular-nums">{formatCZK(price)} Kc</div>
                      {svc.agreed_price != null && svc.final_price != null && svc.agreed_price !== svc.final_price && (
                        <div className="text-[10px] text-slate-500">
                          Dohodnuto: {formatCZK(svc.agreed_price)} Kč
                        </div>
                      )}
                    </div>
                    <Eye className={`w-4 h-4 shrink-0 transition ${isExpanded ? 'text-blue-400' : 'text-slate-500'}`} />
                  </div>

                  {isExpanded && (
                    <div className="border-t border-white/[0.06] px-4 py-3 space-y-3">
                      {detailLoading ? (
                        <div className="flex justify-center py-4">
                          <div className="w-6 h-6 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <>
                          {svc.client_address && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <MapPin className="w-3 h-3" /> {svc.client_address}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                            {svc.agreed_price != null && (
                              <div>
                                <div className="text-[10px] text-slate-500 mb-0.5">Dohodnutá cena</div>
                                <div className="text-sm font-bold text-white">{formatCZK(svc.agreed_price)} Kč</div>
                              </div>
                            )}
                            {svc.final_price != null && (
                              <div>
                                <div className="text-[10px] text-slate-500 mb-0.5">Konečná cena</div>
                                <div className="text-sm font-bold text-cyan-400">{formatCZK(svc.final_price)} Kč</div>
                              </div>
                            )}
                          </div>

                          {workEntries.length > 0 && (
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Práce
                              </div>
                              <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.06]">
                                {workEntries.map(w => (
                                  <div key={w.id} className="flex items-center gap-2 px-3 py-2">
                                    <User className="w-3 h-3 text-cyan-400 shrink-0" />
                                    <span className="text-xs font-semibold text-white flex-1">{w.worker_name}</span>
                                    <span className="text-[10px] text-slate-500">{new Date(w.work_date).toLocaleDateString('cs-CZ')}</span>
                                    <span className="text-xs font-bold text-white">{w.hours}h</span>
                                    {w.hourly_rate > 0 && (
                                      <span className="text-xs font-bold text-cyan-400">{(w.hours * w.hourly_rate).toLocaleString('cs-CZ')} Kč</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {materialEntries.length > 0 && (
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <Package className="w-3 h-3" /> Materiál
                              </div>
                              <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.06]">
                                {materialEntries.map(m => (
                                  <div key={m.id} className="flex items-center gap-2 px-3 py-2">
                                    <Package className="w-3 h-3 text-amber-400 shrink-0" />
                                    <span className="text-xs font-semibold text-white flex-1">{m.material_name}</span>
                                    <span className="text-[10px] text-slate-500">{m.quantity} {m.unit}</span>
                                    <span className="text-xs font-bold text-amber-400">{(m.quantity * m.unit_price).toLocaleString('cs-CZ')} Kč</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {(workEntries.length > 0 || materialEntries.length > 0) && (
                            <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                              <div className="text-xs text-slate-400">
                                {workEntries.length > 0 && (
                                  <>Práce: <span className="font-bold text-cyan-400">{formatCZK(workEntries.reduce((s, w) => s + w.hours * w.hourly_rate, 0))} Kč</span></>
                                )}
                                {workEntries.length > 0 && materialEntries.length > 0 && ' | '}
                                {materialEntries.length > 0 && (
                                  <>Materiál: <span className="font-bold text-amber-400">{formatCZK(materialEntries.reduce((s, m) => s + m.quantity * m.unit_price, 0))} Kč</span></>
                                )}
                              </div>
                            </div>
                          )}

                          {isReady && onMarkServiceInvoiced && (
                        <div className="flex gap-2 pt-2">
                          {onCreateServiceInvoice && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onCreateServiceInvoice(svc.id); }}
                              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl shadow-sm shadow-blue-500/20 transition"
                            >
                              <DollarSign className="w-3.5 h-3.5" /> Vytvořit fakturu
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); onMarkServiceInvoiced(svc.id); }}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Označit jako vyfakturováno
                          </button>
                        </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex items-center justify-between pt-3 border-t border-white/[0.07] mt-2">
              <span className="text-xs font-semibold text-slate-500">
                K fakturaci: <span className="text-amber-400">{formatCZK(readyTotal)} Kč</span>
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Položek: {filtered.length + filteredServices.length}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
