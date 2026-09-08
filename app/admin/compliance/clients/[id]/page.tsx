'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import toast from 'react-hot-toast';
import { useModuleGuard } from '@/hooks/useModuleGuard';
import { adminComplianceService, ComplianceClientDetail } from '@/lib/services/adminComplianceService';
import { card, lbl } from '@/components/admin/compliance/shared';
import ProjectsListing from '@/components/admin/compliance/ProjectsListing';
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

      <ProjectsListing
        clientId={Number(id)}
        title="Compliance Projects"
        subtitle={`Projects for ${client.name}.`}
        showClientLink={false}
        zipFileNamePrefix={client.name}
      />
    </DashboardLayout>
  );
}
