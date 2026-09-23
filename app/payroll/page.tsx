'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { hrService } from '@/lib/services/hrService';
import { Payroll, Employee, PayrollStatus } from '@/lib/services/adminHrService';
import { Badge, inp, lbl, card } from '@/components/admin/projects/shared';
import { PAYROLL_SC } from '@/components/admin/hr/shared';
import { can } from '@/lib/auth';
import { usePermission } from '@/hooks/usePermission';
import toast from 'react-hot-toast';

// No "Add Payroll" here — payroll draft creation stays Company-Admin-only
// (this role's granted permissions are View/Update/Process, no Create; see
// Api\User\PayrollController). Mark Paid is Admin-only for the same reason.
export default function PayrollPage() {
  useAdminGuard();
  const [rows, setRows] = useState<Payroll[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [basicSalary, setBasicSalary] = useState('');
  const [allowances, setAllowances] = useState('');
  const [deductions, setDeductions] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const canUpdate = usePermission('hr', 'canUpdatePayroll');
  const canProcess = usePermission('hr', 'canProcessPayroll');

  const [filterEmployeeId, setFilterEmployeeId] = useState('');
  const [filterMonthYear, setFilterMonthYear] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    if (can('hr', 'canViewEmployees')) {
      hrService.employees.list({ status: 'active' }).then(setEmployees).catch(() => {});
    }
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterEmployeeId) params.employee_id = filterEmployeeId;
      if (filterMonthYear) params.month_year = filterMonthYear;
      if (filterStatus) params.status = filterStatus;
      setRows(await hrService.payroll.list(params));
    } catch (err: any) {
      if (err?.response?.status === 403) toast.error('You do not have permission to view payroll');
      else toast.error('Failed to load payroll');
    }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterEmployeeId, filterMonthYear, filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = (p: Payroll) => {
    setEditingId(p.id);
    setBasicSalary(String(p.basic_salary));
    setAllowances(String(p.allowances));
    setDeductions(String(p.deductions));
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    try {
      await hrService.payroll.update(editingId, {
        basic_salary: Number(basicSalary),
        allowances: allowances ? Number(allowances) : 0,
        deductions: deductions ? Number(deductions) : 0,
      });
      toast.success('Payroll record updated');
      setEditingId(null);
      load();
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to save payroll'); }
    finally { setSaving(false); }
  };

  const process = async (id: number) => {
    setBusyId(id);
    try { await hrService.payroll.process(id); toast.success('Payroll processed'); load(); }
    catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to process payroll'); }
    finally { setBusyId(null); }
  };

  return (
    <DashboardLayout title="Payroll">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>Payroll</h2>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{rows.length} payroll records</p>
      </div>

      {editingId && canUpdate && (
        <form onSubmit={saveEdit} style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
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
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={cancelEdit} style={{ padding: '9px 20px', background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '9px 20px', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
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
                      {p.status === 'draft' && canUpdate && (
                        <button disabled={busyId === p.id} onClick={() => startEdit(p)} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, background: '#f1f5f9', color: '#475569', border: 'none', cursor: 'pointer' }}>Edit</button>
                      )}
                      {p.status === 'draft' && canProcess && (
                        <button disabled={busyId === p.id} onClick={() => process(p.id)} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer' }}>Process</button>
                      )}
                      <Link href={`/payroll/${p.id}/payslip`} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, background: '#f1f5f9', color: '#475569', textDecoration: 'none' }}>Payslip</Link>
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
