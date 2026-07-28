import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ShieldAlert, LogOut, RefreshCw, Store, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const GRAD = 'linear-gradient(135deg, #FFCCE0 0%, #EDD9FF 30%, #D5EDFF 65%, #B8F2DA 100%)';
const PINK = '#FF4E7D';

/* Pulsing ring animation injected once */
const STYLE = `
  @keyframes ping { 0%{transform:scale(1);opacity:.8} 100%{transform:scale(1.7);opacity:0} }
  @keyframes spin { to { transform: rotate(360deg); } }
  .pending-ping { animation: ping 1.8s ease-out infinite; }
  .pending-spin { animation: spin 1.2s linear infinite; }
`;

export default function PendingApproval() {
  const { user, logout, refreshStatus } = useAuth();
  const [checking, setChecking] = useState(false);
  const [countdown, setCountdown] = useState(15);

  /* Auto-poll every 15 s */
  useEffect(() => {
    if (!user || user.approval_status === 'approved') return;
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          refreshStatus().catch(() => {});
          return 15;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [user, refreshStatus]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.approval_status === 'approved' && !user.cloud_blocked) return <Navigate to="/dashboard" replace />;

  const blocked = user.cloud_blocked || user.approval_status === 'blocked';

  async function handleCheck() {
    setChecking(true);
    setCountdown(15);
    try { await refreshStatus(); } finally { setChecking(false); }
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
          <div style={{ width: 32, height: 32, borderRadius: 10, background: PINK, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(255,78,125,0.35)' }}>
            <Store size={15} color="white" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 17, color: '#111' }}>OsaTech</span>
        </div>

        {/* Main card */}
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
              <div className="pending-ping" style={{
                position: 'absolute', width: 80, height: 80, borderRadius: '50%',
                background: PINK + '22',
              }} />
            )}
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: blocked ? '#FEF2F2' : '#FFF1F4',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: blocked ? '0 0 0 8px #FEE2E2' : `0 0 0 8px ${PINK}18`,
            }}>
              {blocked
                ? <ShieldAlert size={30} color="#EF4444" />
                : <Store size={28} color={PINK} />
              }
            </div>
          </div>

          {blocked ? (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: '#111', letterSpacing: '-0.02em', marginBottom: 12 }}>
                Store Blocked
              </h1>
              <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.7, marginBottom: 32 }}>
                {user.block_reason || 'This store has been blocked. Please contact OsaTech support to resolve this.'}
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: '#111', letterSpacing: '-0.02em', marginBottom: 12 }}>
                Request sent to admin!
              </h1>
              <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.75, marginBottom: 8 }}>
                Your store <strong style={{ color: '#374151' }}>{user.store_name || 'registration'}</strong> is waiting for OsaTech approval.
              </p>
              <p style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.7, marginBottom: 32 }}>
                Once they approve you, you'll be automatically redirected to your POS dashboard. Please keep this page open.
              </p>

              {/* Steps */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 36 }}>
                {[
                  { label: 'Registered', done: true },
                  { label: 'Under Review', done: false, active: true },
                  { label: 'Approved', done: false },
                ].map((step, i) => (
                  <div key={step.label} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: step.done ? PINK : step.active ? PINK + '22' : '#F3F4F6',
                        border: step.active ? `2px solid ${PINK}` : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 6px',
                      }}>
                        {step.done
                          ? <CheckCircle2 size={16} color="white" />
                          : step.active
                            ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: PINK }} />
                            : <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#D1D5DB' }} />
                        }
                      </div>
                      <span style={{ fontSize: 10, color: step.done || step.active ? PINK : '#9CA3AF', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {step.label}
                      </span>
                    </div>
                    {i < 2 && (
                      <div style={{ width: 40, height: 2, background: i === 0 ? PINK : '#E5E7EB', margin: '0 4px', marginBottom: 20, flexShrink: 0 }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Auto-check countdown */}
              <div style={{ background: '#F9FAFB', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <RefreshCw size={13} color="#9CA3AF" style={countdown <= 3 ? { animation: 'spin 1.2s linear infinite' } : {}} />
                <span style={{ fontSize: 13, color: '#6B7280' }}>
                  Checking again in <strong style={{ color: '#374151' }}>{countdown}s</strong>…
                </span>
              </div>
            </>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!blocked && (
              <button
                onClick={handleCheck}
                disabled={checking}
                style={{
                  background: checking ? '#F9A8C3' : `linear-gradient(135deg, ${PINK}, #FF2D6F)`,
                  color: 'white', borderRadius: 14, padding: '14px',
                  fontSize: 14, fontWeight: 700, border: 'none',
                  cursor: checking ? 'not-allowed' : 'pointer',
                  boxShadow: checking ? 'none' : '0 6px 20px rgba(255,78,125,0.35)',
                }}
              >
                {checking ? 'Checking…' : 'Check approval now'}
              </button>
            )}
            <button
              onClick={logout}
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
          © 2025 OsaTech · Your data stays private
        </p>
      </div>
    </>
  );
}
