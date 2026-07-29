import { useState } from 'react';
import { Shield, CheckCircle2, AlertCircle, Clock, MessageCircle, Mail, Crown, Zap, Lock, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useMfgAuth } from '../../context/ManufacturingAuthContext';
import { mfgGetStatus } from '../../api/manufacturingApi';
import { toast } from 'sonner';

const PLAN_COLORS = {
  trial:    { bg: 'bg-amber-100 dark:bg-amber-900/30',  text: 'text-amber-700 dark:text-amber-300',  border: 'border-amber-300 dark:border-amber-700'  },
  basic:    { bg: 'bg-blue-100 dark:bg-blue-900/30',    text: 'text-blue-700 dark:text-blue-300',    border: 'border-blue-300 dark:border-blue-700'    },
  pro:      { bg: 'bg-violet-100 dark:bg-violet-900/30',text: 'text-violet-700 dark:text-violet-300',border: 'border-violet-300 dark:border-violet-700' },
  premium:  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-700' },
};

const STATUS_INFO = {
  approved: { icon: CheckCircle2, color: 'text-emerald-600', label: 'Active & Approved' },
  pending:  { icon: Clock,        color: 'text-amber-600',   label: 'Pending Approval' },
  trial:    { icon: Zap,          color: 'text-blue-600',    label: 'Trial Period' },
  blocked:  { icon: AlertCircle,  color: 'text-red-600',     label: 'Blocked' },
};

const PLAN_FEATURES = {
  trial: [
    'All modules for 30 days',
    'Up to 100 sync events',
    'Email support',
  ],
  basic: [
    'All 12 modules',
    'Unlimited sync events',
    'Google Drive backup',
    'Email support',
  ],
  pro: [
    'Everything in Basic',
    'Priority support (WhatsApp)',
    'Custom invoice branding',
    'Multi-device sync',
  ],
  premium: [
    'Everything in Pro',
    'Dedicated account manager',
    'Custom feature development',
    'On-site training',
  ],
};

const EULA_CLAUSES = [
  { title: 'Single Instance License', body: 'This software is licensed to a single manufacturing instance (factory/shop). Sharing the API key with unauthorized users is not permitted.' },
  { title: 'No Redistribution', body: 'You may not redistribute, resell, or sublicense this software or any part of it without written permission from Munib Ahmad / OsaTech.' },
  { title: 'Ownership', body: 'This software is owned exclusively by Munib Ahmad operating as OsaTech. All intellectual property rights are reserved.' },
  { title: 'Support & Updates', body: 'Updates and support are provided at OsaTech\'s discretion. Critical bug fixes are provided free of charge during an active license period.' },
  { title: 'Limitation of Liability', body: 'OsaTech is not responsible for data loss, business interruption, or consequential damages arising from use of this software.' },
  { title: 'Acceptance', body: 'By using this software you agree to these terms. Continued use after any update to these terms constitutes acceptance of the updated terms.' },
];

export default function ManufacturingLicense() {
  const { mfgUser } = useMfgAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [liveStatus, setLiveStatus] = useState(null);

  const plan            = (mfgUser?.license_plan || 'trial').toLowerCase();
  const approvalStatus  = liveStatus?.approval_status || mfgUser?.approval_status || 'pending';
  const companyName     = liveStatus?.company_name   || mfgUser?.company_name || '—';
  const mobile          = mfgUser?.mobile || '—';

  const planColors = PLAN_COLORS[plan] || PLAN_COLORS.trial;
  const statusInfo = STATUS_INFO[approvalStatus] || STATUS_INFO.pending;
  const StatusIcon = statusInfo.icon;

  async function refreshStatus() {
    setRefreshing(true);
    try {
      const res = await mfgGetStatus();
      setLiveStatus(res);
      toast.success('License status refreshed');
    } catch (e) { toast.error(e.message || 'Failed to refresh'); }
    finally { setRefreshing(false); }
  }

  const planFeatures = PLAN_FEATURES[plan] || PLAN_FEATURES.trial;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
          <Shield size={20} className="text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">License & Activation</h1>
          <p className="text-sm text-muted-foreground">Your software license and account details</p>
        </div>
      </div>

      {/* License card */}
      <div className={`rounded-2xl border-2 p-6 ${planColors.border}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown size={16} className={planColors.text} />
              <span className={`text-lg font-black uppercase tracking-wide ${planColors.text}`}>{plan} Plan</span>
            </div>
            <p className="text-sm text-muted-foreground">{companyName}</p>
            <p className="text-xs text-muted-foreground">Account: {mobile}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${planColors.bg} ${planColors.text}`}>
              <StatusIcon size={12} className={statusInfo.color} />
              {statusInfo.label}
            </div>
            <Button size="sm" variant="outline" onClick={refreshStatus} disabled={refreshing} className="h-7 px-3 text-xs gap-1">
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </Button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Included Features</p>
          <div className="space-y-1.5">
            {planFeatures.map(f => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status explanation */}
      {approvalStatus === 'pending' && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Approval Pending</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Your account is awaiting approval from OsaTech. This usually takes a few hours. Contact us on WhatsApp for faster activation.
            </p>
          </div>
        </div>
      )}
      {approvalStatus === 'blocked' && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">Account Blocked</p>
            <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">Contact OsaTech support immediately to resolve this issue.</p>
          </div>
        </div>
      )}

      {/* Upgrade / Contact */}
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Lock size={14} className="text-violet-500" /> Upgrade or Get Support</h3>
        <p className="text-sm text-muted-foreground mb-4">Contact OsaTech to upgrade your plan, extend your license, or get technical support.</p>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://wa.me/923298748232?text=Hi%20OsaTech%2C%20I%20need%20help%20with%20my%20Manufacturing%20ERP%20license"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
          >
            <MessageCircle size={14} /> WhatsApp · 0329-8748232
          </a>
          <a
            href="mailto:munibahmadvfx@gmail.com?subject=Manufacturing ERP License"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border hover:bg-muted transition-colors"
          >
            <Mail size={14} /> munibahmadvfx@gmail.com
          </a>
        </div>
      </div>

      {/* EULA */}
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Shield size={14} className="text-slate-500" /> License Agreement (EULA v2.0)</h3>
        <div className="space-y-4">
          {EULA_CLAUSES.map((c, i) => (
            <div key={c.title}>
              <p className="text-xs font-bold text-foreground">{i + 1}. {c.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
          © 2026 Munib Ahmad · OsaTech. All rights reserved. By using this software you accept these terms.
        </div>
      </div>
    </div>
  );
}
