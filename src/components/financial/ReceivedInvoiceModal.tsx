import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Package, ChevronDown, ChevronUp, Paperclip, Upload, FileText, Image as ImageIcon, X, ExternalLink } from 'lucide-react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';

interface ProjectRef { id: string; project_name: string; }
interface WarehouseItemRef { id: string; name: string; unit: string; quantity: number; }
interface SupplierRef {
  id: string;
  name: string;
  default_due_days: number;
}

interface InvoiceItemForm {
  id?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  vat_rate: number;
  project_id: string;
  warehouse_item_id: string;
  create_receipt: boolean;
  note: string;
}

export interface ReceivedInvoice {
  id: string;
  supplier_name: string;
  supplier_id: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  paid_date?: string;
  paid_amount?: number;
  total_amount: number;
  tax_amount: number;
  status: string;
  project_id: string | null;
  note: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface InvoiceAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  invoice: ReceivedInvoice | null;
  onSaved: () => void;
}

const EMPTY_ITEM: InvoiceItemForm = {
  description: '', quantity: 1, unit: 'ks', unit_price: 0,
  total_price: 0, vat_rate: 21, project_id: '', warehouse_item_id: '',
  create_receipt: false, note: '',
};

const VAT_OPTIONS = [
  { value: 0, label: '0 %' },
  { value: 12, label: '12 %' },
  { value: 21, label: '21 %' },
];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function ReceivedInvoiceModal({ open, onClose, invoice, onSaved }: Props) {
  const { user, profile: authProfile } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItemRef[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRef[]>([]);
  const [saving, setSaving] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(true);
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(true);
  const [attachments, setAttachments] = useState<InvoiceAttachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    supplier_id: '', supplier_name: '', invoice_number: '', invoice_date: '',
    due_date: '', total_amount: 0, tax_amount: 0,
    status: 'draft', project_id: '', note: '', payment_method: 'bank_transfer',
  });

  const [items, setItems] = useState<InvoiceItemForm[]>([]);

  const loadRefs = useCallback(async () => {
    const [projRes, whRes, supRes] = await Promise.all([
      supabase.from('projects').select('id, project_name').neq('status', 'cancelled'),
      supabase.from('warehouse_items').select('id, name, unit, quantity').eq('is_active', true).order('name'),
      supabase.from('suppliers').select('id, name, default_due_days').eq('is_active', true).order('name'),
    ]);
    setProjects((projRes.data || []) as ProjectRef[]);
    setWarehouseItems((whRes.data || []) as WarehouseItemRef[]);
    setSuppliers((supRes.data || []) as SupplierRef[]);
  }, []);

  const loadAttachments = useCallback(async (invoiceId: string) => {
    const { data } = await supabase
      .from('received_invoice_attachments')
      .select('*')
      .eq('received_invoice_id', invoiceId)
      .order('created_at');
    if (data) setAttachments(data as InvoiceAttachment[]);
  }, []);

  const loadItems = useCallback(async (invoiceId: string) => {
    const { data } = await supabase
      .from('received_invoice_items')
      .select('*')
      .eq('received_invoice_id', invoiceId)
      .order('created_at');
    if (data) {
      setItems(data.map((d: Record<string, unknown>) => ({
        id: d.id as string,
        description: (d.description as string) || '',
        quantity: (d.quantity as number) || 1,
        unit: (d.unit as string) || 'ks',
        unit_price: (d.unit_price as number) || 0,
        total_price: (d.total_price as number) || 0,
        vat_rate: (d.vat_rate as number) ?? 21,
        project_id: (d.project_id as string) || '',
        warehouse_item_id: (d.warehouse_item_id as string) || '',
        create_receipt: (d.create_receipt as boolean) || false,
        note: (d.note as string) || '',
      })));
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    loadRefs();
    if (invoice) {
      setForm({
        supplier_id: invoice.supplier_id || '',
        supplier_name: invoice.supplier_name,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        total_amount: invoice.total_amount,
        tax_amount: invoice.tax_amount,
        status: invoice.status,
        project_id: invoice.project_id || '',
        note: invoice.note,
        payment_method: 'bank_transfer',
      });
      loadItems(invoice.id);
      loadAttachments(invoice.id);
    } else {
      const today = new Date().toISOString().split('T')[0];
      setForm({
        supplier_id: '', supplier_name: '', invoice_number: '', invoice_date: today,
        due_date: addDays(today, 14), total_amount: 0, tax_amount: 0,
        status: 'draft', project_id: '', note: '', payment_method: 'bank_transfer',
      });
      setItems([]);
      setAttachments([]);
    }
  }, [open, invoice, loadRefs, loadItems, loadAttachments]);

  const handleSupplierChange = (supplierId: string) => {
    const sup = suppliers.find(s => s.id === supplierId);
    if (sup) {
      const invoiceDate = form.invoice_date || new Date().toISOString().split('T')[0];
      setForm(prev => ({
        ...prev,
        supplier_id: sup.id,
        supplier_name: sup.name,
        due_date: addDays(invoiceDate, sup.default_due_days),
      }));
    } else {
      setForm(prev => ({ ...prev, supplier_id: '', supplier_name: '' }));
    }
  };

  const handleInvoiceDateChange = (date: string) => {
    const sup = suppliers.find(s => s.id === form.supplier_id);
    setForm(prev => ({
      ...prev,
      invoice_date: date,
      ...(sup ? { due_date: addDays(date, sup.default_due_days) } : {}),
    }));
  };

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);

  const updateItem = (idx: number, patch: Partial<InvoiceItemForm>) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, ...patch };
      if ('quantity' in patch || 'unit_price' in patch) {
        updated.total_price = updated.quantity * updated.unit_price;
      }
      return updated;
    }));
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const recalcTotals = () => {
    const base = items.reduce((s, it) => s + it.total_price, 0);
    const tax = items.reduce((s, it) => s + (it.total_price * it.vat_rate / 100), 0);
    setForm(prev => ({ ...prev, total_amount: base + tax, tax_amount: tax }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !invoice) return;
    setUploadingFile(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `received-invoices/${invoice.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('uploads').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
      const { error: insertError } = await supabase.from('received_invoice_attachments').insert({
        received_invoice_id: invoice.id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user?.id,
      });
      if (insertError) throw insertError;
      toast('Soubor nahrán');
      await loadAttachments(invoice.id);
    } catch {
      toast('Chyba při nahrávání', 'error');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteAttachment = async (att: InvoiceAttachment) => {
    if (!confirm(`Smazat přílohu ${att.file_name}?`)) return;
    const pathMatch = att.file_url.match(/uploads\/(.+)$/);
    if (pathMatch) {
      await supabase.storage.from('uploads').remove([decodeURIComponent(pathMatch[1])]);
    }
    await supabase.from('received_invoice_attachments').delete().eq('id', att.id);
    toast('Příloha smazána');
    if (invoice) await loadAttachments(invoice.id);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSave = async () => {
    if (!form.supplier_name.trim() && !form.invoice_number.trim()) return;
    setSaving(true);

    try {
      let invoiceId = invoice?.id;

      const payload = {
        supplier_id: form.supplier_id || null,
        supplier_name: form.supplier_name,
        invoice_number: form.invoice_number,
        invoice_date: form.invoice_date || new Date().toISOString().split('T')[0],
        due_date: form.due_date || new Date().toISOString().split('T')[0],
        total_amount: form.total_amount,
        tax_amount: form.tax_amount,
        status: form.status,
        project_id: form.project_id || null,
        note: form.note,
      };

      if (invoice) {
        const { error } = await supabase
          .from('received_invoices')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', invoice.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('received_invoices')
          .insert({ ...payload, created_by: user!.id })
          .select('id')
          .maybeSingle();
        if (error) throw error;
        invoiceId = data?.id;
      }

      if (!invoiceId) throw new Error('No invoice ID');

      if (invoice) {
        const existingIds = items.filter(it => it.id).map(it => it.id!);
        if (existingIds.length > 0) {
          await supabase
            .from('received_invoice_items')
            .delete()
            .eq('received_invoice_id', invoice.id)
            .not('id', 'in', `(${existingIds.join(',')})`);
        } else {
          await supabase
            .from('received_invoice_items')
            .delete()
            .eq('received_invoice_id', invoice.id);
        }
      }

      const itemsToUpsert = items.map(it => ({
        ...(it.id ? { id: it.id } : {}),
        received_invoice_id: invoiceId!,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        total_price: it.total_price,
        vat_rate: it.vat_rate,
        project_id: it.project_id || null,
        warehouse_item_id: it.warehouse_item_id || null,
        create_receipt: it.create_receipt,
        note: it.note,
      }));

      if (itemsToUpsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('received_invoice_items')
          .upsert(itemsToUpsert);
        if (itemsError) throw itemsError;
      }

      const receiptItems = items.filter(it => it.create_receipt && it.warehouse_item_id);
      if (receiptItems.length > 0) {
        const transactions = receiptItems.map(it => ({
          item_id: it.warehouse_item_id,
          project_id: it.project_id || form.project_id || null,
          type: 'in',
          quantity: it.quantity,
          note: `Příjemka z faktury ${form.invoice_number} - ${it.description}`,
          created_by: user!.id,
        }));
        const { error: txError } = await supabase
          .from('warehouse_transactions')
          .insert(transactions);
        if (txError) throw txError;

        for (const it of receiptItems) {
          const wh = warehouseItems.find(w => w.id === it.warehouse_item_id);
          if (wh) {
            await supabase
              .from('warehouse_items')
              .update({
                quantity: wh.quantity + it.quantity,
                updated_at: new Date().toISOString(),
              })
              .eq('id', wh.id);
          }
        }

        toast(`Vytvořeno ${receiptItems.length} skladových příjemek`);
      }

      if (form.status === 'paid' && form.payment_method === 'cash' && invoiceId) {
        const prevStatus = invoice?.status;
        if (prevStatus !== 'paid') {
          await supabase.from('cash_transactions').insert({
            transaction_type: 'expense',
            amount: form.total_amount,
            description: `Přijatá faktura ${form.invoice_number} – ${form.supplier_name || 'platba hotově'}`,
            note: form.note,
            source: 'received_invoice_payment',
            reference_id: invoiceId,
            performed_by: user?.id || null,
            performed_by_name: authProfile?.display_name || '',
            transaction_date: new Date().toISOString().split('T')[0],
            created_by: user!.id,
          });
        }
      }

      toast(invoice ? 'Faktura aktualizována' : 'Faktura vytvořena');
      onSaved();
      onClose();
    } catch {
      toast('Chyba při ukládání', 'error');
    } finally {
      setSaving(false);
    }
  };

  const itemsTotal = items.reduce((s, it) => s + it.total_price, 0);
  const itemsTax = items.reduce((s, it) => s + (it.total_price * it.vat_rate / 100), 0);
  const receiptCount = items.filter(it => it.create_receipt && it.warehouse_item_id).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={invoice ? 'Upravit přijatou fakturu' : 'Nová přijatá faktura'}
      size="xl"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition"
          >
            Zrušit
          </button>
          {receiptCount > 0 && (
            <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1.5 rounded-lg">
              {receiptCount} příjemek k vytvoření
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || (!form.supplier_name.trim() && !form.invoice_number.trim())}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
          >
            {saving ? 'Ukládám...' : invoice ? 'Uložit' : 'Vytvořit'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-5">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Dodavatel *</label>
            <select
              value={form.supplier_id}
              onChange={e => handleSupplierChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">-- vyberte dodavatele --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.default_due_days}d)</option>
              ))}
            </select>
          </div>
          <div className="col-span-4">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název (manuálně)</label>
            <input
              value={form.supplier_name}
              onChange={e => setForm(prev => ({ ...prev, supplier_name: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Nebo zadejte ručně"
            />
          </div>
          <div className="col-span-3">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Číslo faktury</label>
            <input
              value={form.invoice_number}
              onChange={e => setForm(prev => ({ ...prev, invoice_number: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="FV-2024-001"
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum faktury</label>
            <input
              type="date"
              value={form.invoice_date}
              onChange={e => handleInvoiceDateChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Splatnost</label>
            <input
              type="date"
              value={form.due_date}
              onChange={e => setForm(prev => ({ ...prev, due_date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Částka celkem (Kč)</label>
            <div className="flex gap-1.5">
              <input
                type="number"
                value={form.total_amount}
                onChange={e => setForm(prev => ({ ...prev, total_amount: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {items.length > 0 && (
                <button
                  onClick={recalcTotals}
                  title="Přepočítat z položek včetně DPH"
                  className="px-2 py-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-200 rounded-lg hover:bg-blue-500/20 transition whitespace-nowrap"
                >
                  Suma
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">DPH (Kč)</label>
            <input
              type="number"
              value={form.tax_amount}
              onChange={e => setForm(prev => ({ ...prev, tax_amount: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Stav</label>
            <select
              value={form.status}
              onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="draft">Koncept</option>
              <option value="pending">Ke schválení</option>
              <option value="approved">Schválená</option>
              <option value="paid">Zaplacena</option>
            </select>
            {form.status === 'paid' && (
              <div className="mt-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Způsob platby</label>
                <select
                  value={form.payment_method}
                  onChange={e => setForm(prev => ({ ...prev, payment_method: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="bank_transfer">Bankovní převod</option>
                  <option value="cash">Hotovost</option>
                  <option value="card">Karta</option>
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Projekt (celá faktura)</label>
            <select
              value={form.project_id}
              onChange={e => setForm(prev => ({ ...prev, project_id: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">-- bez přiřazení --</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámka</label>
            <input
              value={form.note}
              onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {invoice && (
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <button
              onClick={() => setAttachmentsExpanded(!attachmentsExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.04] hover:bg-white/[0.06] transition"
            >
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-bold text-white">Přílohy ({attachments.length})</span>
                <span className="text-xs text-slate-500">originály faktur, PDF, obrázky</span>
              </div>
              {attachmentsExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {attachmentsExpanded && (
              <div className="p-4 space-y-3">
                {attachments.length === 0 && (
                  <div className="text-center py-4 text-sm text-slate-500">Žádné přílohy. Nahrajte originál faktury.</div>
                )}
                {attachments.map(att => {
                  const isImage = att.mime_type?.startsWith('image/');
                  const isPdf = att.mime_type === 'application/pdf';
                  return (
                    <div key={att.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] group">
                      <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                        {isImage ? <ImageIcon className="w-4 h-4 text-blue-400" /> : isPdf ? <FileText className="w-4 h-4 text-red-400" /> : <FileText className="w-4 h-4 text-slate-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{att.file_name}</div>
                        <div className="text-xs text-slate-500">{formatFileSize(att.file_size)}</div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <a href={att.file_url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 transition">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={() => deleteAttachment(att)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload}
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-white/10 text-sm font-medium text-slate-500 hover:border-blue-300 hover:text-blue-400 hover:bg-blue-500/10 transition disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {uploadingFile ? 'Nahrávám...' : 'Nahrát přílohu'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="border border-white/10 rounded-xl overflow-hidden">
          <button
            onClick={() => setItemsExpanded(!itemsExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.04] hover:bg-white/[0.06] transition"
          >
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-white">
                Položky faktury ({items.length})
              </span>
              {itemsTotal > 0 && (
                <span className="text-xs font-semibold text-slate-500">
                  - základ {Math.round(itemsTotal).toLocaleString('cs-CZ')} Kč
                  {itemsTax > 0 && ` + DPH ${Math.round(itemsTax).toLocaleString('cs-CZ')} Kč`}
                </span>
              )}
            </div>
            {itemsExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {itemsExpanded && (
            <div className="p-4 space-y-3">
              {items.length === 0 && (
                <div className="text-center py-6 text-sm text-slate-400">
                  Žádné položky. Můžete zadat fakturu jako celek nebo přidat položky.
                </div>
              )}

              {items.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.04] space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 grid grid-cols-12 gap-2">
                      <div className="col-span-4">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Popis</label>
                        <input
                          value={item.description}
                          onChange={e => updateItem(idx, { description: e.target.value })}
                          className="w-full px-2.5 py-2 rounded-lg border border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          placeholder="Popis položky"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Množství</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={e => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2.5 py-2 rounded-lg border border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                          <input
                            value={item.unit}
                            onChange={e => updateItem(idx, { unit: e.target.value })}
                            className="w-14 px-2 py-2 rounded-lg border border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-center"
                          />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Cena/j (Kč)</label>
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={e => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2.5 py-2 rounded-lg border border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">DPH</label>
                        <select
                          value={item.vat_rate}
                          onChange={e => updateItem(idx, { vat_rate: parseFloat(e.target.value) })}
                          className="w-full px-2.5 py-2 rounded-lg border border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          {VAT_OPTIONS.map(v => (
                            <option key={v.value} value={v.value}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Celkem</label>
                        <div className="px-2.5 py-2 rounded-lg bg-navy-800/60 border border-white/[0.08] text-xs font-bold text-white">
                          {Math.round(item.total_price).toLocaleString('cs-CZ')} Kč
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(idx)}
                      className="mt-5 p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-4">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Projekt</label>
                      <select
                        value={item.project_id}
                        onChange={e => updateItem(idx, { project_id: e.target.value })}
                        className="w-full px-2.5 py-2 rounded-lg border border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">-- z hlavičky --</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-4">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Skladová položka</label>
                      <select
                        value={item.warehouse_item_id}
                        onChange={e => updateItem(idx, { warehouse_item_id: e.target.value })}
                        className="w-full px-2.5 py-2 rounded-lg border border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">-- nepropojeno --</option>
                        {warehouseItems.map(w => (
                          <option key={w.id} value={w.id}>{w.name} ({w.quantity} {w.unit})</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-4 flex items-end pb-0.5">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={item.create_receipt}
                          onChange={e => updateItem(idx, { create_receipt: e.target.checked })}
                          disabled={!item.warehouse_item_id}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-400 focus:ring-emerald-500 disabled:opacity-40"
                        />
                        <span className={`text-xs font-semibold ${item.create_receipt && item.warehouse_item_id ? 'text-emerald-400' : 'text-slate-500'} ${!item.warehouse_item_id ? 'opacity-40' : ''}`}>
                          Vytvořit skladovou příjemku
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addItem}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-white/10 text-sm font-medium text-slate-500 hover:border-blue-300 hover:text-blue-400 hover:bg-blue-500/10 transition"
              >
                <Plus className="w-4 h-4" /> Přidat položku
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
