'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useModuleGuard } from '@/hooks/useModuleGuard';
import { adminHrService, Attendance, AttendanceStatus, AttendanceSummary, Employee, Shift } from '@/lib/services/adminHrService';
import { Badge, inp, lbl, card, StatCard } from '@/components/admin/projects/shared';
import { ATTENDANCE_SC } from '@/components/admin/hr/shared';
import TimeSelect from '@/components/ui/TimeSelect';
import toast from 'react-hot-toast';

const STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'half_day', 'leave', 'holiday', 'off_day'];

function fmtMinutes(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function startOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday-start week
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function errorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function AttendancePage() {
  useModuleGuard('attendance');
  const [records, setRecords] = useState<Attendance[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [date, setDate] = useState(todayStr());

  const [filterEmployeeId, setFilterEmployeeId] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterShiftId, setFilterShiftId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');

  // Correction panel state — inline, no modal component exists in this app.
  const [correctingId, setCorrectingId] = useState<number | null>(null);
  const [corStatus, setCorStatus] = useState<AttendanceStatus | ''>('');
  const [corCheckIn, setCorCheckIn] = useState('');
  const [corCheckOut, setCorCheckOut] = useState('');
  const [corReason, setCorReason] = useState('');
  const [correcting, setCorrecting] = useState(false);

  useEffect(() => {
    const requestedEmployeeId = new URLSearchParams(window.location.search).get('employee_id');
    if (requestedEmployeeId) setFilterEmployeeId(requestedEmployeeId); // eslint-disable-line react-hooks/set-state-in-effect
    adminHrService.employees.list({ status: 'active' }).then(setEmployees).catch(() => {});
    adminHrService.shifts.list().then(setShifts).catch(() => {});
  }, []);

  const loadSummary = async () => {
    try { setSummary(await adminHrService.attendance.summary(date)); } catch { /* summary is a nice-to-have widget, list still works without it */ }
  };

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (rangeFrom || rangeTo) {
        if (rangeFrom) params.from = rangeFrom;
        if (rangeTo) params.to = rangeTo;
      } else {
        params.date = date;
      }
      if (filterEmployeeId)  params.employee_id = filterEmployeeId;
      if (filterDepartment)  params.department = filterDepartment;
      if (filterShiftId)     params.shift_id = filterShiftId;
      if (filterStatus)      params.status = filterStatus;
      setRecords(await adminHrService.attendance.list(params));
    } catch { toast.error('Failed to load attendance'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); loadSummary(); }, [date, filterEmployeeId, filterDepartment, filterShiftId, filterStatus, rangeFrom, rangeTo]); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect

  const departments = Array.from(new Set(employees.map(e => e.department).filter((d): d is string => !!d)));

  const syncNow = async () => {
    setSyncing(true);
    try {
      await adminHrService.attendance.syncNow(date);
      toast.success('Attendance synced — absentees finalized for shifts that have ended');
      load(); loadSummary();
    } catch { toast.error('Sync failed'); }
    finally { setSyncing(false); }
  };

  const startCorrect = (r: Attendance) => {
    setCorrectingId(r.id);
    setCorStatus(r.status);
    setCorCheckIn(r.check_in ? r.check_in.slice(0, 5) : '');
    setCorCheckOut(r.check_out ? r.check_out.slice(0, 5) : '');
    setCorReason('');
  };

  const submitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingId) return;
    if (!corReason.trim()) { toast.error('A reason is required for corrections'); return; }
    setCorrecting(true);
    try {
      await adminHrService.attendance.correct(correctingId, {
        status: corStatus || undefined,
        check_in: corCheckIn || null,
        check_out: corCheckOut || null,
        reason: corReason,
      });
      toast.success('Attendance corrected');
      setCorrectingId(null);
      load(); loadSummary();
    } catch (error: unknown) { toast.error(errorMessage(error, 'Failed to correct attendance')); }
    finally { setCorrecting(false); }
  };

  const clearFilters = () => {
    setFilterEmployeeId(''); setFilterDepartment(''); setFilterShiftId(''); setFilterStatus('');
    setRangeFrom(''); setRangeTo('');
  };

  return (
    <DashboardLayout title="Attendance">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>Attendance</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Calculated from check-in/check-out against each employee&apos;s shift</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/admin/attendance/policy" style={{ padding: '9px 18px', background: '#fff', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Policy Settings
          </Link>
          <button onClick={syncNow} disabled={syncing} style={{ padding: '9px 18px', background: syncing ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: syncing ? 'wait' : 'pointer' }}>
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14, marginBottom: 20 }}>
          <StatCard label="Total" value={String(summary.total_employees)} color="#1e293b" />
          <StatCard label="Present" value={String(summary.present)} color="#059669" />
          <StatCard label="Late" value={String(summary.late)} color="#d97706" />
          <StatCard label="Absent" value={String(summary.absent)} color="#dc2626" />
          <StatCard label="Leave" value={String(summary.leave)} color="#7c3aed" />
          <StatCard label="Half Day" value={String(summary.half_day)} color="#2563eb" />
          <StatCard label="Not Checked In" value={String(summary.not_checked_in)} color="#94a3b8" />
          <StatCard label="Currently Working" value={String(summary.currently_working ?? 0)} color="#0891b2" />
          <StatCard label="Checked Out" value={String(summary.checked_out ?? 0)} color="#4f46e5" />
          <StatCard label="Off Today" value={String(summary.off_today ?? summary.off_day)} color="#64748b" />
        </div>
      )}

      <div style={{ ...card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => { setDate(todayStr()); setRangeFrom(''); setRangeTo(''); }} style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b', cursor: 'pointer' }}>Today</button>
          <button type="button" onClick={() => { setDate(todayStr(-1)); setRangeFrom(''); setRangeTo(''); }} style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b', cursor: 'pointer' }}>Yesterday</button>
          <button type="button" onClick={() => { setRangeFrom(startOfWeek()); setRangeTo(todayStr()); }} style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b', cursor: 'pointer' }}>This Week</button>
          <button type="button" onClick={() => { setRangeFrom(startOfMonth()); setRangeTo(todayStr()); }} style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b', cursor: 'pointer' }}>This Month</button>
        </div>
        <input type="date" value={date} onChange={e => { setDate(e.target.value); setRangeFrom(''); setRangeTo(''); }} style={{ ...inp, width: 160 }} />
        <div>
          <label style={lbl}>From</label>
          <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>To</label>
          <input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Employee</label>
          <select value={filterEmployeeId} onChange={e => setFilterEmployeeId(e.target.value)} style={{ ...inp, minWidth: 160 }}>
            <option value="">All employees</option>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Department</label>
          <select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)} style={{ ...inp, minWidth: 140 }}>
            <option value="">All departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Shift</label>
          <select value={filterShiftId} onChange={e => setFilterShiftId(e.target.value)} style={{ ...inp, minWidth: 140 }}>
            <option value="">All shifts</option>
            {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, minWidth: 140 }}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        {(filterEmployeeId || filterDepartment || filterShiftId || filterStatus || rangeFrom || rangeTo) && (
          <button onClick={clearFilters} style={{ padding: '9px 14px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Clear filters
          </button>
        )}
      </div>

      {correctingId && (
        <form onSubmit={submitCorrection} style={{ ...card, marginBottom: 16, border: '1px solid #93c5fd' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 12 }}>Correct Attendance #{correctingId}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
            <div>
              <label style={lbl}>Check-in</label>
              <TimeSelect value={corCheckIn} onChange={setCorCheckIn} allowClear />
            </div>
            <div>
              <label style={lbl}>Check-out</label>
              <TimeSelect value={corCheckOut} onChange={setCorCheckOut} allowClear />
            </div>
            <div>
              <label style={lbl}>Status Override</label>
              <select value={corStatus} onChange={e => setCorStatus(e.target.value as AttendanceStatus)} style={inp}>
                <option value="">Auto (recalculate)</option>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Reason *</label>
            <input value={corReason} onChange={e => setCorReason(e.target.value)} placeholder="Why is this being corrected?" style={inp} required />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setCorrectingId(null)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={correcting} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: correcting ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: correcting ? 'wait' : 'pointer' }}>
              {correcting ? 'Saving…' : 'Save Correction'}
            </button>
          </div>
        </form>
      )}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : records.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>No attendance records match these filters.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Employee', 'Shift', 'Check-in', 'Check-out', 'Worked', 'Late', 'Overtime', 'Status', 'Source', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                    {r.employee?.name}
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>{new Date(r.date).toLocaleDateString('en-GB')} · {r.department ?? '—'}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>
                    {r.shift_name ?? '—'}
                    {r.scheduled_check_in && <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.scheduled_check_in.slice(0, 5)}–{r.scheduled_check_out?.slice(0, 5)}</div>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#0f172a' }}>{r.check_in?.slice(0, 5) ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#0f172a' }}>
                    {r.check_out?.slice(0, 5) ?? (r.is_missing_checkout ? <span style={{ color: '#dc2626', fontWeight: 600 }}>Missing</span> : '—')}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                    {fmtMinutes(r.worked_minutes)}
                    {r.gross_minutes != null && r.gross_minutes !== r.worked_minutes && (
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>Gross {fmtMinutes(r.gross_minutes)}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: r.late_by_minutes ? '#d97706' : '#64748b' }}>{r.late_by_minutes ? fmtMinutes(r.late_by_minutes) : '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: r.overtime_minutes ? '#2563eb' : '#64748b' }}>{r.overtime_minutes ? fmtMinutes(r.overtime_minutes) : '—'}</td>
                  <td style={{ padding: '12px 16px' }}><Badge label={r.status} sc={ATTENDANCE_SC[r.status]} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>{r.source}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => startCorrect(r)} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b', cursor: 'pointer' }}>Correct</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
