'use client';
import { useEffect, useState } from 'react';
import { adminComplianceService, ComplianceDeliverySubmission } from '@/lib/services/adminComplianceService';
import { fmtDate, fmtFileSize } from '@/components/admin/compliance/shared';
import toast from 'react-hot-toast';

// Popup shown from the Project Compliance Listing's "Final Delivery"
// column — same list as the project detail page's "Final Delivery
// History". Read-only besides Download, same as TaskAttachmentsModal.tsx.
export default function FinalDeliveryModal({
  projectId,
  projectName,
  onClose,
}: {
  projectId: number;
  projectName: string;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<ComplianceDeliverySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminComplianceService.project.deliverables(projectId)
      .then((res) => { if (!cancelled) setHistory(res.delivery_history); })
      .catch(() => { if (!cancelled) toast.error('Failed to load final delivery'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const download = async (d: ComplianceDeliverySubmission) => {
    setDownloadingId(d.id);
    try { await adminComplianceService.project.deliveryDownload(d.id, d.file_name); }
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
          background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Final Delivery — {projectName}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, lineHeight: 1, color: '#94a3b8', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
          ) : history.length === 0 ? (
            <div style={{ fontSize: 13, color: '#94a3b8' }}>Not yet delivered to client.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {history.map((d) => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{d.file_name}</span>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      {fmtFileSize(d.file_size)} · {d.delivered_by_admin?.name ?? 'Unknown'} · {fmtDate(d.delivered_at)}
                    </div>
                  </div>
                  <button onClick={() => download(d)} disabled={downloadingId === d.id} style={{
                    padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: downloadingId === d.id ? 'default' : 'pointer',
                    background: '#2563eb', color: '#fff', border: 'none', flexShrink: 0,
                  }}>{downloadingId === d.id ? '…' : 'Download'}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
