'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import toast from 'react-hot-toast';
import { useModuleGuard } from '@/hooks/useModuleGuard';
import { adminProjectService, Project, ProjectInvoice } from '@/lib/services/adminProjectService';
import { InvoicePayment } from '@/types';
import ProjectTabs from '@/components/admin/projects/ProjectTabs';
import SubmitButton from '@/components/ui/SubmitButton';
import { card, lbl, inp, Badge, STATUS_SC, fmtDate, DraftNotice } from '@/components/admin/projects/shared';
import { handleNotFound } from '@/lib/notFound';
import api from '@/lib/axios';

function errorMessage(err: unknown, fallback: string): string {
  const ex = err as { response?: { data?: { message?: string } } };
  return ex.response?.data?.message ?? fallback;
}

const fmt = (n: number, currency?: string) => `${currency ? currency + ' ' : ''}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

// A single aggregate label for the whole project's billing, derived from the
// exact same invoices/billing_summary fields the cards below already use —
// never a separately-computed number, so it can't disagree with them.
function paymentStatus(project: Project): { label: string; sc: { bg: string; color: string } } {
  const invoices = project.invoices ?? [];
  if (invoices.length === 0) return { label: 'No Invoices', sc: { bg: '#f1f5f9', color: '#64748b' } };
  if (invoices.some(i => i.status === 'overdue')) return { label: 'Overdue', sc: STATUS_SC.overdue ?? { bg: '#fef2f2', color: '#dc2626' } };
  const totalInvoiced = project.billing_summary?.total_invoiced ?? 0;
  const totalPaid = project.billing_summary?.total_paid ?? 0;
  if (totalInvoiced > 0 && totalPaid >= totalInvoiced) return { label: 'Paid', sc: STATUS_SC.paid ?? { bg: '#ecfdf5', color: '#059669' } };
  if (totalPaid > 0) return { label: 'Partially Paid', sc: STATUS_SC.partially_paid ?? { bg: '#fff7ed', color: '#ea580c' } };
  return { label: 'Unpaid', sc: STATUS_SC.sent ?? { bg: '#eff6ff', color: '#2563eb' } };
}

export default function ProjectBillingPage() {
  useModuleGuard('projects');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Create Invoice — mirrors the mini-form that used to live on the
  // Overview tab, unchanged (same endpoint, same validation).
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [newInvAmount, setNewInvAmount] = useState('');
  const [newInvDueDate, setNewInvDueDate] = useState('');
  // What this invoice is FOR — "50% Advance Payment", "Milestone 2", etc.
  // Optional, but without it the client only ever sees an amount: it's what
  // the payment page, the invoice email and the portal all show as
  // "Payment For" (see Api\Admin\ProjectController::createInvoice()).
  const [newInvPurpose, setNewInvPurpose] = useState('');
  const [newInvEmail, setNewInvEmail] = useState('');
  // Settings > Invoice tab defaults — the exact same values
  // Api\Admin\ProjectController::createInvoice() resolves server-side (via
  // Company::invoicingProfile(), which prefers the tenant admin's own row —
  // the one this endpoint returns). Read-only here: the form doesn't offer a
  // tax override, it just tells the admin what is about to be applied instead
  // of leaving them to guess.
  const [invoiceDefaults, setInvoiceDefaults] = useState<{ tax_rate: number; payment_terms: number } | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<{ id: number; invoiceNumber: string; sentTo: string; paymentUrl?: string } | null>(null);
  const [invoiceLinkCopied, setInvoiceLinkCopied] = useState(false);
  const copyInvoiceLink = () => {
    if (!createdInvoice?.paymentUrl) return;
    navigator.clipboard.writeText(createdInvoice.paymentUrl).then(() => {
      setInvoiceLinkCopied(true);
      setTimeout(() => setInvoiceLinkCopied(false), 2500);
    });
  };

  const projectInvoiceCurrency = (project?.invoices ?? [])[0]?.currency;

  const load = async () => {
    setLoading(true);
    try {
      setProject(await adminProjectService.getOne(Number(id)));
    } catch (err) {
      if (!handleNotFound(err, router)) toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // A guest (no-client) project already has a real recipient address on file.
  useEffect(() => {
    if (!project || project.client || newInvEmail) return;
    if (project.invoice?.customer_email) setNewInvEmail(project.invoice.customer_email);
  }, [project]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get('/admin/settings')
      .then(r => setInvoiceDefaults({
        tax_rate: Number(r.data.data.invoice.tax_rate) || 0,
        payment_terms: Number(r.data.data.invoice.payment_terms) || 0,
      }))
      .catch(() => { /* the hint just stays hidden — never blocks invoicing */ });
  }, []);

  const handleCreateProjectInvoice = async () => {
    if (invoiceBusy) return;
    if (!newInvAmount) { toast.error('Amount is required'); return; }
    if (!project?.client && !newInvEmail.trim()) { toast.error('This project has no linked client — enter an email to send the invoice to'); return; }
    setInvoiceBusy(true);
    try {
      const sentTo = project?.client?.email ?? newInvEmail.trim();
      const invoice = await adminProjectService.createInvoice(Number(id), {
        due_date: newInvDueDate || null,
        currency: projectInvoiceCurrency,
        items: [{ description: `Invoice for ${project?.name ?? 'project'}`, quantity: 1, unit_price: Number(newInvAmount) }],
        invoice_purpose: newInvPurpose.trim() || null,
        recipient_email: project?.client ? undefined : newInvEmail.trim(),
      });
      toast.success('Invoice created and sent');
      setCreatedInvoice({ id: invoice.id, invoiceNumber: invoice.invoice_number, sentTo, paymentUrl: invoice.payment_url });
      setNewInvAmount(''); setNewInvDueDate(''); setNewInvPurpose('');
      setShowCreateInvoice(false);
      await load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Failed to create invoice'));
    } finally {
      setInvoiceBusy(false);
    }
  };

  if (loading) return (<DashboardLayout title="Project"><div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading…</div></DashboardLayout>);
  if (!project) return (<DashboardLayout title="Project"><div style={{ padding: 60, textAlign: 'center', color: '#dc2626' }}>Project not found.</div></DashboardLayout>);

  const isDraft = project.status === 'draft' || project.status === 'unpaid';
  const summary = project.billing_summary;
  const ps = paymentStatus(project);

  // Every payment across every invoice on this project, newest first, each
  // tagged with which invoice it belongs to — same rows the invoice detail
  // page's own Payments list shows, just flattened across the project.
  const paymentHistory: (InvoicePayment & { invoice: ProjectInvoice })[] = (project.invoices ?? [])
    .flatMap(inv => (inv.payments ?? []).map(p => ({ ...p, invoice: inv })))
    .sort((a, b) => new Date(b.payment_date ?? b.created_at).getTime() - new Date(a.payment_date ?? a.created_at).getTime());

  return (
    <DashboardLayout title="Project">
      {isDraft && <DraftNotice status={project.status} style={{ marginBottom: 16 }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => router.push('/admin/projects')} style={{
          background: '#f1f5f9', border: 'none', borderRadius: 8,
          padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#64748b',
        }}>← Back</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>{project.name}</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>{project.client?.name ?? 'No client linked'}</p>
        </div>
      </div>

      <ProjectTabs projectId={Number(id)} active="billing" isDraft={isDraft} />

      {/* Summary */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>Billing Summary</h3>
          <Badge label={ps.label} sc={ps.sc} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
          <div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Total Invoiced</div><div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{fmt(summary?.total_invoiced ?? 0)}</div></div>
          <div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Total Paid</div><div style={{ fontSize: 17, fontWeight: 700, color: '#059669', marginTop: 4 }}>{fmt(summary?.total_paid ?? 0)}</div></div>
          <div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Remaining Due</div><div style={{ fontSize: 17, fontWeight: 700, color: (summary?.outstanding ?? 0) > 0 ? '#ea580c' : '#059669', marginTop: 4 }}>{fmt(summary?.outstanding ?? 0)}</div></div>
        </div>
      </div>

      {/* Invoices & Billing — moved here from Overview */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>Invoices</h3>
          <button onClick={() => setShowCreateInvoice(v => !v)} style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            + Create Invoice
          </button>
        </div>

        {createdInvoice && (
          <div style={{ marginBottom: 14, padding: '12px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: '#065f46' }}>
                ✓ Invoice {createdInvoice.invoiceNumber} created and sent to {createdInvoice.sentTo}.
              </span>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button onClick={() => router.push(`/invoices/${createdInvoice.id}`)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 600, color: '#059669', cursor: 'pointer' }}>
                  View Invoice →
                </button>
                <button onClick={() => setCreatedInvoice(null)} style={{ background: 'none', border: 'none', color: '#65a30d', cursor: 'pointer', fontSize: 13 }}>✕</button>
              </div>
            </div>
            {createdInvoice.paymentUrl && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: '#166534', fontWeight: 600, marginBottom: 6 }}>Payment Link (share directly with client)</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input readOnly value={createdInvoice.paymentUrl} onFocus={e => e.target.select()} style={{ flex: 1, padding: '8px 10px', border: '1.5px solid #86efac', borderRadius: 7, fontSize: 12, background: '#fff', color: '#374151', outline: 'none' }} />
                  <button onClick={copyInvoiceLink} style={{ padding: '8px 14px', borderRadius: 7, border: 'none', background: invoiceLinkCopied ? '#059669' : '#16a34a', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {invoiceLinkCopied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {showCreateInvoice && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="number" min={0} step="0.01" value={newInvAmount} onChange={e => setNewInvAmount(e.target.value)} placeholder={`Amount (${projectInvoiceCurrency ?? 'USD'})`} style={{ ...inp, width: 160 }} />
            <input type="date" value={newInvDueDate} onChange={e => setNewInvDueDate(e.target.value)} placeholder="Due date (optional)" style={{ ...inp, width: 160 }} />
            <input value={newInvPurpose} onChange={e => setNewInvPurpose(e.target.value)} maxLength={255} placeholder="Purpose — e.g. 50% Advance Payment" style={{ ...inp, flex: '1 1 240px' }} />
            {project.client ? (
              <div style={{ fontSize: 12, color: '#64748b' }}>Will be sent to {project.client.email ?? project.client.name}</div>
            ) : (
              <input type="email" value={newInvEmail} onChange={e => setNewInvEmail(e.target.value)} placeholder="Recipient email (no client on this project)" style={{ ...inp, flex: '1 1 220px' }} />
            )}
            <SubmitButton type="button" onClick={handleCreateProjectInvoice} loading={invoiceBusy} loadingText="Creating Invoice…" style={{ padding: '9px 16px', borderRadius: 7, border: 'none', background: invoiceBusy ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600 }}>
              Create &amp; Send
            </SubmitButton>
            {/* The form has no tax field — the rate comes from Settings >
                Invoice — so this line names the rate about to be applied and,
                once an amount is typed, runs the exact same arithmetic the
                server does: tax = round(amount × rate / 100, 2),
                total = amount + tax. The tax half is skipped entirely until
                the settings call has answered, rather than claiming a rate
                this page hasn't actually confirmed. */}
            <div style={{ width: '100%', fontSize: 11.5, color: '#475569' }}>
              Please give purpose of invoice
              {invoiceDefaults && (invoiceDefaults.tax_rate > 0 ? (
                <>
                  {' '}— tax <strong>{invoiceDefaults.tax_rate}%</strong> will be applied, as set by the admin
                  {Number(newInvAmount) > 0 && (
                    <> ({fmt(Number(newInvAmount))} + {fmt(Math.round(Number(newInvAmount) * invoiceDefaults.tax_rate) / 100)} tax = <strong>{fmt(Number(newInvAmount) + Math.round(Number(newInvAmount) * invoiceDefaults.tax_rate) / 100, projectInvoiceCurrency ?? 'USD')}</strong>)</>
                  )}
                </>
              ) : (
                <>{' '}— no tax will be applied, the admin has set 0%</>
              ))}.
            </div>
            {projectInvoiceCurrency && (
              <div style={{ width: '100%', fontSize: 11, color: '#94a3b8' }}>
                Matches this project's existing invoice currency ({projectInvoiceCurrency}) — new invoices for this project always inherit it.
              </div>
            )}
          </div>
        )}

        {(project.invoices ?? []).length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>No invoices linked to this project yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Invoice #', 'Total', 'Paid', 'Remaining', 'Status', 'Due Date', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Remaining = total_amount - paid_amount, the exact same two
                  fields the invoice detail page's own "Outstanding" figure
                  and the summary cards above are built from — never a
                  separately-recomputed number. */}
              {(project.invoices ?? []).map(inv => {
                const remaining = Math.max(0, inv.total_amount - inv.paid_amount);
                return (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '9px 10px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{inv.invoice_number}</td>
                    <td style={{ padding: '9px 10px', fontSize: 13, color: '#475569' }}>{fmt(inv.total_amount, inv.currency)}</td>
                    <td style={{ padding: '9px 10px', fontSize: 13, color: '#059669', fontWeight: 600 }}>{fmt(inv.paid_amount, inv.currency)}</td>
                    <td style={{ padding: '9px 10px', fontSize: 13, fontWeight: 600, color: remaining > 0 ? '#ea580c' : '#059669' }}>{fmt(remaining, inv.currency)}</td>
                    <td style={{ padding: '9px 10px' }}><Badge label={inv.status} sc={STATUS_SC[inv.status] ?? { bg: '#f1f5f9', color: '#64748b' }} /></td>
                    <td style={{ padding: '9px 10px', fontSize: 13, color: '#64748b' }}>{fmtDate(inv.due_date)}</td>
                    <td style={{ padding: '9px 10px' }}>
                      <button onClick={() => router.push(`/invoices/${inv.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: 12.5, fontWeight: 600, padding: 0 }}>
                        View / Record Payment
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Partial payment history — every payment across every invoice on
          this project, flattened and sorted newest first. */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0, padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
          Payment History ({paymentHistory.length})
        </h3>
        {paymentHistory.length === 0 ? (
          <div style={{ padding: 24, fontSize: 13, color: '#94a3b8' }}>No payments recorded yet.</div>
        ) : (
          <div>
            {paymentHistory.map((p, i) => (
              <div key={p.id} style={{ padding: '12px 20px', borderBottom: i < paymentHistory.length - 1 ? '1px solid #f8fafc' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#059669', fontSize: 14 }}>{fmt(p.amount, p.currency ?? p.invoice.currency)}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                    {p.invoice.invoice_number}
                    {p.method && ` · ${p.method.replace('_', ' ')}`}
                    {p.gateway && ` · ${p.gateway}`}
                    {p.payment_date && ` · ${new Date(p.payment_date).toLocaleDateString('en-GB')}`}
                  </div>
                  {p.notes && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{p.notes}</div>}
                </div>
                <Badge label={p.status} sc={STATUS_SC[p.status] ?? { bg: '#f1f5f9', color: '#64748b' }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
