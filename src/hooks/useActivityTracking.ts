import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

let sessionId: string | null = null;

function getSessionId() {
  if (!sessionId) {
    sessionId = sessionStorage.getItem('hs_sid') ?? null;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('hs_sid', sessionId);
    }
  }
  return sessionId;
}

async function logEvent(
  userId: string,
  orgId: string | null,
  eventType: 'login' | 'logout' | 'page_view',
  pagePath?: string
) {
  await supabase.from('user_activity_log').insert({
    user_id: userId,
    org_id: orgId,
    organization_id: orgId,
    event_type: eventType,
    page_path: pagePath ?? null,
    event_data: pagePath ? { page: pagePath } : {},
    user_agent: navigator.userAgent,
    session_id: getSessionId(),
  });
}

export function useActivityTracking(userId: string | null, orgId: string | null) {
  const location = useLocation();
  const lastPath = useRef<string | null>(null);
  const loggedLogin = useRef(false);

  useEffect(() => {
    if (!userId) {
      loggedLogin.current = false;
      return;
    }

    if (!loggedLogin.current) {
      loggedLogin.current = true;
      logEvent(userId, orgId, 'login');
    }
  }, [userId, orgId]);

  useEffect(() => {
    if (!userId) return;
    const path = location.pathname;
    if (path === lastPath.current) return;
    if (path === '/login' || path === '/register') return;
    lastPath.current = path;
    logEvent(userId, orgId, 'page_view', path);
  }, [location.pathname, userId, orgId]);
}

export { logEvent };
