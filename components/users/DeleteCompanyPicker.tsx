'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { userService } from '@/lib/services/userService';
import { UserCompanyWorkload } from '@/types';

// Step 1 of deleting a user who belongs to more than one company: which one
// are they being deleted from? The same question the Suspend flow asks, for
// the same reason — every number the Impact Summary is about to show is
// scoped to one company, so picking the wrong one shows the wrong picture.
//
// Each row carries what they are actually holding there, so the choice isn't
// made blind. The full breakdown comes next, in DeleteUserModal.

const errorMessage = (err: unknown, fallback: string) => {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return fallback;
};

function Pill({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return (
    <span style={{
      fontSize: 10.5, padding: '2px 7px', borderRadius: 20,
      background: '#fff7ed', color: '#c2410c', fontWeight: 600, whiteSpace: 'nowrap',
    }}>{value} {label}</span>
  );
}

export default function DeleteCompanyPicker({
  userId,
  userName,
  onPick,
  onCancel,
}: {
  userId: number;
  userName: string;
  onPick: (companyId: number, remainingCompanies: number) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<UserCompanyWorkload[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    userService.companyWorkload(userId)
      .then(data => { if (!cancelled) setRows(data); })
      .catch(err => {
        if (cancelled) return;
        toast.error(errorMessage(err, 'Failed to load this user’s companies'));
        onCancel();
      });
    return () => { cancelled = true; };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 520,
          maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
            Delete from which company?
          </h3>
          <button onClick={onCancel} aria-label="Close" style={{
            background: 'none', border: 'none', fontSize: 20, color: '#94a3b8', cursor: 'pointer', lineHeight: 1,
          }}>×</button>
        </div>
        <p style={{ fontSize: 12.5, color: '#64748b', margin: '0 0 16px' }}>
          <strong style={{ color: '#334155' }}>{userName}</strong> belongs to more than one company.
          Pick the one you are removing them from — you will see everything they hold there before
          anything is deleted.
        </p>

        {rows === null ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            Loading their companies…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map(row => {
              // Removing their last company ends the account itself, so the
              // row says so up front rather than surprising them at step two.
              const isLast = rows.length === 1;
              return (
                <button
                  key={row.company_id}
                  onClick={() => onPick(row.company_id, rows.length - 1)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    padding: '11px 14px', border: '1.5px solid #f1f5f9', borderRadius: 10,
                    background: '#fafafa', cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{row.company_name}</div>
                    <div style={{
                      fontSize: 11.5, marginTop: 2, fontWeight: 600,
                      color: row.status === 'active' ? '#059669' : '#dc2626',
                    }}>
                      {row.status === 'active' ? 'Active here' : 'Suspended here'}
                    </div>
                    {row.total === 0 ? (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>
                        Nothing assigned to them here
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        <Pill label="projects" value={row.projects} />
                        <Pill label="leads" value={row.leads} />
                        <Pill label="tasks" value={row.tasks} />
                        <Pill label="clients" value={row.clients} />
                        <Pill label="tickets" value={row.tickets} />
                        <Pill label="team seats" value={row.team} />
                      </div>
                    )}
                    {isLast && (
                      <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 6, fontWeight: 600 }}>
                        Their only company — removing it deletes the account
                      </div>
                    )}
                  </div>
                  <span style={{
                    flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#dc2626', whiteSpace: 'nowrap',
                  }}>Continue →</span>
                </button>
              );
            })}
          </div>
        )}

        <button onClick={onCancel} style={{
          marginTop: 16, width: '100%', padding: 10, background: '#fff', color: '#64748b',
          border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13.5, cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
