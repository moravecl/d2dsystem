import { Mail, Phone, MessageSquare, Calendar, ArrowUpRight, FileText } from 'lucide-react';
import Modal from '../ui/Modal';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  source: string;
  form_data: Record<string, string>;
  status: string;
  converted_project_id: string | null;
  created_at: string;
}

interface Props {
  lead: Lead;
  formName?: string;
  onClose: () => void;
  onConvert: () => void;
}

export default function LeadDetailModal({ lead, formName, onClose, onConvert }: Props) {
  const extraFields = Object.entries(lead.form_data).filter(
    ([key]) => !['name', 'email', 'phone', 'message', 'jmeno', 'e_mail', 'telefon', 'zprava'].includes(key)
  );

  return (
    <Modal open onClose={onClose} title="Detail leadu" size="md">
      <div className="space-y-5">
        <div className="bg-white/[0.04] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">{lead.name || 'Bez jména'}</h3>
            {formName && (
              <span className="px-2.5 py-1 bg-white/[0.08] text-slate-400 text-xs font-bold rounded-full">
                {formName}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lead.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <a href={`mailto:${lead.email}`} className="text-blue-400 hover:underline truncate">
                  {lead.email}
                </a>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <a href={`tel:${lead.phone}`} className="text-blue-400 hover:underline">
                  {lead.phone}
                </a>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              {new Date(lead.created_at).toLocaleString('cs-CZ')}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              Zdroj: {lead.source === 'web_form' ? 'Webový formulář' : lead.source}
            </div>
          </div>
        </div>

        {lead.message && (
          <div>
            <h4 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Zpráva
            </h4>
            <div className="bg-navy-800/60 border border-white/[0.08] rounded-xl p-4 text-sm text-slate-300 whitespace-pre-wrap">
              {lead.message}
            </div>
          </div>
        )}

        {extraFields.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-slate-300 mb-2">Další údaje z formuláře</h4>
            <div className="bg-navy-800/60 border border-white/[0.08] rounded-xl divide-y divide-white/[0.06]">
              {extraFields.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-500 font-medium">{key}</span>
                  <span className="text-white font-semibold">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {lead.status !== 'converted' && (
          <div className="pt-2 border-t border-white/[0.06]">
            <button
              onClick={onConvert}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition"
            >
              <ArrowUpRight className="w-4 h-4" />
              Převést na projekt a klienta
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
