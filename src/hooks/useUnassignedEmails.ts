import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Počet nepřečtených (nově doručených) e-mailů — badge u položky Pošta
 * v sidebaru. Lehký head-count dotaz + minutový polling; obnovuje se
 * i eventem 'emails-changed' (přečtení, smazání, synchronizace).
 */
export function useUnreadEmailCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      const { count: c } = await supabase
        .from('emails')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);
      if (!cancelled) setCount(c ?? 0);
    };

    load();
    const interval = setInterval(load, 60000);
    const onChanged = () => load();
    window.addEventListener('emails-changed', onChanged);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('emails-changed', onChanged);
    };
  }, [enabled]);

  return count;
}
