'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { adminClientService } from '@/lib/services/adminClientService';
import { adminInvoiceService, ClientInvoiceStats } from '@/lib/services/adminInvoiceService';
import { userClientService } from '@/lib/services/userClientService';
import { adminSalesChatService, userSalesChatService } from '@/lib/services/salesChatService';
import { ChatMessage } from '@/lib/services/adminProjectService';
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_MB, fmtFileSize, inp } from '@/components/admin/projects/shared';
import api from '@/lib/axios';
import { getAuthType, can } from '@/lib/auth';
import { Client, Invoice } from '@/types';
import toast from 'react-hot-toast';
import {
  HiArrowLeft, HiPencilSquare, HiCheckCircle, HiXCircle,
  HiDocumentText, HiPlusCircle, HiTrash
} from 'react-icons/hi2';

const INVOICE_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  draft:          { bg: '#f8fafc', color: '#64748b', label: 'Draft' },
  sent:           { bg: '#eff6ff', color: '#2563eb', label: 'Sent' },
  partially_paid: { bg: '#fff7ed', color: '#ea580c', label: 'Partial' },
  paid:           { bg: '#ecfdf5', color: '#059669', label: 'Paid' },
  overdue:        { bg: '#fef2f2', color: '#dc2626', label: 'Overdue' },
  cancelled:      { bg: '#f8fafc', color: '#94a3b8', label: 'Cancelled' },
};

const CLIENT_STATUS: Record<string, { bg: string; color: string }> = {
  active:   { bg: '#ecfdf5', color: '#059669' },
  inactive: { bg: '#f8fafc', color: '#64748b' },
  blocked:  { bg: '#fef2f2', color: '#dc2626' },
};

type Tab = 'details' | 'invoices' | 'portal' | 'chat' | 'messages';

export default function ClientProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const clientId = Number(params.id);
  const isSubUser = getAuthType() === 'user';
  const canEditClient = !isSubUser || can('client', 'canEditClients');
  // Company Admin always sees Sales Chat, same as every other chat surface.
  const canUseSalesChat = !isSubUser || can('sales', 'canUseSalesChat');
  const chatSvc = isSubUser ? userSalesChatService : adminSalesChatService;

  const [tab, setTab] = useState<Tab>('details');
  const [client, setClient]   = useState<Client | null>(null);
  const [perms, setPerms]     = useState<Record<string, { label: string; is_enabled: boolean }>>({});
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats]     = useState<ClientInvoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [invLoading, setInvLoading] = useState(false);

  // Sales Chat
  const [chat, setChat]         = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [sendingChat, setSendingChat] = useState(false);

  // Client Messages (restricted Direct Chat — see Client Communication Rules)
  const dmBase = isSubUser ? '/user' : '/admin';
  const [dmThreads, setDmThreads]         = useState<any[]>([]);
  const [dmActiveThread, setDmActiveThread] = useState<any>(null);
  const [dmMessages, setDmMessages]       = useState<any[]>([]);
  const [dmText, setDmText]               = useState('');
  const [sendingDm, setSendingDm]         = useState(false);

  // portal form state
  const [portalEmail, setPortalEmail]     = useState('');
  const [portalPass, setPortalPass]       = useState('');
  const [portalSaving, setPortalSaving]   = useState(false);
  const [portalError, setPortalError]     = useState('');
  const [portalSuccess, setPortalSuccess] = useState('');

  useEffect(() => {
    if (isSubUser) {
      userClientService.getOne(clientId).then(c => setClient(c))
        .catch(() => {}).finally(() => setLoading(false));
      return;
    }
    adminClientService.getOne(clientId).then(({ client: c, permissions: p }) => {
      setClient(c);
      setPerms(p);
      if (c.user?.email) setPortalEmail(c.user.email);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab !== 'invoices' || isSubUser) return;
    setInvLoading(true);
    adminInvoiceService.forClient(clientId).then(({ invoices: inv, stats: s }) => {
      setInvoices(inv);
      setStats(s);
    }).catch(() => {}).finally(() => setInvLoading(false));
  }, [tab, clientId]);

  const loadChat = () => {
    if (!canUseSalesChat) return;
    chatSvc.clientMessages(clientId).then(setChat).catch(() => {});
  };

  useEffect(() => {
    loadChat();
    if (!canUseSalesChat) return;
    const interval = setInterval(loadChat, 8000);
    return () => clearInterval(interval);
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim() && !chatFile) return;
    if (chatFile) {
      const ext = chatFile.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ALLOWED_ATTACHMENT_TYPES.includes(ext)) { toast.error(`${chatFile.name}: file type not allowed`); return; }
      if (chatFile.size > MAX_ATTACHMENT_MB * 1024 * 1024) { toast.error(`${chatFile.name}: exceeds ${MAX_ATTACHMENT_MB}MB limit`); return; }
    }
    setSendingChat(true);
    try {
      await chatSvc.sendClientMessage(clientId, chatText.trim(), chatFile);
      setChatText('');
      setChatFile(null);
      loadChat();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send message');
    } finally { setSendingChat(false); }
  };

  const downloadChatAttachment = async (m: ChatMessage) => {
    if (!m.attachment_name) return;
    try { await chatSvc.downloadClientAttachment(clientId, m.id, m.attachment_name); }
    catch { toast.error('Download failed'); }
  };

  // Client Messages — the client's own restricted Direct Chat.
  const loadDmThreads = () => {
    api.get(`${dmBase}/clients/${clientId}/direct-chat`).then(res => {
      const data = res.data.data;
      setDmThreads(data);
      if (data.length > 0 && !dmActiveThread) selectDmThread(data[0]);
    }).catch(() => {});
  };

  const selectDmThread = (thread: any) => {
    setDmActiveThread(thread);
    api.get(`${dmBase}/clients/${clientId}/direct-chat/${thread.id}/messages`).then(res => setDmMessages(res.data.data)).catch(() => {});
  };

  useEffect(() => {
    if (tab !== 'messages') return;
    loadDmThreads();
    const interval = setInterval(loadDmThreads, 8000);
    return () => clearInterval(interval);
  }, [clientId, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmText.trim() || !dmActiveThread) return;
    setSendingDm(true);
    try {
      await api.post(`${dmBase}/clients/${clientId}/direct-chat/${dmActiveThread.id}/reply`, { content: dmText.trim() });
      setDmText('');
      const res = await api.get(`${dmBase}/clients/${clientId}/direct-chat/${dmActiveThread.id}/messages`);
      setDmMessages(res.data.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send message');
    } finally { setSendingDm(false); }
  };

  const handleEnablePortal = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPortalSaving(true); setPortalError(''); setPortalSuccess('');
    try {
      await adminClientService.enablePortal(clientId, portalEmail, portalPass);
      setPortalSuccess('Portal access enabled.');
      const { client: c } = await adminClientService.getOne(clientId);
      setClient(c);
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      setPortalError(ex.response?.data?.message ?? 'Failed to enable portal');
    } finally { setPortalSaving(false); }
  };

  const handleDisablePortal = async () => {
    if (!confirm('Disable portal access for this client?')) return;
    setPortalSaving(true); setPortalError(''); setPortalSuccess('');
    try {
      await adminClientService.disablePortal(clientId);
      setPortalSuccess('Portal access disabled.');
      const { client: c } = await adminClientService.getOne(clientId);
      setClient(c);
    } catch { setPortalError('Failed to disable portal'); }
    finally { setPortalSaving(false); }
  };

  const togglePermission = async (key: string, enabled: boolean) => {
    const updated = { ...perms, [key]: { ...perms[key], is_enabled: enabled } };
    setPerms(updated);
    const mapped: Record<string, boolean> = {};
    Object.entries(updated).forEach(([k, v]) => { mapped[k] = v.is_enabled; });
    await adminClientService.updatePermissions(clientId, mapped).catch(() => {});
  };

  const fmt = (n: number, cur = 'USD') => `${cur} ${n.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

  if (loading) return <DashboardLayout title="Client"><div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div></DashboardLayout>;
  if (!client) return <DashboardLayout title="Client"><div style={{ padding: 48, textAlign: 'center', color: '#dc2626' }}>Client not found.</div></DashboardLayout>;

  const tabs: { key: Tab; label: string }[] = isSubUser
    ? [
        { key: 'details', label: 'Details' },
        ...(canUseSalesChat ? [{ key: 'chat' as const, label: 'Sales Chat' }] : []),
        { key: 'messages', label: 'Client Messages' },
      ]
    : [
        { key: 'details', label: 'Details' },
        { key: 'invoices', label: 'Invoices' },
        { key: 'portal', label: 'Portal' },
        ...(canUseSalesChat ? [{ key: 'chat' as const, label: 'Sales Chat' }] : []),
        { key: 'messages', label: 'Client Messages' },
      ];

  return (
    <DashboardLayout title={client.name}>
      <div style={{ maxWidth: 900 }}>
        {/* Back + Header */}
        <button onClick={() => router.push('/clients')} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 14 }}>
          <HiArrowLeft size={16} /> Back to Clients
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{client.name}</h1>
              <span style={{ padding: '3px 10px', borderRadius: 50, fontSize: 11, fontWeight: 600, textTransform: 'capitalize', ...CLIENT_STATUS[client.status] }}>{client.status}</span>
            </div>
            {client.company_name && <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{client.company_name}</p>}
          </div>
          {canEditClient && (
            <button onClick={() => router.push(`/clients/${clientId}/edit`)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <HiPencilSquare size={14} /> Edit Client
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #f1f5f9', marginBottom: 24 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '10px 22px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? '#2563eb' : '#64748b', borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent', marginBottom: -2 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Details Tab ── */}
        {tab === 'details' && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', padding: 28 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 40px' }}>
              {[
                ['Full Name', client.name],
                ['Company', client.company_name ?? '—'],
                ['Email', client.email ?? '—'],
                ['Phone', client.phone ?? '—'],
                ['Status', client.status],
                ['Portal Access', client.portal_access ? 'Enabled' : 'Disabled'],
                ['Address', client.address ?? '—'],
                ['Notes', client.notes ?? '—'],
                ['Created', new Date(client.created_at).toLocaleDateString('en-GB')],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Invoices Tab ── */}
        {tab === 'invoices' && (
          <div>
            {/* Stats row */}
            {stats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
                {[
                  { label: 'Total Invoiced', value: fmt(stats.total_invoiced), color: '#2563eb' },
                  { label: 'Total Paid', value: fmt(stats.total_paid), color: '#059669' },
                  { label: 'Outstanding', value: fmt(stats.total_outstanding), color: '#ea580c' },
                  { label: 'Overdue', value: String(stats.overdue_count), color: '#dc2626' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #f1f5f9', padding: '14px 18px' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <button onClick={() => router.push(`/invoices/new?client_id=${clientId}&company_id=${client?.company_id ?? ''}`)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <HiPlusCircle size={15} /> New Invoice
              </button>
            </div>

            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
              {invLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading invoices…</div>
              ) : invoices.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                  <HiDocumentText size={36} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.4 }} />
                  No invoices yet
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                      {['Invoice #', 'Date', 'Due', 'Amount', 'Paid', 'Status', ''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv, i) => {
                      const st = INVOICE_STATUS[inv.status] ?? INVOICE_STATUS.draft;
                      return (
                        <tr key={inv.id} style={{ borderBottom: i < invoices.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{inv.invoice_number}</td>
                          <td style={{ padding: '12px 14px', color: '#475569', fontSize: 13 }}>{new Date(inv.created_at).toLocaleDateString('en-GB')}</td>
                          <td style={{ padding: '12px 14px', color: '#475569', fontSize: 13 }}>{inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB') : '—'}</td>
                          <td style={{ padding: '12px 14px', color: '#0f172a', fontSize: 13, fontWeight: 600 }}>{fmt(inv.total_amount, inv.currency)}</td>
                          <td style={{ padding: '12px 14px', color: '#059669', fontSize: 13 }}>{fmt(inv.paid_amount, inv.currency)}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: 50, fontSize: 11, fontWeight: 600, ...st }}>{st.label}</span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <button onClick={() => router.push(`/invoices/${inv.id}`)} style={{ padding: '5px 12px', borderRadius: 7, border: '1.5px solid #e0e7ff', background: '#eef2ff', color: '#4f46e5', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>View</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Portal Tab ── */}
        {tab === 'portal' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Enable/disable card */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Portal Access</h3>
              </div>
              <div style={{ padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                  {client.portal_access
                    ? <><HiCheckCircle size={18} color="#059669" /><span style={{ color: '#059669', fontWeight: 600, fontSize: 14 }}>Currently Enabled</span></>
                    : <><HiXCircle size={18} color="#94a3b8" /><span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 14 }}>Not Enabled</span></>
                  }
                </div>

                {portalError && <div style={{ marginBottom: 14, padding: '8px 12px', background: '#fef2f2', borderRadius: 7, color: '#dc2626', fontSize: 13 }}>{portalError}</div>}
                {portalSuccess && <div style={{ marginBottom: 14, padding: '8px 12px', background: '#f0fdf4', borderRadius: 7, color: '#16a34a', fontSize: 13 }}>{portalSuccess}</div>}

                {!client.portal_access ? (
                  <form onSubmit={handleEnablePortal}>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Portal Email *</label>
                      <input type="email" value={portalEmail} onChange={e => setPortalEmail(e.target.value)} required style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fafafa', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Password *</label>
                      <input type="password" value={portalPass} onChange={e => setPortalPass(e.target.value)} required minLength={6} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fafafa', boxSizing: 'border-box' }} />
                    </div>
                    <button type="submit" disabled={portalSaving} style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: portalSaving ? 'not-allowed' : 'pointer' }}>
                      {portalSaving ? 'Enabling…' : 'Enable Portal'}
                    </button>
                  </form>
                ) : (
                  <div>
                    {client.user?.email && <p style={{ margin: '0 0 14px', fontSize: 13, color: '#475569' }}>Login: <strong>{client.user.email}</strong></p>}
                    <button onClick={handleDisablePortal} disabled={portalSaving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: '1.5px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: portalSaving ? 'not-allowed' : 'pointer' }}>
                      <HiTrash size={14} /> {portalSaving ? 'Disabling…' : 'Disable Portal'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Permissions card */}
            {client.portal_access && Object.keys(perms).length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Module Permissions</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>Controls what the client can see in the portal</p>
                </div>
                <div style={{ padding: 22 }}>
                  {Object.entries(perms).map(([key, p]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}>
                      <input type="checkbox" checked={p.is_enabled} onChange={e => togglePermission(key, e.target.checked)} style={{ width: 15, height: 15, accentColor: '#2563eb' }} />
                      <span style={{ fontSize: 14, color: '#0f172a', fontWeight: 500 }}>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Sales Chat Tab ── */}
        {tab === 'chat' && canUseSalesChat && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', padding: 28 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Sales Chat</h3>
            {chat.length === 0 ? (
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>No messages yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto', marginBottom: 14 }}>
                {chat.map(m => (
                  <div key={m.id}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                      {m.sender_admin ? `${m.sender_admin.name} (Admin)` : m.sender?.name ?? 'Unknown'}
                    </div>
                    {m.content && <div style={{ fontSize: 13, color: '#475569' }}>{m.content}</div>}
                    {m.attachment_name && (
                      <button onClick={() => downloadChatAttachment(m)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4, padding: '4px 10px',
                        borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#2563eb',
                        fontSize: 12, cursor: 'pointer',
                      }}>📎 {m.attachment_name}</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {chatFile && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', marginBottom: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: '#334155' }}>📎 {chatFile.name} <span style={{ color: '#94a3b8' }}>({fmtFileSize(chatFile.size)})</span></span>
                <button type="button" onClick={() => setChatFile(null)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Remove</button>
              </div>
            )}
            <form onSubmit={sendChat} style={{ display: 'flex', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, borderRadius: 8, border: '1.5px dashed #cbd5e1', background: '#fff', color: '#64748b', cursor: 'pointer', flexShrink: 0 }}>
                📎
                <input
                  type="file" style={{ display: 'none' }}
                  accept={ALLOWED_ATTACHMENT_TYPES.map(t => `.${t}`).join(',')}
                  onChange={e => { setChatFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
                />
              </label>
              <input
                value={chatText} onChange={e => setChatText(e.target.value)}
                placeholder="Message about this client…" style={{ ...inp, flex: 1 }}
              />
              <button type="submit" disabled={sendingChat} style={{
                padding: '9px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: sendingChat ? 'wait' : 'pointer', opacity: sendingChat ? 0.7 : 1,
              }}>Send</button>
            </form>
          </div>
        )}

        {/* ── Client Messages Tab ── */}
        {tab === 'messages' && (
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ width: 200, background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 12, fontWeight: 600, color: '#64748b' }}>Conversations</div>
              {dmThreads.length === 0 ? (
                <div style={{ padding: 16, fontSize: 12, color: '#94a3b8' }}>No messages yet.</div>
              ) : dmThreads.map((t: any) => (
                <div key={t.id} onClick={() => selectDmThread(t)} style={{
                  padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f8fafc',
                  background: dmActiveThread?.id === t.id ? '#eff6ff' : '#fff', fontSize: 12, fontWeight: 600,
                  color: dmActiveThread?.id === t.id ? '#2563eb' : '#1e293b',
                }}>
                  {t.title || `Thread #${t.id}`}
                </div>
              ))}
            </div>
            <div style={{ flex: 1, background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', padding: 28 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Client Messages</h3>
              {!dmActiveThread ? (
                <div style={{ fontSize: 13, color: '#94a3b8' }}>No conversation selected.</div>
              ) : (
                <>
                  {dmMessages.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>No messages yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto', marginBottom: 14 }}>
                      {dmMessages.map((m: any) => (
                        <div key={m.id}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                            {m.sender_admin ? `${m.sender_admin.name} (Admin)` : m.sender?.name ?? 'Client'}
                          </div>
                          {m.content && <div style={{ fontSize: 13, color: '#475569' }}>{m.content}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  <form onSubmit={sendDm} style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={dmText} onChange={e => setDmText(e.target.value)}
                      placeholder="Reply to client…" style={{ ...inp, flex: 1 }}
                    />
                    <button type="submit" disabled={sendingDm} style={{
                      padding: '9px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff',
                      fontSize: 13, fontWeight: 600, cursor: sendingDm ? 'wait' : 'pointer', opacity: sendingDm ? 0.7 : 1,
                    }}>Send</button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
