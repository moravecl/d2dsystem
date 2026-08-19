import { useState, useCallback, useEffect, useRef } from 'react';

interface IconSettingsData {
  defaultIcons: Record<string, string>;
}

const STORAGE_KEY = 'hs-material-settings';

function loadSettings(): IconSettingsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { defaultIcons: parsed.defaultIcons ?? {} };
    }
  } catch { /* ignore */ }
  return { defaultIcons: {} };
}

export function useMaterialSettings() {
  const stored = useRef(loadSettings());
  const [data, setData] = useState<IconSettingsData>(stored.current);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const setDefaultIcon = useCallback((productId: string, iconId: string | undefined) => {
    setData(prev => {
      const next = { ...prev.defaultIcons };
      if (iconId) next[productId] = iconId;
      else delete next[productId];
      return { ...prev, defaultIcons: next };
    });
  }, []);

  return {
    defaultIcons: data.defaultIcons,
    setDefaultIcon,
  };
}

export type MaterialSettingsState = ReturnType<typeof useMaterialSettings>;
