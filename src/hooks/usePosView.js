import { useEffect, useState } from 'react';

const KEY = 'pos_product_view';
const EVENT = 'pos-product-view-change';

/** 'list' (default) or 'cards' (product cards, like the desktop POS). */
export function getPosView() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'cards' || v === 'grid' ? 'cards' : 'list';
  } catch {
    return 'list';
  }
}

export function setPosView(view) {
  try { localStorage.setItem(KEY, view === 'cards' ? 'cards' : 'list'); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Live value of the Sales-screen product display setting (Settings → Sales screen). */
export function usePosView() {
  const [view, setView] = useState(getPosView);
  useEffect(() => {
    const sync = () => setView(getPosView());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  return view;
}
