'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useModuleGuard } from '@/hooks/useModuleGuard';
import { adminHrService, Department } from '@/lib/services/adminHrService';
import { adminClientService, ClientCompany } from '@/lib/services/adminClientService';
import { getActiveCompany } from '@/lib/auth';
import { card, inp, lbl } from '@/components/admin/projects/shared';
import SubmitButton from '@/components/ui/SubmitButton';
import toast from 'react-hot-toast';

function errorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function DepartmentsPage() {
  useModuleGuard('employees');

  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [companyId, setCompanyId] = useState(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    adminClientService.companies().then(items => {
      const active = getActiveCompany();
      const visibleCompanies = typeof active === 'number' ? items.filter(company => company.id === active) : items;
      setCompanies(visibleCompanies);
      if (visibleCompanies.length) {
        setCompanyId(visibleCompanies[0].id);
      }
    }).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      setDepartments(await adminHrService.departments.list());
    } catch {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
  };

  const startEdit = (department: Department) => {
    setEditingId(department.id);
    setCompanyId(department.company_id);
    setName(department.name);
    setDescription(department.description ?? '');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!editingId && !companyId) {
      toast.error('Select a company');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await adminHrService.departments.update(editingId, { name, description: description || null });
        toast.success('Department updated');
      } else {
        await adminHrService.departments.create({ company_id: companyId, name, description: description || null });
        toast.success('Department created');
      }
      resetForm();
      load();
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Failed to save department'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (department: Department) => {
    if (!confirm(`Delete ${department.name}?`)) return;
    try {
      await adminHrService.departments.remove(department.id);
      toast.success('Department deleted');
      if (editingId === department.id) resetForm();
      load();
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Failed to delete department'));
    }
  };

  return (
    <DashboardLayout title="Departments">
      <div style={{ maxWidth: 960 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>Departments</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Manage the departments available when creating or editing employees.</p>
        </div>

        <form onSubmit={submit} style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(220px, 1.4fr) auto', gap: 14, alignItems: 'end' }}>
            {!editingId && companies.length > 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Company *</label>
                <select value={companyId} onChange={event => setCompanyId(Number(event.target.value))} style={inp} required>
                  <option value={0}>Select company...</option>
                  {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={lbl}>Department Name *</label>
              <input value={name} onChange={event => setName(event.target.value)} style={inp} placeholder="e.g. Engineering" maxLength={100} required />
            </div>
            <div>
              <label style={lbl}>Description</label>
              <input value={description} onChange={event => setDescription(event.target.value)} style={inp} placeholder="Optional" maxLength={500} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <SubmitButton loading={saving} loadingText="Saving..." style={{ padding: '9px 18px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600 }}>
                {editingId ? 'Update' : 'Add Department'}
              </SubmitButton>
              {editingId && <button type="button" onClick={resetForm} style={{ padding: '9px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#64748b', cursor: 'pointer' }}>Cancel</button>}
            </div>
          </div>
        </form>

        <div style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
          ) : departments.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>No departments defined yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Department', 'Description', 'Company', 'Employees', 'Actions'].map(heading => (
                    <th key={heading} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {departments.map(department => (
                  <tr key={department.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{department.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{department.description || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{department.company?.name || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#1e293b' }}>{department.employee_count}</td>
                    <td style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => startEdit(department)} style={{ padding: '4px 12px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', color: '#1e293b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                      <button type="button" onClick={() => remove(department)} style={{ padding: '4px 12px', border: '1px solid #fecaca', borderRadius: 6, background: '#fff', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
