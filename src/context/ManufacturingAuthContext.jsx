import { createContext, useContext, useState, useCallback } from 'react';
import { mfgLogin as apiLogin, mfgRegister as apiRegister, mfgGetStatus } from '../api/manufacturingApi';

const MFG_KEY = 'mfg_user';

// Stored shape: { mobile, api_key, company_name, approval_status }
const ManufacturingAuthContext = createContext(null);

export function ManufacturingAuthProvider({ children }) {
  const [mfgUser, setMfgUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(MFG_KEY) || 'null'); }
    catch { return null; }
  });

  // Calls real API, stores api_key + metadata in localStorage
  const mfgLogin = useCallback(async ({ mobile, password }) => {
    const data = await apiLogin({ mobile, password });
    const user = {
      mobile,
      api_key: data.api_key,
      company_name: data.company_name || '',
      approval_status: data.approval_status,
      license_plan: data.license_plan,
    };
    localStorage.setItem(MFG_KEY, JSON.stringify(user));
    setMfgUser(user);
    return data;
  }, []);

  // Calls real API to register, then logs in
  const mfgRegister = useCallback(async ({ mobile, password, company_name }) => {
    const data = await apiRegister({ mobile, password, company_name });
    const user = {
      mobile,
      api_key: data.api_key,
      company_name: company_name || '',
      approval_status: data.approval_status,
      license_plan: data.license_plan,
    };
    localStorage.setItem(MFG_KEY, JSON.stringify(user));
    setMfgUser(user);
    return data;
  }, []);

  const mfgRefreshStatus = useCallback(async () => {
    const data = await mfgGetStatus();
    setMfgUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, approval_status: data.approval_status };
      localStorage.setItem(MFG_KEY, JSON.stringify(updated));
      return updated;
    });
    return data;
  }, []);

  const mfgLogout = useCallback(() => {
    localStorage.removeItem(MFG_KEY);
    setMfgUser(null);
  }, []);

  return (
    <ManufacturingAuthContext.Provider value={{ mfgUser, mfgLogin, mfgRegister, mfgLogout, mfgRefreshStatus }}>
      {children}
    </ManufacturingAuthContext.Provider>
  );
}

export function useMfgAuth() {
  return useContext(ManufacturingAuthContext);
}
