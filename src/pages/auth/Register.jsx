import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Store, Phone, Lock, Eye, EyeOff,
  ArrowLeft, User, Building2, MapPin,
  CheckCircle2, Clock, Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const GRAD = 'linear-gradient(135deg, #FFCCE0 0%, #EDD9FF 30%, #D5EDFF 65%, #B8F2DA 100%)';
const PINK = '#FF4E7D';

/* ── Custom input ──────────────────────────────────────── */
function Field({ label, icon: Icon, optional, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', letterSpacing: '-0.01em' }}>
          {label}
        </label>
        {optional && <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>Optional</span>}
      </div>
      <div style={{ position: 'relative' }}>
        {Icon && (
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: focused ? PINK : '#C4C9D4', pointerEvents: 'none', transition: 'color 0.15s' }}>
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
            border: `1.5px solid ${focused ? PINK : '#E5E7EB'}`,
            borderRadius: 12, outline: 'none',
            background: focused ? 'white' : '#F9FAFB',
            boxShadow: focused ? '0 0 0 3px rgba(255,78,125,0.12)' : 'none',
            transition: 'all 0.15s',
          }}
          {...props}
        />
      </div>
    </div>
  );
}

/* ── Password with toggle ──────────────────────────────── */
function PasswordField({ label, value, onChange, ...rest }) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7, letterSpacing: '-0.01em' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: focused ? PINK : '#C4C9D4', pointerEvents: 'none', transition: 'color 0.15s' }}>
          <Lock size={15} />
        </span>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required
          minLength={6}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '13px 46px 13px 42px',
            fontSize: 14, color: '#111', fontFamily: 'Inter, system-ui, sans-serif',
            border: `1.5px solid ${focused ? PINK : '#E5E7EB'}`,
            borderRadius: 12, outline: 'none',
            background: focused ? 'white' : '#F9FAFB',
            boxShadow: focused ? '0 0 0 3px rgba(255,78,125,0.12)' : 'none',
            transition: 'all 0.15s',
          }}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#C4C9D4', padding: 0, display: 'flex', alignItems: 'center' }}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

/* ── Left panel step card ──────────────────────────────── */
function StepsCard() {
  const steps = [
    { icon: CheckCircle2, color: '#10B981', bg: '#F0FDF4', label: 'Fill in your details', sub: 'Name, business, mobile, password' },
    { icon: Clock,        color: '#F59E0B', bg: '#FFFBEB', label: 'Quick approval',       sub: 'OsaTech activates your account' },
    { icon: Zap,          color: PINK,      bg: '#FFF1F4', label: 'Start selling',         sub: 'Full POS access, instantly' },
  ];
  return (
    <div style={{ background: 'white', borderRadius: 20, padding: '22px 24px', boxShadow: '0 20px 64px rgba(0,0,0,0.10)' }}>
      <p style={{ fontSize: 11, color: '#6B7280', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18 }}>How it works</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {steps.map(({ icon: Icon, color, bg, label, sub }, i) => (
          <div key={label} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={16} color={color} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 2 }}>{label}</p>
              <p style={{ fontSize: 11.5, color: '#6B7280' }}>{sub}</p>
            </div>
            {i < steps.length - 1 && (
              <div style={{ position: 'absolute', left: 30, width: 1, height: 16, background: '#F3F4F6', marginTop: 36 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════ */
export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [form, setForm] = useState({ ownerName: '', businessName: '', mobile: '', address: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ ...form, mobile: form.mobile.trim() });
      navigate('/pending-approval');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Unable to create account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── LEFT BRAND PANEL — hidden on mobile ──────── */}
      {isDesktop && <div style={{
        width: 440, flexShrink: 0,
        background: GRAD,
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '40px 44px',
      }}>
        {/* Bokeh */}
        {[{ top: '3%', left: '8%', s: 190 }, { bottom: '8%', right: '4%', s: 230 }, { top: '48%', left: '32%', s: 120 }].map((b, i) => (
          <div key={i} style={{ position: 'absolute', borderRadius: '50%', background: 'rgba(255,255,255,0.55)', filter: 'blur(52px)', width: b.s, height: b.s, top: b.top, left: b.left, right: b.right, bottom: b.bottom, pointerEvents: 'none' }} />
        ))}

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: PINK, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(255,78,125,0.4)' }}>
            <Store size={16} color="white" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, color: '#111', letterSpacing: '-0.01em' }}>OsaTech</span>
        </div>

        {/* Headline */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h2 style={{ fontSize: 'clamp(1.7rem,2.8vw,2.5rem)', fontWeight: 900, color: '#111', lineHeight: 1.15, letterSpacing: '-0.025em', marginBottom: 14 }}>
            Set up your<br />store in<br /><span style={{ color: PINK }}>minutes.</span>
          </h2>
          <p style={{ fontSize: 14, color: '#666', lineHeight: 1.75, maxWidth: '28ch' }}>
            Works for retail, bakery, dry fruit, medical, wholesale, and more.
          </p>
        </div>

        {/* Steps card */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <StepsCard />
        </div>

        {/* Business types */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['Retailer', 'Bakery', 'Dry Fruit', 'Medical', 'Wholesale', 'Grocery'].map(t => (
            <span key={t} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 50, background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.6)', color: '#555', backdropFilter: 'blur(6px)' }}>
              {t}
            </span>
          ))}
        </div>
      </div>}

      {/* ── RIGHT FORM PANEL ──────────────────────────── */}
      <div style={{ flex: 1, background: 'white', display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isDesktop ? '24px 52px' : '20px 24px', borderBottom: '1px solid #F5F5F5' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#999', textDecoration: 'none', fontWeight: 500 }}>
            <ArrowLeft size={14} /> Back to home
          </Link>
          <span style={{ fontSize: 13, color: '#999' }}>
            Already have a store?{' '}
            <Link to="/login" style={{ color: PINK, fontWeight: 700, textDecoration: 'none' }}>Log in</Link>
          </span>
        </div>

        {/* Scrollable form area */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: isDesktop ? '40px 52px' : '28px 24px' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>

            {/* Logo mark */}
            <div style={{ width: 54, height: 54, borderRadius: 18, background: `linear-gradient(135deg, ${PINK}, #FF85A6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, boxShadow: '0 8px 28px rgba(255,78,125,0.32)' }}>
              <Store size={24} color="white" />
            </div>

            <h1 style={{ fontSize: 30, fontWeight: 900, color: '#111', letterSpacing: '-0.025em', marginBottom: 6 }}>
              Create your store
            </h1>
            <p style={{ fontSize: 15, color: '#9CA3AF', marginBottom: 36 }}>
              Free to set up · No subscription required
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Two fields in a row on desktop, stacked on mobile */}
              <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 12 }}>
                <Field
                  label="Your name"
                  icon={User}
                  required
                  placeholder="Ahmed Khan"
                  value={form.ownerName}
                  onChange={set('ownerName')}
                />
                <Field
                  label="Mobile number"
                  icon={Phone}
                  type="tel"
                  required
                  placeholder="03001234567"
                  value={form.mobile}
                  onChange={set('mobile')}
                />
              </div>

              <Field
                label="Business name"
                icon={Building2}
                required
                placeholder="Khan Dry Fruit Store"
                value={form.businessName}
                onChange={set('businessName')}
              />

              <Field
                label="Store address"
                icon={MapPin}
                optional
                placeholder="Main Market, Lahore"
                value={form.address}
                onChange={set('address')}
              />

              <PasswordField
                label="Password"
                value={form.password}
                onChange={set('password')}
                placeholder="At least 6 characters"
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
                  background: loading ? '#F9A8C3' : `linear-gradient(135deg, ${PINK} 0%, #FF2D6F 100%)`,
                  color: 'white', borderRadius: 14, padding: '15px',
                  fontSize: 15, fontWeight: 700, border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 8px 28px rgba(255,78,125,0.38)',
                  letterSpacing: '-0.01em', marginTop: 4,
                  transition: 'all 0.2s',
                }}
              >
                {loading ? 'Creating account…' : 'Create my store →'}
              </button>

              <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.6 }}>
                After registering, your account goes through a quick approval before you can log in.
              </p>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>or</span>
              <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
            </div>

            <p style={{ textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: PINK, fontWeight: 700, textDecoration: 'none' }}>
                Log in instead
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: isDesktop ? '16px 52px' : '14px 24px', borderTop: '1px solid #F5F5F5', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#9CA3AF' }}>© 2025 OsaTech · Your data stays private</p>
        </div>
      </div>
    </div>
  );
}
