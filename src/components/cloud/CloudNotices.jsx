/**
 * OsaTech Cloud announcements on the web POS — same look as the desktop app: a translucent
 * scrolling bar for "marquee" notices and a glass popup for "popup" notices; "banner" notices show
 * as a toast. Uses ?peek=1 so the browser never marks notices read for the shop's PCs, and keeps
 * what it already showed in this browser (cleared on sign-out with the rest of the shop's keys).
 */
import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import cloudApi from '@/api/cloudClient';
import { useToast } from '@/context/ToastContext';
import { cn } from '@/lib/utils';

const ACCENTS = {
  violet: ['#7c3aed', '#c026d3'], emerald: ['#059669', '#10b981'], crimson: ['#dc2626', '#f97316'],
  ocean: ['#0284c7', '#6366f1'], golden: ['#d97706', '#f59e0b'], midnight: ['#4338ca', '#7c3aed'],
  neon: ['#16a34a', '#22d3ee'], rose: ['#e11d48', '#fb7185'], teal: ['#0d9488', '#2dd4bf'],
  slate: ['#475569', '#64748b'], glass: ['#3b82f6', '#8b5cf6'],
};
const accentOf = (s) => ACCENTS[s] || ACCENTS.violet;
const hasUrdu = (s) => /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(s || '');
const SEEN_KEY = 'cloud_notices_seen';
const readSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); } };
const writeSeen = (set) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...set].slice(-200))); } catch { /* ignore */ } };

const KEYFRAMES = `
@keyframes wcn-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes wcn-scroll-rtl { from { transform: translateX(-50%); } to { transform: translateX(0); } }
@keyframes wcn-pulse { 0% { transform: scale(1); opacity: .7; } 70%,100% { transform: scale(2.4); opacity: 0; } }
@keyframes wcn-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
.wcn-scroll { animation: wcn-scroll linear infinite; } .wcn-scroll-rtl { animation: wcn-scroll-rtl linear infinite; }
.wcn-pulse { animation: wcn-pulse 2s cubic-bezier(.2,.6,.4,1) infinite; } .wcn-in { animation: wcn-in .35s cubic-bezier(.2,.8,.2,1) both; }
.wcn-track:hover .wcn-scroll, .wcn-track:hover .wcn-scroll-rtl { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .wcn-scroll, .wcn-scroll-rtl, .wcn-pulse, .wcn-in { animation: none !important; } }
`;

export function AnnouncementBar({ items, onDismiss }) {
  if (!items.length) return null;
  const [a, b] = accentOf(items[0].style);
  const text = items.map((i) => (i.body ? `${i.title} — ${i.body}` : i.title)).join('     •     ');
  const urdu = hasUrdu(text);
  const duration = Math.min(70, Math.max(20, text.length * 0.18));
  return (
    <div role="region" aria-label="Announcement from OsaTech" className="wcn-in relative mb-4 overflow-hidden rounded-2xl border backdrop-blur-xl"
      style={{ background: `linear-gradient(100deg, color-mix(in oklab, ${a} 14%, transparent), color-mix(in oklab, ${b} 9%, transparent))`, borderColor: `color-mix(in oklab, ${a} 28%, transparent)`, boxShadow: `0 8px 28px -14px color-mix(in oklab, ${a} 55%, transparent)` }}>
      <style>{KEYFRAMES}</style>
      <div className="relative flex items-center gap-3 py-2 pl-2.5 pr-2">
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: `linear-gradient(140deg, ${a}, ${b})`, boxShadow: `0 4px 12px -4px ${a}` }}>
          <Megaphone size={15} />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5">
            <span className="wcn-pulse absolute inset-0 rounded-full" style={{ background: a }} />
            <span className="absolute inset-0 rounded-full ring-2 ring-background" style={{ background: a }} />
          </span>
        </span>
        <span className="hidden shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] sm:block" style={{ color: a }}>OsaTech</span>
        <div className="wcn-track relative min-w-0 flex-1 overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent)' }}>
          <div dir={urdu ? 'rtl' : 'ltr'} className={cn('inline-block whitespace-nowrap text-[14px] font-medium text-foreground', urdu ? 'wcn-scroll-rtl text-[16px]' : 'wcn-scroll')} style={{ animationDuration: `${duration}s` }}>
            {text}<span className="inline-block w-24" />{text}<span className="inline-block w-24" />
          </div>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Hide announcement" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"><X size={15} /></button>
      </div>
    </div>
  );
}

export function CloudPopup({ notice, onClose }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' || e.key === 'Enter') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  if (!notice) return null;
  const [a, b] = accentOf(notice.style);
  const urdu = hasUrdu(`${notice.title}${notice.body || ''}`);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[6px]" onClick={onClose} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="wcn-title" className="wcn-in relative w-full max-w-[420px] overflow-hidden rounded-[28px] border border-white/10 bg-background/85 shadow-2xl backdrop-blur-2xl">
        <style>{KEYFRAMES}</style>
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-36" style={{ background: `radial-gradient(120% 90% at 50% 0%, color-mix(in oklab, ${a} 30%, transparent), transparent 70%)` }} />
        <div className="relative px-7 pb-6 pt-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] text-white" style={{ background: `linear-gradient(140deg, ${a}, ${b})`, boxShadow: `0 14px 30px -12px ${a}` }}><Megaphone size={24} /></span>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: a }}>From OsaTech</p>
          <h2 id="wcn-title" dir={urdu ? 'rtl' : 'ltr'} className="mt-1.5 text-[20px] font-semibold leading-snug tracking-tight text-foreground">{notice.title}</h2>
          {notice.body && <p dir={urdu ? 'rtl' : 'ltr'} className={cn('mt-3 max-h-[40vh] overflow-y-auto whitespace-pre-line leading-relaxed text-muted-foreground', urdu ? 'text-[17px]' : 'text-[14px]')}>{notice.body}</p>}
          <button type="button" autoFocus onClick={onClose} className="mt-7 h-12 w-full rounded-2xl text-[15px] font-semibold text-white outline-none transition-transform focus-visible:ring-4 focus-visible:ring-white/20 active:scale-[0.98]"
            style={{ background: `linear-gradient(140deg, ${a}, ${b})`, boxShadow: `0 10px 24px -12px ${a}` }}>Got it</button>
        </div>
      </div>
    </div>
  );
}

/** Polls the cloud every 5 minutes and renders the bar + popup queue. Mount once inside the layout. */
export default function CloudNotices() {
  const { showToast } = useToast();
  const [marquees, setMarquees] = useState([]);
  const [queue, setQueue] = useState([]);
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const { data } = await cloudApi.get('/instances/notifications', { params: { peek: 1 } });
        if (!live || !data?.success) return;
        const seen = readSeen();
        setMarquees((data.marquees || []).filter((m) => !seen.has(`m${m.id}`)));
        const fresh = (data.data || []).filter((n) => n.display_type !== 'marquee' && !seen.has(`n${n.id}`));
        for (const n of fresh) {
          if (n.display_type === 'popup') setQueue((q) => (q.some((x) => x.id === n.id) ? q : [...q, n]));
          else { showToast(n.body ? `${n.title} — ${n.body}` : n.title); seen.add(`n${n.id}`); }
        }
        writeSeen(seen);
      } catch { /* offline or blocked — nothing to show */ }
    };
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => { live = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dismissBar = () => { const s = readSeen(); marquees.forEach((m) => s.add(`m${m.id}`)); writeSeen(s); setMarquees([]); };
  const closePopup = () => { const [n, ...rest] = queue; if (n) { const s = readSeen(); s.add(`n${n.id}`); writeSeen(s); } setQueue(rest); };
  return (
    <>
      <AnnouncementBar items={marquees} onDismiss={dismissBar} />
      <CloudPopup notice={queue[0]} onClose={closePopup} />
    </>
  );
}
