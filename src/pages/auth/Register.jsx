import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Phone, Store, MapPin, Lock, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  AuthShell, Field, PasswordToggle, ErrorBox, SubmitButton,
} from './AuthShell';
import { usePasswordToggle, authErrorMessage, isValidMobile } from './authUtils';

function RegisterAside() {
  const steps = [
    ['Create your store account', 'Takes about a minute — just your name, number and shop details.'],
    ['We approve it', 'OsaTech checks new stores before switching on cloud access.'],
    ['Start billing', 'Install the counter app, add products, and everything syncs here.'],
  ];
  return (
    <div className="max-w-md">
      <h2 className="font-display text-4xl xl:text-[44px] leading-[1.08] font-extrabold tracking-tight text-balance">
        Put your shop on <span className="text-sky-300">OsaTech.</span>
      </h2>
      <p className="mt-4 text-white/65 leading-relaxed">
        Billing, khata, stock and cash that keep working offline at the counter, and that you can check from anywhere.
      </p>
      <ol className="mt-10 grid gap-5">
        {steps.map(([title, body], i) => (
          <li key={title} className="flex gap-4">
            <span className="w-8 h-8 rounded-full border border-white/20 bg-white/[0.06] inline-flex items-center justify-center text-sm font-semibold shrink-0 tabular-nums">{i + 1}</span>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-white/55 leading-relaxed">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <ul className="mt-10 flex flex-wrap gap-2">
        {['General store', 'Wholesale', 'Pharmacy', 'Bakery', 'Dry fruits', 'Hardware'].map(t => (
          <li key={t} className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70">{t}</li>
        ))}
      </ul>
    </div>
  );
}

function passwordStrength(pw) {
  if (!pw) return null;
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  if (pw.length < 6) return { level: 0, label: 'Too short' };
  return [{ level: 1, label: 'Okay' }, { level: 1, label: 'Okay' }, { level: 2, label: 'Good' }, { level: 3, label: 'Strong' }, { level: 3, label: 'Strong' }][s];
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const pw = usePasswordToggle();
  const [form, setForm] = useState({ ownerName: '', businessName: '', mobile: '', address: '', password: '' });
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));
  const blur = field => () => setTouched(t => ({ ...t, [field]: true }));

  const errors = {
    ownerName: !form.ownerName.trim() ? 'Enter your name.' : '',
    businessName: !form.businessName.trim() ? 'Enter your shop’s name.' : '',
    mobile: !isValidMobile(form.mobile) ? 'Enter a valid mobile number (10–15 digits).' : '',
    password: form.password.length < 6 ? 'Use at least 6 characters.' : '',
  };
  const show = (f) => (touched[f] ? errors[f] : '');
  const strength = passwordStrength(form.password);

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ ownerName: true, businessName: true, mobile: true, password: true });
    if (Object.values(errors).some(Boolean)) { setError(''); return; }
    setError('');
    setLoading(true);
    try {
      await register({ ...form, mobile: form.mobile.trim(), ownerName: form.ownerName.trim(), businessName: form.businessName.trim(), address: form.address.trim() });
      navigate('/pending-approval');
    } catch (err) {
      setError(authErrorMessage(err, 'Unable to create your account. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell aside={<RegisterAside />}>
      <h1 className="font-display text-[30px] leading-tight font-extrabold tracking-tight">Register your store</h1>
      <p className="mt-2 text-sm text-muted-foreground">Already have an account? <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link></p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="ownerName" label="Your name" icon={User} autoComplete="name" placeholder="Ahmed Khan"
            value={form.ownerName} onChange={set('ownerName')} onBlur={blur('ownerName')} error={show('ownerName')} required />
          <Field id="mobile" label="Mobile number" icon={Phone} type="tel" inputMode="tel" autoComplete="tel" placeholder="03001234567"
            value={form.mobile} onChange={set('mobile')} onBlur={blur('mobile')} error={show('mobile')} required
            hint={!show('mobile') ? 'You’ll sign in with this' : ''} />
        </div>
        <Field id="businessName" label="Shop name" icon={Store} autoComplete="organization" placeholder="Khan Dry Fruit Store"
          value={form.businessName} onChange={set('businessName')} onBlur={blur('businessName')} error={show('businessName')} required />
        <Field id="address" label="Shop address" icon={MapPin} autoComplete="street-address" placeholder="Main Market, Lahore"
          value={form.address} onChange={set('address')} hint="Optional — printed on receipts" />
        <div>
          <Field id="password" label="Password" icon={Lock} type={pw.type} autoComplete="new-password" placeholder="At least 6 characters"
            value={form.password} onChange={set('password')} onBlur={blur('password')} error={show('password')} required
            trailing={<PasswordToggle shown={pw.shown} onToggle={pw.toggle} />} />
          {strength && !show('password') && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex gap-1 flex-1">
                {[1, 2, 3].map(n => (
                  <span key={n} className={`h-1 flex-1 rounded-full ${strength.level >= n ? (strength.level === 1 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-muted'}`} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground w-12 text-right">{strength.label}</span>
            </div>
          )}
        </div>

        <ErrorBox>{error}</ErrorBox>
        <SubmitButton loading={loading} loadingText="Creating your account…">Create store account <ArrowRight size={16} /></SubmitButton>

        <ul className="grid gap-1.5 text-xs text-muted-foreground">
          {['Your account is reviewed before cloud access is switched on.', 'Your data is private to your store.'].map(t => (
            <li key={t} className="flex items-start gap-2"><Check size={13} className="mt-0.5 text-primary shrink-0" />{t}</li>
          ))}
        </ul>
      </form>
    </AuthShell>
  );
}
