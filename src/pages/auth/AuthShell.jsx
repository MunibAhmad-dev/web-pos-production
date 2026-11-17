import { Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Store, Sun, Moon, Eye, EyeOff, AlertCircle } from 'lucide-react';

function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground inline-flex items-center justify-center transition-colors"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export function Logo({ onDark = false }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5" aria-label="OsaTech home">
      <span className="w-9 h-9 rounded-xl bg-primary text-primary-foreground inline-flex items-center justify-center shadow-sm">
        <Store size={17} strokeWidth={2.2} />
      </span>
      <span className={`font-display text-lg font-extrabold tracking-tight ${onDark ? 'text-white' : 'text-foreground'}`}>OsaTech</span>
    </Link>
  );
}

/**
 * Two-column auth layout: brand panel (left, desktop only) + form (right).
 * `aside` is the panel's content; `children` is the form column.
 */
export function AuthShell({ aside, children }) {
  return (
    <div className="min-h-full bg-background text-foreground lg:grid lg:grid-cols-[minmax(380px,0.9fr)_1.1fr]">
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-slate-950 text-white p-10 xl:p-12">
        <div className="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full bg-primary/35 blur-[110px] pointer-events-none" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 w-[320px] h-[320px] rounded-full bg-emerald-500/15 blur-[100px] pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:44px_44px]" aria-hidden="true" />
        <div className="relative"><Logo onDark /></div>
        <div className="relative">{aside}</div>
        <p className="relative text-xs text-white/45">© {new Date().getFullYear()} OsaTech · Point of sale and bookkeeping for shops</p>
      </aside>

      <main className="flex flex-col min-h-full">
        <div className="flex items-center justify-between px-5 sm:px-8 h-16">
          <div className="lg:hidden"><Logo /></div>
          <div className="hidden lg:block" />
          <ThemeButton />
        </div>
        <div className="flex-1 flex items-center justify-center px-5 sm:px-8 pb-12">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
      </main>
    </div>
  );
}

/** Labelled input with optional leading icon and trailing slot. */
export function Field({ id, label, icon: Icon, hint, error, trailing, className = '', ...props }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <div className="relative">
        {Icon && <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />}
        <input
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`w-full h-11 rounded-lg border bg-card text-[15px] text-foreground placeholder:text-muted-foreground/70 outline-none transition-shadow focus:ring-[3px] focus:ring-primary/25 focus:border-primary ${Icon ? 'pl-10' : 'pl-3.5'} ${trailing ? 'pr-11' : 'pr-3.5'} ${error ? 'border-rose-500' : 'border-border'}`}
          {...props}
        />
        {trailing && <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function PasswordToggle({ shown, onToggle }) {
  return (
    <button type="button" onClick={onToggle} aria-label={shown ? 'Hide password' : 'Show password'}
      className="w-8 h-8 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
      {shown ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
}


export function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/[0.07] px-3.5 py-3 text-sm text-rose-700 dark:text-rose-300">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function SubmitButton({ loading, children, loadingText }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 shadow-sm hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity">
      {loading && <span className="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin" aria-hidden="true" />}
      {loading ? loadingText : children}
    </button>
  );
}
