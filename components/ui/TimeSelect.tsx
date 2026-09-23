'use client';
import { inp } from '@/components/admin/projects/shared';

interface TimeSelectProps {
  value: string; // "HH:MM" 24-hour, same format native <input type="time"> uses
  onChange: (value: string) => void;
  required?: boolean;
  minuteStep?: number; // default 5 — plenty of precision for shift timing, far fewer options to scroll through than every minute
  // Shows a small "Clear" button when a value is set. Off by default (the
  // dropdowns always display *some* time once touched, unlike a native
  // input which can go blank) — turn on wherever going back to "no time
  // set" is a real action, e.g. undoing a check-out during a correction.
  allowClear?: boolean;
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12

// Three plain <select> dropdowns (Hour / Minute / AM-PM) in place of the
// native <input type="time">, which on this app's target browsers requires
// clicking tiny individual segments (hour, then minute, then AM/PM) and is
// easy to mis-click — dropdowns are simpler to operate reliably. Still
// stores/emits "HH:MM" 24-hour, so every existing caller (Shift forms, etc.)
// needs no other changes.
export default function TimeSelect({ value, onChange, required, minuteStep = 5, allowClear }: TimeSelectProps) {
  const minutes = Array.from({ length: 60 / minuteStep }, (_, i) => i * minuteStep);

  let hour24 = 9;
  let minute = 0;
  if (value) {
    const [h, m] = value.split(':').map(Number);
    if (!Number.isNaN(h)) hour24 = h;
    if (!Number.isNaN(m)) minute = m;
  }
  const isPM = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const emit = (nextHour12: number, nextMinute: number, nextIsPM: boolean) => {
    let next24 = nextHour12 % 12;
    if (nextIsPM) next24 += 12;
    onChange(`${String(next24).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`);
  };

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <select
        style={{ ...inp, width: 'auto', flex: 1 }}
        value={hour12}
        onChange={e => emit(Number(e.target.value), minute, isPM)}
        required={required}
      >
        {HOURS_12.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <select
        style={{ ...inp, width: 'auto', flex: 1 }}
        value={minute}
        onChange={e => emit(hour12, Number(e.target.value), isPM)}
        required={required}
      >
        {minutes.map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
      </select>
      <select
        style={{ ...inp, width: 'auto', flex: '0 0 68px' }}
        value={isPM ? 'PM' : 'AM'}
        onChange={e => emit(hour12, minute, e.target.value === 'PM')}
        required={required}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
      {allowClear && value && (
        <button
          type="button"
          onClick={() => onChange('')}
          title="Clear"
          style={{ flex: '0 0 auto', padding: '0 10px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
