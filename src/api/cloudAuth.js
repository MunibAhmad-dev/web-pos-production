import cloudApi from './cloudClient';

const SESSION_KEY = 'shop_session';
const API_KEY = 'shop_api_key';

// Shape kept in localStorage/session state — deliberately small, everything
// else (products, sales, ...) lives in the dataStore, hydrated separately.
function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Registers a brand-new shop. Reuses the same public endpoint the desktop
 * app's "Setup" screen calls (POST /api/register-business) — a new Instance
 * is created with approval_status='pending' until OsaTech approves it.
 */
export async function registerShop({ mobile, password, businessName, ownerName, address, email }) {
  const { data } = await cloudApi.post('/register-business', {
    mobile,
    password,
    businessName,
    ownerName,
    address,
    email,
    mode: 'register',
  });
  if (!data.success) throw new Error(data.error || 'Registration failed');

  localStorage.setItem(API_KEY, data.api_key);
  return saveSession({
    instance_id: data.instance_id,
    store_name: businessName || '',
    owner_name: ownerName || '',
    store_address: address || '',
    owner_email: email || '',
    mobile,
    approval_status: data.approval_status,
  });
}

/**
 * Logs into an existing shop (mobile + password) — same idempotent endpoint,
 * mode:'signin'. Works whether the shop was originally registered from the
 * desktop app or from this web app; both write to the same Instance row.
 */
export async function loginShop({ mobile, password }) {
  const { data } = await cloudApi.post('/register-business', {
    mobile,
    password,
    mode: 'signin',
  });
  if (!data.success) throw new Error(data.error || 'Login failed');

  // Sanity-check: backend should only reach here for existing accounts, but
  // guard against any edge-case where a new pending account slips through.
  if (data.message !== 'Already registered') {
    throw new Error('No account found for this mobile number. Please register your store first.');
  }

  localStorage.setItem(API_KEY, data.api_key);
  return saveSession({
    instance_id: data.instance_id,
    store_name: data.store_name || '',
    owner_name: data.owner_name || '',
    store_address: data.store_address || '',
    owner_email: data.owner_email || '',
    mobile,
    approval_status: data.approval_status,
  });
}

/** Polled after registration, mirrors the desktop Setup screen's polling loop. */
export async function checkApprovalStatus(instanceId) {
  const { data } = await cloudApi.get('/approval-status', { params: { instance_id: instanceId } });
  return data;
}

/** Refreshes approval/license/block status for the logged-in instance. */
export async function fetchInstanceStatus() {
  const { data } = await cloudApi.get('/instances/status');
  const session = getSession();
  if (session) {
    saveSession({
      ...session,
      approval_status: data.approval_status,
      store_name: data.store_name || session.store_name,
      cloud_blocked: data.cloud_blocked ?? session.cloud_blocked,
      days_remaining: data.days_remaining ?? session.days_remaining,
    });
  }
  return data;
}

/**
 * Display preferences that belong to this browser, not to a shop — everything else is wiped on
 * sign-out (login, receipt/FBR/module settings, PIN, reminder snoozes, sync cursor, thresholds…),
 * so the next account never sees anything from this one. A list of keys to delete always fell
 * behind as features added new keys; keeping a short allow-list doesn't.
 */
const DEVICE_PREF_KEYS = new Set(['theme', 'sidebar_collapsed', 'pos_nav_closed_groups', 'pos_product_view']);

export function logoutShop() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    for (const k of keys) if (k && !DEVICE_PREF_KEYS.has(k)) localStorage.removeItem(k);
  } catch { /* storage blocked — nothing stored either */ }
  try { sessionStorage.clear(); } catch { /* ignore */ }
}

export function hasApiKey() {
  return Boolean(localStorage.getItem(API_KEY));
}
