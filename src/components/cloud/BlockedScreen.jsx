/**
 * Shown when OsaTech has paused this shop (license or cloud access). Same calm dark design as the
 * desktop app: what happened, the admin's message, WhatsApp support, and an automatic re-check.
 */
import { useEffect, useRef, useState } from 'react';
import { Lock, MessageCircle, RefreshCw, Copy, Check, LogOut, CloudOff } from 'lucide-react';

const NUMBER = '+92 329 8748232';
const WA = 'https://wa.me/923298748232';
const POLL = 30;
const STYLES = `
@keyframes wbs-in { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes wbs-float { 0%,100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-52%) scale(1.06); } }
@keyframes wbs-spin { to { transform: rotate(360deg); } }
.wbs-in { animation: wbs-in .6s cubic-bezier(.2,.8,.2,1) both; } .wbs-orb { animation: wbs-float 9s ease-in-out infinite; } .wbs-spin { animation: wbs-spin 1s linear infinite; }
@media (prefers-reduced-motion: reduce) { .wbs-in, .wbs-orb, .wbs-spin { animation: none !important; } }
`;

export default function BlockedScreen({ storeName, reason, cloudOnly, onCheck, onSignOut }) {
  const [left, setLeft] = useState(POLL);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const busy = useRef(false);
  const check = async () => {
    if (busy.current) return;
    busy.current = true; setChecking(true);
    try { await onCheck?.(); } catch { /* still blocked or offline */ } finally { busy.current = false; setChecking(false); setLeft(POLL); }
  };
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => { if (s <= 1) { check(); return POLL; } return s - 1; }), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pct = ((POLL - left) / POLL) * 100;
  const msg = encodeURIComponent(`Assalam o Alaikum, my OsaTech web POS${storeName ? ` (${storeName})` : ''} shows "access paused". Please help.`);

  return (
    <div className="fixed inset-0 overflow-y-auto text-white" style={{ background: 'radial-gradient(120% 90% at 50% 0%, #1b1f2e 0%, #0b0d14 55%, #07080c 100%)', colorScheme: 'dark' }}>
      <style>{STYLES}</style>
      <div aria-hidden="true" className="wbs-orb pointer-events-none fixed left-1/2 top-[30%] h-[520px] w-[520px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(244,63,94,.16) 0%, rgba(168,85,247,.08) 40%, transparent 68%)', filter: 'blur(8px)' }} />
      <div className="relative flex min-h-full items-center justify-center px-5 py-12">
        <div className="wbs-in w-full max-w-[440px]">
          <div className="rounded-[32px] border border-white/10 bg-white/[0.045] px-7 pb-8 pt-10 text-center shadow-[0_40px_120px_-40px_rgba(0,0,0,.8)] backdrop-blur-2xl sm:px-9">
            <div className="relative mx-auto h-[76px] w-[76px]">
              <span className="absolute inset-0 rounded-[24px] bg-gradient-to-br from-rose-500 to-fuchsia-600 opacity-30 blur-xl" />
              <span className="relative flex h-full w-full items-center justify-center rounded-[24px] bg-gradient-to-br from-rose-500 to-fuchsia-600 shadow-lg ring-1 ring-white/20">
                {cloudOnly ? <CloudOff size={30} /> : <Lock size={30} strokeWidth={2.2} />}
              </span>
            </div>
            <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.18em] text-rose-300/90">Access paused</p>
            <h1 className="mt-2 text-[25px] font-semibold leading-tight tracking-tight">{storeName ? `${storeName} is paused` : 'This shop is paused'}</h1>
            <p className="mt-3 text-[14px] leading-relaxed text-white/60">
              OsaTech has paused {cloudOnly ? 'cloud access' : 'the license'} for this shop. Your data is safe — it opens again the moment it's restored.
            </p>
            {reason && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Message from OsaTech</p>
                <p className="mt-1 text-[14px] leading-relaxed text-white/85">{reason}</p>
              </div>
            )}
            <a href={`${WA}?text=${msg}`} target="_blank" rel="noopener noreferrer"
              className="mt-7 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#25d366] text-[15px] font-semibold text-[#052e16] shadow-lg transition-transform hover:brightness-105 active:scale-[0.98]">
              <MessageCircle size={18} /> WhatsApp OsaTech
            </a>
            <button type="button" onClick={() => { navigator.clipboard?.writeText(NUMBER.replace(/\s/g, '')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {}); }}
              className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] tabular-nums text-white/55 hover:text-white">
              {NUMBER} · 9 am – 9 pm {copied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
            </button>
            <div className="mt-7 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span className="relative h-9 w-9 shrink-0">
                <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(167,139,250,.9)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 94.2} 94.2`} style={{ transition: 'stroke-dasharray 1s linear' }} />
                </svg>
                <RefreshCw size={13} className={`absolute inset-0 m-auto text-violet-200 ${checking ? 'wbs-spin' : ''}`} />
              </span>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[13px] font-medium text-white/85">{checking ? 'Checking with OsaTech…' : 'Checking again automatically'}</p>
                <p className="text-[12px] tabular-nums text-white/45">{checking ? 'One moment' : `Next check in ${left}s`}</p>
              </div>
              <button type="button" onClick={check} disabled={checking} className="h-9 rounded-full bg-white/10 px-4 text-[13px] font-medium hover:bg-white/15 disabled:opacity-50">Check now</button>
            </div>
            {onSignOut && (
              <button type="button" onClick={onSignOut} className="mx-auto mt-5 flex items-center gap-1.5 text-[12px] text-white/45 hover:text-white/80">
                <LogOut size={13} /> Sign out of this shop
              </button>
            )}
          </div>
          <p className="mt-6 text-center text-[11px] text-white/30">OsaTech Web POS</p>
        </div>
      </div>
    </div>
  );
}
