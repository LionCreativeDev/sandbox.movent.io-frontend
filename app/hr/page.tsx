'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { hrService } from '@/lib/services/hrService';
import { HrDashboardStats } from '@/lib/services/adminHrService';
import { StatCard } from '@/components/admin/projects/shared';
import { usePermission } from '@/hooks/usePermission';
import toast from 'react-hot-toast';

export default function HrDashboardPage() {
  useAdminGuard();
  const [stats, setStats] = useState<HrDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const canCreate = usePermission('hr', 'canCreateEmployees');
  const canViewEmployees = usePermission('hr', 'canViewEmployees');
  const canUpdateAttendance = usePermission('hr', 'canUpdateAttendance');
  const canApproveLeave = usePermission('hr', 'canApproveLeave');
  const canProcessPayroll = usePermission('hr', 'canProcessPayroll');
  const canViewRecruitment = usePermission('hr', 'canViewRecruitment');

  useEffect(() => {
    hrService.dashboard()
      .then(setStats)
      .catch(() => toast.error('Failed to load HR dashboard'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout title="HR Dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>HR Dashboard</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Employees, attendance, leave & payroll overview</p>
        </div>
        {canCreate && (
          <Link href="/employees/create" style={{
            padding: '9px 18px', background: '#2563eb', color: '#fff',
            borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}>+ Add Employee</Link>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
      ) : stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            <StatCard label="Total Employees" value={String(stats.total_employees)} color="#2563eb" />
            <StatCard label="Active" value={String(stats.active_employees)} color="#059669" />
            <StatCard label="On Leave" value={String(stats.on_leave_employees)} color="#d97706" />
            <StatCard label="Pending Leave Requests" value={String(stats.pending_leave_requests)} color="#7c3aed" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            <StatCard label="Present Today" value={String(stats.attendance_today.present)} sub={`${stats.attendance_today.absent} absent · ${stats.attendance_today.late} late`} color="#059669" />
            <StatCard label="Open Positions" value={String(stats.open_recruitment_postings)} color="#2563eb" />
            <StatCard label="Payroll Pending" value={String(stats.payroll_pending)} color="#d97706" />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            {canViewEmployees && <Link href="/employees" style={{ padding: '10px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#1e293b', textDecoration: 'none' }}>Manage Employees</Link>}
            {canUpdateAttendance && <Link href="/attendance" style={{ padding: '10px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#1e293b', textDecoration: 'none' }}>Mark Attendance</Link>}
            {canApproveLeave && <Link href="/leaves" style={{ padding: '10px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#1e293b', textDecoration: 'none' }}>Review Leave Requests</Link>}
            {canProcessPayroll && <Link href="/payroll" style={{ padding: '10px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#1e293b', textDecoration: 'none' }}>Process Payroll</Link>}
            {canViewRecruitment && <Link href="/recruitment" style={{ padding: '10px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#1e293b', textDecoration: 'none' }}>Recruitment</Link>}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a', fontSize: 14 }}>Recent HR Activity</div>
            {stats.recent_activity.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No HR activity yet.</div>
            ) : (
              <div>
                {stats.recent_activity.map(a => (
                  <div key={a.id} style={{ padding: '10px 20px', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 13, color: '#1e293b' }}>
                      {a.action.replace(/_/g, ' ')}{a.entity_type ? ` — ${a.entity_type}${a.entity_id ? ` #${a.entity_id}` : ''}` : ''}
                    </span>
                    <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>{new Date(a.created_at).toLocaleString('en-GB')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
