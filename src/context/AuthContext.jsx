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
            ? { ...prev, approval_status: status.approval_status, store_name: status.store_name || prev.store_name, cloud_blocked: status.cloud_blocked, days_remaining: status.days_remaining ?? prev.days_remaining }
            : prev
        );
      })
      .catch(() => {
        logoutShop();
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (mobile, password) => {
    const s = await loginShop({ mobile, password });
    setSession(s);
    return s;
  }, []);

  const register = useCallback(async (payload) => {
    const s = await registerShop(payload);
    setSession(s);
    return s;
  }, []);

  const logout = useCallback(() => {
    clearDataCache().catch(() => {}); // async IDB clear, fire and forget
    logoutShop();
    setSession(null);
  }, []);

  const refreshStatus = useCallback(async () => {
    const status = await fetchInstanceStatus();
    setSession((prev) =>
      prev
        ? { ...prev, approval_status: status.approval_status, cloud_blocked: status.cloud_blocked, days_remaining: status.days_remaining ?? prev.days_remaining }
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
