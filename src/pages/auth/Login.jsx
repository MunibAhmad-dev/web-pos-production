import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Lock, ArrowRight, Factory, TrendingUp, BookOpen, Package } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  AuthShell, Field, PasswordToggle, ErrorBox, SubmitButton,
} from './AuthShell';
import { usePasswordToggle, authErrorMessage, isValidMobile, waLink } from './authUtils';

function LoginAside() {
  return (
    <div className="max-w-md">
      <h2 className="font-display text-4xl xl:text-[44px] leading-[1.08] font-extrabold tracking-tight text-balance">
        Your shop, live, <span className="text-sky-300">wherever you are.</span>
      </h2>
      <p className="mt-4 text-white/65 leading-relaxed">
        Sign in to see today’s sales, profit, khata and stock from the counter PC — updated as it syncs.
      </p>

      {/* sample snapshot */}
      <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-white/60">Today at a glance</p>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Synced
          </span>
        </div>
        <p className="mt-2 text-3xl font-bold tabular-nums">Rs. 84,200</p>
        <p className="text-xs text-emerald-300 inline-flex items-center gap-1 mt-0.5"><TrendingUp size={12} /> 14% more than yesterday</p>
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-sm">
          {[[TrendingUp, 'Rs. 21.9K', 'Profit'], [BookOpen, 'Rs. 1.2L', 'Khata due'], [Package, '10', 'Low stock']].map(([Icon, v, l]) => (
            <div key={l}>
              <p className="font-semibold tabular-nums">{v}</p>
              <p className="text-[11px] text-white/50 inline-flex items-center gap-1"><Icon size={11} />{l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const pw = usePasswordToggle();
  const [form, setForm] = useState({ mobile: '', password: '' });
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const mobileError = touched.mobile && form.mobile && !isValidMobile(form.mobile) ? 'Enter the mobile number you registered with (10–15 digits).' : '';

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ mobile: true, password: true });
    if (!isValidMobile(form.mobile) || !form.password) {
      setError(!form.password ? 'Enter your password.' : 'Enter a valid mobile number.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(form.mobile.trim(), form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(authErrorMessage(err, 'Unable to sign in. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell aside={<LoginAside />}>
      <h1 className="font-display text-[30px] leading-tight font-extrabold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sign in with the mobile number and password of your store.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 grid gap-5">
        <Field
          id="mobile" label="Mobile number" icon={Phone} type="tel" inputMode="tel" autoComplete="tel"
          placeholder="03001234567" value={form.mobile} required autoFocus
          onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))}
          onBlur={() => setTouched(t => ({ ...t, mobile: true }))}
          error={mobileError}
        />
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
            <a href={waLink('Hi, I forgot the password for my OsaTech store.')} target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium text-primary hover:underline">Forgot password?</a>
          </div>
          <Field
            id="password" label="" icon={Lock} type={pw.type} autoComplete="current-password"
            placeholder="Your password" value={form.password} required
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            trailing={<PasswordToggle shown={pw.shown} onToggle={pw.toggle} />}
            className="[&>label]:hidden"
          />
        </div>

        <ErrorBox>{error}</ErrorBox>
        <SubmitButton loading={loading} loadingText="Signing in…">Sign in <ArrowRight size={16} /></SubmitButton>
      </form>

      <p className="mt-8 text-sm text-muted-foreground text-center">
        New to OsaTech? <Link to="/register" className="font-semibold text-primary hover:underline">Register your store</Link>
      </p>

      <div className="mt-8 border-t border-border pt-5">
        <Link to="/manufacturing/login" className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/60 transition-colors">
          <span className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 inline-flex items-center justify-center shrink-0"><Factory size={15} /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-foreground">Using Factory ERP?</span>
            <span className="block text-xs text-muted-foreground">Sign in to the manufacturing app instead</span>
          </span>
          <ArrowRight size={15} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </AuthShell>
  );
}
