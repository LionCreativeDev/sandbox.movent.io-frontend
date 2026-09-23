'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useModuleGuard } from '@/hooks/useModuleGuard';
import { adminHrService, Payroll, Employee, PayrollStatus, AttendanceDeductionPreview } from '@/lib/services/adminHrService';
import { Badge, inp, lbl, card } from '@/components/admin/projects/shared';
import { PAYROLL_SC } from '@/components/admin/hr/shared';
import toast from 'react-hot-toast';

export default function PayrollPage() {
  useModuleGuard('payroll');
  const [rows, setRows] = useState<Payroll[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  // Non-null while editing an existing draft record instead of creating a
  // new one — the same form doubles as both, since the fields are identical.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [monthYear, setMonthYear] = useState('');
  const [basicSalary, setBasicSalary] = useState('');
  const [allowances, setAllowances] = useState('');
  const [deductions, setDeductions] = useState('');
  const [attendanceDeduction, setAttendanceDeduction] = useState('');
  const [deductionBreakdown, setDeductionBreakdown] = useState<AttendanceDeductionPreview['breakdown'] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Filters — all three are real server-side params the backend already
  // supports (PayrollController@index), not client-side array filtering.
  const [filterEmployeeId, setFilterEmployeeId] = useState('');
  const [filterMonthYear, setFilterMonthYear] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    adminHrService.employees.list({ status: 'active' }).then(setEmployees).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterEmployeeId) params.employee_id = filterEmployeeId;
      if (filterMonthYear) params.month_year = filterMonthYear;
      if (filterStatus) params.status = filterStatus;
      setRows(await adminHrService.payroll.list(params));
    }
    catch { toast.error('Failed to load payroll'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterEmployeeId, filterMonthYear, filterStatus]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setEmployeeId(''); setMonthYear(''); setBasicSalary(''); setAllowances(''); setDeductions('');
    setAttendanceDeduction(''); setDeductionBreakdown(null);
  };

  const startEdit = (p: Payroll) => {
    setEditingId(p.id);
    setEmployeeId(String(p.employee_id));
    setMonthYear(p.month_year);
    setBasicSalary(String(p.basic_salary));
    setAllowances(String(p.allowances));
    setDeductions(String(p.deductions));
    setAttendanceDeduction(String(p.attendance_deduction ?? 0));
    setDeductionBreakdown(p.attendance_deduction_breakdown);
    setShowForm(true);
  };

  // Pulls that month's Attendance (Late/Half Day/Absent/Off Day beyond the
  // company's free allowance) and computes what the deduction WOULD be —
  // prefills the field but doesn't lock it, the admin can still edit before
  // saving. Manual button rather than auto-fetch so it never silently
  // overwrites a value someone already adjusted.
  const recalcAttendanceDeduction = async () => {
    if (!employeeId || !monthYear || !basicSalary) { toast.error('Select employee, month and basic salary first'); return; }
    setPreviewLoading(true);
    try {
      const preview = await adminHrService.payroll.deductionPreview(Number(employeeId), monthYear, Number(basicSalary));
      setAttendanceDeduction(String(preview.total));
      setDeductionBreakdown(preview.breakdown);
      toast.success(`Calculated from attendance: ${preview.total}`);
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to calculate attendance deduction'); }
    finally { setPreviewLoading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !monthYear || !basicSalary) { toast.error('Employee, month and basic salary are required'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await adminHrService.payroll.update(editingId, {
          basic_salary: Number(basicSalary),
          allowances: allowances ? Number(allowances) : 0,
          deductions: deductions ? Number(deductions) : 0,
          attendance_deduction: attendanceDeduction ? Number(attendanceDeduction) : 0,
          attendance_deduction_breakdown: deductionBreakdown,
        });
        toast.success('Payroll record updated');
      } else {
        await adminHrService.payroll.create({
          employee_id: Number(employeeId), month_year: monthYear,
          basic_salary: Number(basicSalary),
          allowances: allowances ? Number(allowances) : undefined,
          deductions: deductions ? Number(deductions) : undefined,
          attendance_deduction: attendanceDeduction ? Number(attendanceDeduction) : undefined,
          attendance_deduction_breakdown: deductionBreakdown,
        });
        toast.success('Payroll draft created');
      }
      resetForm();
      load();
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to save payroll'); }
    finally { setSaving(false); }
  };

  const process = async (id: number) => {
    setBusyId(id);
    try { await adminHrService.payroll.process(id); toast.success('Payroll processed'); load(); }
    catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to process payroll'); }
    finally { setBusyId(null); }
  };

  const markPaid = async (id: number) => {
    setBusyId(id);
    try { await adminHrService.payroll.markPaid(id); toast.success('Marked as paid'); load(); }
    catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to mark as paid'); }
    finally { setBusyId(null); }
  };

  return (
    <DashboardLayout title="Payroll">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>Payroll</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{rows.length} payroll records</p>
        </div>
        <button onClick={() => (showForm ? resetForm() : setShowForm(true))} style={{ padding: '9px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {showForm ? 'Cancel' : '+ Add Payroll'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={lbl}>Employee</label>
              <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} style={inp} disabled={!!editingId}>
                <option value="">Select…</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Month</label>
              <input type="month" value={monthYear} onChange={e => setMonthYear(e.target.value)} style={inp} disabled={!!editingId} />
            </div>
            <div>
              <label style={lbl}>Basic Salary</label>
              <input type="number" min={0} step="0.01" value={basicSalary} onChange={e => setBasicSalary(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Allowances</label>
              <input type="number" min={0} step="0.01" value={allowances} onChange={e => setAllowances(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Deductions</label>
              <input type="number" min={0} step="0.01" value={deductions} onChange={e => setDeductions(e.target.value)} style={inp} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: deductionBreakdown ? 12 : 0 }}>
              <div style={{ flex: '0 0 220px' }}>
                <label style={lbl}>Attendance Deduction</label>
                <input type="number" min={0} step="0.01" value={attendanceDeduction} onChange={e => setAttendanceDeduction(e.target.value)} style={inp} />
              </div>
              <button type="button" onClick={recalcAttendanceDeduction} disabled={previewLoading} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b', fontSize: 12, fontWeight: 600, cursor: previewLoading ? 'wait' : 'pointer' }}>
                {previewLoading ? 'Calculating…' : 'Calculate from Attendance'}
              </button>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Late/Half Day/Absent beyond the free allowance in Attendance Policy, at that day&apos;s rate.</span>
            </div>
            {deductionBreakdown && (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: '#64748b' }}>
                {(['late', 'half_day', 'absent', 'off_day'] as const).map(key => {
                  const b = deductionBreakdown[key];
                  if (!b || b.count === 0) return null;
                  return (
                    <span key={key} style={{ padding: '4px 10px', background: '#f8fafc', borderRadius: 6 }}>
                      {key.replace('_', ' ')}: {b.count} ({b.billable_count} billable) × {b.percent}% = {b.amount}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <button type="submit" disabled={saving} style={{ padding: '9px 20px', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Draft'}
          </button>
        </form>
      )}

      <div style={{ ...card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <label style={lbl}>Employee</label>
          <select value={filterEmployeeId} onChange={e => setFilterEmployeeId(e.target.value)} style={{ ...inp, minWidth: 160 }}>
            <option value="">All employees</option>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Month</label>
          <input type="month" value={filterMonthYear} onChange={e => setFilterMonthYear(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as PayrollStatus | '')} style={{ ...inp, minWidth: 140 }}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="processed">Processed</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        {(filterEmployeeId || filterMonthYear || filterStatus) && (
          <button onClick={() => { setFilterEmployeeId(''); setFilterMonthYear(''); setFilterStatus(''); }} style={{ padding: '9px 14px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Clear filters
          </button>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>No payroll records found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Employee', 'Month', 'Basic', 'Allowances', 'Deductions', 'Attendance Deduction', 'Net Pay', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{p.employee?.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{p.month_year}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{p.basic_salary}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{p.allowances}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{p.deductions}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: p.attendance_deduction > 0 ? '#dc2626' : '#64748b' }}>{p.attendance_deduction}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{p.net_pay}</td>
                  <td style={{ padding: '12px 16px' }}><Badge label={p.status} sc={PAYROLL_SC[p.status]} /></td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {p.status === 'draft' && (
                        <>
                          <button disabled={busyId === p.id} onClick={() => startEdit(p)} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, background: '#f1f5f9', color: '#475569', border: 'none', cursor: 'pointer' }}>Edit</button>
                          <button disabled={busyId === p.id} onClick={() => process(p.id)} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer' }}>Process</button>
                        </>
                      )}
                      {p.status === 'processed' && (
                        <button disabled={busyId === p.id} onClick={() => markPaid(p.id)} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, background: '#059669', color: '#fff', border: 'none', cursor: 'pointer' }}>Mark Paid</button>
                      )}
                      <Link href={`/admin/payroll/${p.id}/payslip`} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, background: '#f1f5f9', color: '#475569', textDecoration: 'none' }}>Payslip</Link>
                    </div>
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
