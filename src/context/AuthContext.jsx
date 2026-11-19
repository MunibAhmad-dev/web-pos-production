import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSession, loginShop, registerShop, logoutShop, fetchInstanceStatus, hasApiKey } from '../api/cloudAuth';
import { clearDataCache } from '../store/dataStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => getSession());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasApiKey()) {
      setLoading(false);
      return;
    }
    fetchInstanceStatus()
      .then((status) => {
        setSession((prev) =>
          prev
            ? { ...prev, approval_status: status.approval_status, store_name: status.store_name || prev.store_name, cloud_blocked: status.cloud_blocked, block_reason: status.block_reason || "", days_remaining: status.days_remaining ?? prev.days_remaining }
            : prev
        );
      })
      .catch(() => {
        // Same clean-up as a manual sign-out: the cached data and sync position belong to this account.
        clearDataCache().catch(() => {});
        logoutShop();
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (mobile, password) => {
    const s = await loginShop({ mobile, password });
    // Never start from a cache left by another account (or an expired session): its sync position
    // would skip this shop's history and every page would show zero.
    await clearDataCache().catch(() => {});
    setSession(s);
    return s;
  }, []);

  const register = useCallback(async (payload) => {
    const s = await registerShop(payload);
    await clearDataCache().catch(() => {});
    setSession(s);
    return s;
  }, []);

  // Sign-out leaves nothing of this shop behind: the local database is emptied (awaited), every
  // shop key is removed, and the page reloads so no data stays in memory for the next account.
  const logout = useCallback(async () => {
    await clearDataCache().catch(() => {});
    logoutShop();
    setSession(null);
    window.location.replace('/login');
  }, []);

  const refreshStatus = useCallback(async () => {
    const status = await fetchInstanceStatus();
    setSession((prev) =>
      prev
        ? { ...prev, approval_status: status.approval_status, cloud_blocked: status.cloud_blocked, block_reason: status.block_reason || "", days_remaining: status.days_remaining ?? prev.days_remaining }
        : prev
    );
    return status;
  }, []);

  return (
    <AuthContext.Provider value={{ user: session, loading, login, register, logout, refreshStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
