'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useModuleGuard } from '@/hooks/useModuleGuard';
import { adminHrService, AttendancePolicy } from '@/lib/services/adminHrService';
import { inp, lbl, card } from '@/components/admin/projects/shared';
import toast from 'react-hot-toast';
import SubmitButton from '@/components/ui/SubmitButton';

// Company-wide attendance rules: worked-hours thresholds, grace/overtime
// defaults, and the salary deduction % + free-allowance counts applied
// when Payroll is generated (see app/Services/AttendanceDeductionCalculator.php).
// One settings object per company — no list/CRUD, just a form.
export default function AttendancePolicyPage() {
  useModuleGuard('attendance');

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

  const load = () => {
    setLoading(true);
    adminHrService.attendance.policy.get().then((p: AttendancePolicy) => {
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
  };

  useEffect(load, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminHrService.attendance.policy.update({
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

  return (
    <DashboardLayout title="Attendance Policy">
      <div style={{ maxWidth: 800 }}>
        <div style={{ marginBottom: 20 }}>
          <Link href="/admin/attendance" style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>&larr; Back to Attendance</Link>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '8px 0 4px' }}>Attendance Policy</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Company-wide rules for worked-hours thresholds and salary deductions. Applies to every employee unless their own Shift overrides grace period.
          </p>
        </div>

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
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10, marginBottom: 0 }}>
              Worked hours below Half Day Minimum still counts as Present/Late (they showed up); between Half Day and Full Day Minimum → marked Half Day. Grace period here is the fallback for employees with no Shift assigned — each Shift can set its own.
            </p>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 14 }}>Overtime</div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: overtimeEnabled ? 14 : 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                <input type="checkbox" checked={overtimeEnabled} onChange={e => setOvertimeEnabled(e.target.checked)} />
                Track overtime
              </label>
            </div>
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
              % of one day&apos;s pay (Monthly Salary ÷ Working Days) deducted per occurrence beyond the free allowance — applied automatically when Payroll is generated for that month.
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
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10, marginBottom: 0 }}>
              Off Day is a non-working day (weekend) — its deduction normally stays 0% unless your company has an unusual policy.
            </p>
          </div>

          <SubmitButton loading={saving} loadingText="Saving…" style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600 }}>
            Save Policy
          </SubmitButton>
        </form>
      </div>
    </DashboardLayout>
  );
}
