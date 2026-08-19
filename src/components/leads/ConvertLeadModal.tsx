import { useState } from 'react';
import { ArrowUpRight, User, FolderKanban } from 'lucide-react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../lib/auditLog';
import { useNavigate } from 'react-router-dom';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  form_data: Record<string, string>;
}

interface Props {
  lead: Lead;
  onClose: () => void;
  onConverted: () => void;
}

export default function ConvertLeadModal({ lead, onClose, onConverted }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const nameParts = lead.name.split(' ');
  const suggestedProjectName = lead.name ? `Projekt - ${lead.name}` : '';

  const [clientName, setClientName] = useState(lead.name);
  const [clientEmail, setClientEmail] = useState(lead.email);
  const [clientPhone, setClientPhone] = useState(lead.phone);
  const [projectName, setProjectName] = useState(suggestedProjectName);
  const [navigateToProject, setNavigateToProject] = useState(true);

  const handleConvert = async () => {
    if (!clientName.trim() || !projectName.trim()) {
      toast('Vyplňte jméno klienta a název projektu', 'error');
      return;
    }
    if (!user) return;

    setSaving(true);

    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .insert({
        user_id: user.id,
        name: clientName.trim(),
        email: clientEmail.trim(),
        phone: clientPhone.trim(),
        client_type: 'rd',
      })
      .select()
      .maybeSingle();

    if (clientError || !clientData) {
      toast('Chyba při vytváření klienta', 'error');
      setSaving(false);
      return;
    }

    await logAudit('client', clientData.id, 'created', { name: clientName, source: 'lead_conversion' });

    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: projectName.trim(),
        project_name: projectName.trim(),
        client_name: clientName.trim(),
        client_id: clientData.id,
        status: 'lead',
        description: lead.message || '',
      })
      .select()
      .maybeSingle();

    if (projectError || !projectData) {
      toast('Chyba při vytváření projektu', 'error');
      setSaving(false);
      return;
    }

    await logAudit('project', projectData.id, 'created', { name: projectName, source: 'lead_conversion' });

    await supabase
      .from('leads')
      .update({
        status: 'converted',
        converted_client_id: clientData.id,
        converted_project_id: projectData.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id);

    toast('Lead úspěšně převeden na projekt a klienta', 'success');
    setSaving(false);
    onConverted();

    if (navigateToProject) {
      navigate(`/projekty/${projectData.id}`);
    }
  };

  return (
    <Modal open onClose={onClose} title="Převést lead na projekt" size="md">
      <div className="space-y-5">
        <div className="bg-blue-500/10 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-800">
            Z leadu se vytvoří nový klient a projekt. Údaje si můžete před vytvořením upravit.
          </p>
        </div>

        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-300 mb-3">
            <User className="w-4 h-4" />
            Nový klient
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-slate-400 mb-1">Jméno *</label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2.5 border border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">E-mail</label>
                <input
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  type="email"
                  className="w-full px-3 py-2.5 border border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">Telefon</label>
                <input
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  type="tel"
                  className="w-full px-3 py-2.5 border border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-300 mb-3">
            <FolderKanban className="w-4 h-4" />
            Nový projekt
          </h3>
          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-1">Název projektu *</label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-3 py-2.5 border border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={navigateToProject}
            onChange={(e) => setNavigateToProject(e.target.checked)}
            className="rounded border-slate-300"
          />
          Po vytvoření otevřít projekt
        </label>

        <div className="flex items-center gap-3 pt-2 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-white/10 rounded-xl text-sm font-bold text-slate-300 hover:bg-white/[0.04] transition"
          >
            Zrušit
          </button>
          <button
            onClick={handleConvert}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition disabled:opacity-50"
          >
            <ArrowUpRight className="w-4 h-4" />
            {saving ? 'Vytvářím...' : 'Vytvořit klienta a projekt'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
