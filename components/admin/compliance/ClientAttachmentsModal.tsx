'use client';
import { useEffect, useState } from 'react';
import { adminComplianceService, ComplianceChatMessage } from '@/lib/services/adminComplianceService';
import { fmtDate } from '@/components/admin/compliance/shared';
import toast from 'react-hot-toast';

// Popup shown from the Project Compliance Listing's "Client Attachments"
// column — files the CLIENT themselves sent in the project's chat, not
// anything staff uploaded. Read-only besides Download, same as
// TaskAttachmentsModal.tsx/ProjectAttachmentsModal.tsx.
export default function ClientAttachmentsModal({
  projectId,
  projectName,
  onClose,
}: {
  projectId: number;
  projectName: string;
  onClose: () => void;
}) {
  const [attachments, setAttachments] = useState<ComplianceChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminComplianceService.project.clientAttachments(projectId)
      .then((res) => { if (!cancelled) setAttachments(res); })
      .catch(() => { if (!cancelled) toast.error('Failed to load client attachments'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const download = async (m: ComplianceChatMessage) => {
    setDownloadingId(m.id);
    try { await adminComplianceService.project.clientAttachmentDownload(m.id, m.attachment_name ?? 'attachment'); }
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
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Client Attachments — {projectName}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, lineHeight: 1, color: '#94a3b8', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
          ) : attachments.length === 0 ? (
            <div style={{ fontSize: 13, color: '#94a3b8' }}>No attachments from the client yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {attachments.map((m) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{m.attachment_name}</span>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      {m.sender?.name ?? m.guest_sender_name ?? 'Client'} · {fmtDate(m.sent_at)}
                    </div>
                  </div>
                  <button onClick={() => download(m)} disabled={downloadingId === m.id} style={{
                    padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: downloadingId === m.id ? 'default' : 'pointer',
                    background: '#2563eb', color: '#fff', border: 'none', flexShrink: 0,
                  }}>{downloadingId === m.id ? '…' : 'Download'}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
