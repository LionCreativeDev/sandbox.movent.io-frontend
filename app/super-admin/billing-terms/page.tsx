'use client';
import { useEffect, useState } from 'react';
import SuperAdminLayout from '@/components/super-admin/SuperAdminLayout';
import { billingTermService, BillingTerm } from '@/lib/services/billingTermService';
import SubmitButton from '@/components/ui/SubmitButton';
import { HiPlus, HiPencil, HiTrash, HiPower, HiXMark } from 'react-icons/hi2';
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

type FormState = { name: string; months: string; discount_percent: string };
const EMPTY_FORM: FormState = { name: '', months: '', discount_percent: '0' };

export default function BillingTermsPage() {
  const [terms, setTerms] = useState<BillingTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null); // null = not editing, 0 = creating new
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    billingTermService.getAll()
      .then(setTerms)
      .catch(() => toast.error('Failed to load billing terms'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const startCreate = () => { setEditingId(0); setForm(EMPTY_FORM); };
  const startEdit = (t: BillingTerm) => {
    setEditingId(t.id);
    setForm({ name: t.name, months: String(t.months), discount_percent: String(t.discount_percent) });
  };
  const cancelEdit = () => { setEditingId(null); setForm(EMPTY_FORM); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const months = Number(form.months);
    const discount = Number(form.discount_percent);
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!months || months < 1) { toast.error('Months must be at least 1'); return; }
    if (discount < 0 || discount > 100) { toast.error('Discount must be between 0 and 100'); return; }

    setSaving(true);
    try {
      const payload = { name: form.name.trim(), months, discount_percent: discount };
      if (editingId) {
        await billingTermService.update(editingId, payload);
        toast.success('Billing term updated');
      } else {
        await billingTermService.create(payload);
        toast.success('Billing term created');
      }
      cancelEdit();
      load();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex.response?.data?.message ?? 'Failed to save billing term');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: BillingTerm) => {
    if (!confirm(`Delete "${t.name}"? Any package option built on it is removed too (unless a company is on it).`)) return;
    try {
      await billingTermService.delete(t.id);
      toast.success('Billing term deleted');
      load();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex.response?.data?.message ?? 'Failed to delete billing term');
    }
  };

  const handleToggle = async (t: BillingTerm) => {
    try {
      const res = await billingTermService.toggle(t.id);
      setTerms(ts => ts.map(x => x.id === t.id ? { ...x, is_active: res.is_active } : x));
      toast.success(res.is_active ? 'Billing term activated' : 'Billing term deactivated');
    } catch {
      toast.error('Failed to toggle status');
    }
  };

  return (
    <SuperAdminLayout>
      <div style={{ padding: '28px 32px', maxWidth: 900 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Billing Terms</h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
              Multi-year billing options (Yearly, 2-Year, 5-Year, or anything else) — add as many as you need.
            </p>
          </div>
          {editingId === null && (
            <button
              onClick={startCreate}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              <HiPlus size={18} /> New Term
            </button>
          )}
        </div>

        <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 20px' }}>
          Every package automatically gets a companion option for each active term below (monthly price × months,
          then that term&apos;s % off) — see <a href="/super-admin/packages" style={{ color: '#7c3aed' }}>Packages</a>.
          Monthly billing itself is never discounted and isn&apos;t managed here.
        </p>

        {editingId !== null && (
          <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {editingId ? 'Edit Billing Term' : 'New Billing Term'}
              </h3>
              <button type="button" onClick={cancelEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <HiXMark size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={lbl}>Name</label>
                <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Yearly, 5-Year, 18 Months" required />
              </div>
              <div>
                <label style={lbl}>Months</label>
                <input type="number" min={1} style={inp} value={form.months} onChange={e => setForm(f => ({ ...f, months: e.target.value }))} placeholder="12" required />
              </div>
              <div>
                <label style={lbl}>Discount (%)</label>
                <input type="number" min={0} max={100} step={0.01} style={inp} value={form.discount_percent} onChange={e => setForm(f => ({ ...f, discount_percent: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={cancelEdit} style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Cancel
              </button>
              <SubmitButton loading={saving} loadingText="Saving…" style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: saving ? '#c4b5fd' : 'linear-gradient(135deg, #7c3aed, #a78bfa)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
                {editingId ? 'Save Changes' : 'Create Term'}
              </SubmitButton>
            </div>
          </form>
        )}

        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
          ) : terms.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No billing terms yet</div>
              <div style={{ fontSize: 13 }}>Every package will only offer Monthly billing until you add one.</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Name', 'Months', 'Discount', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {terms.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{t.name}</td>
                    <td style={{ padding: '14px 18px', color: '#64748b', fontSize: 13 }}>{t.months}</td>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: '#16a34a', fontSize: 14 }}>{Number(t.discount_percent)}%</td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: t.is_active ? '#ecfdf5' : '#fef2f2', color: t.is_active ? '#059669' : '#ef4444' }}>
                        {t.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => startEdit(t)} title="Edit" style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#2563eb' }}>
                          <HiPencil size={14} />
                        </button>
                        <button onClick={() => handleToggle(t)} title={t.is_active ? 'Deactivate' : 'Activate'} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: t.is_active ? '#d97706' : '#059669' }}>
                          <HiPower size={14} />
                        </button>
                        <button onClick={() => handleDelete(t)} title="Delete" style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#ef4444' }}>
                          <HiTrash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </SuperAdminLayout>
  );
}
