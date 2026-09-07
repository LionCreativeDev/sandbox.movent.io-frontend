'use client';
import { useEffect, useState } from 'react';
import SuperAdminLayout from '@/components/super-admin/SuperAdminLayout';
import { subscriptionPolicyService, SubscriptionPolicy } from '@/lib/services/subscriptionPolicyService';
import { moduleService, ModuleItem } from '@/lib/services/moduleService';
import SubmitButton from '@/components/ui/SubmitButton';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import toast from 'react-hot-toast';

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 13px',
  border: '1.5px solid #e2e8f0', borderRadius: 8,
  fontSize: 14, outline: 'none', background: '#fafafa', color: '#0f172a',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
};
const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: '#7c3aed',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16,
};

type FormState = {
  trial_enabled: boolean;
  trial_duration_days: string;
  trial_modules: string[];
  all_modules_during_trial: boolean;
  grace_period_days: string;
  renewal_reminder_days: string;
  auto_suspend_on_trial_expiry: boolean;
  trial_expiry_behavior: 'grace_period' | 'suspend_immediately';
  payment_policy_notes: string;
};

const toForm = (p: SubscriptionPolicy): FormState => ({
  trial_enabled: p.trial_enabled,
  trial_duration_days: String(p.trial_duration_days),
  trial_modules: p.trial_modules ?? [],
  all_modules_during_trial: !p.trial_modules || p.trial_modules.length === 0,
  grace_period_days: String(p.grace_period_days),
  renewal_reminder_days: p.renewal_reminder_days.join(', '),
  auto_suspend_on_trial_expiry: p.auto_suspend_on_trial_expiry,
  trial_expiry_behavior: p.trial_expiry_behavior,
  payment_policy_notes: p.payment_policy_notes ?? '',
});

export default function SubscriptionPolicyPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modulesLoading, setModulesLoading] = useState(true);
  const [availableModules, setAvailableModules] = useState<ModuleItem[]>([]);
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    subscriptionPolicyService.get()
      .then(p => setForm(toForm(p)))
      .catch(() => setError('Failed to load subscription policy'))
      .finally(() => setLoading(false));

    moduleService.getAll()
      .then(all => setAvailableModules(all.filter(m => m.is_active)))
      .catch(() => {})
      .finally(() => setModulesLoading(false));
  }, []);

  const toggleModule = (mod: ModuleItem) => {
    if (!form) return;
    const checked = mod.sub_modules.every(m => form.trial_modules.includes(m));
    setForm({
      ...form,
      trial_modules: checked
        ? form.trial_modules.filter(m => !mod.sub_modules.includes(m))
        : [...new Set([...form.trial_modules, ...mod.sub_modules])],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || saving) return;

    const reminderDays = form.renewal_reminder_days
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(Number);
    if (reminderDays.some(n => isNaN(n) || n < 0)) {
      setError('Renewal reminder days must be a comma-separated list of non-negative numbers, e.g. 7, 3, 1');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updated = await subscriptionPolicyService.update({
        trial_enabled: form.trial_enabled,
        trial_duration_days: Number(form.trial_duration_days),
        trial_modules: form.all_modules_during_trial ? null : form.trial_modules,
        grace_period_days: Number(form.grace_period_days),
        renewal_reminder_days: reminderDays,
        auto_suspend_on_trial_expiry: form.auto_suspend_on_trial_expiry,
        trial_expiry_behavior: form.trial_expiry_behavior,
        // Renewal failure no longer has its own dropdown/checkbox — it
        // always enters a grace period first (same grace_period_days as
        // trial expiry), then unconditionally suspends once that runs out
        // (see CheckSubscriptionLifecycle::expireGracePeriods(), which
        // always suspends regardless of any flag). These two values are
        // fixed so that behavior holds regardless of whatever was last
        // saved before this UI existed.
        auto_suspend_on_renewal_failure: true,
        renewal_failure_behavior: 'grace_period',
        payment_policy_notes: form.payment_policy_notes || null,
      });
      setForm(toForm(updated));
      toast.success('Subscription policy updated');
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      const msg = ex.response?.data?.message ?? 'Failed to update subscription policy';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <SuperAdminLayout>
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <LoadingOverlay show={saving} message="Saving policy…" />
      <div style={{ maxWidth: 780, padding: '28px 32px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Trial &amp; Subscription Policy</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
            Controls how every new Company Admin&apos;s trial, grace period, renewal, and suspension behave —
            plan pricing itself is managed under <a href="/super-admin/packages" style={{ color: '#7c3aed' }}>Packages</a>.
          </p>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          <form onSubmit={handleSubmit} style={{ padding: 28 }}>
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 20 }}>
                {error}
              </div>
            )}

            {/* Trial */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={sectionTitle}>Trial</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 16 }}>
                <input type="checkbox" checked={form.trial_enabled} onChange={e => setForm({ ...form, trial_enabled: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#7c3aed' }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#475569' }}>Offer a free trial to new Company Admins</span>
              </label>
              <div style={{ marginBottom: 16, maxWidth: 220 }}>
                <label style={lbl}>Trial Duration (days)</label>
                <input type="number" min={0} max={365} style={inp} value={form.trial_duration_days}
                  onChange={e => setForm({ ...form, trial_duration_days: e.target.value })} disabled={!form.trial_enabled} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
                <input type="checkbox" checked={form.all_modules_during_trial}
                  onChange={e => setForm({ ...form, all_modules_during_trial: e.target.checked })}
                  disabled={!form.trial_enabled}
                  style={{ width: 16, height: 16, accentColor: '#7c3aed' }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#475569' }}>All modules available during trial</span>
              </label>

              {!form.all_modules_during_trial && form.trial_enabled && (
                modulesLoading ? (
                  <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading modules…</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {availableModules.map(mod => {
                      const checked = mod.sub_modules.every(m => form.trial_modules.includes(m));
                      return (
                        <label key={mod.key} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                          background: checked ? 'rgba(124,58,237,0.07)' : '#fafafa',
                          border: `1.5px solid ${checked ? '#a78bfa' : '#e2e8f0'}`,
                        }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleModule(mod)}
                            style={{ accentColor: '#7c3aed', width: 14, height: 14, marginTop: 2, cursor: 'pointer' }} />
                          <div style={{ fontSize: 13, fontWeight: checked ? 600 : 500, color: checked ? '#6d28d9' : '#334155' }}>{mod.label}</div>
                        </label>
                      );
                    })}
                  </div>
                )
              )}
            </div>

            {/* Trial Expiry Behavior section hidden for now (not needed
                currently) — trial_expiry_behavior/auto_suspend_on_trial_expiry
                stay at whatever was last saved and keep being sent unchanged
                below, so nothing about actual behavior changes, just no
                longer editable from this UI. Grace Period (days) is still
                editable — moved into Renewal below since it's still used by
                both trial and renewal expiry. */}

            {/* Renewal */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={sectionTitle}>Renewal</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 4 }}>
                <div>
                  <label style={lbl}>Renewal Reminder Days Before Expiry</label>
                  <input style={inp} value={form.renewal_reminder_days}
                    onChange={e => setForm({ ...form, renewal_reminder_days: e.target.value })}
                    placeholder="e.g. 7, 3, 1" />
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '6px 0 0' }}>Comma-separated list — a reminder fires once at each threshold.</p>
                </div>
                <div>
                  <label style={lbl}>Grace Period (days)</label>
                  <input type="number" min={0} max={90} style={inp} value={form.grace_period_days}
                    onChange={e => setForm({ ...form, grace_period_days: e.target.value })} />
                </div>
              </div>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '10px 0 0' }}>
                A failed renewal always enters a Grace Period first (using the Grace Period days above), then suspends once it runs out.
              </p>
            </div>

            {/* Billing */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={sectionTitle}>Billing</h3>
              <div style={{
                background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10,
                padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
              }}>
                <p style={{ fontSize: 12, color: '#6b21a8', margin: 0, lineHeight: 1.6 }}>
                  Multi-year billing options (Yearly, 2-Year, or any other duration) and their discounts are
                  managed separately now — add, edit, or remove as many terms as you need.
                </p>
                <a href="/super-admin/billing-terms" style={{
                  fontSize: 12, fontWeight: 700, color: '#fff', background: '#7c3aed',
                  padding: '8px 16px', borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap',
                }}>
                  Manage Billing Terms →
                </a>
              </div>
            </div>

            {/* Payment policy */}
            <div style={{ marginBottom: 8 }}>
              <h3 style={sectionTitle}>Payment Policy Notes</h3>
              <textarea style={{ ...inp, minHeight: 100, resize: 'vertical' }} value={form.payment_policy_notes}
                onChange={e => setForm({ ...form, payment_policy_notes: e.target.value })}
                placeholder="Shown to Company Admin on the plan-selection/billing screen — refund policy, accepted payment methods, etc." />
            </div>

            <div style={{ display: 'flex', gap: 12, paddingTop: 20, marginTop: 20, borderTop: '1px solid #f1f5f9' }}>
              <SubmitButton loading={saving} loadingText="Saving…" style={{ padding: '10px 32px', borderRadius: 8, border: 'none', background: saving ? '#c4b5fd' : 'linear-gradient(135deg, #7c3aed, #a78bfa)', color: '#fff', fontSize: 14, fontWeight: 600 }}>
                Save Policy
              </SubmitButton>
            </div>
          </form>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
