import { useState, useEffect } from 'react';
import { Search, User, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import AddressAutocomplete from '../../components/ui/AddressAutocomplete';
import type { QuickJob } from './quickJobTypes';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editJob?: QuickJob | null;
  prefillProjectId?: string;
  prefillProjectName?: string;
  prefillClientId?: string;
  prefillClientName?: string;
  prefillAddress?: string;
  prefillLat?: number | null;
  prefillLon?: number | null;
}

interface ClientOption {
  id: string;
  name: string;
  ico: string;
}

interface ProjectOption {
  id: string;
  project_name: string;
}

export default function QuickJobFormModal({
  open, onClose, onSaved, editJob,
  prefillProjectId, prefillProjectName, prefillClientId, prefillClientName,
  prefillAddress, prefillLat, prefillLon,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [addressLat, setAddressLat] = useState<number | null>(null);
  const [addressLon, setAddressLon] = useState<number | null>(null);
  const [priority, setPriority] = useState('normal');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [tags, setTags] = useState('');

  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<ClientOption[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [projects, setProjects] = useState<ProjectOption[]>([]);

  useEffect(() => {
    if (!open) return;
    if (editJob) {
      setTitle(editJob.title);
      setDescription(editJob.description || '');
      setClientId(editJob.client_id);
      setClientName(editJob.client_name || '');
      setProjectId(editJob.project_id);
      setAddress(editJob.address || '');
      setAddressLat(editJob.address_lat);
      setAddressLon(editJob.address_lon);
      setPriority(editJob.priority);
      setEstimatedHours(editJob.estimated_hours ? String(editJob.estimated_hours) : '');
      setTags((editJob.tags || []).join(', '));
    } else {
      setTitle('');
      setDescription('');
      setClientId(prefillClientId || null);
      setClientName(prefillClientName || '');
      setProjectId(prefillProjectId || null);
      setAddress(prefillAddress || '');
      setAddressLat(prefillLat || null);
      setAddressLon(prefillLon || null);
      setPriority('normal');
      setEstimatedHours('');
      setTags('');
    }
  }, [open, editJob, prefillProjectId, prefillClientId, prefillClientName, prefillAddress, prefillLat, prefillLon]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from('projects').select('id, project_name').neq('status', 'cancelled').order('project_name');
      setProjects((data || []) as ProjectOption[]);
    })();
  }, [open]);

  useEffect(() => {
    if (clientSearch.length < 2) {
      setClientResults([]);
      setShowClientDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, ico')
        .ilike('name', `%${clientSearch}%`)
        .limit(8);
      const results = (data || []) as ClientOption[];
      setClientResults(results);
      setShowClientDropdown(results.length > 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  const selectClient = (c: ClientOption) => {
    setClientId(c.id);
    setClientName(c.name);
    setClientSearch('');
    setShowClientDropdown(false);
  };

  const clearClient = () => {
    setClientId(null);
    setClientName('');
    setClientSearch('');
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast('Vyplňte název zakázky', 'error');
      return;
    }
    setSaving(true);

    const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description,
      client_id: clientId,
      client_name: clientName,
      project_id: projectId,
      address,
      address_lat: addressLat,
      address_lon: addressLon,
      priority,
      estimated_hours: estimatedHours ? parseFloat(estimatedHours) : 0,
      tags: tagArray,
      updated_at: new Date().toISOString(),
    };

    if (editJob) {
      const { error } = await supabase.from('quick_jobs').update(payload).eq('id', editJob.id);
      if (error) {
        toast('Chyba při ukládání', 'error');
        setSaving(false);
        return;
      }
      toast('Zakázka aktualizována');
    } else {
      payload.created_by = user?.id;
      payload.status = 'pool';
      const { error } = await supabase.from('quick_jobs').insert(payload);
      if (error) {
        toast('Chyba při vytváření', 'error');
        setSaving(false);
        return;
      }
      toast('Zakázka přidána do sběrníku');
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editJob ? 'Upravit zakázku' : 'Nová rychlá zakázka'}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
            {saving ? 'Ukládám...' : editJob ? 'Uložit' : 'Vytvořit'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Např. Oprava zásuvky, montáž světla..."
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/30"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="Podrobnosti zakázky..."
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/30 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Klient</label>
          {clientId ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <User className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-300 flex-1">{clientName}</span>
              <button onClick={clearClient} className="p-0.5 rounded hover:bg-white/10 text-slate-400"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={clientSearch || clientName}
                onChange={e => {
                  setClientSearch(e.target.value);
                  setClientName(e.target.value);
                }}
                placeholder="Hledat v CRM nebo zadat ručně..."
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/30"
              />
              {showClientDropdown && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-navy-800 rounded-xl border border-white/10 shadow-xl max-h-48 overflow-y-auto">
                  {clientResults.map(c => (
                    <button key={c.id} onClick={() => selectClient(c)} className="w-full text-left px-3 py-2 hover:bg-white/[0.06] transition">
                      <div className="text-sm font-medium text-white">{c.name}</div>
                      {c.ico && <div className="text-[11px] text-slate-400">IC: {c.ico}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Projekt</label>
          <select
            value={projectId || ''}
            onChange={e => setProjectId(e.target.value || null)}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/30"
          >
            <option value="" className="bg-navy-800 text-slate-400">-- bez projektu --</option>
            {projects.map(p => <option key={p.id} value={p.id} className="bg-navy-800 text-white">{p.project_name}</option>)}
          </select>
          {prefillProjectName && projectId === prefillProjectId && (
            <div className="text-[11px] text-blue-400 mt-1">Propojeno s: {prefillProjectName}</div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Adresa</label>
          <AddressAutocomplete
            value={address}
            lat={addressLat}
            lon={addressLon}
            onChange={(addr, lat, lon) => { setAddress(addr); setAddressLat(lat); setAddressLon(lon); }}
            includeClients
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Priorita</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/30"
            >
              <option value="low" className="bg-navy-800">Nízká</option>
              <option value="normal" className="bg-navy-800">Normální</option>
              <option value="high" className="bg-navy-800">Vysoká</option>
              <option value="urgent" className="bg-navy-800">Urgentní</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Odhad hodin</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={estimatedHours}
              onChange={e => setEstimatedHours(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/30"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Štítky</label>
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="elektro, SDK, malířské... (oddělte čárkou)"
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/30"
          />
        </div>
      </div>
    </Modal>
  );
}
