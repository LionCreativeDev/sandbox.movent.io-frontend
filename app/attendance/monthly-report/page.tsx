'use client';
import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { usePermission } from '@/hooks/usePermission';
import { hrService } from '@/lib/services/hrService';
import { AttendanceCalendar, Employee } from '@/lib/services/adminHrService';
import { Badge, inp, lbl, card, StatCard } from '@/components/admin/projects/shared';
import { ATTENDANCE_SC } from '@/components/admin/hr/shared';
import toast from 'react-hot-toast';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function fmtMinutes(mins: number | null | undefined): string {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AttendanceMonthlyReportPage() {
  useAdminGuard();
  const canView = usePermission('hr', 'canViewAttendance');

  const now = new Date();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<AttendanceCalendar | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canView) return;
    hrService.employees.list({ status: 'active' }).then(list => {
      setEmployees(list);
      if (list.length > 0) setEmployeeId(String(list[0].id)); // eslint-disable-line react-hooks/set-state-in-effect
    }).catch(() => {});
  }, [canView]);

  useEffect(() => {
    if (!canView || !employeeId) return;
    setLoading(true);
    hrService.attendance.calendar(Number(employeeId), month, year)
      .then(setData)
      .catch(() => toast.error('Failed to load monthly report'))
      .finally(() => setLoading(false));
  }, [canView, employeeId, month, year]);

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 4 + i);
  const selectedEmployee = employees.find(e => String(e.id) === employeeId);

  return (
    <DashboardLayout title="Monthly Attendance Report">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>Monthly Attendance Report</h2>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Per-employee breakdown of present, absent, late and leave days for a given month</p>
      </div>

      {!canView ? (
        <div style={{ ...card, textAlign: 'center', color: '#94a3b8' }}>You do not have permission to view the attendance register.</div>
      ) : (
        <>
          <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={lbl}>Employee</label>
              <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} style={{ ...inp, minWidth: 200 }}>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}{emp.department ? ` — ${emp.department}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Month</label>
              <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ ...inp, minWidth: 140 }}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Year</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))} style={inp}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
          ) : !data ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Select an employee to view their monthly report.</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14, margin: '20px 0' }}>
                <StatCard label="Attendance %" value={`${data.attendance_percentage}%`} color="#1e293b" />
                <StatCard label="Present" value={String(data.stats.present ?? 0)} color="#059669" />
                <StatCard label="Late" value={String(data.stats.late ?? 0)} sub={data.total_late_minutes ? `${fmtMinutes(data.total_late_minutes)} total` : undefined} color="#d97706" />
                <StatCard label="Absent" value={String(data.stats.absent ?? 0)} color="#dc2626" />
                <StatCard label="Leave" value={String(data.stats.leave ?? 0)} color="#7c3aed" />
                <StatCard label="Half Day" value={String(data.stats.half_day ?? 0)} color="#2563eb" />
                <StatCard label="Holiday / Off" value={String((data.stats.holiday ?? 0) + (data.stats.off_day ?? 0))} color="#64748b" />
                <StatCard label="Overtime" value={fmtMinutes(data.total_overtime_minutes)} color="#0891b2" />
              </div>

              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                  {selectedEmployee?.name} — {MONTHS[month - 1]} {year}, day by day
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Date', 'Status', 'Check-in', 'Check-out', 'Worked', 'Late by'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.days.map(d => (
                        <tr key={d.date} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '10px 16px', fontSize: 13, color: '#1e293b' }}>{new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}</td>
                          <td style={{ padding: '10px 16px' }}>{d.status ? <Badge label={d.status} sc={ATTENDANCE_SC[d.status]} /> : <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>}</td>
                          <td style={{ padding: '10px 16px', fontSize: 12, color: '#0f172a' }}>{d.check_in?.slice(0, 5) ?? '—'}</td>
                          <td style={{ padding: '10px 16px', fontSize: 12, color: '#0f172a' }}>{d.check_out?.slice(0, 5) ?? '—'}</td>
                          <td style={{ padding: '10px 16px', fontSize: 12, color: '#64748b', fontWeight: 600 }}>{fmtMinutes(d.worked_minutes)}</td>
                          <td style={{ padding: '10px 16px', fontSize: 12, color: d.late_by_minutes ? '#d97706' : '#64748b' }}>{d.late_by_minutes ? fmtMinutes(d.late_by_minutes) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
