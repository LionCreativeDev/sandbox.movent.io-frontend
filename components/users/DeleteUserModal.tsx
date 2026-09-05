'use client';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { userService } from '@/lib/services/userService';
import { ROLE_LABELS } from '@/lib/roleUtils';
import { UserDeleteImpact, UserImpactSection } from '@/types';

// Impact Summary for removing a person. Two modes, one screen:
//
//   'unassign' — take them off this one company. Their account survives.
//   'delete'   — destroy the account itself. Irreversible, and much wider:
//                every CASCADE listed in App\Services\UserDeletionService
//                goes with them.
//
// Both show the same thing first, because both leave work behind that
// somebody else has to pick up. Reassignment is offered before either, and a
// delete with active work still on their plate needs an explicit override.

const errorMessage = (err: unknown, fallback: string) => {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return fallback;
};

// Buckets the backend can reassign, in the order they're offered.
const BUCKETS: { key: string; label: string; hint: string }[] = [
  { key: 'projects',        label: 'Projects',        hint: 'Both the projects they manage and the ones they sell' },
  { key: 'leads',           label: 'Leads',           hint: 'Every lead currently assigned to them' },
  { key: 'tasks',           label: 'Tasks',           hint: 'Tasks assigned to them across this company' },
  { key: 'clients',         label: 'Clients',         hint: 'Clients they are the account manager for' },
  { key: 'support_tickets', label: 'Support tickets', hint: 'Tickets currently assigned to them' },
  { key: 'team',            label: 'Team resources',  hint: 'Their seats on project teams' },
];

const ON_DELETE_TEXT: Record<UserImpactSection['on_delete'], { text: string; bg: string; color: string }> = {
  unassigned: { text: 'Record stays, loses them', bg: '#f1f5f9', color: '#475569' },
  deleted:    { text: 'Deleted with the account', bg: '#fef2f2', color: '#b91c1c' },
};

function SectionCard({ section }: { section: UserImpactSection }) {
  const tag = ON_DELETE_TEXT[section.on_delete];
  const blocking = section.blocking_count > 0;

  return (
    <div style={{
      border: `1px solid ${blocking ? '#fecaca' : '#f1f5f9'}`, borderRadius: 10,
      padding: '11px 13px', background: blocking ? '#fffbfb' : '#fff',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{section.label}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: blocking ? '#dc2626' : '#1e293b' }}>
          {section.total}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
          background: tag.bg, color: tag.color,
        }}>{tag.text}</span>
        {blocking && (
          <span style={{
            fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: '#fef2f2', color: '#b91c1c',
          }}>{section.blocking_count} need reassigning</span>
        )}
      </div>

      {section.note && (
        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6 }}>{section.note}</div>
      )}

      {section.items.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          {section.items.map(item => (
            <span key={`${section.key}-${item.id}`} style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 6,
              background: '#f8fafc', border: '1px solid #f1f5f9', color: '#334155',
            }}>
              {item.name}
              {item.meta && <span style={{ color: '#94a3b8' }}> · {item.meta.replace(/_/g, ' ')}</span>}
            </span>
          ))}
          {section.more > 0 && (
            <span style={{ fontSize: 11, padding: '3px 8px', color: '#94a3b8' }}>
              +{section.more} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function DeleteUserModal({
  userId,
  userName,
  companyId,
  mode,
  onCancel,
  onDone,
}: {
  userId: number;
  userName: string;
  /** Company the impact is measured against. Backend resolves one if omitted. */
  companyId?: number;
  /** 'delete' destroys the account; 'unassign' only removes this company. */
  mode: 'delete' | 'unassign';
  onCancel: () => void;
  onDone: () => void;
}) {
  const [impact, setImpact] = useState<UserDeleteImpact | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'reassign' | 'confirm' | null>(null);
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [override, setOverride] = useState(false);

  // State is only touched in the promise callbacks — `loading` already starts
  // true, so nothing is set synchronously inside the effect body.
  useEffect(() => {
    let cancelled = false;
    userService.deleteImpact(userId, companyId)
      .then(data => { if (!cancelled) setImpact(data); })
      .catch(err => {
        if (cancelled) return;
        toast.error(errorMessage(err, 'Failed to load this user’s impact summary'));
        onCancel();
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  // Only offer a bucket that actually has something in it, so the admin isn't
  // picking a recipient for work that doesn't exist.
  const offeredBuckets = useMemo(() => {
    if (!impact) return [];
    const live = new Set(
      impact.sections.filter(s => s.total > 0 && s.reassign_key).map(s => s.reassign_key as string),
    );
    return BUCKETS.filter(b => live.has(b.key));
  }, [impact]);

  const blockers = impact?.blockers ?? [];
  const isDelete = mode === 'delete';
  const hardBlocked = isDelete && impact ? !impact.can_delete : false;
  const needsOverride = isDelete && blockers.length > 0 && !override;

  const applyReassign = async () => {
    const chosen = Object.fromEntries(Object.entries(targets).filter(([, v]) => v));
    if (Object.keys(chosen).length === 0) {
      toast.error('Pick who should take over at least one of these.');
      return;
    }
    setBusy('reassign');
    try {
      const res = await userService.reassign(userId, companyId, chosen);
      const moved = Object.values(res.moved).reduce((a, b) => a + b, 0);
      toast.success(`${moved} record${moved === 1 ? '' : 's'} reassigned`);
      setImpact(res.impact);
      setTargets({});
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to reassign'));
    } finally {
      setBusy(null);
    }
  };

  const confirm = async () => {
    setBusy('confirm');
    try {
      if (isDelete) {
        await userService.deletePermanently(userId, companyId, blockers.length > 0);
        toast.success(`"${userName}" permanently deleted`);
      } else {
        await userService.remove(userId, companyId);
        toast.success(`"${userName}" removed from this company`);
      }
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, isDelete ? 'Failed to delete user' : 'Failed to remove user'));
      setBusy(null);
    }
  };

  const u = impact?.user;
  const roleLabel = u ? (u.custom_role_label || ROLE_LABELS[u.role_type] || u.role_type) : '';

  return (
    <div
      onClick={() => { if (!busy) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, width: '100%', maxWidth: 720,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
        }}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 12, padding: '20px 24px 14px', borderBottom: '1px solid #f1f5f9',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
              {isDelete ? 'Delete user account' : 'Remove user from company'}
            </h3>
            <p style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0 0' }}>
              {isDelete
                ? 'Everything below is affected. Hand the active work over first, or confirm you want it left unassigned.'
                : 'They keep their account, but lose access to this company. Their work here is listed below.'}
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={!!busy}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', fontSize: 22, color: '#94a3b8',
              cursor: busy ? 'not-allowed' : 'pointer', lineHeight: 1, padding: 0,
            }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {loading || !impact || !u ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              Working out what this user holds…
            </div>
          ) : (
            <>
              {/* Identity */}
              <div style={{
                border: '1px solid #f1f5f9', borderRadius: 10, padding: '12px 14px',
                background: '#f8fafc', marginBottom: 16,
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                  {[
                    ['Name', u.name],
                    ['Email', u.email],
                    ['Role', roleLabel],
                    ['Company', u.company_name ?? '—'],
                    ['Account status', u.status],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.7 }}>{label}</div>
                      <div style={{ fontSize: 12.5, color: '#1e293b', fontWeight: 600, marginTop: 2, wordBreak: 'break-word' }}>{value}</div>
                    </div>
                  ))}
                </div>
                {u.companies.length > 1 && (
                  <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 10, fontWeight: 600 }}>
                    Also belongs to {u.companies.filter(c => c.id !== u.company_id).map(c => c.name).join(', ')}
                    {isDelete && ' — deleting the account removes them there too.'}
                  </div>
                )}
              </div>

              {/* Role-specific breakdown */}
              {impact.role_extra && impact.role_extra.rows.some(r => r.value > 0) && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 7 }}>
                    As a {roleLabel}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                    {impact.role_extra.rows.map(r => (
                      <div key={r.label} style={{ border: '1px solid #f1f5f9', borderRadius: 9, padding: '9px 11px' }}>
                        <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{r.value}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{r.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked records */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 7 }}>
                Linked records
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {impact.sections.filter(s => s.total > 0).length === 0 ? (
                  <div style={{ fontSize: 12.5, color: '#059669', border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 10, padding: '11px 13px' }}>
                    Nothing is linked to this user in this company — no dependencies to hand over.
                  </div>
                ) : (
                  impact.sections.filter(s => s.total > 0).map(s => <SectionCard key={s.key} section={s} />)
                )}
              </div>

              {/* Reassignment */}
              {offeredBuckets.length > 0 && (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '13px 14px', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Reassign before removing</div>
                  <div style={{ fontSize: 11.5, color: '#64748b', margin: '3px 0 11px' }}>
                    Pick who takes over. Anything you leave blank stays as it is.
                  </div>

                  {impact.candidates.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '9px 11px' }}>
                      No other active user in this company can take this over. Add or activate someone first,
                      or continue and leave these records unassigned.
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {offeredBuckets.map(b => (
                          <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ minWidth: 150, flex: '1 1 150px' }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{b.label}</div>
                              <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{b.hint}</div>
                            </div>
                            <select
                              value={targets[b.key] ?? ''}
                              onChange={e => setTargets(t => ({ ...t, [b.key]: Number(e.target.value) || 0 }))}
                              style={{
                                flex: '1 1 200px', padding: '7px 10px', borderRadius: 8,
                                border: '1.5px solid #e2e8f0', fontSize: 12.5, color: '#1e293b', background: '#fff',
                              }}>
                              <option value="">Leave unassigned</option>
                              {impact.candidates.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name} — {ROLE_LABELS[c.role_type] || c.role_type}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={applyReassign}
                        disabled={!!busy}
                        style={{
                          marginTop: 12, padding: '8px 16px', borderRadius: 8, border: 'none',
                          background: '#2563eb', color: '#fff', fontSize: 12.5, fontWeight: 600,
                          cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
                        }}>
                        {busy === 'reassign' ? 'Reassigning…' : 'Reassign selected'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Outstanding work / warning */}
              {hardBlocked ? (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#b45309', marginBottom: 4 }}>
                    This account can’t be deleted from here
                  </div>
                  <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>{impact.block_reason}</div>
                </div>
              ) : blockers.length > 0 ? (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#b91c1c', marginBottom: 6 }}>
                    Still holding active work
                  </div>
                  <ul style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 12, color: '#dc2626', lineHeight: 1.7 }}>
                    {blockers.map(b => (
                      <li key={b.key}><strong>{b.count}</strong> — {b.label}</li>
                    ))}
                  </ul>
                  <div style={{ fontSize: 12, color: '#dc2626', lineHeight: 1.5 }}>
                    Reassign these above so someone picks them up.
                    {isDelete && ' Deleting anyway leaves them with nobody assigned.'}
                  </div>
                  {isDelete && (
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={override}
                        onChange={e => setOverride(e.target.checked)}
                        style={{ marginTop: 2 }}
                      />
                      <span style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>
                        Delete anyway — I understand this work will be left unassigned.
                      </span>
                    </label>
                  )}
                </div>
              ) : (
                <div style={{
                  background: isDelete ? '#fef2f2' : '#f8fafc',
                  border: `1px solid ${isDelete ? '#fecaca' : '#e2e8f0'}`,
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: isDelete ? '#b91c1c' : '#334155', marginBottom: 4 }}>
                    {isDelete
                      ? 'This permanently deletes the account and cannot be undone.'
                      : 'They lose access to this company immediately.'}
                  </div>
                  <div style={{ fontSize: 12, color: isDelete ? '#dc2626' : '#64748b', lineHeight: 1.5 }}>
                    {isDelete
                      ? 'Their login, timesheets, team memberships, chat participation, notifications and uploaded folder files go with it. Projects, tasks, invoices and chat messages stay, but no longer show their name.'
                      : 'Their account and everything they authored stay exactly as they are.'}
                  </div>
                </div>
              )}

              <p style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b', margin: '14px 0 0' }}>
                {isDelete ? 'Permanently delete ' : 'Remove '}
                <span style={{ color: '#dc2626' }}>&ldquo;{u.name}&rdquo;</span>
                {isDelete ? '?' : ' from this company?'}
              </p>
            </>
          )}
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          padding: '14px 24px 20px', borderTop: '1px solid #f1f5f9',
        }}>
          <button
            onClick={onCancel}
            disabled={!!busy}
            style={{
              padding: '9px 18px', borderRadius: 8, border: '1.5px solid #e2e8f0',
              background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
            }}>Cancel</button>
          <button
            onClick={confirm}
            disabled={loading || !!busy || !impact || hardBlocked || needsOverride}
            title={needsOverride ? 'Reassign the active work above, or tick “Delete anyway”.' : undefined}
            style={{
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer',
              opacity: loading || !!busy || hardBlocked || needsOverride ? 0.5 : 1,
            }}>
            {busy === 'confirm'
              ? (isDelete ? 'Deleting…' : 'Removing…')
              : (isDelete ? 'Delete Anyway' : 'Remove from company')}
          </button>
        </div>
      </div>
    </div>
  );
}
