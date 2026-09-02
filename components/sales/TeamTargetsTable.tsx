'use client';
import { useState } from 'react';
import { TeamSalesTarget } from '@/lib/services/salesExtrasService';
import { inp } from '@/components/admin/projects/shared';

interface Props {
  targets: TeamSalesTarget[];
  onSave: (userId: number, payload: { target_value?: number | null; target_deals?: number | null }) => Promise<void>;
  // Row role_types that show read-only (no Edit button) — e.g. a Lead
  // Manager's own "Team Targets" section passes ['lead_manager'] here,
  // since Api\User\SalesTargetController::updateForUser() only ever accepts
  // a Seller target anyway (a Lead Manager manages their own target via the
  // personal section above, and may never edit a peer Lead Manager's).
  // Company Admin's page (frontend/app/admin/sales/targets/page.tsx) omits
  // this — Admin may edit every row.
  readOnlyRoles?: string[];
}

// Shared between the Company Admin targets page (frontend/app/admin/sales/
// targets/page.tsx) and a Lead Manager's "Team Targets" section (frontend/
// app/sales/targets/page.tsx) — same table, same inline edit-per-row
// behavior, since Api\Admin\SalesTargetController and Api\User\
// SalesTargetController::team()/updateForUser() return/accept the identical
// shape (see TeamSalesTarget).
export default function TeamTargetsTable({ targets, onSave, readOnlyRoles = [] }: Props) {
  const [editing, setEditing] = useState<Record<number, { value: string; deals: string }>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const startEdit = (t: TeamSalesTarget) => {
    setEditing(e => ({
      ...e,
      [t.user_id]: {
        value: t.target_value != null ? String(t.target_value) : '',
        deals: t.target_deals != null ? String(t.target_deals) : '',
      },
    }));
  };

  const cancelEdit = (userId: number) => {
    setEditing(e => {
      const next = { ...e };
      delete next[userId];
      return next;
    });
  };

  const save = async (userId: number) => {
    const draft = editing[userId];
    if (!draft) return;
    setSaving(userId);
    try {
      await onSave(userId, {
        target_value: draft.value ? Number(draft.value) : null,
        target_deals: draft.deals ? Number(draft.deals) : null,
      });
      cancelEdit(userId);
    } finally {
      setSaving(null);
    }
  };

  if (targets.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No sellers yet.</div>;
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {['Name', 'Target Value', 'Target Deals', 'Achieved', 'Action'].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {targets.map(t => {
            const draft = editing[t.user_id];
            const readOnly = readOnlyRoles.includes(t.role_type);
            return (
              <tr key={t.user_id} style={{ borderBottom: '1px solid #f8fafc' }}>
                <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.user_name}</td>
                <td style={{ padding: '10px 16px' }}>
                  {draft ? (
                    <input
                      type="number" min={0} step="0.01" value={draft.value}
                      onChange={e => setEditing(ed => ({ ...ed, [t.user_id]: { ...ed[t.user_id], value: e.target.value } }))}
                      style={{ ...inp, width: 110, padding: '5px 8px' }}
                    />
                  ) : (
                    <span style={{ fontSize: 13, color: '#0f172a' }}>{t.target_value != null ? `$${t.target_value.toLocaleString()}` : '—'}</span>
                  )}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  {draft ? (
                    <input
                      type="number" min={0} value={draft.deals}
                      onChange={e => setEditing(ed => ({ ...ed, [t.user_id]: { ...ed[t.user_id], deals: e.target.value } }))}
                      style={{ ...inp, width: 80, padding: '5px 8px' }}
                    />
                  ) : (
                    <span style={{ fontSize: 13, color: '#0f172a' }}>{t.target_deals ?? '—'}</span>
                  )}
                </td>
                <td style={{ padding: '10px 16px', fontSize: 12, color: '#64748b' }}>
                  ${t.achieved_value.toLocaleString()} · {t.achieved_deals} deals
                </td>
                <td style={{ padding: '10px 16px' }}>
                  {draft ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => save(t.user_id)} disabled={saving === t.user_id}
                        style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: saving === t.user_id ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving === t.user_id ? 'not-allowed' : 'pointer' }}
                      >
                        {saving === t.user_id ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => cancelEdit(t.user_id)}
                        style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : readOnly ? (
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>View only</span>
                  ) : (
                    <button
                      onClick={() => startEdit(t)}
                      style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
