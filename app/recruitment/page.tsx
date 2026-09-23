'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { hrService } from '@/lib/services/hrService';
import { Recruitment } from '@/lib/services/adminHrService';
import { Badge, inp, lbl, card } from '@/components/admin/projects/shared';
import { RECRUITMENT_SC } from '@/components/admin/hr/shared';
import { usePermission } from '@/hooks/usePermission';
import toast from 'react-hot-toast';

// No company picker in the create form — scoped server-side to the active
// company, same as /employees/create.
export default function RecruitmentPage() {
  useAdminGuard();
  const [postings, setPostings] = useState<Recruitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [openings, setOpenings] = useState('1');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const canCreate = usePermission('hr', 'canCreateRecruitment');

  const load = async () => {
    setLoading(true);
    try { setPostings(await hrService.recruitment.list(filterStatus ? { status: filterStatus } : undefined)); }
    catch (err: any) {
      if (err?.response?.status === 403) toast.error('You do not have permission to view recruitment postings');
      else toast.error('Failed to load recruitment postings');
    }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!position) { toast.error('Position is required'); return; }
    setSaving(true);
    try {
      await hrService.recruitment.create({
        position,
        department: department || undefined,
        openings: openings ? Number(openings) : undefined,
        description: description || undefined,
      });
      toast.success('Posting created');
      setShowForm(false);
      setPosition(''); setDepartment(''); setOpenings('1'); setDescription('');
      load();
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to create posting'); }
    finally { setSaving(false); }
  };

  return (
    <DashboardLayout title="Recruitment">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>Recruitment</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{postings.length} job postings</p>
        </div>
        {canCreate && (
          <button onClick={() => setShowForm(s => !s)} style={{ padding: '9px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {showForm ? 'Cancel' : '+ Add Posting'}
          </button>
        )}
      </div>

      <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <label style={lbl}>Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, minWidth: 160 }}>
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="on_hold">On Hold</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {showForm && canCreate && (
        <form onSubmit={submit} style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={lbl}>Position *</label>
              <input value={position} onChange={e => setPosition(e.target.value)} style={inp} required />
            </div>
            <div>
              <label style={lbl}>Department</label>
              <input value={department} onChange={e => setDepartment(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Openings</label>
              <input type="number" min={1} value={openings} onChange={e => setOpenings(e.target.value)} style={inp} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ ...inp, minHeight: 80, resize: 'vertical' }} />
          </div>
          <button type="submit" disabled={saving} style={{ padding: '9px 20px', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : 'Create Posting'}
          </button>
        </form>
      )}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : postings.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>No job postings found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Position', 'Department', 'Openings', 'Applicants', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {postings.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{r.position}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{r.department ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{r.openings}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{r.applicants_count ?? 0}</td>
                  <td style={{ padding: '12px 16px' }}><Badge label={r.status} sc={RECRUITMENT_SC[r.status]} /></td>
                  <td style={{ padding: '12px 16px' }}>
                    <Link href={`/recruitment/${r.id}`} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, background: '#2563eb', color: '#fff', textDecoration: 'none' }}>View</Link>
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
