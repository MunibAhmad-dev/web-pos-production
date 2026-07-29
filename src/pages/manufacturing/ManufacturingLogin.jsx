import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  Factory, Phone, Lock, Eye, EyeOff,
  ArrowLeft, Cpu, Package2, Wrench,
} from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useMfgAuth } from '../../context/ManufacturingAuthContext';

const GRAD = 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 30%, #C7D2FE 65%, #BFDBFE 100%)';
const PURPLE = '#7C3AED';

function Field({ label, icon: Icon, right, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7, letterSpacing: '-0.01em' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        {Icon && (
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: focused ? PURPLE : '#C4C9D4', pointerEvents: 'none', transition: 'color 0.15s' }}>
            <Icon size={15} />
          </span>
        )}
        <input
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: `13px ${right ? '46px' : '16px'} 13px ${Icon ? '42px' : '16px'}`,
            fontSize: 14, color: '#111', fontFamily: 'Inter, system-ui, sans-serif',
            border: `1.5px solid ${focused ? PURPLE : '#E5E7EB'}`,
            borderRadius: 12, outline: 'none',
            background: focused ? 'white' : '#F9FAFB',
            boxShadow: focused ? `0 0 0 3px rgba(124,58,237,0.12)` : 'none',
            transition: 'all 0.15s',
          }}
          {...props}
        />
        {right}
      </div>
    </div>
  );
}

function PasswordField({ label, value, onChange, ...rest }) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7, letterSpacing: '-0.01em' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: focused ? PURPLE : '#C4C9D4', pointerEvents: 'none', transition: 'color 0.15s' }}>
          <Lock size={15} />
        </span>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '13px 46px 13px 42px',
            fontSize: 14, color: '#111', fontFamily: 'Inter, system-ui, sans-serif',
            border: `1.5px solid ${focused ? PURPLE : '#E5E7EB'}`,
            borderRadius: 12, outline: 'none',
            background: focused ? 'white' : '#F9FAFB',
            boxShadow: focused ? `0 0 0 3px rgba(124,58,237,0.12)` : 'none',
            transition: 'all 0.15s',
          }}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#C4C9D4', padding: 0, display: 'flex', alignItems: 'center',
          }}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

function FactoryPreviewCard() {
  return (
    <div style={{
      background: 'white', borderRadius: 20, padding: '22px 24px',
      boxShadow: '0 20px 64px rgba(0,0,0,0.1)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 10, color: '#6B7280', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Buildable Stock</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: '#111', lineHeight: 1 }}>124 units</p>
        </div>
        <div style={{ background: '#F5F3FF', borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Cpu size={11} color={PURPLE} />
          <span style={{ fontSize: 11, color: PURPLE, fontWeight: 700 }}>Live</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 32, marginBottom: 18 }}>
        {[55, 72, 48, 88, 62, 94, 70, 86, 78, 100].map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 9 ? PURPLE : '#DDD6FE', borderRadius: 3 }} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 0, borderTop: '1px solid #F5F5F5', paddingTop: 16 }}>
        {[
          [Cpu, '48', 'Part SKUs'],
          [Package2, '3', 'Open POs'],
          [Wrench, '7', 'Assemblies'],
        ].map(([Icon, v, l], i) => (
          <div key={l} style={{ flex: 1, paddingLeft: i ? 16 : 0, borderLeft: i ? '1px solid #F5F5F5' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
              <Icon size={11} color="#aaa" />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>{v}</span>
            </div>
            <span style={{ fontSize: 10, color: '#6B7280' }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ManufacturingLogin() {
  const { mfgUser, mfgLogin } = useMfgAuth();
  const navigate = useNavigate();

  // Already logged in — skip the login form entirely
  if (mfgUser) {
    return <Navigate to={mfgUser.approval_status === 'approved' ? '/manufacturing/dashboard' : '/manufacturing/pending'} replace />;
  }
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [form, setForm] = useState({ mobile: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await mfgLogin({ mobile: form.mobile.trim(), password: form.password });
      navigate(data.approval_status === 'approved' ? '/manufacturing/dashboard' : '/manufacturing/pending');
    } catch (err) {
      setError(err.message || 'Login failed. Check your mobile and password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {isDesktop && (
        <div style={{
          width: 440, flexShrink: 0,
          background: GRAD,
          position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '40px 44px',
        }}>
          {[{ top: '3%', left: '8%', s: 190 }, { bottom: '8%', right: '4%', s: 230 }, { top: '50%', left: '35%', s: 120 }].map((b, i) => (
            <div key={i} style={{ position: 'absolute', borderRadius: '50%', background: 'rgba(255,255,255,0.55)', filter: 'blur(52px)', width: b.s, height: b.s, top: b.top, left: b.left, right: b.right, bottom: b.bottom, pointerEvents: 'none' }} />
          ))}

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: PURPLE, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}>
              <Factory size={16} color="white" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 18, color: '#111', letterSpacing: '-0.01em' }}>OsaTech</span>
          </div>

          <div style={{ position: 'relative', zIndex: 2 }}>
            <h2 style={{ fontSize: 'clamp(1.7rem,2.8vw,2.5rem)', fontWeight: 900, color: '#111', lineHeight: 1.15, letterSpacing: '-0.025em', marginBottom: 14 }}>
              Your factory,<br />fully managed,<br /><span style={{ color: PURPLE }}>your way.</span>
            </h2>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.75, maxWidth: '28ch' }}>
              Manufacturing ERP built for Pakistani factories — BOM, parts inventory, vendor ledger.
            </p>
          </div>

          <div style={{ position: 'relative', zIndex: 2 }}>
            <FactoryPreviewCard />
          </div>

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {['Air Cooler · Light Manufacturing · Workshop', 'BOM auto-consumed on every sale', 'Parts inventory with reserved-stock view'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#555' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: PURPLE, flexShrink: 0 }} />
                {f}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1, background: 'white', display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isDesktop ? '24px 52px' : '20px 24px', borderBottom: '1px solid #F5F5F5' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#999', textDecoration: 'none', fontWeight: 500 }}>
            <ArrowLeft size={14} /> Back to home
          </Link>
          <span style={{ fontSize: 13, color: '#999' }}>
            New here?{' '}
            <Link to="/manufacturing/register" style={{ color: PURPLE, fontWeight: 700, textDecoration: 'none' }}>Create your factory account</Link>
          </span>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isDesktop ? '40px 52px' : '32px 24px' }}>
          <div style={{ width: '100%', maxWidth: 400 }}>

            <div style={{ width: 54, height: 54, borderRadius: 18, background: `linear-gradient(135deg, ${PURPLE}, #9F67FF)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, boxShadow: '0 8px 28px rgba(124,58,237,0.32)' }}>
              <Factory size={24} color="white" />
            </div>

            <h1 style={{ fontSize: 30, fontWeight: 900, color: '#111', letterSpacing: '-0.025em', marginBottom: 6 }}>
              Factory Login
            </h1>
            <p style={{ fontSize: 15, color: '#9CA3AF', marginBottom: 36 }}>
              Log in to your manufacturing dashboard
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <Field
                  label="Mobile number"
                  icon={Phone}
                  type="tel"
                  required
                  autoFocus
                  placeholder="03001234567"
                  value={form.mobile}
                  onChange={e => setForm({ ...form, mobile: e.target.value })}
                />

                <PasswordField
                  label="Password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />

                {error && (
                  <div style={{ background: '#FFF1F3', border: '1.5px solid #FECDD3', borderRadius: 11, padding: '12px 16px', fontSize: 13, color: '#BE123C', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15 }}>⚠</span> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: loading ? '#C4B5FD' : `linear-gradient(135deg, ${PURPLE} 0%, #6D28D9 100%)`,
                    color: 'white', borderRadius: 14, padding: '15px',
                    fontSize: 15, fontWeight: 700, border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: loading ? 'none' : '0 8px 28px rgba(124,58,237,0.38)',
                    letterSpacing: '-0.01em', marginTop: 4,
                    transition: 'all 0.2s',
                  }}
                >
                  {loading ? 'Logging in…' : 'Login to Manufacturing →'}
                </button>
              </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>or</span>
              <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
            </div>

            <p style={{ textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>
              Don't have an account yet?{' '}
              <Link to="/manufacturing/register" style={{ color: PURPLE, fontWeight: 700, textDecoration: 'none' }}>
                Register for free
              </Link>
            </p>
          </div>
        </div>

        <div style={{ padding: isDesktop ? '16px 52px' : '14px 24px', borderTop: '1px solid #F5F5F5', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#9CA3AF' }}>© 2025 OsaTech · Manufacturing ERP</p>
        </div>
      </div>
    </div>
  );
}
