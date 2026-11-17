import { useState } from 'react';

export const WHATSAPP_NUMBER = '923298748232';
export const waLink = (msg) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;

/** Same checks the server applies, so mistakes show before submitting. */
export const isValidMobile = (m) => /^\d{10,15}$/.test(String(m || '').replace(/[\s\-+()]/g, ''));

/** Friendly message for any auth error, including the new rate limit (429). */
export function authErrorMessage(err, fallback) {
  const status = err?.response?.status;
  const server = err?.response?.data?.error;
  if (status === 429) return server || 'Too many attempts. Please wait a while and try again.';
  if (!err?.response && err?.message === 'Network Error') return 'Can’t reach the server. Check your internet connection and try again.';
  return server || err?.message || fallback;
}

export function usePasswordToggle() {
  const [shown, setShown] = useState(false);
  return { shown, toggle: () => setShown(s => !s), type: shown ? 'text' : 'password' };
}
