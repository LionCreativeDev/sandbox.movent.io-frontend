'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useModuleGuard } from '@/hooks/useModuleGuard';
import Link from 'next/link';
import { adminHrService, Department, EmploymentType, Shift } from '@/lib/services/adminHrService';
import { adminClientService, ClientCompany } from '@/lib/services/adminClientService';
import { getActiveCompany } from '@/lib/auth';
import { inp, lbl, card } from '@/components/admin/projects/shared';
import toast from 'react-hot-toast';
import SubmitButton from '@/components/ui/SubmitButton';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import PhoneInput from '@/components/ui/PhoneInput';

function errorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function CreateEmployeePage() {
  useModuleGuard('employees');
  const router = useRouter();

  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [companyId, setCompanyId] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designation, setDesignation] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full_time');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftId, setShiftId] = useState('');
  const [salary, setSalary] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminClientService.companies().then(cs => {
      setCompanies(cs);
      if (cs.length) {
        // Whichever company is active (the CompanySelector dropdown) wins
        // — otherwise this always defaulted to the alphabetically-first
        // company regardless of which one the admin actually had selected.
        const active = getActiveCompany();
        setCompanyId(typeof active === 'number' && cs.some(c => c.id === active) ? active : cs[0].id);
      }
    }).catch(() => {});
    adminHrService.shifts.list().then(setShifts).catch(() => {});
  }, []);

  useEffect(() => {
    if (!companyId) return;
    adminHrService.departments.list({ company_id: String(companyId) }).then(setDepartments).catch(() => {});
  }, [companyId]);

  const selectedShift = shifts.find(s => s.id === Number(shiftId));

  // Falls back to the (only) company even if the dropdown state hasn't
  // caught up yet — the dropdown is only shown when there's a real choice.
  const effectiveCompanyId = companyId || companies[0]?.id || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return; // Guards a double-click/Enter re-submit before the disabled prop re-renders.
    if (companies.length === 0) { toast.error('No active company found for your account.'); return; }
    setSaving(true);
    try {
      const employee = await adminHrService.employees.create({
        company_id: effectiveCompanyId,
        name, email: email || null, phone: phone || null,
        department: department || null, designation: designation || null,
        employment_type: employmentType,
        shift_id: shiftId ? Number(shiftId) : null,
        salary: salary ? Number(salary) : null,
        join_date: joinDate || null,
      });
      toast.success('Employee created');
      router.push(`/admin/employees/${employee.id}`);
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Failed to create employee'));
    } finally { setSaving(false); }
  };

  return (
    <DashboardLayout title="Add Employee">
      <LoadingOverlay show={saving} message="Creating Employee…" />
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 20px' }}>Add Employee</h2>

        <form onSubmit={handleSubmit} style={card}>
          {companies.length >= 1 && (
            <div style={{ marginBottom: 16, maxWidth: 360 }}>
              <label style={lbl}>Company *</label>
              <select style={inp} value={companyId} onChange={e => { setCompanyId(Number(e.target.value)); setDepartment(''); }} required>
                <option value={0}>Select company…</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

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
              <select style={inp} value={department} onChange={e => setDepartment(e.target.value)}>
                <option value="">No department</option>
                {departments.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                <Link href="/admin/departments" style={{ color: '#2563eb', fontWeight: 600 }}>Manage departments</Link>
              </div>
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
                  No shifts yet? <Link href="/admin/shifts" style={{ color: '#2563eb', fontWeight: 600 }}>Manage shifts</Link>
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
