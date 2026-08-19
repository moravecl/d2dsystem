import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';

export interface KanbanColumn {
  id: string;
  organization_id: string;
  entity_type: string;
  key: string;
  label: string;
  color: string;
  position: number;
}

const DEFAULT_LEADS_COLUMNS: Omit<KanbanColumn, 'id' | 'organization_id'>[] = [
  { entity_type: 'leads', key: 'new', label: 'Nový', color: 'blue', position: 0 },
  { entity_type: 'leads', key: 'contacted', label: 'Kontaktován', color: 'amber', position: 1 },
  { entity_type: 'leads', key: 'qualified', label: 'Kvalifikován', color: 'emerald', position: 2 },
  { entity_type: 'leads', key: 'converted', label: 'Převeden', color: 'green', position: 3 },
  { entity_type: 'leads', key: 'lost', label: 'Ztracen', color: 'slate', position: 4 },
];

const DEFAULT_SERVICE_COLUMNS: Omit<KanbanColumn, 'id' | 'organization_id'>[] = [
  { entity_type: 'service_tickets', key: 'open', label: 'Otevřený', color: 'blue', position: 0 },
  { entity_type: 'service_tickets', key: 'in_progress', label: 'Řeší se', color: 'amber', position: 1 },
  { entity_type: 'service_tickets', key: 'resolved', label: 'Vyřešeno', color: 'emerald', position: 2 },
  { entity_type: 'service_tickets', key: 'closed', label: 'Uzavřeno', color: 'slate', position: 3 },
];

const DEFAULT_QUICK_JOBS_COLUMNS: Omit<KanbanColumn, 'id' | 'organization_id'>[] = [
  { entity_type: 'quick_jobs', key: 'pool', label: 'Pool', color: 'slate', position: 0 },
  { entity_type: 'quick_jobs', key: 'claimed', label: 'Převzato', color: 'blue', position: 1 },
  { entity_type: 'quick_jobs', key: 'scheduled', label: 'Naplánováno', color: 'cyan', position: 2 },
  { entity_type: 'quick_jobs', key: 'in_progress', label: 'Probíhá', color: 'amber', position: 3 },
  { entity_type: 'quick_jobs', key: 'done', label: 'Hotovo', color: 'emerald', position: 4 },
];

export function useKanbanColumns(entityType: 'leads' | 'service_tickets' | 'quick_jobs') {
  const { organization } = useOrganization();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);

  const orgId = organization?.id;

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);

    const { data } = await supabase
      .from('kanban_columns')
      .select('*')
      .eq('organization_id', orgId)
      .eq('entity_type', entityType)
      .order('position');

    if (data && data.length > 0) {
      setColumns(data as KanbanColumn[]);
    } else {
      const defaults = entityType === 'leads' ? DEFAULT_LEADS_COLUMNS : entityType === 'quick_jobs' ? DEFAULT_QUICK_JOBS_COLUMNS : DEFAULT_SERVICE_COLUMNS;
      const toInsert = defaults.map((c) => ({ ...c, organization_id: orgId }));
      const { data: inserted } = await supabase
        .from('kanban_columns')
        .insert(toInsert)
        .select('*');
      setColumns((inserted as KanbanColumn[]) || []);
    }
    setLoading(false);
  }, [orgId, entityType]);

  useEffect(() => {
    load();
  }, [load]);

  const addColumn = async (label: string, color: string) => {
    if (!orgId) return;
    const key = label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    const position = columns.length;

    const { data } = await supabase
      .from('kanban_columns')
      .insert({ organization_id: orgId, entity_type: entityType, key, label, color, position })
      .select('*')
      .maybeSingle();

    if (data) setColumns((prev) => [...prev, data as KanbanColumn]);
    return data as KanbanColumn | null;
  };

  const updateColumn = async (id: string, updates: Partial<Pick<KanbanColumn, 'label' | 'color' | 'position'>>) => {
    await supabase.from('kanban_columns').update(updates).eq('id', id);

    if (updates.label !== undefined) {
      const col = columns.find((c) => c.id === id);
      if (col) {
        const newKey = updates.label
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '');
        await supabase.from('kanban_columns').update({ key: newKey }).eq('id', id);
        updates = { ...updates } as any;
        (updates as any).key = newKey;
      }
    }

    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeColumn = async (id: string) => {
    await supabase.from('kanban_columns').delete().eq('id', id);
    setColumns((prev) => prev.filter((c) => c.id !== id));
  };

  const reorderColumns = async (reordered: KanbanColumn[]) => {
    setColumns(reordered);
    const updates = reordered.map((c, i) => ({ id: c.id, position: i }));
    for (const u of updates) {
      await supabase.from('kanban_columns').update({ position: u.position }).eq('id', u.id);
    }
  };

  return { columns, loading, addColumn, updateColumn, removeColumn, reorderColumns, reload: load };
}
