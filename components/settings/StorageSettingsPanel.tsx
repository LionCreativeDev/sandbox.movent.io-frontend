'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { storageService, formatBytes, formatStorageAuto, StorageOverview, StorageWarningLevel } from '@/lib/services/storageService';
import { useDriveOAuthResult } from '@/hooks/useDriveOAuthResult';

const card: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden', marginBottom: 20 };
const cardHead: React.CSSProperties = { padding: '16px 24px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' };
const cardBody: React.CSSProperties = { padding: 24 };

/** Normal/High/Critical/Full → bar + text color, shared by both the internal and the real Drive quota cards. */
const warningColor = (level: StorageWarningLevel): string =>
  level === 'full' ? '#dc2626' : level === 'critical' ? '#ea580c' : level === 'high' ? '#d97706' : '#2563eb';

const warningMessage = (level: StorageWarningLevel): string | null => {
  if (level === 'full') return 'Storage is full. New uploads here will be refused until space is freed or Drive is connected.';
  if (level === 'critical') return 'Very little storage remains.';
  if (level === 'high') return 'Storage usage is approaching the limit.';
  return null;
};

// "3m ago" / "2h ago" / "5d ago" — same small local convention already used
// in app/client/layout.tsx, not worth extracting for one more caller.
function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Company Admin > Settings > Storage.
 *
 * Company Admin only — this panel is rendered by app/settings/page.tsx only
 * when !isStaff, matching the backend, which has no staff-guard route for
 * any of this at all (Api\Admin\StorageController's class note).
 *
 * The OAuth round trip is a full page navigation (Google, then back) — this
 * page's own Connect/Change Account buttons never pass a `return_to`
 * (there is nowhere more specific for THEM to return to than here), so the
 * backend's default lands back on exactly this tab; useDriveOAuthResult()
 * reads the one-time `?drive=connected|error&reason=…` result off that
 * landing and shows the outcome, same as every other page that can be an
 * OAuth return destination — see components/storage/StorageLimitModal for
 * the one that passes an explicit return_to.
 */
export default function StorageSettingsPanel() {
  const [data, setData] = useState<StorageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState<'connect' | 'change' | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const load = () => {
    setLoading(true);
    storageService.show()
      .then(setData)
      .catch(() => toast.error('Failed to load storage settings'))
      .finally(() => setLoading(false));
  };

  useDriveOAuthResult(load);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const startConnect = async () => {
    setConnecting(true);
    try {
      const { url } = await storageService.connectUrl();
      window.location.href = url;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(msg ?? 'Could not start Google Drive connection');
      setConnecting(false);
    }
  };

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      const { drive_quota } = await storageService.refreshQuota();
      setData(prev => (prev ? { ...prev, drive_quota } : prev));
      toast.success('Storage refreshed');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(msg ?? 'Could not refresh storage');
    } finally {
      setRefreshing(false);
    }
  };

  const doDisconnect = async () => {
    setDisconnecting(true);
    try {
      await storageService.disconnect();
      toast.success('Google Drive disconnected');
      setShowDisconnectConfirm(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(msg ?? 'Could not disconnect Google Drive');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return <div style={{ ...card, ...cardBody, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>;
  }

  if (!data || data.requires_company_selection) {
    return (
      <div style={card}>
        <div style={cardBody}>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Storage belongs to one company. Pick a single company in the company filter at the top to view its storage.
          </p>
        </div>
      </div>
    );
  }

  const s = data.storage!;
  const drive = data.drive!;
  const driveQuota = data.drive_quota ?? null;
  const barColor = warningColor(s.warning_level);
  const internalWarning = warningMessage(s.warning_level);

  return (
    <>
      {/* Internal Storage */}
      <div style={card}>
        <div style={cardHead}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Internal Storage</div>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
            Every attachment uploaded across projects, comments, tasks, documents and deliveries
          </p>
        </div>
        <div style={cardBody}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
              {formatBytes(s.used_bytes)} <span style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8' }}>/ {s.limit_mb} MB used</span>
            </span>
            <span style={{ fontSize: 12, color: s.is_full ? '#dc2626' : '#94a3b8', fontWeight: s.is_full ? 700 : 400 }}>
              {s.is_full ? 'Full' : `Remaining: ${formatBytes(s.remaining_bytes)}`}
            </span>
          </div>
          <div style={{ height: 10, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${s.used_percentage}%`, background: barColor, borderRadius: 6, transition: 'width .3s' }} />
          </div>
          {internalWarning && (s.is_full ? !drive.connected : true) && (
            <div style={{
              marginTop: 16, padding: '12px 16px', borderRadius: 10,
              background: s.is_full ? '#fef2f2' : '#fffbeb',
              border: `1px solid ${s.is_full ? '#fecaca' : '#fde68a'}`,
              color: s.is_full ? '#991b1b' : '#92400e', fontSize: 13, lineHeight: 1.6,
            }}>
              {s.is_full
                ? 'Your company storage limit has been reached. New uploads across the CRM will be refused until you connect Google Drive or free up space.'
                : internalWarning}
            </div>
          )}
        </div>
      </div>

      {/* Google Drive */}
      <div style={card}>
        <div style={cardHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>📁</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Google Drive</div>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
            Once internal storage is full, new attachments automatically go here instead
          </p>
        </div>
        <div style={cardBody}>
          {!data.drive_configured ? (
            <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
              Google Drive is not configured on this server yet. Ask your platform administrator to set it up.
            </p>
          ) : drive.status === 'connected' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>Connected</span>
              </div>
              <Row label="Connected account" value={drive.email ?? '—'} />
              <Row label="Connected since" value={drive.connected_at ? new Date(drive.connected_at).toLocaleDateString('en-GB') : '—'} />
              <p style={{ fontSize: 11.5, color: '#94a3b8', margin: '12px 0 18px', lineHeight: 1.6 }}>
                This is your company&apos;s own storage integration — the connected Google account does not need to
                match any CRM login.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowAccountPicker('change')} style={btn('ghost')}>Change Google Account</button>
                <button onClick={() => setShowDisconnectConfirm(true)} style={btn('danger')}>Disconnect</button>
              </div>
            </>
          ) : drive.status === 'error' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ea580c' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#ea580c' }}>Needs reconnecting</span>
              </div>
              <p style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 14 }}>
                {drive.last_error ?? 'Google Drive access could not be refreshed.'} New uploads are using internal
                storage until this is fixed.
              </p>
              <button onClick={() => setShowAccountPicker('connect')} style={btn('primary')}>Reconnect Google Drive</button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#cbd5e1' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>Not Connected</span>
              </div>
              <button onClick={() => setShowAccountPicker('connect')} style={btn('primary')}>Connect Google Drive</button>
            </>
          )}
        </div>
      </div>

      {/* Google Drive Storage — the account's REAL quota (Google's own
          about.storageQuota), only meaningful once actually connected. */}
      {driveQuota && (
        <div style={card}>
          <div style={cardHead}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Google Drive Storage</div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                  The connected Google account&apos;s real storage — across Drive, Gmail and Photos combined
                </p>
              </div>
              <button onClick={doRefresh} disabled={refreshing} style={{ ...btn('ghost'), padding: '7px 14px', opacity: refreshing ? 0.6 : 1 }}>
                {refreshing ? 'Refreshing…' : 'Refresh Storage'}
              </button>
            </div>
          </div>
          <div style={cardBody}>
            {driveQuota.unlimited ? (
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                {formatStorageAuto(driveQuota.used_bytes)} used <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>— Unlimited plan</span>
              </p>
            ) : driveQuota.total_bytes ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                    {formatStorageAuto(driveQuota.used_bytes)} <span style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8' }}>/ {formatStorageAuto(driveQuota.total_bytes)} used</span>
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    {driveQuota.used_percentage}% used
                    {driveQuota.available_bytes !== null && ` · Available: ${formatStorageAuto(driveQuota.available_bytes)}`}
                  </span>
                </div>
                <div style={{ height: 10, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${driveQuota.used_percentage ?? 0}%`, background: warningColor(driveQuota.warning_level), borderRadius: 6, transition: 'width .3s' }} />
                </div>
                {warningMessage(driveQuota.warning_level) && (
                  <div style={{ marginTop: 14, fontSize: 12.5, color: warningColor(driveQuota.warning_level), fontWeight: 600 }}>
                    {warningMessage(driveQuota.warning_level)}
                  </div>
                )}
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>Fetching storage details…</p>
            )}
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#94a3b8' }}>
              <span>{driveQuota.stale && driveQuota.last_synced_at ? 'Could not refresh just now — showing last known values.' : ' '}</span>
              <span>{driveQuota.last_synced_at ? `Last synced: ${timeAgo(driveQuota.last_synced_at)}` : ''}</span>
            </div>
          </div>
        </div>
      )}

      {/* Breakdown */}
      {data.breakdown && data.breakdown.some(r => r.internal_files > 0 || r.drive_files > 0) && (
        <div style={card}>
          <div style={cardHead}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Files by Location</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Location', 'File Count', 'Total Size', 'Internal Size', 'Google Drive Files'].map(h => (
                    <th key={h} style={{ padding: '10px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.breakdown.filter(r => r.internal_files > 0 || r.drive_files > 0).map(r => (
                  <tr key={r.label} style={{ borderTop: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px 24px', fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{r.label}</td>
                    <td style={{ padding: '10px 24px', fontSize: 13, color: '#475569' }}>{r.internal_files + r.drive_files}</td>
                    <td style={{ padding: '10px 24px', fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{formatStorageAuto(r.total_bytes)}</td>
                    <td style={{ padding: '10px 24px', fontSize: 13, color: '#475569' }}>{formatBytes(r.internal_bytes)} ({r.internal_files})</td>
                    <td style={{ padding: '10px 24px', fontSize: 13, color: '#475569' }}>{r.drive_files}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAccountPicker && (
        <AccountPickerModal
          mode={showAccountPicker}
          connecting={connecting}
          onCancel={() => setShowAccountPicker(null)}
          onContinue={() => { setShowAccountPicker(null); startConnect(); }}
        />
      )}

      {showDisconnectConfirm && (
        <ConfirmModal
          title="Disconnect Google Drive?"
          body="Existing files already stored in Google Drive will remain there and keep working in the CRM. New uploads will go back to internal storage — and will be refused again once that fills up, until Google Drive is reconnected."
          confirmLabel={disconnecting ? 'Disconnecting…' : 'Disconnect'}
          disabled={disconnecting}
          danger
          onCancel={() => setShowDisconnectConfirm(false)}
          onConfirm={doDisconnect}
        />
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ color: '#0f172a', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function btn(variant: 'primary' | 'ghost' | 'danger'): React.CSSProperties {
  const base: React.CSSProperties = { padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
  if (variant === 'primary') return { ...base, border: 'none', background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff' };
  if (variant === 'danger') return { ...base, border: '1.5px solid #fecaca', background: '#fff', color: '#dc2626' };
  return { ...base, border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569' };
}

/**
 * "Which Google account would you like to use for company file storage?" —
 * the step the spec requires BEFORE the OAuth redirect, so it is never
 * mistaken for the CRM Company Admin's own login: this Drive account
 * belongs to the company's storage integration and can be any Google
 * account, picked from Google's own account chooser on the next screen.
 */
function AccountPickerModal({ mode, connecting, onCancel, onContinue }: {
  mode: 'connect' | 'change'; connecting: boolean; onCancel: () => void; onContinue: () => void;
}) {
  return (
    <Overlay onCancel={onCancel}>
      <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
        Which Google account would you like to use for company file storage?
      </h3>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
        You can connect your current Google account or use a different one — it does not need to match your
        Company Admin login. This Google Drive will be used to store your company&apos;s CRM attachments once
        internal storage is full.
        {mode === 'change' && (
          <> Files already uploaded to your current Google Drive account will stay exactly where they are.</>
        )}
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onCancel} style={btn('ghost')}>Cancel</button>
        <button onClick={onContinue} disabled={connecting} style={{ ...btn('primary'), opacity: connecting ? 0.6 : 1 }}>
          {connecting ? 'Redirecting…' : 'Continue with Google'}
        </button>
      </div>
    </Overlay>
  );
}

function ConfirmModal({ title, body, confirmLabel, danger, disabled, onCancel, onConfirm }: {
  title: string; body: string; confirmLabel: string; danger?: boolean; disabled?: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <Overlay onCancel={onCancel}>
      <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{title}</h3>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{body}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onCancel} style={btn('ghost')}>Cancel</button>
        <button onClick={onConfirm} disabled={disabled} style={{ ...btn(danger ? 'danger' : 'primary'), opacity: disabled ? 0.6 : 1 }}>
          {confirmLabel}
        </button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onCancel }: { children: React.ReactNode; onCancel: () => void }) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, padding: 24, boxShadow: '0 20px 60px rgba(15,23,42,0.25)' }}>
        {children}
      </div>
    </div>
  );
}
