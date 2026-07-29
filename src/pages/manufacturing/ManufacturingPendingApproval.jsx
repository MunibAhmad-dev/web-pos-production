import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldAlert, LogOut, RefreshCw, Factory, CheckCircle2 } from 'lucide-react';
import { useMfgAuth } from '../../context/ManufacturingAuthContext';

const GRAD = 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 30%, #C7D2FE 65%, #BFDBFE 100%)';
const PURPLE = '#7C3AED';

const STYLE = `
  @keyframes ping { 0%{transform:scale(1);opacity:.8} 100%{transform:scale(1.7);opacity:0} }
  @keyframes spin { to { transform: rotate(360deg); } }
  .mfg-ping { animation: ping 1.8s ease-out infinite; }
  .mfg-spin { animation: spin 1.2s linear infinite; }
`;

export default function ManufacturingPendingApproval() {
  const { mfgUser, mfgLogout, mfgRefreshStatus } = useMfgAuth();
  const [checking,  setChecking]  = useState(false);
  const [countdown, setCountdown] = useState(15);

  /* Auto-poll every 15 s */
  useEffect(() => {
    if (!mfgUser || mfgUser.approval_status === 'approved') return;
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          mfgRefreshStatus().catch(() => {});
          return 15;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [mfgUser, mfgRefreshStatus]);

  if (!mfgUser) return <Navigate to="/manufacturing/login" replace />;
  if (mfgUser.approval_status === 'approved') return <Navigate to="/manufacturing/dashboard" replace />;

  const blocked = mfgUser.approval_status === 'blocked';

  async function handleCheck() {
    setChecking(true);
    setCountdown(15);
    try { await mfgRefreshStatus(); } finally { setChecking(false); }
  }

  return (
    <>
      <style>{STYLE}</style>
      <div style={{
        minHeight: '100vh', background: GRAD,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '32px 24px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Bokeh */}
        {[{ top: '5%', left: '8%', s: 220 }, { bottom: '8%', right: '6%', s: 260 }, { top: '45%', left: '55%', s: 150 }].map((b, i) => (
          <div key={i} style={{ position: 'absolute', borderRadius: '50%', background: 'rgba(255,255,255,0.5)', filter: 'blur(55px)', width: b.s, height: b.s, top: b.top, left: b.left, right: b.right, bottom: b.bottom, pointerEvents: 'none' }} />
        ))}

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: PURPLE, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }}>
            <Factory size={15} color="white" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 17, color: '#111' }}>OsaTech</span>
        </div>

        {/* Card */}
        <div style={{
          position: 'relative', zIndex: 2,
          background: 'white', borderRadius: 28,
          padding: '48px 40px', maxWidth: 440, width: '100%',
          boxShadow: '0 32px 80px rgba(0,0,0,0.10)',
          textAlign: 'center',
        }}>

          {/* Icon with pulse */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
            {!blocked && (
              <div className="mfg-ping" style={{
                position: 'absolute', width: 80, height: 80, borderRadius: '50%',
                background: PURPLE + '22',
              }} />
            )}
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: blocked ? '#FEF2F2' : '#F5F3FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: blocked ? '0 0 0 8px #FEE2E2' : `0 0 0 8px ${PURPLE}18`,
            }}>
              {blocked
                ? <ShieldAlert size={30} color="#EF4444" />
                : <Factory size={28} color={PURPLE} />
              }
            </div>
          </div>

          {blocked ? (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: '#111', letterSpacing: '-0.02em', marginBottom: 12 }}>
                Factory Blocked
              </h1>
              <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.7, marginBottom: 32 }}>
                This factory account has been blocked. Please contact OsaTech support to resolve this.
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: '#111', letterSpacing: '-0.02em', marginBottom: 12 }}>
                Request sent to admin!
              </h1>
              <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.75, marginBottom: 8 }}>
                Your factory <strong style={{ color: '#374151' }}>{mfgUser.company_name || 'account'}</strong> is waiting for OsaTech approval.
              </p>
              <p style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.7, marginBottom: 32 }}>
                Once approved, you'll be automatically redirected to your manufacturing dashboard. Please keep this page open.
              </p>

              {/* Progress steps */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 36 }}>
                {[
                  { label: 'Registered',    done: true },
                  { label: 'Under Review',  done: false, active: true },
                  { label: 'Approved',      done: false },
                ].map((step, i) => (
                  <div key={step.label} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: step.done ? PURPLE : step.active ? PURPLE + '22' : '#F3F4F6',
                        border: step.active ? `2px solid ${PURPLE}` : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 6px',
                      }}>
                        {step.done
                          ? <CheckCircle2 size={16} color="white" />
                          : step.active
                            ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: PURPLE }} />
                            : <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#D1D5DB' }} />
                        }
                      </div>
                      <span style={{ fontSize: 10, color: step.done || step.active ? PURPLE : '#9CA3AF', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {step.label}
                      </span>
                    </div>
                    {i < 2 && (
                      <div style={{ width: 40, height: 2, background: i === 0 ? PURPLE : '#E5E7EB', margin: '0 4px', marginBottom: 20, flexShrink: 0 }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Countdown */}
              <div style={{ background: '#F9FAFB', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <RefreshCw size={13} color="#9CA3AF" style={countdown <= 3 ? { animation: 'spin 1.2s linear infinite' } : {}} />
                <span style={{ fontSize: 13, color: '#6B7280' }}>
                  Checking again in <strong style={{ color: '#374151' }}>{countdown}s</strong>…
                </span>
              </div>
            </>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!blocked && (
              <button
                onClick={handleCheck}
                disabled={checking}
                style={{
                  background: checking ? '#C4B5FD' : `linear-gradient(135deg, ${PURPLE}, #6D28D9)`,
                  color: 'white', borderRadius: 14, padding: '14px',
                  fontSize: 14, fontWeight: 700, border: 'none',
                  cursor: checking ? 'not-allowed' : 'pointer',
                  boxShadow: checking ? 'none' : '0 6px 20px rgba(124,58,237,0.35)',
                }}
              >
                {checking ? 'Checking…' : 'Check approval now'}
              </button>
            )}
            <button
              onClick={mfgLogout}
              style={{
                background: 'transparent', color: '#9CA3AF',
                borderRadius: 14, padding: '12px',
                fontSize: 14, fontWeight: 500, border: '1.5px solid #E5E7EB',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>

        <p style={{ position: 'relative', zIndex: 2, fontSize: 12, color: '#9CA3AF', marginTop: 28 }}>
          © 2025 OsaTech · Manufacturing ERP
        </p>
      </div>
    </>
  );
}
