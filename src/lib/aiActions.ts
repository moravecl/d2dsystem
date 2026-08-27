import { supabase } from './supabase';

/**
 * Návrhy akcí od AI asistenta. Asistent do dat nikdy nezapisuje sám —
 * vrací návrhy, uživatel je schválí a zápis proběhne tady, pod jeho
 * přihlášením (platí RLS a oprávnění).
 */

export interface CreateTaskAction {
  type: 'create_task';
  title: string;
  description?: string;
  due_date?: string | null;
  project_id?: string | null;
  source_email_id?: string;
}

export interface AssignEmailAction {
  type: 'assign_email';
  email_id: string;
  project_id: string;
  reason?: string;
}

export interface CreateDueItemAction {
  type: 'create_due_item';
  asset_id?: string | null;
  asset_name?: string;
  due_type: string;
  label: string;
  due_date: string;
  source_email_id?: string;
}

export interface CreateLeadAction {
  type: 'create_lead';
  name: string;
  email?: string;
  phone?: string;
  message?: string;
  source_email_id?: string;
}

export type ProposedAction =
  | CreateTaskAction
  | AssignEmailAction
  | CreateDueItemAction
  | CreateLeadAction;

export const ACTION_TYPE_LABELS: Record<ProposedAction['type'], string> = {
  create_task: 'Úkol',
  assign_email: 'Přiřazení e-mailu',
  create_due_item: 'Termín k majetku',
  create_lead: 'Nový lead',
};

export function actionSummary(a: ProposedAction): string {
  switch (a.type) {
    case 'create_task':
      return `${a.title}${a.due_date ? ` (do ${new Date(a.due_date).toLocaleDateString('cs-CZ')})` : ''}`;
    case 'assign_email':
      return a.reason || 'Přiřadit e-mail k projektu';
    case 'create_due_item':
      return `${a.label} — do ${new Date(a.due_date).toLocaleDateString('cs-CZ')}${a.asset_name && !a.asset_id ? ` (majetek: ${a.asset_name})` : ''}`;
    case 'create_lead':
      return `${a.name}${a.email ? ` <${a.email}>` : ''}`;
  }
}

interface ExecuteContext {
  userId: string;
  orgId: string;
}

/** Provede schválenou akci; vrací null při úspěchu, jinak text chyby. */
export async function executeAction(a: ProposedAction, ctx: ExecuteContext): Promise<string | null> {
  switch (a.type) {
    case 'create_task': {
      const { error } = await supabase.from('tasks').insert({
        title: a.title,
        description: a.description ?? '',
        status: 'todo',
        priority: 'medium',
        due_date: a.due_date || null,
        project_id: a.project_id || null,
        created_by: ctx.userId,
        organization_id: ctx.orgId,
      });
      return error ? error.message : null;
    }
    case 'assign_email': {
      const { error } = await supabase
        .from('emails')
        .update({
          project_id: a.project_id,
          assignment_status: 'manual',
          assignment_engine: 'ai',
          assignment_reason: a.reason || 'Přiřazeno AI asistentem',
        })
        .eq('id', a.email_id);
      if (!error) window.dispatchEvent(new Event('emails-changed'));
      return error ? error.message : null;
    }
    case 'create_due_item': {
      if (!a.asset_id) return 'Vyberte majetek, ke kterému termín patří';
      const { error } = await supabase.from('due_items').insert({
        asset_id: a.asset_id,
        due_type: a.due_type || 'other',
        label: a.label,
        due_date: a.due_date,
        notify: true,
        created_by: ctx.userId,
      });
      return error ? error.message : null;
    }
    case 'create_lead': {
      const { error } = await supabase.from('leads').insert({
        organization_id: ctx.orgId,
        name: a.name,
        email: a.email ?? '',
        phone: a.phone ?? '',
        message: a.message ?? '',
        source: 'ai_asistent',
      });
      return error ? error.message : null;
    }
  }
}
