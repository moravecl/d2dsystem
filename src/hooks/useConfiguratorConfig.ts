import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { DEFAULT_CONFIGURATOR_CONFIG } from '../lib/configurator/defaults';
import type { ConfiguratorConfig } from '../lib/configurator/types';

/**
 * Ceník konfigurátoru organizace. Bez uloženého záznamu platí výchozí
 * ceník zabudovaný v aplikaci; uložení (jen admin) vytvoří/aktualizuje
 * řádek v configurator_settings. Merge zajistí, že nové klíče přidané
 * v aplikaci nerozbijí starší uloženou konfiguraci. Nese i veřejný
 * token a zapnutí veřejného konfigurátoru.
 */
export function useConfiguratorConfig() {
  const { organization } = useOrganization();
  const [config, setConfig] = useState<ConfiguratorConfig>(DEFAULT_CONFIGURATOR_CONFIG);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [publicEnabled, setPublicEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('configurator_settings')
      .select('config, public_token, public_enabled')
      .limit(1)
      .maybeSingle();
    if (data?.config && typeof data.config === 'object') {
      const stored = data.config as Partial<ConfiguratorConfig>;
      setConfig({
        catalog: { ...DEFAULT_CONFIGURATOR_CONFIG.catalog, ...(stored.catalog ?? {}) },
        prices: { ...DEFAULT_CONFIGURATOR_CONFIG.prices, ...(stored.prices ?? {}) },
        defaults: { ...DEFAULT_CONFIGURATOR_CONFIG.defaults, ...(stored.defaults ?? {}) },
        public: {
          ...DEFAULT_CONFIGURATOR_CONFIG.public,
          ...(stored.public ?? {}),
          prices: {
            ...DEFAULT_CONFIGURATOR_CONFIG.public.prices,
            ...(stored.public?.prices ?? {}),
          },
          subsidies: stored.public?.subsidies?.length
            ? stored.public.subsidies
            : DEFAULT_CONFIGURATOR_CONFIG.public.subsidies,
        },
      });
    } else {
      setConfig(DEFAULT_CONFIGURATOR_CONFIG);
    }
    setPublicToken((data as { public_token?: string } | null)?.public_token ?? null);
    setPublicEnabled((data as { public_enabled?: boolean } | null)?.public_enabled ?? false);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (
    next: ConfiguratorConfig,
    options?: { publicEnabled?: boolean },
  ): Promise<string | null> => {
    if (!organization) return 'Chybí organizace';
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const row: Record<string, unknown> = {
      organization_id: organization.id,
      config: next,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    };
    if (options?.publicEnabled !== undefined) row.public_enabled = options.publicEnabled;
    const { data, error } = await supabase
      .from('configurator_settings')
      .upsert(row, { onConflict: 'organization_id' })
      .select('id, public_token, public_enabled');
    setSaving(false);
    if (error || !data || data.length === 0) return error?.message ?? 'Uložení se nepodařilo';
    setConfig(next);
    setPublicToken((data[0] as { public_token?: string }).public_token ?? null);
    setPublicEnabled((data[0] as { public_enabled?: boolean }).public_enabled ?? false);
    return null;
  }, [organization]);

  return { config, publicToken, publicEnabled, loading, saving, save, reload: load };
}
