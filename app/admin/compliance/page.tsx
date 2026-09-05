'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import toast from 'react-hot-toast';
import { useModuleGuard } from '@/hooks/useModuleGuard';
import { adminComplianceService, ComplianceDashboard, ComplianceCaseStatus } from '@/lib/services/adminComplianceService';
import { StatCard, CASE_STATUS_SC } from '@/components/admin/compliance/shared';

const STATUS_LABELS: Record<ComplianceCaseStatus, string> = {
  not_started: 'Not Started',
  pending: 'Pending',
  under_review: 'Under Review',
  compliant: 'Compliant',
  on_hold: 'On Hold',
  rejected: 'Rejected',
};

export default function ComplianceDashboardPage() {
  useModuleGuard('compliance');
  const router = useRouter();
  const [dashboard, setDashboard] = useState<ComplianceDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const d = await adminComplianceService.dashboard.get();
      setDashboard(d);
    } catch {
      toast.error('Failed to load compliance dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <DashboardLayout title="Compliance">
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
      </DashboardLayout>
    );
  }

  if (!dashboard) {
    return (
      <DashboardLayout title="Compliance">
        <div style={{ padding: 60, textAlign: 'center', color: '#dc2626' }}>Failed to load compliance dashboard.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Compliance">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>Compliance</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Overview of client compliance cases across all projects</p>
        </div>
        <button onClick={() => router.push('/admin/compliance/clients')} style={{
          padding: '9px 18px', background: '#2563eb', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>View Clients →</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
        <StatCard label="Total Cases" value={String(dashboard.total)} color="#0f172a" />
        {(Object.keys(STATUS_LABELS) as ComplianceCaseStatus[]).map(status => (
          <StatCard
            key={status}
            label={STATUS_LABELS[status]}
            value={String(dashboard.by_status?.[status] ?? 0)}
            color={CASE_STATUS_SC[status]?.color ?? '#0f172a'}
          />
        ))}
      </div>

      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
        padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Unassigned Officer</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>{dashboard.unassigned_officer}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 5 }}>Cases with no compliance officer assigned</div>
        </div>
        <button onClick={() => router.push('/admin/compliance/clients')} style={{
          padding: '8px 16px', background: '#fff', color: '#2563eb',
          border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        }}>Review Clients →</button>
      </div>
    </DashboardLayout>
  );
}
