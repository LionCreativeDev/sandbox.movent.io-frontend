'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import toast from 'react-hot-toast';
import { useModuleGuard } from '@/hooks/useModuleGuard';
import { adminProjectService, ProjectAttachment } from '@/lib/services/adminProjectService';
import ProjectTabs from '@/components/admin/projects/ProjectTabs';
import { card, fmtDate, fmtFileSize, ALLOWED_ATTACHMENT_TYPES } from '@/components/admin/projects/shared';

export default function ProjectAttachmentsPage() {
  useModuleGuard('projects');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = Number(id);

  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [visibleToClient, setVisibleToClient] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setAttachments(await adminProjectService.attachments.list(projectId)); }
    catch { toast.error('Failed to load attachments'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadAttachments = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    let failed = 0;
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ALLOWED_ATTACHMENT_TYPES.includes(ext)) { toast.error(`${file.name}: file type not allowed`); failed++; continue; }
      try {
        await adminProjectService.attachments.upload(projectId, file, visibleToClient);
      } catch {
        failed++;
        toast.error(`${file.name}: upload failed`);
      }
    }
    if (failed < files.length) toast.success('Attachment(s) uploaded');
    setUploading(false);
    load();
  };

  const downloadAttachment = async (a: ProjectAttachment) => {
    try { await adminProjectService.attachments.download(projectId, a.id, a.original_name); }
    catch { toast.error('Download failed'); }
  };

  const deleteAttachment = async (a: ProjectAttachment) => {
    if (!confirm(`Delete "${a.original_name}"?`)) return;
    try {
      await adminProjectService.attachments.remove(projectId, a.id);
      toast.success('Attachment deleted');
      setAttachments(prev => prev.filter(x => x.id !== a.id));
    } catch { toast.error('Failed to delete attachment'); }
  };

  return (
    <DashboardLayout title="Project Attachments">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => router.push(`/admin/projects/${id}`)} style={{
          background: '#f1f5f9', border: 'none', borderRadius: 8,
          padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#64748b',
        }}>← Back</button>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>Attachments</h2>
      </div>

      <ProjectTabs projectId={projectId} active="attachments" />

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>Project Attachments</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
              <input
                type="checkbox" checked={visibleToClient}
                onChange={e => setVisibleToClient(e.target.checked)}
              />
              Visible to client
            </label>
            <label style={{
              padding: '6px 14px', borderRadius: 8, border: '1.5px dashed #cbd5e1',
              background: uploading ? '#f1f5f9' : '#f8fafc', color: '#475569',
              fontSize: 12, fontWeight: 500, cursor: uploading ? 'not-allowed' : 'pointer',
            }}>
              {uploading ? 'Uploading…' : '+ Add Files'}
              <input
                type="file" multiple disabled={uploading} style={{ display: 'none' }}
                accept={ALLOWED_ATTACHMENT_TYPES.map(t => `.${t}`).join(',')}
                onChange={e => { uploadAttachments(e.target.files); e.target.value = ''; }}
              />
            </label>
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : attachments.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>No attachments uploaded yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {attachments.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>{a.original_name}</span>
                    {a.is_visible_to_client && (
                      <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 20, background: '#ecfdf5', color: '#059669', fontWeight: 600 }}>
                        Visible to client
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {a.file_type ?? 'file'} · {fmtFileSize(a.file_size)} · {a.uploaded_by_admin?.name ?? a.uploaded_by_user?.name ?? '—'} · {fmtDate(a.created_at)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => downloadAttachment(a)} style={{
                    padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                    background: '#2563eb', color: '#fff', border: 'none',
                  }}>Download</button>
                  <button onClick={() => deleteAttachment(a)} style={{
                    padding: '4px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6,
                  }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
