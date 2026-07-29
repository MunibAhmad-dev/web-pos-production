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

export async function mfgCreateSale(payload) {
  const id = Date.now(); // timestamp-based — safely above Electron's SQLite sequential IDs
  const fullPayload = { ...payload, id };
  const result = await request('/sync', {
    method: 'POST',
    body: JSON.stringify({
      items: [{
        entity_type: 'sale',
        operation: 'create',
        payload: fullPayload,
        local_id: id,
      }],
    }),
  });
  return { ...result, sale_id: id };
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
