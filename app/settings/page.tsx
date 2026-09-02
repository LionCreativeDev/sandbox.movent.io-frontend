'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/axios';
import { getAuthType, getAuthUser } from '@/lib/auth';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { moduleUpgradeService, ModuleCatalog } from '@/lib/services/moduleUpgradeService';

// ─── Types ───────────────────────────────────────────────────────────────────
interface CompanySettings {
  name: string; industry: string; email: string; phone: string;
  address: string; timezone: string; currency: string; logo_url: string | null;
}
interface InvoiceSettings {
  prefix: string; tax_rate: number; payment_terms: number; notes: string;
}
interface BankSettings {
  bank_name: string; account_name: string; account_number: string;
  iban: string; swift: string;
}
interface GatewayConfig { [key: string]: string; }
interface GatewayEntry { label: string; is_active: boolean; config: GatewayConfig; }
type Gateways = Record<string, GatewayEntry>;

// ─── Styles ──────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fafafa', color: '#0f172a', boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' };
const card: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden', marginBottom: 20 };
const cardHead: React.CSSProperties = { padding: '16px 24px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' };
const cardBody: React.CSSProperties = { padding: 24 };

const TIMEZONES   = ['Asia/Karachi', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kolkata', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'UTC'];
const CURRENCIES  = [{ v: 'PKR', l: 'PKR — Pakistani Rupee' }, { v: 'USD', l: 'USD — US Dollar' }, { v: 'EUR', l: 'EUR — Euro' }, { v: 'GBP', l: 'GBP — British Pound' }, { v: 'AED', l: 'AED — UAE Dirham' }, { v: 'SAR', l: 'SAR — Saudi Riyal' }];
const INDUSTRIES  = ['Technology', 'Finance', 'Healthcare', 'Education', 'Retail', 'Manufacturing', 'Construction', 'Real Estate', 'Consulting', 'Marketing', 'Legal', 'Hospitality', 'Other'];

// Gateway config field definitions
const GATEWAY_FIELDS: Record<string, { key: string; label: string; placeholder: string; secret?: boolean; type?: string }[]> = {
  paypal: [
    { key: 'client_id',     label: 'Client ID',     placeholder: 'AXxxxxxxxxxxxxxxxxxxxxx' },
    { key: 'client_secret', label: 'Client Secret', placeholder: 'EXxxxxxxxxxxxxxxxxxxxxx', secret: true },
    { key: 'mode',          label: 'Mode',           placeholder: 'sandbox', type: 'mode' },
    { key: 'webhook_id',    label: 'Webhook ID', placeholder: 'Optional — enables automatic payment confirmation' },
  ],
  stripe: [
    { key: 'publishable_key', label: 'Publishable Key', placeholder: 'pk_live_xxxxxxxxxxxxxxxx' },
    { key: 'secret_key',      label: 'Secret Key',      placeholder: 'sk_live_xxxxxxxxxxxxxxxx', secret: true },
    { key: 'mode',            label: 'Mode',            placeholder: 'live', type: 'mode' },
    { key: 'webhook_secret',  label: 'Webhook Signing Secret', placeholder: 'Optional — enables automatic payment confirmation', secret: true },
  ],
  authorize_net: [
    { key: 'api_login_id',    label: 'API Login ID',           placeholder: '1234567890' },
    { key: 'transaction_key', label: 'Transaction Key',         placeholder: 'xxxxxxxxxxxxxxxx', secret: true },
    { key: 'client_key',      label: 'Client Key (Accept.js)',  placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx' },
    { key: 'mode',            label: 'Mode',                    placeholder: 'sandbox', type: 'mode' },
    { key: 'signature_key',   label: 'Signature Key', placeholder: 'Optional — enables automatic payment confirmation', secret: true },
  ],
};

const GATEWAY_ICONS: Record<string, string> = { paypal: '🅿', stripe: '⚡', authorize_net: '🔐' };
const GATEWAY_COLORS: Record<string, string> = { paypal: '#003087', stripe: '#635bff', authorize_net: '#1a1a2e' };

// ─── Tab Button ──────────────────────────────────────────────────────────────
function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: active ? 'linear-gradient(135deg,#2563eb,#3b82f6)' : 'transparent', color: active ? '#fff' : '#64748b', fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer', transition: 'all .15s' }}>
      {label}
    </button>
  );
}

// ─── Save Button ─────────────────────────────────────────────────────────────
function SaveBtn({ saving, label = 'Save Changes' }: { saving: boolean; label?: string }) {
  return (
    <button type="submit" disabled={saving} style={{ padding: '10px 28px', borderRadius: 9, border: 'none', background: saving ? '#93c5fd' : 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
      {saving ? 'Saving…' : label}
    </button>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div style={{ position: 'fixed', bottom: 28, right: 28, padding: '12px 20px', borderRadius: 10, background: type === 'success' ? '#ecfdf5' : '#fef2f2', border: `1.5px solid ${type === 'success' ? '#6ee7b7' : '#fecaca'}`, color: type === 'success' ? '#065f46' : '#dc2626', fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,.1)' }}>
      {type === 'success' ? '✓ ' : '✗ '}{msg}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  useAdminGuard();
  const router = useRouter();
  const [tab, setTab] = useState<'company' | 'invoice' | 'bank' | 'gateways' | 'subscription'>('company');
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [company,  setCompany]  = useState<CompanySettings>({ name: '', industry: '', email: '', phone: '', address: '', timezone: 'Asia/Karachi', currency: 'PKR', logo_url: null });
  const [invoice,  setInvoice]  = useState<InvoiceSettings>({ prefix: 'INV', tax_rate: 0, payment_terms: 30, notes: '' });
  const [bank,     setBank]     = useState<BankSettings>({ bank_name: '', account_name: '', account_number: '', iban: '', swift: '' });
  const [gateways, setGateways] = useState<Gateways>({});
  const [moduleCatalog, setModuleCatalog] = useState<ModuleCatalog | null>(null);

  const [savingC, setSavingC]   = useState(false);
  const [savingI, setSavingI]   = useState(false);
  const [savingB, setSavingB]   = useState(false);
  const [savingGW, setSavingGW] = useState<Record<string, boolean>>({});
  const [testingGW, setTestingGW] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string } | null>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadSettings = () => {
    setLoading(true);
    api.get('/admin/settings').then(r => {
      const d = r.data.data;
      setCompany({
        ...d.company,
        industry: d.company.industry ?? '',
        email:    d.company.email    ?? '',
        phone:    d.company.phone    ?? '',
        address:  d.company.address  ?? '',
      });
      setInvoice({
        ...d.invoice,
        notes: d.invoice.notes ?? '',
      });
      setBank({
        bank_name:      d.bank.bank_name      ?? '',
        account_name:   d.bank.account_name   ?? '',
        account_number: d.bank.account_number ?? '',
        iban:           d.bank.iban           ?? '',
        swift:          d.bank.swift          ?? '',
      });
      setGateways(d.gateways ?? {});
      setLogoPreview(d.company.logo_url ?? null);
      setLogoFile(null);
    }).catch(() => showToast('Failed to load settings', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (getAuthType() !== 'admin') { router.replace('/dashboard'); return; }
    loadSettings();
    moduleUpgradeService.catalog().then(setModuleCatalog).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // One webhook endpoint per gateway per account — the id in the path is
  // this Company Admin's own id, not tied to any single company.
  const webhookUrl = (gatewayKey: string) => {
    const adminId = (getAuthUser() as { id?: number } | null)?.id;
    return `${process.env.NEXT_PUBLIC_API_URL ?? ''}/webhooks/${gatewayKey}/${adminId ?? ''}`;
  };

  // ── Company save ─────────────────────────────────────────────────────────
  const saveCompany = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault(); setSavingC(true);
    try {
      // Upload logo first if selected
      if (logoFile) {
        const fd = new FormData();
        fd.append('logo', logoFile);
        const lr = await api.post('/admin/settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setLogoPreview(lr.data.data.logo_url);
        setLogoFile(null);
      }
      await api.put('/admin/settings/company', {
        name: company.name, industry: company.industry || null,
        email: company.email || null, phone: company.phone || null,
        address: company.address || null, timezone: company.timezone,
        currency: company.currency,
      });
      showToast('Company profile saved', 'success');
    } catch { showToast('Failed to save company profile', 'error'); }
    finally { setSavingC(false); }
  };

  // ── Invoice save ──────────────────────────────────────────────────────────
  const saveInvoice = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault(); setSavingI(true);
    try {
      await api.put('/admin/settings/invoice', {
        prefix: invoice.prefix, tax_rate: invoice.tax_rate,
        payment_terms: invoice.payment_terms, notes: invoice.notes || null,
      });
      showToast('Invoice settings saved', 'success');
    } catch { showToast('Failed to save invoice settings', 'error'); }
    finally { setSavingI(false); }
  };

  // ── Gateway save ──────────────────────────────────────────────────────────
  const saveGateway = async (key: string) => {
    setSavingGW(p => ({ ...p, [key]: true }));
    try {
      const gw = gateways[key];
      await api.put(`/admin/settings/gateways/${key}`, {
        is_active: gw.is_active,
        config:    gw.config,
      });
      showToast(`${gw.label} settings saved`, 'success');
    } catch { showToast('Failed to save gateway settings', 'error'); }
    finally { setSavingGW(p => ({ ...p, [key]: false })); }
  };

  const toggleGateway = (key: string, val: boolean) =>
    setGateways(p => ({ ...p, [key]: { ...p[key], is_active: val } }));

  const setGatewayConfig = (key: string, field: string, val: string) => {
    setGateways(p => ({ ...p, [key]: { ...p[key], config: { ...p[key].config, [field]: val } } }));
    setTestResults(p => ({ ...p, [key]: null }));
  };

  // ── Gateway test connection ───────────────────────────────────────────────
  const testGateway = async (key: string) => {
    setTestingGW(p => ({ ...p, [key]: true }));
    setTestResults(p => ({ ...p, [key]: null }));
    try {
      const res = await api.post(`/admin/settings/gateways/${key}/test`);
      setTestResults(p => ({ ...p, [key]: { ok: true, msg: res.data.message ?? 'Connection successful' } }));
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      setTestResults(p => ({ ...p, [key]: { ok: false, msg: ex.response?.data?.message ?? 'Test failed' } }));
    } finally {
      setTestingGW(p => ({ ...p, [key]: false }));
    }
  };

  // ── Bank save ─────────────────────────────────────────────────────────────
  const saveBank = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault(); setSavingB(true);
    try {
      await api.put('/admin/settings/bank', {
        bank_name: bank.bank_name || null, account_name: bank.account_name || null,
        account_number: bank.account_number || null, iban: bank.iban || null,
        swift: bank.swift || null,
      });
      showToast('Bank details saved', 'success');
    } catch { showToast('Failed to save bank details', 'error'); }
    finally { setSavingB(false); }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  if (loading) return (
    <DashboardLayout title="Settings">
      <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout title="Settings">
      <div style={{ maxWidth: 860 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Settings</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
            One shared profile, invoice defaults, and payment details for your whole account — every company you own uses the same settings.
          </p>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f8fafc', padding: 6, borderRadius: 12, width: 'fit-content', border: '1px solid #f1f5f9' }}>
          {([['company','Company'], ['invoice','Invoice'], ['bank','Bank / Payment'], ['gateways','Gateways'], ['subscription','Subscription']] as const).map(([k, l]) => (
            <Tab key={k} label={l} active={tab === k} onClick={() => setTab(k)} />
          ))}
        </div>

        {/* ── Company Profile ── */}
        {tab === 'company' && (
          <form onSubmit={saveCompany}>
            <div style={card}>
              <div style={cardHead}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Company Profile</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#94a3b8' }}>Basic information shown on invoices and client portal</p>
              </div>
              <div style={cardBody}>
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ width: 80, height: 80, borderRadius: 12, background: '#f1f5f9', border: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {logoPreview
                      ? <img src={logoPreview} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 28 }}>🏢</span>
                    }
                  </div>
                  <div>
                    <label style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                      {logoPreview ? 'Change Logo' : 'Upload Logo'}
                      <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
                    </label>
                    {logoFile && <span style={{ marginLeft: 10, fontSize: 12, color: '#059669' }}>✓ {logoFile.name}</span>}
                    <p style={{ margin: '5px 0 0', fontSize: 11, color: '#94a3b8' }}>PNG, JPG, WebP — max 2MB</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={lbl}>Company Name *</label>
                    <input style={inp} value={company.name} onChange={e => setCompany(p => ({ ...p, name: e.target.value }))} required />
                  </div>
                  <div>
                    <label style={lbl}>Industry</label>
                    <select style={inp} value={company.industry} onChange={e => setCompany(p => ({ ...p, industry: e.target.value }))}>
                      <option value="">Select industry…</option>
                      {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Email</label>
                    <input type="email" style={inp} value={company.email} onChange={e => setCompany(p => ({ ...p, email: e.target.value }))} placeholder="company@example.com" />
                  </div>
                  <div>
                    <label style={lbl}>Phone</label>
                    <input style={inp} value={company.phone} onChange={e => setCompany(p => ({ ...p, phone: e.target.value }))} placeholder="+92 300 0000000" />
                  </div>
                  <div>
                    <label style={lbl}>Timezone</label>
                    <select style={inp} value={company.timezone} onChange={e => setCompany(p => ({ ...p, timezone: e.target.value }))}>
                      {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Currency</label>
                    <select style={inp} value={company.currency} onChange={e => setCompany(p => ({ ...p, currency: e.target.value }))}>
                      {CURRENCIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={lbl}>Address</label>
                  <textarea style={{ ...inp, resize: 'vertical', minHeight: 70 }} value={company.address} onChange={e => setCompany(p => ({ ...p, address: e.target.value }))} placeholder="Full company address…" />
                </div>
              </div>
              <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', justifyContent: 'flex-end' }}>
                <SaveBtn saving={savingC} />
              </div>
            </div>
          </form>
        )}

        {/* ── Invoice Settings ── */}
        {tab === 'invoice' && (
          <form onSubmit={saveInvoice}>
            <div style={card}>
              <div style={cardHead}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Invoice Defaults</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#94a3b8' }}>These defaults are pre-filled when creating a new invoice</p>
              </div>
              <div style={cardBody}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={lbl}>Invoice Prefix</label>
                    <input style={inp} value={invoice.prefix} onChange={e => setInvoice(p => ({ ...p, prefix: e.target.value.toUpperCase() }))} placeholder="INV" required maxLength={20} />
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>e.g. INV → INV-2025-0001</p>
                  </div>
                  <div>
                    <label style={lbl}>Default Tax Rate (%)</label>
                    <input type="number" min={0} max={100} step="0.01" style={inp} value={invoice.tax_rate} onChange={e => setInvoice(p => ({ ...p, tax_rate: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label style={lbl}>Payment Terms (days)</label>
                    <input type="number" min={0} max={365} style={inp} value={invoice.payment_terms} onChange={e => setInvoice(p => ({ ...p, payment_terms: parseInt(e.target.value) || 0 }))} />
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>Due date = issue date + this many days</p>
                  </div>
                </div>

                {/* Live preview */}
                <div style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 18px', marginBottom: 16 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Preview</p>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <div><span style={{ fontSize: 11, color: '#94a3b8' }}>Invoice #</span><br /><span style={{ fontSize: 15, fontWeight: 700, color: '#2563eb' }}>{invoice.prefix || 'INV'}-2025-0042</span></div>
                    <div><span style={{ fontSize: 11, color: '#94a3b8' }}>Tax</span><br /><span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{invoice.tax_rate}%</span></div>
                    <div><span style={{ fontSize: 11, color: '#94a3b8' }}>Payment due</span><br /><span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Net {invoice.payment_terms} days</span></div>
                  </div>
                </div>

                <div>
                  <label style={lbl}>Default Invoice Notes / Footer</label>
                  <textarea style={{ ...inp, resize: 'vertical', minHeight: 90 }} value={invoice.notes} onChange={e => setInvoice(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Thank you for your business. Payment must be received within the agreed terms." maxLength={1000} />
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>{invoice.notes.length}/1000 characters</p>
                </div>
              </div>
              <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', justifyContent: 'flex-end' }}>
                <SaveBtn saving={savingI} />
              </div>
            </div>
          </form>
        )}

        {/* ── Bank Details ── */}
        {tab === 'bank' && (
          <form onSubmit={saveBank}>
            <div style={card}>
              <div style={cardHead}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Bank Account Details</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#94a3b8' }}>Shown on invoices so clients know where to send bank transfer payments</p>
              </div>
              <div style={cardBody}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={lbl}>Bank Name</label>
                    <input style={inp} value={bank.bank_name} onChange={e => setBank(p => ({ ...p, bank_name: e.target.value }))} placeholder="e.g. HBL, Meezan Bank, UBL" />
                  </div>
                  <div>
                    <label style={lbl}>Account Name</label>
                    <input style={inp} value={bank.account_name} onChange={e => setBank(p => ({ ...p, account_name: e.target.value }))} placeholder="Account holder name" />
                  </div>
                  <div>
                    <label style={lbl}>Account Number</label>
                    <input style={inp} value={bank.account_number} onChange={e => setBank(p => ({ ...p, account_number: e.target.value }))} placeholder="0123456789" />
                  </div>
                  <div>
                    <label style={lbl}>IBAN</label>
                    <input style={{ ...inp, fontFamily: 'monospace' }} value={bank.iban} onChange={e => setBank(p => ({ ...p, iban: e.target.value.toUpperCase() }))} placeholder="PK36SCBL0000001123456702" />
                  </div>
                  <div>
                    <label style={lbl}>SWIFT / BIC Code</label>
                    <input style={{ ...inp, fontFamily: 'monospace' }} value={bank.swift} onChange={e => setBank(p => ({ ...p, swift: e.target.value.toUpperCase() }))} placeholder="SCBLPKKA" />
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>Required for international wire transfers</p>
                  </div>
                </div>

                {/* Preview box */}
                {(bank.bank_name || bank.account_number) && (
                  <div style={{ marginTop: 20, padding: '16px 20px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Invoice Footer Preview</p>
                    <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
                      <strong>Bank Transfer Details:</strong><br />
                      {bank.bank_name && <>{bank.bank_name}<br /></>}
                      {bank.account_name && <>Account Name: {bank.account_name}<br /></>}
                      {bank.account_number && <>Account #: {bank.account_number}<br /></>}
                      {bank.iban && <>IBAN: {bank.iban}<br /></>}
                      {bank.swift && <>SWIFT: {bank.swift}</>}
                    </p>
                  </div>
                )}
              </div>
              <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', justifyContent: 'flex-end' }}>
                <SaveBtn saving={savingB} />
              </div>
            </div>
          </form>
        )}

        {/* ── Payment Gateways ── */}
        {tab === 'gateways' && (
          <div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
              Enable and configure the payment gateways you want to offer clients. This is one shared configuration for your whole account — every company you own uses the same active gateways, there is nothing to set up per company.
            </p>

            {Object.entries(gateways).map(([key, gw]) => {
              const fields  = GATEWAY_FIELDS[key] ?? [];
              const icon    = GATEWAY_ICONS[key] ?? '💳';
              const color   = GATEWAY_COLORS[key] ?? '#64748b';
              const saving  = savingGW[key] ?? false;

              return (
                <div key={key} style={{ ...card, border: gw.is_active ? `2px solid ${color}22` : '1px solid #f1f5f9' }}>
                  {/* Header row with toggle */}
                  <div style={{ padding: '18px 24px', borderBottom: gw.is_active ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: gw.is_active ? `${color}08` : '#fafafa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                        {icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{gw.label}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 }}>{key}</div>
                      </div>
                    </div>
                    {/* Toggle switch */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <span style={{ fontSize: 13, color: gw.is_active ? '#059669' : '#94a3b8', fontWeight: 600 }}>
                        {gw.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <div
                        onClick={() => toggleGateway(key, !gw.is_active)}
                        style={{ width: 44, height: 24, borderRadius: 12, background: gw.is_active ? '#10b981' : '#e2e8f0', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}
                      >
                        <div style={{ position: 'absolute', top: 3, left: gw.is_active ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', transition: 'left .2s' }} />
                      </div>
                    </label>
                  </div>

                  {/* Config fields — only show when active */}
                  {gw.is_active && (
                    <div style={{ padding: 24 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                        {fields.map(f => (
                          <div key={f.key}>
                            <label style={lbl}>{f.label}{f.secret && <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 4 }}>(encrypted)</span>}</label>
                            {f.type === 'mode' ? (
                              <select style={inp} value={gw.config[f.key] ?? 'sandbox'} onChange={e => setGatewayConfig(key, f.key, e.target.value)}>
                                <option value="sandbox">Sandbox / Test</option>
                                <option value="live">Live / Production</option>
                              </select>
                            ) : (
                              <input
                                style={{ ...inp, fontFamily: f.secret ? 'monospace' : 'inherit' }}
                                type={f.secret ? 'password' : 'text'}
                                value={gw.config[f.key] ?? ''}
                                onChange={e => setGatewayConfig(key, f.key, e.target.value)}
                                placeholder={f.placeholder}
                                autoComplete="off"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      {gw.config['mode'] === 'sandbox' && (
                        <div style={{ padding: '8px 14px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12, color: '#92400e', marginBottom: 14 }}>
                          ⚠ Sandbox mode — transactions are test-only and won&apos;t charge real cards
                        </div>
                      )}
                      {gw.config['mode'] === 'live' && (
                        <div style={{ padding: '8px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: '#dc2626', marginBottom: 14 }}>
                          🔴 Live mode — real charges will be made. Verify all credentials before saving.
                        </div>
                      )}
                      {/* Webhook URL — paste this into the gateway's own dashboard so payments confirm automatically */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                          Webhook URL <span style={{ fontWeight: 400, color: '#94a3b8', textTransform: 'none' }}>(paste into your {gw.label} dashboard for automatic payment confirmation)</span>
                        </div>
                        <div style={{ padding: '8px 12px', borderRadius: 7, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'monospace', color: '#475569', wordBreak: 'break-all' }}>
                          {webhookUrl(key)}
                        </div>
                      </div>
                      {/* Accept.js URL for Authorize.Net */}
                      {key === 'authorize_net' && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                            Accept.js Library URL <span style={{ fontWeight: 400, color: '#94a3b8', textTransform: 'none' }}>(auto-computed)</span>
                          </div>
                          <div style={{ padding: '8px 12px', borderRadius: 7, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'monospace', color: '#475569' }}>
                            {gw.config['mode'] === 'live' ? 'https://js.authorize.net/v1/Accept.js' : 'https://jstest.authorize.net/v1/Accept.js'}
                          </div>
                        </div>
                      )}
                      {/* Test result */}
                      {testResults[key] && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '9px 13px', borderRadius: 8, background: testResults[key]!.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${testResults[key]!.ok ? '#bbf7d0' : '#fecaca'}` }}>
                          <span style={{ fontSize: 15 }}>{testResults[key]!.ok ? '✓' : '✗'}</span>
                          <span style={{ fontSize: 12, color: testResults[key]!.ok ? '#15803d' : '#dc2626' }}>{testResults[key]!.msg}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => testGateway(key)}
                          disabled={testingGW[key] || saving}
                          style={{ padding: '9px 18px', borderRadius: 9, border: `1.5px solid ${color}44`, background: '#fff', color, fontSize: 13, fontWeight: 600, cursor: testingGW[key] || saving ? 'not-allowed' : 'pointer', opacity: testingGW[key] || saving ? 0.6 : 1 }}
                        >
                          {testingGW[key] ? '⏳ Testing…' : '🔌 Test'}
                        </button>
                        <button
                          onClick={() => saveGateway(key)}
                          disabled={saving}
                          style={{ padding: '9px 24px', borderRadius: 9, border: 'none', background: saving ? '#93c5fd' : `linear-gradient(135deg,${color},${color}cc)`, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
                        >
                          {saving ? 'Saving…' : `Save ${gw.label}`}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* If inactive, show a save button to persist the toggle */}
                  {!gw.is_active && (
                    <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => saveGateway(key)}
                        disabled={saving}
                        style={{ padding: '7px 20px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Subscription ── */}
        {tab === 'subscription' && (
          <div style={card}>
            <div style={cardHead}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Active Modules</div>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>Purchase additional modules for your account at any time.</p>
            </div>
            <div style={cardBody}>
              {!moduleCatalog ? (
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 18 }}>Loading…</div>
              ) : moduleCatalog.owned_modules.length === 0 ? (
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 18 }}>No modules purchased yet.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                  {moduleCatalog.owned_modules.map(key => {
                    const label = moduleCatalog.modules.find(m => m.key === key)?.label ?? key;
                    return (
                      <span key={key} style={{ padding: '4px 10px', background: '#ecfdf5', color: '#059669', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{label}</span>
                    );
                  })}
                </div>
              )}
              <Link href="/admin/upgrade-modules" style={{
                display: 'inline-block', padding: '10px 28px', borderRadius: 9, border: 'none',
                background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none',
              }}>
                Upgrade Modules
              </Link>
            </div>
          </div>
        )}
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </DashboardLayout>
  );
}
