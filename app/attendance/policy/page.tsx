'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { usePermission } from '@/hooks/usePermission';
import { hrService } from '@/lib/services/hrService';
import { AttendancePolicy } from '@/lib/services/adminHrService';
import { inp, lbl, card } from '@/components/admin/projects/shared';
import toast from 'react-hot-toast';
import SubmitButton from '@/components/ui/SubmitButton';

// Staff-side mirror of /admin/attendance/policy — gated by its own
// canManageAttendancePolicy (view and edit both), not the general
// canViewEmployees/canEditEmployees bucket. This screen sets salary
// deduction rules affecting every employee's payroll, so it's excluded
// from the hr role's default permission set — only visible/editable to a
// staff user the Company Admin has explicitly granted this permission to.
export default function StaffAttendancePolicyPage() {
  useAdminGuard();
  const canView = usePermission('hr', 'canManageAttendancePolicy');
  const canEdit = canView;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [halfDayHours, setHalfDayHours] = useState('4');
  const [fullDayHours, setFullDayHours] = useState('8');
  const [graceMinutes, setGraceMinutes] = useState('15');
  const [overtimeEnabled, setOvertimeEnabled] = useState(false);
  const [overtimeThresholdMinutes, setOvertimeThresholdMinutes] = useState('0');

  const [lateDeductionPercent, setLateDeductionPercent] = useState('0');
  const [halfDayDeductionPercent, setHalfDayDeductionPercent] = useState('50');
  const [absentDeductionPercent, setAbsentDeductionPercent] = useState('100');
  const [offDayDeductionPercent, setOffDayDeductionPercent] = useState('0');
  const [freeLateAllowed, setFreeLateAllowed] = useState('0');
  const [freeHalfDayAllowed, setFreeHalfDayAllowed] = useState('0');
  const [freeAbsentAllowed, setFreeAbsentAllowed] = useState('0');
  const [freeOffDayAllowed, setFreeOffDayAllowed] = useState('0');

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    hrService.attendance.policy.get().then((p: AttendancePolicy) => {
      setHalfDayHours(String(p.half_day_threshold_minutes / 60));
      setFullDayHours(String(p.full_day_threshold_minutes / 60));
      setGraceMinutes(String(p.default_grace_period_minutes));
      setOvertimeEnabled(p.overtime_enabled);
      setOvertimeThresholdMinutes(String(p.overtime_threshold_minutes ?? 0));
      setLateDeductionPercent(p.late_deduction_percent);
      setHalfDayDeductionPercent(p.half_day_deduction_percent);
      setAbsentDeductionPercent(p.absent_deduction_percent);
      setOffDayDeductionPercent(p.off_day_deduction_percent);
      setFreeLateAllowed(String(p.free_late_allowed));
      setFreeHalfDayAllowed(String(p.free_half_day_allowed));
      setFreeAbsentAllowed(String(p.free_absent_allowed));
      setFreeOffDayAllowed(String(p.free_off_day_allowed));
    }).catch(() => toast.error('Failed to load attendance policy'))
      .finally(() => setLoading(false));
  }, [canView]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await hrService.attendance.policy.update({
        half_day_threshold_minutes: Math.round(Number(halfDayHours) * 60),
        full_day_threshold_minutes: Math.round(Number(fullDayHours) * 60),
        default_grace_period_minutes: Number(graceMinutes),
        overtime_enabled: overtimeEnabled,
        overtime_threshold_minutes: Number(overtimeThresholdMinutes),
        late_deduction_percent: Number(lateDeductionPercent),
        half_day_deduction_percent: Number(halfDayDeductionPercent),
        absent_deduction_percent: Number(absentDeductionPercent),
        off_day_deduction_percent: Number(offDayDeductionPercent),
        free_late_allowed: Number(freeLateAllowed),
        free_half_day_allowed: Number(freeHalfDayAllowed),
        free_absent_allowed: Number(freeAbsentAllowed),
        free_off_day_allowed: Number(freeOffDayAllowed),
      });
      toast.success('Attendance policy saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save attendance policy');
    } finally { setSaving(false); }
  };

  if (loading) return <DashboardLayout title="Attendance Policy"><div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div></DashboardLayout>;
  if (!canView) return <DashboardLayout title="Attendance Policy"><div style={{ ...card, textAlign: 'center', color: '#94a3b8' }}>You do not have permission to view this page.</div></DashboardLayout>;

  return (
    <DashboardLayout title="Attendance Policy">
      <div style={{ maxWidth: 800 }}>
        <div style={{ marginBottom: 20 }}>
          <Link href="/attendance" style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>&larr; Back to Attendance</Link>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '8px 0 4px' }}>Attendance Policy</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Company-wide rules for worked-hours thresholds and salary deductions.
          </p>
        </div>

        <fieldset disabled={!canEdit} style={{ border: 'none', padding: 0, margin: 0 }}>
        <form onSubmit={handleSubmit}>
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 14 }}>Working Hours</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                <label style={lbl}>Half Day Minimum (hours)</label>
                <input type="number" min={0} step="0.5" style={inp} value={halfDayHours} onChange={e => setHalfDayHours(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Full Day Minimum (hours)</label>
                <input type="number" min={0} step="0.5" style={inp} value={fullDayHours} onChange={e => setFullDayHours(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Default Grace Period (min)</label>
                <input type="number" min={0} max={180} style={inp} value={graceMinutes} onChange={e => setGraceMinutes(e.target.value)} />
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 14 }}>Overtime</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer', marginBottom: overtimeEnabled ? 14 : 0 }}>
              <input type="checkbox" checked={overtimeEnabled} onChange={e => setOvertimeEnabled(e.target.checked)} />
              Track overtime
            </label>
            {overtimeEnabled && (
              <div style={{ maxWidth: 260 }}>
                <label style={lbl}>Minimum minutes past shift-end to count as OT</label>
                <input type="number" min={0} style={inp} value={overtimeThresholdMinutes} onChange={e => setOvertimeThresholdMinutes(e.target.value)} />
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>Salary Deductions</div>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 0, marginBottom: 14 }}>
              % of one day&apos;s pay deducted per occurrence beyond the free allowance — applied automatically when Payroll is generated.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Status', 'Deduction %', 'Free Allowed / Month'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: '#1e293b' }}>Late</td>
                  <td style={{ padding: '10px 12px' }}><input type="number" min={0} max={100} step="0.5" style={{ ...inp, width: 100 }} value={lateDeductionPercent} onChange={e => setLateDeductionPercent(e.target.value)} /></td>
                  <td style={{ padding: '10px 12px' }}><input type="number" min={0} max={31} style={{ ...inp, width: 100 }} value={freeLateAllowed} onChange={e => setFreeLateAllowed(e.target.value)} /></td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: '#1e293b' }}>Half Day</td>
                  <td style={{ padding: '10px 12px' }}><input type="number" min={0} max={100} step="0.5" style={{ ...inp, width: 100 }} value={halfDayDeductionPercent} onChange={e => setHalfDayDeductionPercent(e.target.value)} /></td>
                  <td style={{ padding: '10px 12px' }}><input type="number" min={0} max={31} style={{ ...inp, width: 100 }} value={freeHalfDayAllowed} onChange={e => setFreeHalfDayAllowed(e.target.value)} /></td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: '#1e293b' }}>Absent</td>
                  <td style={{ padding: '10px 12px' }}><input type="number" min={0} max={100} step="0.5" style={{ ...inp, width: 100 }} value={absentDeductionPercent} onChange={e => setAbsentDeductionPercent(e.target.value)} /></td>
                  <td style={{ padding: '10px 12px' }}><input type="number" min={0} max={31} style={{ ...inp, width: 100 }} value={freeAbsentAllowed} onChange={e => setFreeAbsentAllowed(e.target.value)} /></td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: '#1e293b' }}>Off Day</td>
                  <td style={{ padding: '10px 12px' }}><input type="number" min={0} max={100} step="0.5" style={{ ...inp, width: 100 }} value={offDayDeductionPercent} onChange={e => setOffDayDeductionPercent(e.target.value)} /></td>
                  <td style={{ padding: '10px 12px' }}><input type="number" min={0} max={31} style={{ ...inp, width: 100 }} value={freeOffDayAllowed} onChange={e => setFreeOffDayAllowed(e.target.value)} /></td>
                </tr>
              </tbody>
            </table>
          </div>

          {canEdit && (
            <SubmitButton loading={saving} loadingText="Saving…" style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600 }}>
              Save Policy
            </SubmitButton>
          )}
        </form>
        </fieldset>
      </div>
    </DashboardLayout>
  );
}
