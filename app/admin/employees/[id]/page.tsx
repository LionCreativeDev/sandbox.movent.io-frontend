'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useModuleGuard } from '@/hooks/useModuleGuard';
import { adminHrService, Employee } from '@/lib/services/adminHrService';
import { Badge, card, inp, fmtFileSize } from '@/components/admin/projects/shared';
import { EMPLOYEE_STATUS_SC, ATTENDANCE_SC, LEAVE_SC, PAYROLL_SC } from '@/components/admin/hr/shared';
import toast from 'react-hot-toast';
import { handleNotFound } from '@/lib/notFound';

export default function EmployeeDetailPage() {
  useModuleGuard('employees');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const employeeId = Number(id);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading]   = useState(true);
  const [docTitle, setDocTitle] = useState('');
  const [docFile, setDocFile]   = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setEmployee(await adminHrService.employees.getOne(employeeId));
    } catch (err) {
      if (!handleNotFound(err, router)) { toast.error('Failed to load employee'); router.push('/admin/employees'); }
    }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [employeeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const deactivate = async () => {
    if (!confirm('Deactivate this employee? They will stay on the Employees list marked Terminated — this does not delete their record.')) return;
    try {
      setEmployee(await adminHrService.employees.deactivate(employeeId));
      toast.success('Employee deactivated');
    } catch { toast.error('Failed to deactivate employee'); }
  };

  const reactivate = async () => {
    try {
      setEmployee(await adminHrService.employees.reactivate(employeeId));
      toast.success('Employee reactivated');
    } catch { toast.error('Failed to reactivate employee'); }
  };

  const deleteEmployee = async () => {
    if (!confirm('Delete this employee permanently? This removes them from every list — attendance/leave/payroll history is kept, but the employee record itself cannot be recovered from the UI. This is different from Deactivate.')) return;
    try {
      await adminHrService.employees.remove(employeeId);
      toast.success('Employee deleted');
      router.push('/admin/employees');
    } catch { toast.error('Failed to delete employee'); }
  };

  const uploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile || !docTitle) { toast.error('Title and file are required'); return; }
    setUploading(true);
    try {
      await adminHrService.employees.documents.upload(employeeId, docFile, docTitle);
      toast.success('Document uploaded');
      setDocTitle(''); setDocFile(null);
      load();
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to upload document'); }
    finally { setUploading(false); }
  };

  if (loading) return <DashboardLayout title="Employee"><div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div></DashboardLayout>;
  if (!employee) return <DashboardLayout title="Employee"><div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Employee not found.</div></DashboardLayout>;

  return (
    <DashboardLayout title={employee.name}>
      <div style={{ maxWidth: 1000 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>{employee.name}</h2>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <Badge label={employee.status} sc={EMPLOYEE_STATUS_SC[employee.status]} />
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{employee.employee_code}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={`/admin/employees/${employeeId}/edit`} style={{ padding: '9px 16px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#1e293b', textDecoration: 'none' }}>Edit</Link>
            {employee.status === 'terminated' ? (
              <button onClick={reactivate} style={{ padding: '9px 16px', border: '1px solid #bbf7d0', background: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#059669', cursor: 'pointer' }}>Reactivate</button>
            ) : (
              <button onClick={deactivate} style={{ padding: '9px 16px', border: '1px solid #fde68a', background: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#d97706', cursor: 'pointer' }}>Deactivate</button>
            )}
            <button onClick={deleteEmployee} style={{ padding: '9px 16px', border: '1px solid #fecaca', background: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#dc2626', cursor: 'pointer' }}>Delete</button>
          </div>
        </div>

        {/* Info — auto-fit rather than a fixed 4 columns, so 8 fields don't
            leave an uneven trailing row and it collapses cleanly on narrow
            screens instead of compressing 4-across. */}
        <div style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
            <div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Email</div><div style={{ fontSize: 13, color: '#0f172a', marginTop: 4 }}>{employee.email ?? '—'}</div></div>
            <div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Phone</div><div style={{ fontSize: 13, color: '#0f172a', marginTop: 4 }}>{employee.phone ?? '—'}</div></div>
            <div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Department</div><div style={{ fontSize: 13, color: '#0f172a', marginTop: 4 }}>{employee.department ?? '—'}</div></div>
            <div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Designation</div><div style={{ fontSize: 13, color: '#0f172a', marginTop: 4 }}>{employee.designation ?? '—'}</div></div>
            <div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Employment Type</div><div style={{ fontSize: 13, color: '#0f172a', marginTop: 4 }}>{employee.employment_type.replace('_', ' ')}</div></div>
            <div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Shift</div><div style={{ fontSize: 13, color: '#0f172a', marginTop: 4 }}>{employee.shift ? `${employee.shift.name} (${employee.shift_start_time?.slice(0, 5)} – ${employee.shift_end_time?.slice(0, 5)})` : (employee.shift_start_time && employee.shift_end_time ? `${employee.shift_start_time.slice(0, 5)} – ${employee.shift_end_time.slice(0, 5)}` : '—')}</div></div>
            <div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Salary</div><div style={{ fontSize: 13, color: '#0f172a', marginTop: 4 }}>{employee.salary ?? '—'}</div></div>
            <div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Join Date</div><div style={{ fontSize: 13, color: '#0f172a', marginTop: 4 }}>{employee.join_date ? new Date(employee.join_date).toLocaleDateString('en-GB') : '—'}</div></div>
            <div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Company</div><div style={{ fontSize: 13, color: '#0f172a', marginTop: 4 }}>{employee.company?.name ?? '—'}</div></div>
            <div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Created By</div><div style={{ fontSize: 13, color: '#0f172a', marginTop: 4 }}>{employee.creator?.name ?? '—'}</div></div>
          </div>
        </div>

        {/* Recent Attendance */}
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a', fontSize: 14 }}>Recent Attendance</div>
          {!employee.attendances || employee.attendances.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No attendance records yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {employee.attendances.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px 20px', fontSize: 13, color: '#0f172a' }}>{new Date(a.date).toLocaleDateString('en-GB')}</td>
                    <td style={{ padding: '10px 20px' }}><Badge label={a.status} sc={ATTENDANCE_SC[a.status]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Leave Requests */}
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a', fontSize: 14 }}>Recent Leave Requests</div>
          {!employee.leave_requests || employee.leave_requests.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No leave requests yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {employee.leave_requests.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px 20px', fontSize: 13, color: '#0f172a' }}>{l.leave_type}</td>
                    <td style={{ padding: '10px 20px', fontSize: 12, color: '#64748b' }}>{new Date(l.from_date).toLocaleDateString('en-GB')} – {new Date(l.to_date).toLocaleDateString('en-GB')}</td>
                    <td style={{ padding: '10px 20px' }}><Badge label={l.status} sc={LEAVE_SC[l.status]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Payroll */}
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a', fontSize: 14 }}>Recent Payroll</div>
          {!employee.payrolls || employee.payrolls.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No payroll records yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {employee.payrolls.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px 20px', fontSize: 13, color: '#0f172a' }}>{p.month_year}</td>
                    <td style={{ padding: '10px 20px', fontSize: 12, color: '#64748b' }}>Net: {p.net_pay}</td>
                    <td style={{ padding: '10px 20px' }}><Badge label={p.status} sc={PAYROLL_SC[p.status]} /></td>
                    <td style={{ padding: '10px 20px' }}>
                      <Link href={`/admin/payroll/${p.id}/payslip`} style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>View Payslip</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Documents */}
        <div style={card}>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginBottom: 14 }}>Documents</div>
          <form onSubmit={uploadDoc} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
            <div style={{ flex: '1 1 200px' }}>
              <input value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="Document title" style={inp} />
            </div>
            <input type="file" onChange={e => setDocFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
            <button type="submit" disabled={uploading} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: uploading ? 'wait' : 'pointer' }}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </form>
          {!employee.documents || employee.documents.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>No documents uploaded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {employee.documents.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
                  <span style={{ fontSize: 13, color: '#0f172a' }}>{d.title}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{fmtFileSize(d.file_size_bytes)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
