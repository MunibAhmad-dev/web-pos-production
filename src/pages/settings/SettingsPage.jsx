import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import cloudApi from '../../api/cloudClient';
import { Card, CardHeader } from '@/components/ui/panel';
import { Input } from '@/components/form/fields';
import Button from '@/components/ui/action-button';
import Badge from '@/components/ui/status-badge';
import { useLowStockThreshold } from '../../hooks/useLowStockThreshold';
import { setLowStockThreshold } from '../../utils/constants';

const statusTone = { approved: 'green', pending: 'orange', blocked: 'red' };

export default function SettingsPage() {
  const { user, refreshStatus } = useAuth();
  const { showToast } = useToast();
  const [storeName, setStoreName] = useState(user?.store_name || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const threshold = useLowStockThreshold();
  const [thresholdInput, setThresholdInput] = useState(threshold);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await cloudApi.post('/instances/heartbeat', { store_name: storeName });
      await refreshStatus();
      showToast('Store name updated');
    } catch (err) {
      showToast(err.response?.data?.error || 'Unable to save', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveThreshold = (e) => {
    e.preventDefault();
    const value = Number(thresholdInput);
    if (!Number.isFinite(value) || value < 0) {
      showToast('Enter a valid threshold', 'error');
      return;
    }
    setLowStockThreshold(value);
    showToast('Low stock threshold updated');
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Settings</h2>
        <p className="text-sm text-muted-foreground">Store profile and preferences for this web account.</p>
      </div>

      <Card>
        <CardHeader
          title="Store Profile"
          action={<Badge tone={statusTone[user?.approval_status] || 'gray'}>{user?.approval_status}</Badge>}
        />
        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <Input label="Business / Store name" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          <Input label="Owner name" value={user?.owner_name || ''} disabled />
          <Input label="Mobile number (login)" value={user?.mobile || ''} disabled />
          <Input label="Store address" value={user?.store_address || ''} disabled />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save Store Name'}
            </Button>
          </div>
        </form>
        <p className="px-5 pb-5 text-xs text-muted-foreground">
          Only the store name can be updated from here today — owner name, mobile and address are set at registration
          (shared with the desktop app) and aren&apos;t editable from the web yet.
        </p>
      </Card>

      <Card>
        <CardHeader title="Inventory" />
        <form onSubmit={handleSaveThreshold} className="flex flex-col gap-4 p-5 sm:max-w-xs">
          <Input
            label="Low stock alert threshold"
            type="number"
            min="0"
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Products at or below this quantity show a low-stock badge on Dashboard, Products, Inventory and POS.</p>
          <Button type="submit" className="self-start">
            Save Threshold
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="Account" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Instance ID</p>
            <p className="font-mono text-xs text-ink">{user?.instance_id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Approval status</p>
            <Badge tone={statusTone[user?.approval_status] || 'gray'}>{user?.approval_status}</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
