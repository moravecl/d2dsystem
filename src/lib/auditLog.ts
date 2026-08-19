import { supabase } from './supabase';

export async function logAudit(
  entityType: string,
  entityId: string | null,
  action: string,
  details: Record<string, unknown> = {}
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('audit_log').insert({
    user_id: user.id,
    entity_type: entityType,
    entity_id: entityId,
    action,
    details,
  });
}
