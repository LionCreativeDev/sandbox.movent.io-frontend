'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import toast from 'react-hot-toast';
import { useModuleGuard } from '@/hooks/useModuleGuard';
import { adminComplianceService, ComplianceClientDetail } from '@/lib/services/adminComplianceService';
import { card, lbl, Badge, CASE_STATUS_SC, fmtDate } from '@/components/admin/compliance/shared';
import { handleNotFound } from '@/lib/notFound';

export default function ComplianceClientDetailPage() {
  useModuleGuard('compliance');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<ComplianceClientDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const d = await adminComplianceService.clients.get(Number(id));
      setDetail(d);
    } catch (err) {
      if (!handleNotFound(err, router)) toast.error('Failed to load client');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <DashboardLayout title="Client Compliance">
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
      </DashboardLayout>
    );
  }

  if (!detail) {
    return (
      <DashboardLayout title="Client Compliance">
        <div style={{ padding: 60, textAlign: 'center', color: '#dc2626' }}>Client not found.</div>
      </DashboardLayout>
    );
  }

  const { client, projects } = detail;

  return (
    <DashboardLayout title="Client Compliance">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => router.push('/admin/compliance/clients')} style={{
          background: '#f1f5f9', border: 'none', borderRadius: 8,
          padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#64748b',
        }}>← Back</button>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>{client.name}</h2>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>Client Info</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><label style={lbl}>Name</label><div style={{ fontSize: 13 }}>{client.name}</div></div>
          <div><label style={lbl}>Email</label><div style={{ fontSize: 13 }}>{client.email ?? '—'}</div></div>
          <div><label style={lbl}>Phone</label><div style={{ fontSize: 13 }}>{client.phone ?? '—'}</div></div>
          <div><label style={lbl}>Total Projects</label><div style={{ fontSize: 13 }}>{projects.length}</div></div>
        </div>
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0, padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>Projects</h3>
        {projects.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No projects found for this client.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Name', 'Reference', 'Status', 'PM', 'Seller', 'Compliance Status', 'Officer', 'Requirements', 'Deadline'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left', fontSize: 11,
                    fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/admin/compliance/projects/${p.id}`)}
                  style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{p.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{p.reference ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>{p.status.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{p.project_manager?.name ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{p.seller?.name ?? '—'}</td>
                  <td style={{ padding: '12px 16px' }}><Badge label={p.compliance_status} sc={CASE_STATUS_SC[p.compliance_status]} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{p.compliance_officer?.name ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#1e293b' }}>{p.requirements_approved}/{p.requirements_total} approved</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{fmtDate(p.deadline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}
