import { useEffect, useState } from 'react';
import { Store } from 'lucide-react';

/**
 * Full-screen loader shown while the session is checked and the shop's data loads.
 * Theme tokens are already complete colours (hsl(...)), so they're used as var(--x) directly —
 * wrapping them in hsl() again made the old loader's colours invalid.
 */
const STYLES = `
@keyframes ls-orbit { to { transform: rotate(360deg); } }
@keyframes ls-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.035); } }
@keyframes ls-glide { 0% { transform: translateX(-110%); } 100% { transform: translateX(260%); } }
@keyframes ls-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes ls-halo { 0%, 100% { opacity: .55; transform: scale(.96); } 50% { opacity: 1; transform: scale(1.04); } }
.ls-root { animation: ls-rise .5s cubic-bezier(.2,.8,.2,1) both; }
.ls-tile { animation: ls-breathe 2.8s ease-in-out infinite; }
.ls-orbit { animation: ls-orbit 1.6s cubic-bezier(.55,.15,.45,.85) infinite; }
.ls-orbit-slow { animation: ls-orbit 7s linear infinite; }
.ls-bar { animation: ls-glide 1.35s cubic-bezier(.45,.05,.55,.95) infinite; }
.ls-halo { animation: ls-halo 3.2s ease-in-out infinite; }
.ls-msg { animation: ls-rise .35s ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .ls-root, .ls-tile, .ls-orbit, .ls-orbit-slow, .ls-bar, .ls-halo, .ls-msg { animation: none !important; }
}
`;

function storeName() {
  try { return JSON.parse(localStorage.getItem('shop_session') || 'null')?.store_name || ''; } catch { return ''; }
}

export default function LoadingScreen({ message = 'Starting up…', submessage = '' }) {
  const [name] = useState(storeName);
  // Reassure on slow connections instead of looking stuck.
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 7000); return () => clearTimeout(t); }, []);

  return (
    <div role="status" aria-live="polite" aria-busy="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-background px-6">
      <style>{STYLES}</style>

      {/* soft halo behind the mark */}
      <div aria-hidden="true" className="ls-halo pointer-events-none absolute left-1/2 top-[44%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, color-mix(in oklab, var(--primary) 16%, transparent) 0%, transparent 62%)' }} />

      <div className="ls-root relative flex w-full max-w-[320px] flex-col items-center text-center">
        {/* mark */}
        <div className="relative h-[104px] w-[104px]">
          <svg aria-hidden="true" viewBox="0 0 104 104" className="ls-orbit-slow absolute inset-0 h-full w-full">
            <circle cx="52" cy="52" r="50" fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="2 6" />
          </svg>
          <svg aria-hidden="true" viewBox="0 0 104 104" className="ls-orbit absolute inset-0 h-full w-full">
            <circle cx="52" cy="52" r="44" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="56 220" />
          </svg>
          <div className="ls-tile absolute inset-[22px] flex items-center justify-center rounded-[18px] text-primary-foreground"
            style={{
              background: 'linear-gradient(145deg, color-mix(in oklab, var(--primary) 88%, white), var(--primary) 55%, color-mix(in oklab, var(--primary) 80%, black))',
              boxShadow: '0 14px 34px -10px color-mix(in oklab, var(--primary) 55%, transparent), inset 0 1px 0 rgba(255,255,255,.25)',
            }}>
            <Store size={26} strokeWidth={2.1} />
          </div>
        </div>

        {name && <p className="mt-7 text-[12px] font-medium uppercase tracking-[0.16em] text-muted-foreground truncate max-w-full">{name}</p>}
        <h2 key={message} className={`ls-msg ${name ? 'mt-2' : 'mt-7'} text-[18px] font-semibold tracking-tight text-foreground`}>{message}</h2>
        {submessage && <p key={submessage} className="ls-msg mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{submessage}</p>}

        {/* progress */}
        <div className="mt-7 h-1 w-40 overflow-hidden rounded-full bg-muted">
          <div className="ls-bar h-full w-2/5 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, var(--primary), transparent)' }} />
        </div>

        <p className={`mt-5 text-[12px] text-muted-foreground transition-opacity duration-500 ${slow ? 'opacity-100' : 'opacity-0'}`}>
          Taking a little longer on this connection — your data is on its way.
        </p>
        <span className="sr-only">Loading</span>
      </div>
    </div>
  );
}
