'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { adminInvoiceService, InvoicePayload } from '@/lib/services/adminInvoiceService';
import { adminClientService, ClientCompany } from '@/lib/services/adminClientService';
import { userClientService } from '@/lib/services/userClientService';
import { adminLeadService, userLeadService } from '@/lib/services/adminLeadService';
import { Client, User } from '@/types';
import { getAuthType, getAuthUser, can } from '@/lib/auth';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { HiArrowLeft, HiPlusCircle, HiTrash, HiUserCircle, HiUsers } from 'react-icons/hi2';

const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fafafa', color: '#0f172a', boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' };

interface LineItem { description: string; quantity: number; unit_price: number; }
const EMPTY_ITEM = (): LineItem => ({ description: '', quantity: 1, unit_price: 0 });

type CustomerType = 'client' | 'guest';

function NewInvoiceForm() {
  useAdminGuard();
  const router  = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get('lead_id') ? Number(searchParams.get('lead_id')) : null;
  const clientIdParam = searchParams.get('client_id') ? Number(searchParams.get('client_id')) : null;
  const companyIdParam = searchParams.get('company_id') ? Number(searchParams.get('company_id')) : null;

  // isAdmin is cookie-derived — must be state to avoid SSR/client hydration mismatch.
  // authResolved guards every effect below that branches on isAdmin: without
  // it, the lead/client-prefill effects can fire once on mount while isAdmin
  // is still its default `false`, calling userLeadService (GET /user/leads/…)
  // for an actual Company Admin — a wrong-guard 401 that force-logs-out via
  // the global axios interceptor, even though the very next render would
  // have called the correct admin endpoint.
  const [isAdmin, setIsAdmin] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [leadPrefilled, setLeadPrefilled] = useState(false);
  const [clientPrefilled, setClientPrefilled] = useState(false);

  // Company + settings
  const [companies, setCompanies]   = useState<ClientCompany[]>([]);
  const [companyId, setCompanyId]   = useState(0);
  const [currency, setCurrency]     = useState('USD');
  const [dueDate, setDueDate]       = useState('');
  const [taxRate, setTaxRate]       = useState(0);
  const [discount, setDiscount]     = useState(0);
  const [notes, setNotes]           = useState('');
  const [items, setItems]           = useState<LineItem[]>([EMPTY_ITEM()]);

  // Customer type — starts as 'client'; useEffect corrects to 'guest' for sub-users
  const [customerType, setCustomerType] = useState<CustomerType>('client');
  const [clients, setClients]           = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientId, setClientId]         = useState<number | null>(null);

  // Guest fields
  const [guestName, setGuestName]       = useState('');
  const [guestEmail, setGuestEmail]     = useState('');
  const [guestPhone, setGuestPhone]     = useState('');
  const [guestAddress, setGuestAddress] = useState('');

  // Submit
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [linking, setLinking] = useState(false);
  const [createdLink, setCreatedLink] = useState('');

  // Load companies on mount — also resolves isAdmin from cookies (client-only)
  useEffect(() => {
    if (!can('invoice', 'canCreateInvoices')) { router.replace('/invoices'); return; }
    const adminFlag = getAuthType() === 'admin';
    setIsAdmin(adminFlag);
    setAuthResolved(true);
    if (!adminFlag) {
      const user = getAuthUser() as User | null;
      if (user?.company) {
        const c: ClientCompany = { id: user.company.id, name: user.company.name, currency: user.company.currency ?? 'USD' };
        setCompanies([c]);
        setCompanyId(c.id);
      }
    } else {
      adminClientService.companies().then(cs => {
        setCompanies(cs);
        if (cs.length) setCompanyId(companyIdParam && cs.some(c => c.id === companyIdParam) ? companyIdParam : cs[0].id);
      }).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load clients when company changes — sub-users see their own company's
  // basic-client list too (userClientService), not just Admins.
  useEffect(() => {
    if (!companyId) { setClients([]); return; }
    setLoadingClients(true);
    setClientId(null);
    const load = isAdmin
      ? adminClientService.list({ company_id: String(companyId) }).then(res => res.clients)
      : userClientService.list();
    load
      .then(list => setClients(list))
      .catch(() => setClients([]))
      .finally(() => setLoadingClients(false));
  }, [companyId, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill from a Lead (e.g. arriving via /invoices/new?lead_id=50 from a
  // won lead's detail page) — once, and only after the client list (if any)
  // has loaded so we can match lead.client_id against it.
  useEffect(() => {
    if (!authResolved || !leadId || leadPrefilled || loadingClients) return;
    const svc = isAdmin ? adminLeadService : userLeadService;
    svc.getOne(leadId).then(lead => {
      if (lead.client_id && clients.some(c => c.id === lead.client_id)) {
        setCustomerType('client');
        setClientId(lead.client_id);
      } else {
        setCustomerType('guest');
        setGuestName(lead.name);
        if (lead.email) setGuestEmail(lead.email);
        if (lead.phone) setGuestPhone(lead.phone);
      }
      setLeadPrefilled(true);
    }).catch(() => setLeadPrefilled(true));
  }, [authResolved, leadId, leadPrefilled, loadingClients, clients, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill from a Client (e.g. arriving via /invoices/new?client_id=12 from
  // a client's own detail page) — once, and only after that company's client
  // list has loaded so we can confirm the id actually belongs to it.
  useEffect(() => {
    if (!authResolved || !clientIdParam || leadId || clientPrefilled || loadingClients) return;
    if (clients.some(c => c.id === clientIdParam)) {
      setCustomerType('client');
      setClientId(clientIdParam);
    }
    setClientPrefilled(true);
  }, [authResolved, clientIdParam, leadId, clientPrefilled, loadingClients, clients]); // eslint-disable-line react-hooks/exhaustive-deps

  const setItem = (i: number, k: keyof LineItem, v: string | number) =>
    setItems(prev => prev.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  const addItem    = () => setItems(p => [...p, EMPTY_ITEM()]);
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));

  const subtotal = items.reduce((s, r) => s + r.quantity * r.unit_price, 0);
  const taxAmt   = (subtotal * taxRate) / 100;
  const total    = Math.max(0, subtotal + taxAmt - discount);

  const fmt = (n: number) => `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [sending, setSending] = useState(false);

  // Shared validation + payload build — reused by Save as Draft, Create &
  // Send, and Create Invoice (link-only). Returns null (having already set
  // the error state) if the form isn't ready to submit.
  const buildPayload = (): InvoicePayload | null => {
    if (!companyId) { setError('Select a company'); return null; }
    if (items.some(r => !r.description.trim())) { setError('All items need a description'); return null; }
    if (customerType === 'client' && !clientId) { setError('Select a client, or switch to Guest for an external customer'); return null; }
    if (customerType === 'guest' && !guestName.trim()) { setError('Customer name is required for guest invoices'); return null; }

    return {
      company_id:      companyId,
      lead_id:         leadId || undefined,
      currency,
      tax_rate:        taxRate,
      discount_amount: discount,
      notes:           notes || null,
      due_date:        dueDate || null,
      items: items.map(r => ({ description: r.description, quantity: r.quantity, unit_price: r.unit_price })),
      ...(customerType === 'client'
        ? { client_id: clientId }
        : {
            client_id:        null,
            customer_name:    guestName.trim()    || null,
            customer_email:   guestEmail.trim()   || null,
            customer_phone:   guestPhone.trim()   || null,
            customer_address: guestAddress.trim() || null,
          }
      ),
    };
  };

  const handleCreate = async (sendAfter: boolean) => {
    const recipientEmail = customerType === 'client'
      ? clients.find(c => c.id === clientId)?.email
      : guestEmail.trim();

    setError('');
    setCreatedLink('');
    const payload = buildPayload();
    if (!payload) return;

    if (sendAfter && !recipientEmail) {
      setError('Customer email is required to send invoice.');
      return;
    }

    sendAfter ? setSending(true) : setSaving(true);
    try {
      const inv = isAdmin
        ? await adminInvoiceService.create(payload)
        : await api.post('/user/invoices', payload).then(r => r.data.data);

      if (sendAfter && recipientEmail) {
        try {
          if (isAdmin) {
            await adminInvoiceService.sendEmail(inv.id, recipientEmail);
          } else {
            await api.post(`/user/invoices/${inv.id}/send-email`, { email: recipientEmail });
          }
          toast.success('Invoice created and sent');
        } catch (sendErr: unknown) {
          const ex = sendErr as { response?: { data?: { message?: string } } };
          toast.error(ex.response?.data?.message ?? 'Invoice created, but email could not be sent. Please try sending again.');
        }
      } else {
        toast.success('Invoice created');
      }

      router.push(`/invoices/${inv.id}`);
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msgs = ex.response?.data?.errors;
      if (msgs) setError(Object.values(msgs).flat().join(' · '));
      else setError(ex.response?.data?.message ?? 'Failed to create invoice');
    } finally { setSaving(false); setSending(false); }
  };

  // Create Invoice — creates it, then immediately generates its shareable
  // public payment link. Deliberately does NOT send an email (no recipient
  // email required, unlike Create & Send) — generateLink already marks the
  // invoice as sent on its own, matching existing invoice-module behavior.
  const handleCreateAndLink = async () => {
    setError('');
    setCreatedLink('');
    const payload = buildPayload();
    if (!payload) return;

    setLinking(true);
    try {
      const inv = isAdmin
        ? await adminInvoiceService.create(payload)
        : await api.post('/user/invoices', payload).then(r => r.data.data);

      const linkRes = isAdmin
        ? await adminInvoiceService.generatePaymentLink(inv.id)
        : await api.post(`/user/invoices/${inv.id}/generate-link`, {}).then(r => r.data.data);

      try {
        await navigator.clipboard.writeText(linkRes.payment_url);
        toast.success('Invoice created — payment link copied to clipboard');
      } catch {
        setCreatedLink(linkRes.payment_url);
        toast.success('Invoice created');
      }

      router.push(`/invoices/${inv.id}`);
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msgs = ex.response?.data?.errors;
      if (msgs) setError(Object.values(msgs).flat().join(' · '));
      else setError(ex.response?.data?.message ?? 'Failed to create invoice or generate its payment link');
    } finally { setLinking(false); }
  };

  const typeBtn = (type: CustomerType, icon: React.ReactNode, label: string, sub: string): React.ReactNode => {
    const active = customerType === type;
    return (
      <button
        type="button"
        onClick={() => setCustomerType(type)}
        style={{
          flex: 1, padding: '12px 16px', borderRadius: 9, cursor: 'pointer', textAlign: 'left',
          border: `2px solid ${active ? '#2563eb' : '#e2e8f0'}`,
          background: active ? '#eff6ff' : '#fafafa',
          transition: 'border-color .15s, background .15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 3 }}>
          <span style={{ color: active ? '#2563eb' : '#94a3b8' }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: active ? '#1d4ed8' : '#374151' }}>{label}</span>
          {active && <span style={{ marginLeft: 'auto', width: 16, height: 16, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 900, flexShrink: 0 }}>✓</span>}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', paddingLeft: 25 }}>{sub}</div>
      </button>
    );
  };

  return (
    <DashboardLayout title="New Invoice">
      <div style={{ maxWidth: 900 }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 14 }}>
          <HiArrowLeft size={16} /> Back
        </button>

        <form onSubmit={e => { e.preventDefault(); handleCreate(false); }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, alignItems: 'start' }}>
            {/* Left column */}
            <div>
              {/* Invoice Details card */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Invoice Details</h3>
                </div>
                <div style={{ padding: 22 }}>
                  {error && (
                    <div style={{ marginBottom: 14, padding: '9px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, color: '#dc2626', fontSize: 13 }}>
                      {error}
                    </div>
                  )}

                  {/* Company */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={lbl}>Company *</label>
                    <select style={inp} value={companyId} onChange={e => setCompanyId(Number(e.target.value))}>
                      <option value={0}>Select company…</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* Currency / Due Date / Notes */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 0 }}>
                    <div>
                      <label style={lbl}>Currency</label>
                      <select style={inp} value={currency} onChange={e => setCurrency(e.target.value)}>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="AED">AED</option>
                        <option value="SAR">SAR</option>
                        <option value="PKR">PKR</option>
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Due Date</label>
                      <input type="date" style={inp} value={dueDate} onChange={e => setDueDate(e.target.value)} />
                    </div>
                    <div>
                      <label style={lbl}>Notes</label>
                      <input style={inp} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note…" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer card */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Customer</h3>
                </div>
                <div style={{ padding: 22 }}>

                  {/* Type toggle — shown whenever a client list is available (Admin's
                      full Client list, or a sub-user's Basic Clients access) */}
                  <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                    {typeBtn('client', <HiUsers size={15} />, 'Existing Client', 'Select from your client list')}
                    {typeBtn('guest',  <HiUserCircle size={15} />, 'Guest / External', 'Enter customer details manually')}
                  </div>

                  {/* Existing Client dropdown */}
                  {customerType === 'client' && (
                    <div>
                      <label style={lbl}>Select Client *</label>
                      {loadingClients ? (
                        <div style={{ padding: '10px 0', fontSize: 13, color: '#94a3b8' }}>Loading clients…</div>
                      ) : clients.length === 0 ? (
                        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, fontSize: 13, color: '#dc2626' }}>
                          No clients found for this company. <button type="button" onClick={() => setCustomerType('guest')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontWeight: 600, fontSize: 13, padding: 0 }}>Switch to Guest</button>
                        </div>
                      ) : (
                        <select
                          style={inp}
                          value={clientId ?? ''}
                          onChange={e => setClientId(Number(e.target.value) || null)}
                        >
                          <option value="">Select a client…</option>
                          {clients.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name}{c.company_name ? ` (${c.company_name})` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                      {clientId && (() => {
                        const sel = clients.find(c => c.id === clientId);
                        if (!sel) return null;
                        return (
                          <div style={{ marginTop: 10, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12, color: '#166534' }}>
                            <div style={{ fontWeight: 700 }}>{sel.name}</div>
                            {sel.email && <div style={{ marginTop: 2, color: '#16a34a' }}>{sel.email}</div>}
                            {sel.company_name && <div style={{ marginTop: 2 }}>{sel.company_name}</div>}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Guest / External Customer fields */}
                  {customerType === 'guest' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div>
                          <label style={lbl}>Customer Name *</label>
                          <input style={inp} value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="John Smith" />
                        </div>
                        <div>
                          <label style={lbl}>Email</label>
                          <input type="email" style={inp} value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="john@example.com" />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div>
                          <label style={lbl}>Phone <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                          <input style={inp} value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="+1 234 567 8900" />
                        </div>
                        <div>
                          <label style={lbl}>Billing Address <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                          <input style={inp} value={guestAddress} onChange={e => setGuestAddress(e.target.value)} placeholder="123 Main St, City" />
                        </div>
                      </div>
                      {guestEmail && (
                        <div style={{ fontSize: 12, color: '#64748b', background: '#f8fafc', borderRadius: 7, padding: '8px 12px' }}>
                          💡 The public payment link will be pre-filled with these details
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Line items card */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Line Items</h3>
                  <button type="button" onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <HiPlusCircle size={14} /> Add Item
                  </button>
                </div>
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 120px 110px 40px', gap: 8, padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    {['Description', 'Qty', 'Unit Price', 'Total', ''].map(h => (
                      <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
                    ))}
                  </div>
                  {items.map((row, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 120px 110px 40px', gap: 8, padding: '10px 16px', borderBottom: i < items.length - 1 ? '1px solid #f8fafc' : 'none', alignItems: 'center' }}>
                      <input style={inp} value={row.description} onChange={e => setItem(i, 'description', e.target.value)} placeholder="Item description" required />
                      <input style={{ ...inp, textAlign: 'right' }} type="number" min={1} step="0.01" value={row.quantity} onChange={e => setItem(i, 'quantity', parseFloat(e.target.value) || 1)} />
                      <input style={{ ...inp, textAlign: 'right' }} type="number" min={0} step="0.01" value={row.unit_price} onChange={e => setItem(i, 'unit_price', parseFloat(e.target.value) || 0)} placeholder="0.00" />
                      <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#0f172a', paddingRight: 4 }}>{fmt(row.quantity * row.unit_price)}</div>
                      <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1} style={{ background: 'none', border: 'none', cursor: items.length === 1 ? 'not-allowed' : 'pointer', color: '#f87171', padding: 4, opacity: items.length === 1 ? 0.3 : 1 }}>
                        <HiTrash size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column – totals + submit */}
            <div style={{ position: 'sticky', top: 20 }}>
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Summary</h3>
                </div>
                <div style={{ padding: 20 }}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={lbl}>Tax Rate (%)</label>
                    <input type="number" min={0} max={100} step="0.01" style={inp} value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <label style={lbl}>Discount ({currency})</label>
                    <input type="number" min={0} step="0.01" style={inp} value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                    {[
                      { label: 'Subtotal',       value: fmt(subtotal) },
                      { label: `Tax (${taxRate}%)`, value: fmt(taxAmt) },
                      { label: 'Discount',        value: `– ${fmt(discount)}` },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#64748b' }}>
                        <span>{row.label}</span><span style={{ fontWeight: 500 }}>{row.value}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '2px solid #e2e8f0', fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                      <span>Total</span><span style={{ color: '#2563eb' }}>{fmt(total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {createdLink && (
                <div style={{ marginBottom: 10, padding: '10px 12px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Payment Link</div>
                  <div style={{ fontSize: 12, color: '#0c4a6e', wordBreak: 'break-all' }}>{createdLink}</div>
                </div>
              )}

              <button
                type="submit"
                disabled={saving || sending || linking}
                style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', background: saving ? '#93c5fd' : 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: (saving || sending || linking) ? 'not-allowed' : 'pointer', marginBottom: 10 }}
              >
                {saving ? 'Creating…' : 'Save as Draft'}
              </button>
              <button
                type="button"
                onClick={handleCreateAndLink}
                disabled={saving || sending || linking}
                style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: '1.5px solid #0284c7', background: linking ? '#f0f9ff' : '#fff', color: '#0284c7', fontSize: 15, fontWeight: 700, cursor: (saving || sending || linking) ? 'not-allowed' : 'pointer', marginBottom: 10 }}
              >
                {linking ? 'Creating…' : 'Create Invoice'}
              </button>
              <button
                type="button"
                onClick={() => handleCreate(true)}
                disabled={saving || sending || linking}
                style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: '1.5px solid #2563eb', background: sending ? '#eff6ff' : '#fff', color: '#2563eb', fontSize: 15, fontWeight: 700, cursor: (saving || sending || linking) ? 'not-allowed' : 'pointer' }}
              >
                {sending ? 'Creating & Sending…' : 'Create & Send Invoice'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={
      <DashboardLayout title="New Invoice">
        <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
      </DashboardLayout>
    }>
      <NewInvoiceForm />
    </Suspense>
  );
}
