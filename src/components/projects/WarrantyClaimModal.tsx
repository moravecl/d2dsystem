import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, RefreshCw, Wrench, Package, DollarSign, PenTool } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';
import SignaturePad from './SignaturePad';

interface InstalledDevice {
  id: string;
  device_type: string;
  name: string;
  manufacturer: string;
  serial_number: string;
  warranty_end_date: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  device: InstalledDevice | null;
  onSaved: () => void;
}

const DEVICE_TYPES: Record<string, string> = {
  stridac: 'Stridac',
  baterie: 'Baterie',
  wallbox: 'Wallbox',
  tepelne_cerpadlo: 'Tepelne cerpadlo',
  rekuperace: 'Rekuperace',
  other: 'Ostatni',
};

type TabKey = 'claim' | 'replacement' | 'costs' | 'signature';

export default function WarrantyClaimModal({ open, onClose, projectId, device, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('claim');

  const [claimType, setClaimType] = useState<'repair' | 'replacement'>('repair');
  const [faultDescription, setFaultDescription] = useState('');
  const [resolutionDescription, setResolutionDescription] = useState('');
  const [claimDate, setClaimDate] = useState(new Date().toISOString().slice(0, 10));
  const [technicianName, setTechnicianName] = useState('');
  const [isWarranty, setIsWarranty] = useState(true);
  const [notes, setNotes] = useState('');

  const [replacementName, setReplacementName] = useState('');
  const [replacementSerial, setReplacementSerial] = useState('');
  const [replacementManufacturer, setReplacementManufacturer] = useState('');

  const [laborCost, setLaborCost] = useState(0);
  const [materialCost, setMaterialCost] = useState(0);

  const [customerName, setCustomerName] = useState('');
  const [customerSignature, setCustomerSignature] = useState('');
  const [technicianSignature, setTechnicianSignature] = useState('');

  const warrantyActive = device?.warranty_end_date
    ? new Date(device.warranty_end_date) >= new Date()
    : false;

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    if (data?.full_name) setTechnicianName(data.full_name);
  }, [user]);

  const loadClientName = useCallback(async () => {
    const { data } = await supabase.from('projects').select('client_name').eq('id', projectId).maybeSingle();
    if (data?.client_name) setCustomerName(data.client_name);
  }, [projectId]);

  useEffect(() => {
    if (open && device) {
      setClaimType('repair');
      setFaultDescription('');
      setResolutionDescription('');
      setClaimDate(new Date().toISOString().slice(0, 10));
      setIsWarranty(warrantyActive);
      setNotes('');
      setReplacementName('');
      setReplacementSerial('');
      setReplacementManufacturer('');
      setLaborCost(0);
      setMaterialCost(0);
      setCustomerSignature('');
      setTechnicianSignature('');
      setActiveTab('claim');
      loadProfile();
      loadClientName();
    }
  }, [open, device, warrantyActive, loadProfile, loadClientName]);

  const totalCost = laborCost + materialCost;

  const handleSave = async () => {
    if (!device || !faultDescription.trim() || !technicianName.trim()) {
      toast('Vyplňte popis závady a jméno technika', 'error');
      return;
    }
    if (claimType === 'replacement' && !replacementName.trim()) {
      toast('Vyplňte název náhradního zařízení', 'error');
      return;
    }

    setSaving(true);
    const claimNumber = `RK-${Date.now().toString(36).toUpperCase()}`;

    const { error } = await supabase.from('warranty_claims').insert({
      project_id: projectId,
      device_id: device.id,
      claim_number: claimNumber,
      claim_type: claimType,
      original_device_type: device.device_type,
      original_device_name: device.name,
      original_serial_number: device.serial_number,
      original_manufacturer: device.manufacturer,
      fault_description: faultDescription,
      resolution_description: resolutionDescription,
      replacement_device_name: claimType === 'replacement' ? replacementName : '',
      replacement_serial_number: claimType === 'replacement' ? replacementSerial : '',
      replacement_manufacturer: claimType === 'replacement' ? replacementManufacturer : '',
      labor_cost: laborCost,
      material_cost: materialCost,
      total_cost: totalCost,
      is_warranty: isWarranty,
      status: customerSignature ? 'signed' : 'completed',
      technician_name: technicianName,
      claim_date: claimDate,
      customer_signature: customerSignature,
      customer_name: customerName,
      signed_at: customerSignature ? new Date().toISOString() : null,
      technician_signature: technicianSignature,
      technician_signed_at: technicianSignature ? new Date().toISOString() : null,
      notes,
      created_by: user!.id,
    });

    if (error) {
      toast('Chyba při ukládání reklamace', 'error');
      setSaving(false);
      return;
    }

    if (claimType === 'replacement' && replacementName.trim()) {
      await supabase.from('installed_devices').update({
        name: replacementName,
        serial_number: replacementSerial,
        manufacturer: replacementManufacturer || device.manufacturer,
        notes: `Vymena v ramci reklamace ${claimNumber}. Puvodni: ${device.name} (S/N: ${device.serial_number})`,
        updated_at: new Date().toISOString(),
      }).eq('id', device.id);
    }

    setSaving(false);
    toast(customerSignature ? 'Reklamacni protokol ulozen a podepsan' : 'Reklamacni protokol ulozen');
    onSaved();
    onClose();
  };

  if (!device) return null;

  const tabs: { key: TabKey; label: string; icon: typeof Wrench }[] = [
    { key: 'claim', label: 'Reklamace', icon: AlertTriangle },
    ...(claimType === 'replacement' ? [{ key: 'replacement' as TabKey, label: 'Náhrada', icon: RefreshCw }] : []),
    { key: 'costs', label: 'Náklady', icon: DollarSign },
    { key: 'signature', label: 'Podpis', icon: PenTool },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Reklamace / Výměna zařízení" size="xl" footer={
      <>
        <div className="flex-1 flex items-center gap-3">
          {totalCost > 0 && (
            <span className="text-sm font-semibold text-slate-300">
              Celkem: {totalCost.toLocaleString('cs-CZ')} Kc
            </span>
          )}
          {customerSignature && (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">Podepsáno</span>
          )}
        </div>
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
        <button
          onClick={handleSave}
          disabled={saving || !faultDescription.trim() || !technicianName.trim()}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
        >
          {saving ? 'Ukladam...' : 'Ulozit protokol'}
        </button>
      </>
    }>
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">{device.name}</div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>{DEVICE_TYPES[device.device_type] || device.device_type}</span>
                {device.manufacturer && <span>{device.manufacturer}</span>}
                {device.serial_number && <span className="font-mono">S/N: {device.serial_number}</span>}
              </div>
            </div>
            {warrantyActive ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">V záruce</span>
            ) : device.warranty_end_date ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-red-500/20 text-red-400 shrink-0">Po záruce</span>
            ) : null}
          </div>
        </div>

        <div className="flex gap-1 border-b border-white/[0.06] pb-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
 activeTab === tab.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-white/[0.04]'
 }`}
            >
              <tab.icon className="w-3.5 h-3.5" />{tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'claim' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Typ</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setClaimType('repair')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition ${
 claimType === 'repair'
 ? 'border-blue-500 bg-blue-500/10 text-blue-400'
 : 'border-white/[0.08] text-slate-500 hover:border-white/[0.12]'
 }`}
                  >
                    <Wrench className="w-4 h-4" />Oprava
                  </button>
                  <button
                    type="button"
                    onClick={() => setClaimType('replacement')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition ${
 claimType === 'replacement'
 ? 'border-amber-500 bg-amber-500/10 text-amber-400'
 : 'border-white/[0.08] text-slate-500 hover:border-white/[0.12]'
 }`}
                  >
                    <RefreshCw className="w-4 h-4" />Výměna
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum</label>
                <input
                  type="date"
                  value={claimDate}
                  onChange={e => setClaimDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Technik *</label>
                <input
                  value={technicianName}
                  onChange={e => setTechnicianName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={isWarranty}
                    onChange={e => setIsWarranty(e.target.checked)}
                    className="rounded border-white/[0.12] text-blue-400 focus:ring-blue-400"
                  />
                  <span className="text-sm font-medium text-slate-400">Zaruční oprava</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis závady / důvod reklamace *</label>
              <textarea
                value={faultDescription}
                onChange={e => setFaultDescription(e.target.value)}
                rows={3}
                placeholder="Popište závadu, okolnosti, jak se projevuje..."
                className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis provedené opravy / řešení</label>
              <textarea
                value={resolutionDescription}
                onChange={e => setResolutionDescription(e.target.value)}
                rows={2}
                placeholder="Co bylo provedeno, jaké díly použity..."
                className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámky</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>
        )}

        {activeTab === 'replacement' && claimType === 'replacement' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="text-xs font-semibold text-amber-400 mb-1">Původní zařízení</div>
              <div className="text-sm text-amber-400">{device.name} | {device.manufacturer} | S/N: {device.serial_number}</div>
            </div>

            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Náhradní zařízení
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název / Model *</label>
              <input
                value={replacementName}
                onChange={e => setReplacementName(e.target.value)}
                placeholder="Název nového zařízení"
                className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Výrobce</label>
                <input
                  value={replacementManufacturer}
                  onChange={e => setReplacementManufacturer(e.target.value)}
                  placeholder={device.manufacturer}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Výrobní číslo</label>
                <input
                  value={replacementSerial}
                  onChange={e => setReplacementSerial(e.target.value)}
                  placeholder="S/N nového zařízení"
                  className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'costs' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Náklady na práci (Kc)</label>
                <input
                  type="number"
                  min={0}
                  value={laborCost}
                  onChange={e => setLaborCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Náklady na materiál (Kc)</label>
                <input
                  type="number"
                  min={0}
                  value={materialCost}
                  onChange={e => setMaterialCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <span className="text-sm text-slate-500">Celkové náklady</span>
              <span className="text-lg font-extrabold text-white">{totalCost.toLocaleString('cs-CZ')} Kc</span>
            </div>

            {isWarranty && totalCost > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <AlertTriangle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs text-emerald-400">Záruční oprava - náklady nebudou účtovány zákazníkovi</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'signature' && (
          <div className="space-y-5">
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="text-xs text-blue-400">
                Podpisem obě strany potvrzuji provedení opravy/výměny a souhlas s popsaným řešením.
              </div>
            </div>

            <div className="p-4 rounded-xl border-2 border-white/[0.08] space-y-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Technik</div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Jméno technika</label>
                <input
                  value={technicianName}
                  onChange={e => setTechnicianName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Podpis technika</label>
                <SignaturePad
                  value={technicianSignature}
                  onChange={setTechnicianSignature}
                  width={500}
                  height={150}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl border-2 border-white/[0.08] space-y-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Zákazník</div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Jméno zákazníka</label>
                <input
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Podpis zákazníka</label>
                <SignaturePad
                  value={customerSignature}
                  onChange={setCustomerSignature}
                  width={500}
                  height={150}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
