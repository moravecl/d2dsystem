import { useState, useEffect } from 'react';
import { Settings, Package, Layers, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';

interface DesignerConfig {
  id?: string;
  enable_products: boolean;
  enable_schematic: boolean;
  default_mode: 'products' | 'schematic';
}

export default function DesignerConfigPage() {
  const { organization } = useOrganization();
  const { toast } = useToast();

  const [config, setConfig] = useState<DesignerConfig>({
    enable_products: true,
    enable_schematic: true,
    default_mode: 'products',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!organization?.id) return;

    const loadConfig = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('designer_config')
        .select('*')
        .eq('organization_id', organization.id)
        .maybeSingle();

      if (data) {
        setConfig({
          id: data.id,
          enable_products: data.enable_products,
          enable_schematic: data.enable_schematic,
          default_mode: data.default_mode,
        });
      }
      setLoading(false);
    };

    loadConfig();
  }, [organization?.id]);

  const handleSave = async () => {
    if (!organization?.id) return;

    setSaving(true);

    if (config.id) {
      const { error } = await supabase
        .from('designer_config')
        .update({
          enable_products: config.enable_products,
          enable_schematic: config.enable_schematic,
          default_mode: config.default_mode,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);

      if (error) {
        toast(`Chyba: ${error.message}`);
      } else {
        toast('Konfigurace uložena');
      }
    } else {
      const { data, error } = await supabase
        .from('designer_config')
        .insert({
          organization_id: organization.id,
          enable_products: config.enable_products,
          enable_schematic: config.enable_schematic,
          default_mode: config.default_mode,
        })
        .select()
        .single();

      if (error) {
        toast(`Chyba: ${error.message}`);
      } else {
        setConfig((prev) => ({ ...prev, id: data.id }));
        toast('Konfigurace uložena');
      }
    }

    setSaving(false);
  };

  const bothDisabled = !config.enable_products && !config.enable_schematic;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">Konfigurace návrháře</h1>
            <p className="text-sm text-slate-400">Nastavení chování návrháře v projektech</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || bothDisabled}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Uložit
        </button>
      </div>

      {bothDisabled && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-400">
            Alespoň jeden režim musí být povolený. Aktivujte produkty nebo schematické značky.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div
          className={`rounded-2xl border p-6 transition cursor-pointer ${
            config.enable_products
              ? 'border-blue-500/50 bg-blue-500/10'
              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
          }`}
          onClick={() => setConfig((prev) => ({ ...prev, enable_products: !prev.enable_products }))}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-400" />
            </div>
            <div
              className={`w-12 h-6 rounded-full relative transition ${
                config.enable_products ? 'bg-blue-600' : 'bg-slate-600'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  config.enable_products ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </div>
          </div>

          <h3 className="text-lg font-bold text-white mb-2">Produkty</h3>
          <p className="text-sm text-slate-400">
            Umožňuje vkládat piny s produkty na půdorys. Ideální pro elektroinstalace, osvětlení a další
            produktové konfigurace.
          </p>
        </div>

        <div
          className={`rounded-2xl border p-6 transition cursor-pointer ${
            config.enable_schematic
              ? 'border-teal-500/50 bg-teal-500/10'
              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
          }`}
          onClick={() => setConfig((prev) => ({ ...prev, enable_schematic: !prev.enable_schematic }))}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-teal-600/20 flex items-center justify-center">
              <Layers className="w-6 h-6 text-teal-400" />
            </div>
            <div
              className={`w-12 h-6 rounded-full relative transition ${
                config.enable_schematic ? 'bg-teal-600' : 'bg-slate-600'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  config.enable_schematic ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </div>
          </div>

          <h3 className="text-lg font-bold text-white mb-2">Schematické značky</h3>
          <p className="text-sm text-slate-400">
            Umožňuje vkládat schematické značky (zásuvky, vypínače, apod.) které se následně přiřazují k produktům.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h3 className="text-lg font-bold text-white mb-4">Výchozí režim</h3>
        <p className="text-sm text-slate-400 mb-4">
          Který panel se zobrazí jako výchozí při otevření návrháře
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => setConfig((prev) => ({ ...prev, default_mode: 'products' }))}
            disabled={!config.enable_products}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border font-bold transition ${
              config.default_mode === 'products'
                ? 'border-blue-500 bg-blue-600/20 text-blue-400'
                : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.04]'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Package className="w-5 h-5" />
            Produkty
          </button>

          <button
            onClick={() => setConfig((prev) => ({ ...prev, default_mode: 'schematic' }))}
            disabled={!config.enable_schematic}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border font-bold transition ${
              config.default_mode === 'schematic'
                ? 'border-teal-500 bg-teal-600/20 text-teal-400'
                : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.04]'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Layers className="w-5 h-5" />
            Schéma
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h3 className="text-lg font-bold text-white mb-2">Jak to funguje</h3>
        <div className="space-y-3 text-sm text-slate-400">
          <p>
            <strong className="text-white">Produkty:</strong> Přímé vkládání produktů z katalogu na půdorys.
            Každý pin představuje konkrétní produkt s cenou a množstvím.
          </p>
          <p>
            <strong className="text-white">Schematické značky:</strong> Vkládání abstraktních prvků (zásuvka,
            vypínač, světlo) které se následně hromadně přiřazují k produktům v sekci Přiřazení produktů.
          </p>
          <p>
            Pokud máte povoleny oba režimy, uživatel si může v návrháři přepínat mezi panely PRODUKTY a SCHÉMA.
          </p>
        </div>
      </div>
    </div>
  );
}
