import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { DEFAULT_CONFIGURATOR_CONFIG } from '../lib/configurator/defaults';
import type { ConfiguratorConfig } from '../lib/configurator/types';

/**
 * Ceník konfigurátoru organizace. Bez uloženého záznamu platí výchozí
 * ceník zabudovaný v aplikaci; uložení (jen admin) vytvoří/aktualizuje
 * řádek v configurator_settings. Merge zajistí, že nové klíče přidané
 * v aplikaci nerozbijí starší uloženou konfiguraci.
 */
export function useConfiguratorConfig() {
  const { organization } = useOrganization();
  const [config, setConfig] = useState<ConfiguratorConfig>(DEFAULT_CONFIGURATOR_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('configurator_settings')
      .select('config')
      .limit(1)
      .maybeSingle();
    if (data?.config && typeof data.config === 'object') {
      const stored = data.config as Partial<ConfiguratorConfig>;
      setConfig({
        catalog: { ...DEFAULT_CONFIGURATOR_CONFIG.catalog, ...(stored.catalog ?? {}) },
        prices: { ...DEFAULT_CONFIGURATOR_CONFIG.prices, ...(stored.prices ?? {}) },
        defaults: { ...DEFAULT_CONFIGURATOR_CONFIG.defaults, ...(stored.defaults ?? {}) },
      });
    } else {
      setConfig(DEFAULT_CONFIGURATOR_CONFIG);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (next: ConfiguratorConfig): Promise<string | null> => {
    if (!organization) return 'Chybí organizace';
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('configurator_settings')
      .upsert({
        organization_id: organization.id,
        config: next,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id' })
      .select('id');
    setSaving(false);
    if (error || !data || data.length === 0) return error?.message ?? 'Uložení se nepodařilo';
    setConfig(next);
    return null;
  }, [organization]);

  return { config, loading, saving, save, reload: load };
}
