// Manufacturing ERP cloud API client
// Base URL: https://osatechcloud.cloud/api/manufacturing
// Auth: Bearer <api_key> stored in localStorage (mfg_user.api_key)

const BASE = `${import.meta.env.VITE_API_URL}/manufacturing`;

function getApiKey() {
  try {
    const u = JSON.parse(localStorage.getItem('mfg_user') || 'null');
    return u?.api_key || null;
  } catch { return null; }
}

async function request(path, options = {}) {
  const apiKey = getApiKey();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
export async function mfgRegister({ mobile, password, company_name }) {
  return request('/register', {
    method: 'POST',
    body: JSON.stringify({ mobile, password, company_name, app_version: 'web-1.0' }),
  });
}

export async function mfgLogin({ mobile, password }) {
  return request('/login', {
    method: 'POST',
    body: JSON.stringify({ mobile, password }),
  });
}

export async function mfgGetStatus() {
  return request('/status');
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
export async function mfgGetDashboard({ start_date, end_date } = {}) {
  const params = new URLSearchParams();
  if (start_date) params.set('start_date', start_date);
  if (end_date)   params.set('end_date',   end_date);
  const qs = params.toString();
  return request(`/dashboard${qs ? `?${qs}` : ''}`);
}

// ─── Cloud counts ──────────────────────────────────────────────────────────────
export async function mfgGetCloudCounts() {
  return request('/cloud-counts');
}

// ─── Notifications ─────────────────────────────────────────────────────────────
export async function mfgGetNotifications() {
  return request('/notifications');
}

// ─── Reports ───────────────────────────────────────────────────────────────────
export async function mfgGetReports({ period, start_date, end_date } = {}) {
  const params = new URLSearchParams();
  if (period)     params.set('period',     period);
  if (start_date) params.set('start_date', start_date);
  if (end_date)   params.set('end_date',   end_date);
  const qs = params.toString();
  return request(`/reports${qs ? `?${qs}` : ''}`);
}

// ─── Sell / POS ────────────────────────────────────────────────────────────────
export async function mfgGetSellItems({ search } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const qs = params.toString();
  return request(`/sell-items${qs ? `?${qs}` : ''}`);
}

export async function mfgCreateSale(payload, stockUpdates = []) {
  const id = Date.now(); // timestamp-based — safely above Electron's SQLite sequential IDs
  const fullPayload = { ...payload, id };
  const items = [
    { entity_type: 'sale', operation: 'create', payload: fullPayload, local_id: id },
    ...stockUpdates.map(u => ({
      entity_type: u.entity_type,
      operation: 'update',
      payload: u.payload,
      local_id: Number(u.payload.id),
    })),
  ];
  const result = await request('/sync', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
  return { ...result, sale_id: id };
}

export async function mfgCreatePurchase(payload, stockUpdates = []) {
  const items = [];
  if (payload) {
    const id = Date.now();
    items.push({ entity_type: 'purchase', operation: 'create', payload: { ...payload, id }, local_id: id });
  }
  items.push(...stockUpdates.map(u => ({
    entity_type: u.entity_type,
    operation:   'update',
    payload:     u.payload,
    local_id:    Number(u.payload.id),
  })));
  return request('/sync', { method: 'POST', body: JSON.stringify({ items }) });
}

// ─── Parts CRUD ────────────────────────────────────────────────────────────────
export async function mfgGetParts({ search } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const qs = params.toString();
  return request(`/parts${qs ? `?${qs}` : ''}`);
}

export async function mfgCreatePart(payload) {
  return request('/parts', { method: 'POST', body: JSON.stringify(payload) });
}

export async function mfgUpdatePart(id, payload) {
  return request(`/parts/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function mfgAdjustPartStock(id, stock) {
  return request(`/parts/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ stock }) });
}

export async function mfgDeletePart(id) {
  return request(`/parts/${id}`, { method: 'DELETE' });
}

// ─── Products (Air Coolers) CRUD ───────────────────────────────────────────────
export async function mfgGetProducts({ search } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const qs = params.toString();
  return request(`/products${qs ? `?${qs}` : ''}`);
}

export async function mfgCreateProduct(payload) {
  return request('/products', { method: 'POST', body: JSON.stringify(payload) });
}

export async function mfgUpdateProduct(id, payload) {
  return request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function mfgDeleteProduct(id) {
  return request(`/products/${id}`, { method: 'DELETE' });
}

// ─── Vendors ───────────────────────────────────────────────────────────────────
export async function mfgGetVendors({ search } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const qs = params.toString();
  return request(`/vendors${qs ? `?${qs}` : ''}`);
}
export async function mfgGetVendorProfile(id) {
  return request(`/vendors/${id}/profile`);
}
export async function mfgCreateVendor(payload) {
  return request('/vendors', { method: 'POST', body: JSON.stringify(payload) });
}
export async function mfgUpdateVendor(id, payload) {
  return request(`/vendors/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export async function mfgDeleteVendor(id) {
  return request(`/vendors/${id}`, { method: 'DELETE' });
}

// ─── Customers ─────────────────────────────────────────────────────────────────
export async function mfgGetCustomers({ search } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const qs = params.toString();
  return request(`/customers${qs ? `?${qs}` : ''}`);
}
export async function mfgGetCustomerProfile(id) {
  return request(`/customers/${id}/profile`);
}
export async function mfgCreateCustomer(payload) {
  return request('/customers', { method: 'POST', body: JSON.stringify(payload) });
}
export async function mfgUpdateCustomer(id, payload) {
  return request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export async function mfgDeleteCustomer(id) {
  return request(`/customers/${id}`, { method: 'DELETE' });
}

// ─── Accounts / Accounting ─────────────────────────────────────────────────────
export async function mfgGetAccounts() {
  return request('/accounts');
}
export async function mfgCreateAccount(payload) {
  return request('/accounts', { method: 'POST', body: JSON.stringify(payload) });
}
export async function mfgUpdateAccount(id, payload) {
  return request(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export async function mfgDeleteAccount(id) {
  return request(`/accounts/${id}`, { method: 'DELETE' });
}
export async function mfgTransfer(payload) {
  return request('/accounts/transfer', { method: 'POST', body: JSON.stringify(payload) });
}
export async function mfgGetLedger({ limit = 50, offset = 0 } = {}) {
  return request(`/accounting/ledger?limit=${limit}&offset=${offset}`);
}

// ─── Expenses ──────────────────────────────────────────────────────────────────
export async function mfgGetExpenses({ search } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const qs = params.toString();
  return request(`/expenses${qs ? `?${qs}` : ''}`);
}
export async function mfgCreateExpense(payload) {
  return request('/expenses', { method: 'POST', body: JSON.stringify(payload) });
}
export async function mfgDeleteExpense(id) {
  return request(`/expenses/${id}`, { method: 'DELETE' });
}

// ─── Invoices ──────────────────────────────────────────────────────────────────
export async function mfgGetInvoices({ type, status, search, page, limit } = {}) {
  const params = new URLSearchParams();
  if (type   && type   !== 'all') params.set('type',   type);
  if (status && status !== 'all') params.set('status', status);
  if (search) params.set('search', search);
  if (page)   params.set('page',   String(page));
  if (limit)  params.set('limit',  String(limit));
  const qs = params.toString();
  return request(`/invoices${qs ? `?${qs}` : ''}`);
}
