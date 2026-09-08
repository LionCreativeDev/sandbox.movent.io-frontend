'use client';
import { useEffect, useState } from 'react';
import { adminComplianceService, ComplianceInvoice } from '@/lib/services/adminComplianceService';
import { Badge, INVOICE_SC, fmtDate, paymentMethodText } from '@/components/admin/compliance/shared';
import toast from 'react-hot-toast';

// Popup shown from the Project Compliance Listing's "Invoices" column —
// same list as the project detail page's "Billing" card. Read-only, same
// as ChatModal.tsx/CommentsModal.tsx.
export default function InvoicesModal({
  projectId,
  projectName,
  onClose,
}: {
  projectId: number;
  projectName: string;
  onClose: () => void;
}) {
  const [invoices, setInvoices] = useState<ComplianceInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminComplianceService.project.billing(projectId)
      .then((res) => { if (!cancelled) setInvoices(res); })
      .catch(() => { if (!cancelled) toast.error('Failed to load invoices'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const download = async (inv: ComplianceInvoice) => {
    setDownloadingId(inv.id);
    try { await adminComplianceService.project.invoiceDownload(inv.id, `${inv.invoice_number}.txt`); }
    catch { toast.error('Download failed'); }
    finally { setDownloadingId(null); }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, width: '100%', maxWidth: 620,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Invoices — {projectName}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, lineHeight: 1, color: '#94a3b8', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
          ) : invoices.length === 0 ? (
            <div style={{ fontSize: 13, color: '#94a3b8' }}>No invoices for this project.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {invoices.map((inv) => (
                <div key={inv.id} style={{ padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{inv.invoice_number}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Badge label={inv.status} sc={INVOICE_SC[inv.status]} />
                      <button onClick={() => download(inv)} disabled={downloadingId === inv.id} style={{
                        padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: downloadingId === inv.id ? 'default' : 'pointer',
                        background: '#2563eb', color: '#fff', border: 'none', flexShrink: 0,
                      }}>{downloadingId === inv.id ? '…' : 'Download'}</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    Total: {inv.currency} {inv.total_amount} · Paid: {inv.currency} {inv.paid_amount}
                    {inv.due_date ? ` · Due ${fmtDate(inv.due_date)}` : ''}
                  </div>
                  {inv.payments.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {inv.payments.map((p) => (
                        <div key={p.id} style={{ fontSize: 11, color: '#94a3b8' }}>
                          {p.currency} {p.amount} via {paymentMethodText(p)}{p.payment_date ? ` · ${fmtDate(p.payment_date)}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
