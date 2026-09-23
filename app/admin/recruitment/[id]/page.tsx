'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useModuleGuard } from '@/hooks/useModuleGuard';
import { adminHrService, Recruitment, ApplicantStatus, RecruitmentStatus } from '@/lib/services/adminHrService';
import { Badge, inp, lbl, card } from '@/components/admin/projects/shared';
import { RECRUITMENT_SC, APPLICANT_SC } from '@/components/admin/hr/shared';
import toast from 'react-hot-toast';
import PhoneInput from '@/components/ui/PhoneInput';
import { handleNotFound } from '@/lib/notFound';

const APPLICANT_STATUSES: ApplicantStatus[] = ['applied', 'shortlisted', 'interviewed', 'hired', 'rejected'];

export default function RecruitmentDetailPage() {
  useModuleGuard('recruitment');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const recruitmentId = Number(id);

  const [posting, setPosting] = useState<Recruitment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  // "Edit Posting" — position/department/openings/description/status.
  const [editing, setEditing] = useState(false);
  const [editPosition, setEditPosition] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editOpenings, setEditOpenings] = useState('1');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<RecruitmentStatus>('open');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => {
    try { setPosting(await adminHrService.recruitment.getOne(recruitmentId)); }
    catch (err) { if (!handleNotFound(err, router)) toast.error('Failed to load posting'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [recruitmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addApplicant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) { toast.error('Applicant name is required'); return; }
    setSaving(true);
    try {
      await adminHrService.recruitment.addApplicant(recruitmentId, { name, email: email || undefined, phone: phone || undefined });
      toast.success('Applicant added');
      setShowForm(false);
      setName(''); setEmail(''); setPhone('');
      load();
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to add applicant'); }
    finally { setSaving(false); }
  };

  const updateStatus = async (applicantId: number, status: ApplicantStatus) => {
    setBusyId(applicantId);
    try {
      await adminHrService.recruitment.updateApplicantStatus(recruitmentId, applicantId, status);
      toast.success('Applicant status updated');
      load();
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to update applicant'); }
    finally { setBusyId(null); }
  };

  const startEdit = () => {
    if (!posting) return;
    setEditPosition(posting.position);
    setEditDepartment(posting.department ?? '');
    setEditOpenings(String(posting.openings));
    setEditDescription(posting.description ?? '');
    setEditStatus(posting.status);
    setEditing(true);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPosition) { toast.error('Position is required'); return; }
    setSavingEdit(true);
    try {
      await adminHrService.recruitment.update(recruitmentId, {
        position: editPosition,
        department: editDepartment || undefined,
        openings: editOpenings ? Number(editOpenings) : undefined,
        description: editDescription || undefined,
        status: editStatus,
      });
      toast.success('Posting updated');
      setEditing(false);
      load();
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to update posting'); }
    finally { setSavingEdit(false); }
  };

  const removePosting = async () => {
    if (!confirm('Delete this job posting? This cannot be undone.')) return;
    setRemoving(true);
    try {
      await adminHrService.recruitment.remove(recruitmentId);
      toast.success('Posting deleted');
      router.push('/admin/recruitment');
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to delete posting'); setRemoving(false); }
  };

  if (loading) return <DashboardLayout title="Recruitment"><div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div></DashboardLayout>;
  if (!posting) return <DashboardLayout title="Recruitment"><div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Posting not found.</div></DashboardLayout>;

  return (
    <DashboardLayout title={posting.position}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>{posting.position}</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{posting.department ?? 'No department'} · {posting.openings} opening(s)</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Badge label={posting.status} sc={RECRUITMENT_SC[posting.status]} />
          <button onClick={() => (editing ? setEditing(false) : startEdit())} style={{ padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {editing ? 'Cancel' : 'Edit'}
          </button>
          <button onClick={removePosting} disabled={removing} style={{ padding: '8px 16px', background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: removing ? 'not-allowed' : 'pointer' }}>
            {removing ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {editing ? (
        <form onSubmit={saveEdit} style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={lbl}>Position *</label>
              <input value={editPosition} onChange={e => setEditPosition(e.target.value)} style={inp} required />
            </div>
            <div>
              <label style={lbl}>Department</label>
              <input value={editDepartment} onChange={e => setEditDepartment(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Openings</label>
              <input type="number" min={1} value={editOpenings} onChange={e => setEditOpenings(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Status</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value as RecruitmentStatus)} style={inp}>
                <option value="open">Open</option>
                <option value="on_hold">On Hold</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Description</label>
            <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} style={{ ...inp, minHeight: 80, resize: 'vertical' }} />
          </div>
          <button type="submit" disabled={savingEdit} style={{ padding: '9px 20px', background: savingEdit ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: savingEdit ? 'not-allowed' : 'pointer' }}>
            {savingEdit ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      ) : posting.description && (
        <div style={{ ...card, marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: '#475569', margin: 0, whiteSpace: 'pre-wrap' }}>{posting.description}</p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>Applicants ({posting.applicants?.length ?? 0})</h3>
        <button onClick={() => setShowForm(s => !s)} style={{ padding: '7px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {showForm ? 'Cancel' : '+ Add Applicant'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addApplicant} style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={lbl}>Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} style={inp} required />
            </div>
            <div>
              <label style={lbl}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Phone</label>
              <PhoneInput value={phone} onChange={setPhone} />
            </div>
          </div>
          <button type="submit" disabled={saving} style={{ padding: '9px 20px', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : 'Add Applicant'}
          </button>
        </form>
      )}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {!posting.applicants || posting.applicants.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>No applicants yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Name', 'Email', 'Phone', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posting.applicants.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{a.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{a.email ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{a.phone ?? '—'}</td>
                  <td style={{ padding: '12px 16px' }}><Badge label={a.status} sc={APPLICANT_SC[a.status]} /></td>
                  <td style={{ padding: '12px 16px' }}>
                    <select
                      value={a.status}
                      disabled={busyId === a.id}
                      onChange={e => updateStatus(a.id, e.target.value as ApplicantStatus)}
                      style={{ ...inp, width: 140, padding: '4px 8px', fontSize: 12 }}
                    >
                      {APPLICANT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
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
