'use client';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useModuleGuard } from '@/hooks/useModuleGuard';

export default function CompliancePage() {
  useModuleGuard('compliance');
  const router = useRouter();

  return (
    <DashboardLayout title="Compliance">
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Compliance</h1>
        <button
          onClick={() => router.push('/admin/compliance/clients')}
          style={{
            padding: '14px 28px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}
        >
          View Clients →
        </button>
      </div>
    </DashboardLayout>
  );
}
