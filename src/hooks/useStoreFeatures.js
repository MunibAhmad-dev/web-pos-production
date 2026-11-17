import { useMemo } from 'react';
import { useDataStore } from '@/store/dataStore';
import { useModuleSettings } from './useModuleSettings';

/**
 * Which optional modules this shop uses. Read from the settings the desktop app syncs, so the
 * web sidebar shows the same module sections as the counter PC; the browser's own module
 * toggles (Settings → Modules on the web) can switch a module on as well.
 */
export function useStoreFeatures() {
  const { list } = useDataStore();
  const { modules } = useModuleSettings();
  return useMemo(() => {
    let s = {};
    try { s = list('settings')?.[0] || {}; } catch { s = {}; }
    const on = (key) => Number(s[key]) === 1 || s[key] === true || !!modules[key];
    return {
      wholesale: on('wholesale_module_enabled'),
      mobile: on('mobile_module_enabled'),
      pharmacy: on('pharmacy_module_enabled'),
      dms: on('dms_module_enabled'),
    };
  }, [list, modules]);
}
