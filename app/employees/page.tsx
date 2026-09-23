'use client';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { hrService } from '@/lib/services/hrService';
import { AttendanceDisplayStatus, Employee } from '@/lib/services/adminHrService';
import { Badge, inp, lbl } from '@/components/admin/projects/shared';
import { ATTENDANCE_SC, EMPLOYEE_STATUS_SC } from '@/components/admin/hr/shared';
import TimeSelect from '@/components/ui/TimeSelect';
import { usePermission } from '@/hooks/usePermission';
import toast from 'react-hot-toast';

type AttendanceAction = 'check_in' | 'check_out';

const ATTENDANCE_LABEL: Record<AttendanceDisplayStatus, string> = {
  not_checked_in: 'Not Checked In',
  working: 'Working',
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  half_day: 'Half Day',
  holiday: 'Holiday',
  leave: 'Leave',
  off_day: 'Off Day',
  pending: 'Not Checked In',
};

function fmtTime(value?: string | null): string {
  if (!value) return '—';
  const [hourRaw, minute = '00'] = value.slice(0, 5).split(':');
  const hour = Number(hourRaw);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${minute} ${suffix}`;
}

function actionButton(background: string, color: string): CSSProperties {
  return {
    padding: '5px 12px',
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 6,
    border: 'none',
    background,
    color,
    cursor: 'pointer',
  };
}

function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return fallback;
}

export default function EmployeesPage() {
  useAdminGuard();
  const canCreate = usePermission('hr', 'canCreateEmployees');
  const canMarkAttendance = usePermission('hr', 'canUpdateAttendance');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusF, setStatusF]     = useState('');
  const [departmentF, setDepartmentF] = useState('');
  const [attendanceModal, setAttendanceModal] = useState<{ employee: Employee; action: AttendanceAction } | null>(null);
  const [timeMode, setTimeMode] = useState<'current' | 'manual'>('current');
  const [manualTime, setManualTime] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualReason, setManualReason] = useState('');
  const [attendanceSaving, setAttendanceSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search)      params.search = search;
      if (statusF)     params.status = statusF;
      if (departmentF) params.department = departmentF;
      setEmployees(await hrService.employees.list(params));
    } catch (err: any) {
      if (err?.response?.status === 403) toast.error('You do not have permission to view employees');
      else toast.error('Failed to load employees');
    }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusF, departmentF]); // eslint-disable-line react-hooks/exhaustive-deps

  const openAttendanceModal = (employee: Employee, action: AttendanceAction) => {
    if (!employee.shift_id && action === 'check_in') {
      toast.error('No shift is assigned to this employee.');
      return;
    }

    setAttendanceModal({ employee, action });
    setTimeMode('current');
    setManualTime('');
    setManualDate(new Date().toISOString().slice(0, 10));
    setManualReason('');
  };

  const submitAttendanceAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!attendanceModal) return;
    if (timeMode === 'manual' && (!manualTime || !manualReason.trim())) {
      toast.error('Manual time and reason are required.');
      return;
    }

    setAttendanceSaving(true);
    try {
      const payload = timeMode === 'manual'
        ? { time_mode: 'manual' as const, time: manualTime, date: manualDate, reason: manualReason }
        : { time_mode: 'current' as const };

      if (attendanceModal.action === 'check_in') {
        await hrService.attendance.checkInEmployee(attendanceModal.employee.id, payload);
        toast.success('Employee checked in');
      } else {
        await hrService.attendance.checkOutEmployee(attendanceModal.employee.id, payload);
        toast.success('Employee checked out');
      }

      setAttendanceModal(null);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Attendance action failed'));
    } finally {
      setAttendanceSaving(false);
    }
  };

  const attendanceButton = (employee: Employee) => {
    const today = employee.today_attendance;
    if (today?.check_in && !today.check_out) {
      return <button onClick={() => openAttendanceModal(employee, 'check_out')} style={actionButton('#0f766e', '#fff')}>Check Out</button>;
    }
    if (today?.check_in && today.check_out) {
      return <Link href={`/attendance?employee_id=${employee.id}`} style={{ ...actionButton('#eef2ff', '#4f46e5'), textDecoration: 'none' }}>View Attendance</Link>;
    }
    return <button onClick={() => openAttendanceModal(employee, 'check_in')} style={actionButton('#2563eb', '#fff')}>Check In</button>;
  };

  return (
    <DashboardLayout title="Employees">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>Employees</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{employees.length} employees</p>
        </div>
        {canCreate && (
          <Link href="/employees/create" style={{
            padding: '9px 18px', background: '#2563eb', color: '#fff',
            borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}>+ Add Employee</Link>
        )}
      </div>

      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
        padding: '12px 16px', marginBottom: 16,
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
          placeholder="Search name, email, employee code…"
          style={{ ...inp, width: 260 }}
        />
        <input
          value={departmentF}
          onChange={e => setDepartmentF(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
          placeholder="Department…"
          style={{ ...inp, width: 160 }}
        />
        <select value={statusF} onChange={e => setStatusF(e.target.value)}
          style={{ ...inp, width: 160, background: '#fff' }}>
          <option value="">All Statuses</option>
          {Object.keys(EMPLOYEE_STATUS_SC).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <button onClick={load} style={{
          padding: '8px 18px', background: '#2563eb', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}>Search</button>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : employees.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
            No employees found.{canCreate && <>{' '}<Link href="/employees/create" style={{ color: '#2563eb', fontWeight: 600 }}>Add one</Link></>}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Employee', 'Code', 'Phone', 'Department', 'Designation', 'Shift', "Today's Status", 'Check-in', 'Check-out', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left', fontSize: 11,
                    fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map(e => {
                const displayStatus = e.today_attendance?.display_status ?? 'not_checked_in';
                return (
                <tr key={e.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{e.name}</div>
                    {e.email && <div style={{ fontSize: 11, color: '#94a3b8' }}>{e.email}</div>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{e.employee_code ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{e.phone ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{e.department ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{e.designation ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>
                    {e.shift?.name ?? '—'}
                    {e.shift && <div style={{ fontSize: 11, color: '#94a3b8' }}>{fmtTime(e.shift.start_time)} - {fmtTime(e.shift.end_time)}</div>}
                  </td>
                  <td style={{ padding: '12px 16px' }}><Badge label={ATTENDANCE_LABEL[displayStatus]} sc={ATTENDANCE_SC[displayStatus]} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#0f172a' }}>{fmtTime(e.today_attendance?.check_in)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#0f172a' }}>{fmtTime(e.today_attendance?.check_out)}</td>
                  <td style={{ padding: '12px 16px' }}><Badge label={e.status} sc={EMPLOYEE_STATUS_SC[e.status]} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{e.join_date ? new Date(e.join_date).toLocaleDateString('en-GB') : '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', whiteSpace: 'nowrap' }}>
                      {canMarkAttendance && attendanceButton(e)}
                      <Link href={`/employees/${e.id}`} style={{
                        padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                        background: '#2563eb', color: '#fff', textDecoration: 'none',
                      }}>View</Link>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {attendanceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
          <form onSubmit={submitAttendanceAction} style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 22, boxShadow: '0 20px 50px rgba(15, 23, 42, 0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
              <div>
                <h3 style={{ fontSize: 18, color: '#0f172a', margin: 0 }}>{attendanceModal.action === 'check_in' ? 'Check In' : 'Check Out'}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>{attendanceModal.employee.name}</p>
              </div>
              <button type="button" onClick={() => setAttendanceModal(null)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10, marginBottom: 16 }}>
              <div><div style={lbl}>Assigned Shift</div><div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{attendanceModal.employee.shift?.name ?? '—'}</div></div>
              <div><div style={lbl}>Shift Start</div><div style={{ fontSize: 13, color: '#0f172a' }}>{fmtTime(attendanceModal.employee.shift?.start_time)}</div></div>
              <div><div style={lbl}>Shift End</div><div style={{ fontSize: 13, color: '#0f172a' }}>{fmtTime(attendanceModal.employee.shift?.end_time)}</div></div>
              <div><div style={lbl}>Grace Period</div><div style={{ fontSize: 13, color: '#0f172a' }}>{attendanceModal.employee.shift?.grace_period_minutes ?? 0} min</div></div>
              {attendanceModal.action === 'check_out' && <div><div style={lbl}>Today&apos;s Check-in</div><div style={{ fontSize: 13, color: '#0f172a' }}>{fmtTime(attendanceModal.employee.today_attendance?.check_in)}</div></div>}
            </div>

            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#1e293b' }}>
                <input type="radio" checked={timeMode === 'current'} onChange={() => setTimeMode('current')} />
                Use Current System Time
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#1e293b' }}>
                <input type="radio" checked={timeMode === 'manual'} onChange={() => setTimeMode('manual')} />
                Enter Time Manually
              </label>
            </div>

            {timeMode === 'manual' && (
              <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={lbl}>Manual Time</label>
                  <TimeSelect value={manualTime} onChange={setManualTime} />
                </div>
                {attendanceModal.action === 'check_in' && (
                  <div>
                    <label style={lbl}>Date</label>
                    <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} style={inp} />
                  </div>
                )}
                <div>
                  <label style={lbl}>Reason / Note *</label>
                  <input value={manualReason} onChange={e => setManualReason(e.target.value)} placeholder="Employee forgot to check in." style={inp} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setAttendanceModal(null)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={attendanceSaving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: attendanceSaving ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 700, cursor: attendanceSaving ? 'wait' : 'pointer' }}>
                {attendanceSaving ? 'Saving…' : attendanceModal.action === 'check_in' ? 'Confirm Check In' : 'Confirm Check Out'}
              </button>
            </div>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}
