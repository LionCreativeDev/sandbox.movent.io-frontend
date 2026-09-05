'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { adminInvoiceService } from '@/lib/services/adminInvoiceService';
import api from '@/lib/axios';
import { getAuthType, getAuthUser, can } from '@/lib/auth';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { Invoice, InvoicePayment } from '@/types';
import { handleNotFound } from '@/lib/notFound';
import {
  HiArrowLeft, HiPencilSquare, HiPaperAirplane, HiXCircle,
  HiPlusCircle, HiTrash, HiLink, HiClipboard, HiClipboardDocumentCheck, HiChatBubbleLeftRight
} from 'react-icons/hi2';
import SubmitButton from '@/components/ui/SubmitButton';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_MB, fmtFileSize } from '@/components/admin/projects/shared';
import { adminSalesChatService, userSalesChatService } from '@/lib/services/salesChatService';
import { ChatMessage } from '@/lib/services/adminProjectService';
import toast from 'react-hot-toast';
import { chatSenderName } from '@/lib/chatSender';

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  draft:          { bg: '#f1f5f9', color: '#64748b', label: 'Draft' },
  sent:           { bg: '#eff6ff', color: '#2563eb', label: 'Sent' },
  partially_paid: { bg: '#fff7ed', color: '#ea580c', label: 'Partially Paid' },
  paid:           { bg: '#ecfdf5', color: '#059669', label: 'Paid' },
  overdue:        { bg: '#fef2f2', color: '#dc2626', label: 'Overdue' },
  cancelled:      { bg: '#f8fafc', color: '#94a3b8', label: 'Cancelled' },
};

const METHODS = ['bank_transfer', 'cash', 'card', 'cheque'];

const GATEWAY_LABEL: Record<string, string> = {
  stripe: 'Stripe',
  paypal: 'PayPal',
  authorize_net: 'Authorize.Net',
};

// A gateway-processed payment stores the generic 'gateway' in `method` and
// the actual processor in `gateway` (see InvoiceGatewayChargeService /
// PublicInvoiceController) — without this, the Payments list just printed
// the literal word "gateway" instead of e.g. "Stripe".
function paymentMethodLabel(p: InvoicePayment): string {
  if (p.method === 'gateway') {
    return p.gateway ? (GATEWAY_LABEL[p.gateway] ?? p.gateway.replace('_', ' ')) : 'Gateway';
  }
  return p.method?.replace('_', ' ') ?? '';
}

const PROJECT_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  planning:  { bg: '#eff6ff', color: '#2563eb' },
  active:    { bg: '#ecfdf5', color: '#059669' },
  on_hold:   { bg: '#fffbeb', color: '#d97706' },
  completed: { bg: '#f0fdf4', color: '#16a34a' },
  cancelled: { bg: '#fef2f2', color: '#dc2626' },
};

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 };

export default function InvoiceDetailPage() {
  useAdminGuard();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const invoiceId = Number(params.id);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [actionErr, setActionErr] = useState('');

  // Payment form state
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount]     = useState('');
  const [payMethod, setPayMethod]     = useState('bank_transfer');
  const [payDate, setPayDate]         = useState('');
  const [payNotes, setPayNotes]       = useState('');
  const [payLoading, setPayLoading]   = useState(false);
  const [payError, setPayError]       = useState('');

  // Payment link state
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [linkLoading, setLinkLoading]     = useState(false);
  const [linkErr, setLinkErr]             = useState('');
  const [linkMsg, setLinkMsg]             = useState('');
  const [expiryDays, setExpiryDays]       = useState('');
  const [copied, setCopied]               = useState(false);
  const [paymentUrl, setPaymentUrl]       = useState<string | null>(null);

  const isSubUser = getAuthType() === 'user';
  const isAdmin   = getAuthType() === 'admin';

  // Sales Chat — only reachable when this invoice has no Lead/Client at all
  // (a fully guest invoice); otherwise the conversation lives on that Lead's
  // or Client's own Sales Chat tab instead (see App\Services\
  // InvoiceChatContext). Same canUseSalesChat gate as the Lead/Client detail
  // pages.
  const authUser = getAuthUser() as { role_type?: string } | null;
  // A Lead Manager may also reach this now, but only for an invoice they
  // themselves actually created — enforced server-side in Api\User\
  // SalesChatController::invoice() (never their canViewAllCompanyLeads
  // company-wide bypass).
  const canUseSalesChat = isAdmin || ((authUser?.role_type === 'seller' || authUser?.role_type === 'lead_manager') && can('sales', 'canUseSalesChat'));
  const chatSvc = isAdmin ? adminSalesChatService : userSalesChatService;
  const [chat, setChat]               = useState<ChatMessage[]>([]);
  const [chatText, setChatText]       = useState('');
  const [chatFile, setChatFile]       = useState<File | null>(null);
  const [sendingChat, setSendingChat] = useState(false);

  const load = () => {
    const fetch = isSubUser
      ? api.get(`/user/invoices/${invoiceId}`).then(r => r.data.data)
      : adminInvoiceService.getOne(invoiceId);
    fetch.then(setInvoice).catch((err) => { handleNotFound(err, router); }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [invoiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // A Project takes over the conversation entirely once one exists — see
  // App\Services\InvoiceChatContext::resolve()'s own Project-first priority
  // and App\Services\PaymentProjectStartService::migrateChatHistory(),
  // which moves this exact thread's messages into the Project's chat the
  // moment payment creates it. Without the !invoice.project_id check here,
  // this panel kept showing (and writing into) the now-abandoned,
  // invoice-anchored thread even after payment — split from what the
  // client's public page and the "Chat" button above both already moved on
  // to, instead of this page correctly pointing at Project Chat too.
  const showSalesChat = canUseSalesChat && !!invoice && !invoice.project_id && !invoice.client_id && !invoice.lead_id;

  // A "Chat" quick-link always visible in the header, for every invoice —
  // not just the fully-guest ones with an embedded panel further down this
  // page. Before this, a Seller/Lead Manager whose invoice had a Lead or
  // Client attached had no obvious way to reach the conversation their
  // client started via "Chat with Seller" on the public payment page — they
  // had to already know to go open that Lead/Client's own page and find its
  // Sales Chat tab. Priority mirrors App\Services\InvoiceChatContext::
  // resolve() exactly: Project first, then Client, then Lead, then this
  // page's own embedded panel.
  const adminPrefix = isAdmin ? '/admin' : '';
  const chatLink = !invoice ? null
    : invoice.project_id ? `${adminPrefix}/projects/${invoice.project_id}/chat`
    : invoice.client_id  ? `${adminPrefix}/clients/${invoice.client_id}?tab=chat`
    : invoice.lead_id    ? `${adminPrefix}/leads/${invoice.lead_id}?tab=chat`
    : null; // null means "scroll to the embedded panel on this page instead"

  const loadChat = () => {
    if (!showSalesChat) return;
    chatSvc.invoiceMessages(invoiceId).then(setChat).catch(() => {});
  };

  useEffect(() => {
    if (!showSalesChat) return;
    loadChat();
    const interval = setInterval(loadChat, 8000);
    return () => clearInterval(interval);
  }, [showSalesChat]); // eslint-disable-line react-hooks/exhaustive-deps

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
      await chatSvc.sendInvoiceMessage(invoiceId, chatText.trim(), chatFile);
      setChatText('');
      setChatFile(null);
      loadChat();
    } catch { toast.error('Failed to send message'); }
    finally { setSendingChat(false); }
  };

  const downloadChatAttachment = async (m: ChatMessage) => {
    if (!m.attachment_name) return;
    try { await chatSvc.downloadInvoiceAttachment(invoiceId, m.id, m.attachment_name); }
    catch { toast.error('Failed to download attachment'); }
  };

  useEffect(() => {
    if (invoice?.payment_token) {
      setPaymentUrl(`${window.location.origin}/pay/invoice/${invoice.payment_token}`);
    } else {
      setPaymentUrl(null);
    }
  }, [invoice?.payment_token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = async (action: 'send' | 'cancel') => {
    const confirm_msg = action === 'cancel' ? 'Cancel this invoice?' : 'Mark invoice as Sent?';
    if (!confirm(confirm_msg)) return;
    setActionErr(''); setActionMsg('');
    try {
      if (action === 'send')   await adminInvoiceService.send(invoiceId);
      if (action === 'cancel') await adminInvoiceService.cancel(invoiceId);
      setActionMsg(action === 'send' ? 'Invoice marked as sent.' : 'Invoice cancelled.');
      load();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      setActionErr(ex.response?.data?.message ?? 'Action failed');
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;
    if (!confirm(`Delete draft invoice ${invoice.invoice_number}? This cannot be undone.`)) return;
    setActionErr(''); setActionMsg('');
    try {
      await adminInvoiceService.remove(invoiceId);
      router.push(isAdmin ? '/admin/invoices' : '/invoices');
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      setActionErr(ex.response?.data?.message ?? 'Failed to delete invoice');
    }
  };

  const handleRecordPayment = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (payLoading) return; // Guards a double-click/Enter re-submit before the disabled prop re-renders.
    setPayLoading(true); setPayError('');
    try {
      await adminInvoiceService.recordPayment(invoiceId, {
        amount:       parseFloat(payAmount),
        method:       payMethod,
        payment_date: payDate || undefined,
        notes:        payNotes || undefined,
      });
      setShowPayForm(false);
      setPayAmount(''); setPayMethod('bank_transfer'); setPayDate(''); setPayNotes('');
      load();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      setPayError(ex.response?.data?.message ?? 'Failed to record payment');
    } finally { setPayLoading(false); }
  };

  const goToChat = () => {
    if (chatLink) { router.push(chatLink); return; }
    document.getElementById('invoice-sales-chat')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRemovePayment = async (p: InvoicePayment) => {
    if (!confirm(`Remove this ${invoice?.currency ?? ''} ${p.amount} payment?`)) return;
    await adminInvoiceService.removePayment(p.id).catch(() => {});
    load();
  };

  const handleGenerateLink = async () => {
    setLinkLoading(true); setLinkErr(''); setLinkMsg('');
    try {
      await adminInvoiceService.generatePaymentLink(invoiceId, {
        expiry_days: expiryDays ? Number(expiryDays) : undefined,
      });
      setLinkMsg('Payment link generated.');
      load();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      setLinkErr(ex.response?.data?.message ?? 'Failed to generate link');
    } finally { setLinkLoading(false); }
  };

  const handleRevokeLink = async () => {
    if (!confirm('Revoke this payment link? The existing URL will stop working.')) return;
    setLinkLoading(true); setLinkErr('');
    try {
      await adminInvoiceService.revokePaymentLink(invoiceId);
      setLinkMsg('Payment link revoked.');
      load();
    } catch { setLinkErr('Failed to revoke link'); }
    finally { setLinkLoading(false); }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const fmt = (n: number, cur?: string) => `${cur ?? invoice?.currency ?? 'USD'} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) return <DashboardLayout title="Invoice"><div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div></DashboardLayout>;
  if (!invoice) return <DashboardLayout title="Invoice"><div style={{ padding: 48, textAlign: 'center', color: '#dc2626' }}>Invoice not found.</div></DashboardLayout>;

  const st = STATUS_STYLE[invoice.status] ?? STATUS_STYLE.draft;
  const outstanding = invoice.total_amount - invoice.paid_amount;
  const canEdit   = invoice.status === 'draft' || invoice.status === 'sent';
  const canSend   = invoice.status === 'draft';
  const canCancel = invoice.status !== 'paid' && invoice.status !== 'cancelled';
  const canPay    = invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.status !== 'draft';
  // Independent of payment status — a Paid invoice's old link can still
  // expire, and the Lead needs a fresh one to re-view/re-download from (see
  // Api\{Admin,User}\InvoiceController::generateLink(), which only ever
  // rejects 'cancelled' — never 'paid').
  const canLink = invoice.status !== 'cancelled';

  return (
    <DashboardLayout title={invoice.invoice_number}>
      <LoadingOverlay show={payLoading} message="Recording Payment…" />
      <div style={{ width: '100%', maxWidth: 'none' }}>
        <button onClick={() => router.push('/invoices')} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 14 }}>
          <HiArrowLeft size={16} /> Back to Invoices
        </button>

        {/* Header card */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', padding: '24px 28px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{invoice.invoice_number}</h1>
                <span style={{ padding: '4px 12px', borderRadius: 50, fontSize: 12, fontWeight: 700, ...st }}>{st.label}</span>
              </div>
              {invoice.client && (
                <div>
                  <button onClick={() => router.push(`/clients/${invoice.client_id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#2563eb', fontWeight: 600, fontSize: 14 }}>
                    {invoice.client.name}
                  </button>
                  {invoice.client.company_name && <span style={{ color: '#94a3b8', fontSize: 13 }}> · {invoice.client.company_name}</span>}
                </div>
              )}
              {!invoice.client && invoice.customer_name && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{invoice.customer_name}</span>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {invoice.customer_email   && <span style={{ fontSize: 12, color: '#64748b' }}>{invoice.customer_email}</span>}
                    {invoice.customer_phone   && <span style={{ fontSize: 12, color: '#64748b' }}>{invoice.customer_phone}</span>}
                    {invoice.customer_address && <span style={{ fontSize: 12, color: '#94a3b8' }}>{invoice.customer_address}</span>}
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {!isSubUser && canEdit && (
                <button onClick={() => router.push(`/invoices/${invoiceId}/edit`)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 7, border: '1.5px solid #e2e8f0', background: '#fff', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <HiPencilSquare size={14} /> Edit
                </button>
              )}
              {canUseSalesChat && (
                <button onClick={goToChat} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 7, border: '1.5px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <HiChatBubbleLeftRight size={14} /> Chat
                </button>
              )}
              {!isSubUser && canSend && (
                <button onClick={() => handleAction('send')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 7, border: 'none', background: '#eff6ff', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <HiPaperAirplane size={14} /> Mark Sent
                </button>
              )}
              {!isSubUser && !['paid', 'cancelled'].includes(invoice.status) && (
                <button onClick={() => router.push(`/invoices/${invoiceId}/send`)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <HiPaperAirplane size={14} /> Send Invoice
                </button>
              )}
              {!isSubUser && canPay && (
                <button onClick={() => setShowPayForm(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <HiPlusCircle size={14} /> Record Payment
                </button>
              )}
              {!isSubUser && canLink && (
                <button onClick={() => setShowLinkPanel(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 7, border: '1.5px solid #e2e8f0', background: showLinkPanel ? '#eff6ff' : '#fff', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <HiLink size={14} /> Payment Link
                </button>
              )}
              {!isSubUser && canCancel && (
                <button onClick={() => handleAction('cancel')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fff', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <HiXCircle size={14} /> Cancel
                </button>
              )}
              {/* True delete — only ever a draft; a sent/partially_paid/
                  paid/overdue invoice must be cancelled (above) instead,
                  which preserves the record. */}
              {isAdmin && invoice.status === 'draft' && (
                <button onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fff', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <HiTrash size={14} /> Delete
                </button>
              )}
            </div>
          </div>

          {invoice.project_id && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, fontSize: 13, color: '#5b21b6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>This invoice is linked to a project.</span>
              {/* This page is shared by the Admin and Seller guards (see
                  app/admin/invoices/[id]/page.tsx, which re-exports it), so
                  the destination has to follow the caller's own guard — an
                  Admin sent to the Seller-guard /projects route gets 401'd
                  straight back out to the login screen. */}
              <button onClick={() => router.push(isAdmin ? `/admin/projects/${invoice.project_id}` : `/projects/${invoice.project_id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', fontWeight: 700, fontSize: 13 }}>
                View Project →
              </button>
            </div>
          )}

          {/* Deal/Project reference — spec §5: client must know exactly
              which service/proposed project this invoice is for, before a
              Project record exists. Swaps to "Related Project" once one
              has been created from this Deal. */}
          {(invoice.invoice_purpose || invoice.lead?.proposed_project_title) && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
              {invoice.lead?.proposed_project_title && (
                <div style={{ fontSize: 13, color: '#0f172a', marginBottom: 3 }}>
                  <strong>{invoice.lead.fulfillment_status === 'project_created' ? 'Related Project: ' : 'Related Deal: '}</strong>
                  {invoice.lead.proposed_project_title}
                  {invoice.lead.deal_reference && <span style={{ color: '#94a3b8' }}> — {invoice.lead.deal_reference}</span>}
                </div>
              )}
              {invoice.invoice_purpose && (
                <div style={{ fontSize: 12, color: '#64748b' }}>Purpose: {invoice.invoice_purpose}</div>
              )}
            </div>
          )}

          {/* Full project history for this Deal — completed, previous and
              latest — the same "all projects" view a client sees for their
              own account in the Client Portal (see
              frontend/app/client/projects/page.tsx). */}
          {invoice.project_history && invoice.project_history.length > 0 && (
            <div style={{ marginTop: 14, padding: '14px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
                Project History <span style={{ fontWeight: 400, color: '#94a3b8' }}>({invoice.project_history.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {invoice.project_history.map(p => {
                  const sc = PROJECT_STATUS_STYLE[p.status] || { bg: '#f1f5f9', color: '#64748b' };
                  return (
                    <div
                      key={p.id}
                      onClick={() => router.push(isAdmin ? `/admin/projects/${p.id}` : `/projects/${p.id}`)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                        <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                          {p.status?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>{p.project_manager?.name || '—'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 90 }}>
                          <div style={{ flex: 1, height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${p.progress}%`, height: '100%', background: p.progress === 100 ? '#16a34a' : '#7c3aed', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 10, color: '#64748b' }}>{p.progress}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {actionMsg && <div style={{ marginTop: 14, padding: '9px 14px', background: '#f0fdf4', borderRadius: 7, color: '#16a34a', fontSize: 13 }}>{actionMsg}</div>}
          {actionErr && <div style={{ marginTop: 14, padding: '9px 14px', background: '#fef2f2', borderRadius: 7, color: '#dc2626', fontSize: 13 }}>{actionErr}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 22, paddingTop: 18, borderTop: '1px solid #f1f5f9' }}>
            {[
              { label: 'Total', value: fmt(invoice.total_amount), color: '#0f172a' },
              { label: 'Paid', value: fmt(invoice.paid_amount), color: '#059669' },
              { label: 'Outstanding', value: fmt(outstanding), color: outstanding > 0 ? '#ea580c' : '#059669' },
              { label: 'Due Date', value: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : '—', color: '#0f172a' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Link panel */}
        {showLinkPanel && canLink && (
          <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 12, padding: 22, marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#1e3a5f' }}>Payment Link</h4>

            {linkMsg && <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f0fdf4', borderRadius: 7, color: '#16a34a', fontSize: 13 }}>{linkMsg}</div>}
            {linkErr && <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef2f2', borderRadius: 7, color: '#dc2626', fontSize: 13 }}>{linkErr}</div>}

            {paymentUrl ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <input
                    readOnly
                    value={paymentUrl}
                    style={{ flex: 1, padding: '9px 12px', border: '1.5px solid #93c5fd', borderRadius: 7, fontSize: 12, background: '#fff', color: '#1e293b', outline: 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  />
                  <button
                    onClick={() => copyLink(paymentUrl)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', borderRadius: 7, border: 'none', background: copied ? '#059669' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {copied ? <><HiClipboardDocumentCheck size={14} /> Copied!</> : <><HiClipboard size={14} /> Copy Link</>}
                  </button>
                </div>
                {invoice.token_expires_at && (
                  <div style={{ fontSize: 12, color: '#3b82f6', marginBottom: 12 }}>
                    Expires: {new Date(invoice.token_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={handleGenerateLink} disabled={linkLoading} style={{ padding: '7px 14px', borderRadius: 7, border: '1.5px solid #93c5fd', background: '#fff', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {linkLoading ? 'Working…' : 'Regenerate'}
                  </button>
                  <button onClick={handleRevokeLink} disabled={linkLoading} style={{ padding: '7px 14px', borderRadius: 7, border: '1.5px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Revoke Link
                  </button>
                  <a href={paymentUrl!} target="_blank" rel="noreferrer" style={{ padding: '7px 14px', borderRadius: 7, border: '1.5px solid #86efac', background: '#f0fdf4', color: '#059669', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    Open Payment Page ↗
                  </a>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ margin: '0 0 14px', fontSize: 13, color: '#475569' }}>
                  {invoice.status === 'paid'
                    ? 'This invoice is already paid — generate a fresh link so your client can still view the receipt and project history, no login required.'
                    : 'Generate a secure, shareable link so your client can pay this invoice online — no login required.'}
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                  <div>
                    <label style={{ ...lbl, color: '#1e3a5f' }}>Link expiry (days)</label>
                    <input
                      type="number" min={1} max={365} placeholder="No expiry"
                      value={expiryDays} onChange={e => setExpiryDays(e.target.value)}
                      style={{ width: 130, padding: '9px 12px', border: '1.5px solid #93c5fd', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff' }}
                    />
                  </div>
                  <button onClick={handleGenerateLink} disabled={linkLoading} style={{ padding: '9px 20px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: linkLoading ? 'not-allowed' : 'pointer' }}>
                    {linkLoading ? 'Generating…' : 'Generate Link'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Record Payment form (inline) */}
        {showPayForm && (
          <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 12, padding: 22, marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#14532d' }}>Record Payment — Outstanding: {fmt(outstanding)}</h4>
            {payError && <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef2f2', borderRadius: 7, color: '#dc2626', fontSize: 13 }}>{payError}</div>}
            <form onSubmit={handleRecordPayment}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ ...lbl, color: '#166534' }}>Amount *</label>
                  <input type="number" min={0.01} max={outstanding} step="0.01" required style={{ ...({ ...{}, ...{ border: '1.5px solid #86efac' }, background: '#fff' } as React.CSSProperties), width: '100%', padding: '9px 12px', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }} value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder={`Max ${outstanding}`} />
                </div>
                <div>
                  <label style={{ ...lbl, color: '#166534' }}>Method</label>
                  <select style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #86efac', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff' }} value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                    {METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ ...lbl, color: '#166534' }}>Date</label>
                  <input type="date" style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #86efac', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }} value={payDate} onChange={e => setPayDate(e.target.value)} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ ...lbl, color: '#166534' }}>Notes</label>
                <input style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #86efac', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }} value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Optional note…" />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <SubmitButton loading={payLoading} loadingText="Recording Payment…" style={{ padding: '9px 24px', borderRadius: 7, border: 'none', background: '#059669', color: '#fff', fontSize: 13, fontWeight: 600 }}>
                  Save Payment
                </SubmitButton>
                <button type="button" onClick={() => setShowPayForm(false)} disabled={payLoading} style={{ padding: '9px 18px', borderRadius: 7, border: '1px solid #86efac', background: '#fff', color: '#059669', fontSize: 13, cursor: payLoading ? 'not-allowed' : 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(340px, 420px)', gap: 16, alignItems: 'start' }}>
          {/* Line items */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Line Items</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  {['Description', 'Qty', 'Unit Price', 'Total'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: h === 'Description' ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(invoice.items ?? []).map((item, i) => (
                  <tr key={item.id ?? i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#0f172a' }}>{item.description}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 13, color: '#475569' }}>{item.quantity}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 13, color: '#475569' }}>{fmt(item.unit_price)}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{fmt(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Totals footer */}
            <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
              {[
                { label: 'Subtotal', value: fmt(invoice.subtotal) },
                { label: `Tax (${invoice.tax_rate}%)`, value: fmt(invoice.tax_amount) },
                { label: 'Discount', value: `- ${fmt(invoice.discount_amount)}` },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'flex-end', gap: 40, fontSize: 13, color: '#64748b', marginBottom: 5 }}>
                  <span>{r.label}</span><span style={{ minWidth: 110, textAlign: 'right' }}>{r.value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 40, marginTop: 8, paddingTop: 8, borderTop: '2px solid #e2e8f0', fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                <span>Total</span><span style={{ minWidth: 110, textAlign: 'right', color: '#2563eb' }}>{fmt(invoice.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Payments */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Payments</h3>
            </div>
            {(invoice.payments ?? []).length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No payments recorded yet</div>
            ) : (
              <div>
                {(invoice.payments ?? []).map((p, i) => (
                  <div key={p.id} style={{ padding: '13px 18px', borderBottom: i < (invoice.payments?.length ?? 0) - 1 ? '1px solid #f8fafc' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#059669', fontSize: 14 }}>{fmt(p.amount)}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                        {paymentMethodLabel(p)}
                        {p.payment_date && ` · ${new Date(p.payment_date).toLocaleDateString('en-GB')}`}
                      </div>
                      {p.exchange_rate != null && p.converted_amount != null && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4,
                          fontSize: 11, fontWeight: 600, color: '#92400e', background: '#fffbeb',
                          border: '1px solid #fde68a', borderRadius: 5, padding: '2px 7px',
                        }}>
                          🔄 Converted — gateway charged {p.converted_currency} {Number(p.converted_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          {' '}(1 {invoice.currency} = {Number(p.exchange_rate).toFixed(4)} {p.converted_currency})
                        </div>
                      )}
                      {p.notes && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{p.notes}</div>}
                    </div>
                    <button onClick={() => handleRemovePayment(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: 4 }}>
                      <HiTrash size={14} />
                    </button>
                  </div>
                ))}
                <div style={{ padding: '12px 18px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Total Paid</span>
                  <span style={{ fontWeight: 700, color: '#059669' }}>{fmt(invoice.paid_amount)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {invoice.notes && (
          <div style={{ marginTop: 16, background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', padding: '18px 22px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Notes</div>
            <p style={{ margin: 0, fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap' }}>{invoice.notes}</p>
          </div>
        )}

        {/* Sales Chat — only for a fully guest invoice (no Lead/Client), so
            the "Chat with Seller" button on this invoice's public payment
            page has somewhere to actually be read/replied from. */}
        {showSalesChat && (
          <div id="invoice-sales-chat" style={{ marginTop: 16, background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', padding: '20px 24px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Chat with Client</h3>
            {chat.length === 0 ? (
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>No messages yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto', marginBottom: 14 }}>
                {chat.map(m => (
                  <div key={m.id}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                      {chatSenderName(m, { adminSuffix: true, guestSuffix: true })}
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
                placeholder="Message the client…" style={{ flex: 1, padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none' }}
              />
              <button type="submit" disabled={sendingChat} style={{
                padding: '9px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: sendingChat ? 'wait' : 'pointer', opacity: sendingChat ? 0.7 : 1,
              }}>Send</button>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
