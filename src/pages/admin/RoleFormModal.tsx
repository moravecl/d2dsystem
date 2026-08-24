import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import type { CustomRole } from '../../lib/permissions';
import { getDefaultPermissions } from '../../lib/permissions';

const PRESET_COLORS = [
  '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#64748b',
];

interface Props {
  role: CustomRole | null;
  duplicateFrom: CustomRole | null;
  organizationId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function RoleFormModal({ role, duplicateFrom, organizationId, onClose, onSaved }: Props) {
  const isEdit = !!role;
  const source = role ?? duplicateFrom;

  const [name, setName] = useState(source ? (isEdit ? source.name : source.name + ' (kopie)') : '');
  const [slug, setSlug] = useState(source ? (isEdit ? source.slug : '') : '');
  const [description, setDescription] = useState(source?.description ?? '');
  const [color, setColor] = useState(source?.color ?? '#0ea5e9');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const generateSlug = (val: string) =>
    val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEdit) setSlug(generateSlug(val));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast('Zadejte název role', 'error');
      return;
    }
    const finalSlug = slug.trim() || generateSlug(name);
    if (!finalSlug) {
      toast('Slug nesmí být prázdný', 'error');
      return;
    }
    setSaving(true);

    if (isEdit && role) {
      const { error } = await supabase
        .from('custom_roles')
        .update({
          name: name.trim(),
          slug: finalSlug,
          description: description.trim(),
          color,
          updated_at: new Date().toISOString(),
        })
        .eq('id', role.id);

      if (error) {
        toast('Chyba: ' + error.message, 'error');
        setSaving(false);
        return;
      }
      toast('Role aktualizována');
    } else {
      const permissions = duplicateFrom ? duplicateFrom.permissions : getDefaultPermissions();
      const { error } = await supabase.from('custom_roles').insert({
        organization_id: organizationId,
        name: name.trim(),
        slug: finalSlug,
        description: description.trim(),
        color,
        is_system: false,
        permissions,
        sort_order: 99,
      });

      if (error) {
        if (error.message.includes('custom_roles_org_slug_unique')) {
          toast('Role s tímto slugem již existuje', 'error');
        } else {
          toast('Chyba: ' + error.message, 'error');
        }
        setSaving(false);
        return;
      }
      toast('Nová role vytvořena');
    }

    setSaving(false);
    onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Upravit roli' : duplicateFrom ? 'Duplikovat roli' : 'Nová role'}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition"
          >
            Zrušit
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-5 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Uložit' : 'Vytvořit'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název role</label>
          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="např. Projektant, Obchodník..."
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Slug (identifikátor)</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={isEdit && role?.is_system}
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 font-mono text-xs"
            placeholder="projektant"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            placeholder="Co tato role umožňuje..."
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Barva</label>
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-lg transition-all ${
                  color === c ? 'ring-2 ring-offset-2 ring-blue-400 scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded-lg cursor-pointer border border-white/10"
            />
          </div>
        </div>

        {duplicateFrom && (
          <div className="p-3 bg-blue-500/10 rounded-xl text-xs text-blue-400 font-medium">
            Oprávnění budou zkopírována z role "{duplicateFrom.name}". Po vytvoření je můžete upravit.
          </div>
        )}
      </div>
    </Modal>
  );
}
