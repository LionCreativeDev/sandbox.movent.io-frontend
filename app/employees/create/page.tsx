'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { hrService } from '@/lib/services/hrService';
import { EmploymentType, Shift } from '@/lib/services/adminHrService';
import { inp, lbl, card } from '@/components/admin/projects/shared';
import toast from 'react-hot-toast';
import SubmitButton from '@/components/ui/SubmitButton';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import PhoneInput from '@/components/ui/PhoneInput';

// No company picker here — unlike the Admin (who can own several companies
// and must say which), a staff User's request is scoped server-side to
// whichever company is currently active (ScopesToActiveCompany), same as
// every other User-guard create form in this app.
export default function CreateEmployeePage() {
  useAdminGuard();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full_time');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftId, setShiftId] = useState('');
  const [salary, setSalary] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { hrService.shifts.list().then(setShifts).catch(() => {}); }, []);

  const selectedShift = shifts.find(s => s.id === Number(shiftId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const employee = await hrService.employees.create({
        name, email: email || null, phone: phone || null,
        department: department || null, designation: designation || null,
        employment_type: employmentType,
        shift_id: shiftId ? Number(shiftId) : null,
        salary: salary ? Number(salary) : null,
        join_date: joinDate || null,
      });
      toast.success('Employee created');
      router.push(`/employees/${employee.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create employee');
    } finally { setSaving(false); }
  };

  return (
    <DashboardLayout title="Add Employee">
      <LoadingOverlay show={saving} message="Creating Employee…" />
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 20px' }}>Add Employee</h2>

        <form onSubmit={handleSubmit} style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={lbl}>Full Name *</label>
              <input style={inp} value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <label style={lbl}>Email</label>
              <input type="email" style={inp} value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Phone</label>
              <PhoneInput value={phone} onChange={setPhone} />
            </div>
            <div>
              <label style={lbl}>Department</label>
              <input style={inp} value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Engineering" />
            </div>
            <div>
              <label style={lbl}>Designation</label>
              <input style={inp} value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Software Engineer" />
            </div>
            <div>
              <label style={lbl}>Employment Type</label>
              <select style={inp} value={employmentType} onChange={e => setEmploymentType(e.target.value as EmploymentType)}>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Salary</label>
              <input type="number" min={0} step="0.01" style={inp} value={salary} onChange={e => setSalary(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Join Date</label>
              <input type="date" style={inp} value={joinDate} onChange={e => setJoinDate(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Shift</label>
              <select style={inp} value={shiftId} onChange={e => setShiftId(e.target.value)}>
                <option value="">No shift</option>
                {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)})</option>)}
              </select>
              {selectedShift ? (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Check-in {selectedShift.start_time.slice(0, 5)} · Check-out {selectedShift.end_time.slice(0, 5)}</div>
              ) : (
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                  No shifts yet? <Link href="/shifts" style={{ color: '#2563eb', fontWeight: 600 }}>Manage shifts</Link>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => router.back()} disabled={saving} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>Cancel</button>
            <SubmitButton loading={saving} loadingText="Creating Employee…" style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600 }}>
              Create Employee
            </SubmitButton>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
