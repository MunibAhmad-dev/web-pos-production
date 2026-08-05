import { useState, useCallback } from 'react';

const KEY = 'pos_module_settings';
const DEFAULTS = {
  bakery_module_enabled: false,
  dry_fruits_module_enabled: false,
  pharmacy_module_enabled: false,
};

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}

export function useModuleSettings() {
  const [modules, setModules] = useState(load);

  const toggle = useCallback((key) => {
    setModules((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const set = useCallback((key, value) => {
    setModules((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { modules, toggle, set };
}

export function getModuleSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}
