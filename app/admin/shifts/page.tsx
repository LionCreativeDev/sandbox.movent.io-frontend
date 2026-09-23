'use client';
import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useModuleGuard } from '@/hooks/useModuleGuard';
import { adminHrService, Shift } from '@/lib/services/adminHrService';
import { adminClientService, ClientCompany } from '@/lib/services/adminClientService';
import { getActiveCompany } from '@/lib/auth';
import { inp, lbl, card } from '@/components/admin/projects/shared';
import toast from 'react-hot-toast';
import SubmitButton from '@/components/ui/SubmitButton';
import TimeSelect from '@/components/ui/TimeSelect';

// Raw span between start and end, before any break is subtracted — the
// same "Gross" concept the Attendance page shows per check-in/check-out,
// applied here to the shift's own scheduled times. Overnight shifts (end
// <= start, e.g. 22:00–06:00) wrap past midnight, same rule the backend
// AttendanceCalculator uses.
function grossDuration(startTime: string, endTime: string): string {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// e.g. start 10:00 + 20min grace -> "10:20" — the exact clock time after
// which a check-in counts as Late (matches AttendanceCalculator's own
// grace-period cutoff, see app/Services/AttendanceCalculator.php).
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Simple lookup-table CRUD (name + start/end time) — no dedicated
// create/edit routes, just an inline form above the list, same shape as
// other small admin-managed catalogs in this app.
export default function ShiftsPage() {
  useModuleGuard('employees');

  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [companyId, setCompanyId] = useState(0);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [graceMinutes, setGraceMinutes] = useState('15');

  useEffect(() => {
    adminClientService.companies().then(cs => {
      setCompanies(cs);
      if (cs.length) {
        const active = getActiveCompany();
        setCompanyId(typeof active === 'number' && cs.some(c => c.id === active) ? active : cs[0].id);
      }
    }).catch(() => {});
  }, []);

  const effectiveCompanyId = companyId || companies[0]?.id || 0;

  const load = async () => {
    setLoading(true);
    try {
      setShifts(await adminHrService.shifts.list());
    } catch { toast.error('Failed to load shifts'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setStartTime('');
    setEndTime('');
    setGraceMinutes('15');
  };

  const startEdit = (shift: Shift) => {
    setEditingId(shift.id);
    setName(shift.name);
    setStartTime(shift.start_time.slice(0, 5));
    setEndTime(shift.end_time.slice(0, 5));
    setGraceMinutes(String(shift.grace_period_minutes ?? 15));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (editingId) {
        await adminHrService.shifts.update(editingId, { name, start_time: startTime, end_time: endTime, grace_period_minutes: Number(graceMinutes) });
        toast.success('Shift updated');
      } else {
        if (!companies.length) { toast.error('No active company found for your account.'); return; }
        await adminHrService.shifts.create({ company_id: effectiveCompanyId, name, start_time: startTime, end_time: endTime, grace_period_minutes: Number(graceMinutes) });
        toast.success('Shift created');
      }
      resetForm();
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save shift');
    } finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this shift? Employees assigned to it will keep their current timing but lose the link.')) return;
    try {
      await adminHrService.shifts.remove(id);
      toast.success('Shift deleted');
      if (editingId === id) resetForm();
      load();
    } catch { toast.error('Failed to delete shift'); }
  };

  return (
    <DashboardLayout title="Shifts">
      <div style={{ maxWidth: 900 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>Shifts</h2>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px' }}>
          Define reusable shift schedules (e.g. Morning, Evening) — employees pick a shift instead of typing timings manually.
        </p>

        <form onSubmit={handleSubmit} style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr auto', gap: 16, alignItems: 'end' }}>
            {companies.length >= 1 && !editingId && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Company *</label>
                <select style={inp} value={companyId} onChange={e => setCompanyId(Number(e.target.value))} required>
                  <option value={0}>Select company…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={lbl}>Shift Name *</label>
              <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning Shift" required />
            </div>
            <div>
              <label style={lbl}>Start Time *</label>
              <TimeSelect value={startTime} onChange={setStartTime} required />
            </div>
            <div>
              <label style={lbl}>End Time *</label>
              <TimeSelect value={endTime} onChange={setEndTime} required />
              {startTime && endTime && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Gross Time: {grossDuration(startTime, endTime)}</div>
              )}
            </div>
            <div>
              <label style={lbl}>Grace Period (min)</label>
              <input type="number" min={0} max={180} style={inp} value={graceMinutes} onChange={e => setGraceMinutes(e.target.value)} />
              {startTime && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Late after {addMinutes(startTime, Number(graceMinutes) || 0)}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <SubmitButton loading={saving} loadingText="Saving…" style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600 }}>
                {editingId ? 'Update' : 'Add Shift'}
              </SubmitButton>
              {editingId && (
                <button type="button" onClick={resetForm} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              )}
            </div>
          </div>
        </form>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
          ) : shifts.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>No shifts defined yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Name', 'Start', 'End', 'Gross Time', 'Grace Period', 'Late After', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shifts.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{s.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{s.start_time.slice(0, 5)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{s.end_time.slice(0, 5)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{grossDuration(s.start_time.slice(0, 5), s.end_time.slice(0, 5))}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{s.grace_period_minutes} min</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#d97706', fontWeight: 600 }}>{addMinutes(s.start_time.slice(0, 5), s.grace_period_minutes)}</td>
                    <td style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
                      <button onClick={() => startEdit(s)} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b', cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => remove(s.id)} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>Delete</button>
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
