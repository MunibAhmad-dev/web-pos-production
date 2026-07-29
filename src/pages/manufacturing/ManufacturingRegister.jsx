import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMfgAuth } from '../../context/ManufacturingAuthContext';
import {
  Factory, Phone, Lock, Eye, EyeOff,
  ArrowLeft, Building2, User, Cpu,
} from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const GRAD = 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 30%, #C7D2FE 65%, #BFDBFE 100%)';
const PURPLE = '#7C3AED';

function Field({ label, icon: Icon, ...props }) {
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
            padding: `13px 16px 13px ${Icon ? '42px' : '16px'}`,
            fontSize: 14, color: '#111', fontFamily: 'Inter, system-ui, sans-serif',
            border: `1.5px solid ${focused ? PURPLE : '#E5E7EB'}`,
            borderRadius: 12, outline: 'none',
            background: focused ? 'white' : '#F9FAFB',
            boxShadow: focused ? `0 0 0 3px rgba(124,58,237,0.12)` : 'none',
            transition: 'all 0.15s',
          }}
          {...props}
        />
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

export default function ManufacturingRegister() {
  const { mfgRegister: mfgLogin } = useMfgAuth();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [form, setForm] = useState({ factoryName: '', ownerName: '', mobile: '', password: '', confirmPassword: '' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const data = await mfgLogin({ mobile: form.mobile.trim(), password: form.password, company_name: form.factoryName.trim() });
      navigate(data.approval_status === 'approved' ? '/manufacturing/dashboard' : '/manufacturing/pending');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
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
              Start managing<br />your factory<br /><span style={{ color: PURPLE }}>the smart way.</span>
            </h2>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.75, maxWidth: '28ch' }}>
              Full manufacturing ERP for Pakistani factories. Register today and take control of your production floor.
            </p>
          </div>

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ background: 'white', borderRadius: 20, padding: '22px 24px', boxShadow: '0 20px 64px rgba(0,0,0,0.1)' }}>
              <p style={{ fontSize: 11, color: '#6B7280', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 14, fontWeight: 600 }}>What you get</p>
              {[
                [Cpu, 'BOM auto-consumed on every sale'],
                [Building2, 'Parts inventory with reserved-stock'],
                [Factory, 'Vendor POs and payable ledger'],
              ].map(([Icon, text]) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={14} color={PURPLE} />
                  </div>
                  <span style={{ fontSize: 13, color: '#374151' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {['Air Cooler · Light Manufacturing · Workshop', 'Offline-first  ·  Cloud sync  ·  PKR native'].map(f => (
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
            Already registered?{' '}
            <Link to="/manufacturing/login" style={{ color: PURPLE, fontWeight: 700, textDecoration: 'none' }}>Log in</Link>
          </span>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isDesktop ? '40px 52px' : '32px 24px' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>

            <div style={{ width: 54, height: 54, borderRadius: 18, background: `linear-gradient(135deg, ${PURPLE}, #9F67FF)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, boxShadow: '0 8px 28px rgba(124,58,237,0.32)' }}>
              <Factory size={24} color="white" />
            </div>

            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', letterSpacing: '-0.025em', marginBottom: 6 }}>
              Register your factory
            </h1>
            <p style={{ fontSize: 15, color: '#9CA3AF', marginBottom: 32 }}>
              Set up your manufacturing account
            </p>

            {notice ? (
              <div style={{ background: '#F5F3FF', border: '1.5px solid #DDD6FE', borderRadius: 14, padding: '24px 22px', textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `${PURPLE}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Factory size={24} color={PURPLE} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 8 }}>Almost there!</p>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7 }}>{notice}</p>
                <button
                  onClick={() => setNotice('')}
                  style={{ marginTop: 18, fontSize: 13, color: PURPLE, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  ← Back to form
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Field
                  label="Factory / Business name"
                  icon={Building2}
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. OsaTech Air Coolers"
                  value={form.factoryName}
                  onChange={e => setForm({ ...form, factoryName: e.target.value })}
                />

                <Field
                  label="Owner name"
                  icon={User}
                  type="text"
                  required
                  placeholder="Your full name"
                  value={form.ownerName}
                  onChange={e => setForm({ ...form, ownerName: e.target.value })}
                />

                <Field
                  label="Mobile number"
                  icon={Phone}
                  type="tel"
                  required
                  placeholder="03001234567"
                  value={form.mobile}
                  onChange={e => setForm({ ...form, mobile: e.target.value })}
                />

                <PasswordField
                  label="Password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />

                <PasswordField
                  label="Confirm password"
                  value={form.confirmPassword}
                  onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
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
                  {loading ? 'Registering…' : 'Register Factory →'}
                </button>
              </form>
            )}

            {!notice && (
              <p style={{ textAlign: 'center', fontSize: 13, color: '#9CA3AF', marginTop: 24 }}>
                Already have an account?{' '}
                <Link to="/manufacturing/login" style={{ color: PURPLE, fontWeight: 700, textDecoration: 'none' }}>
                  Log in
                </Link>
              </p>
            )}
          </div>
        </div>

        <div style={{ padding: isDesktop ? '16px 52px' : '14px 24px', borderTop: '1px solid #F5F5F5', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#9CA3AF' }}>© 2025 OsaTech · Manufacturing ERP</p>
        </div>
      </div>
    </div>
  );
}
