'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { getAuthType } from '@/lib/auth';
import { storageService } from '@/lib/services/storageService';

/**
 * The professional modal Section 10 asks for, shown when an upload is
 * refused for running out of company storage (errors.error_code ===
 * 'storage_limit_reached' — see App\Services\AttachmentStorageService::
 * errorResponse(), which every attachment upload endpoint in this app
 * returns identically).
 *
 * "Connect Google Drive" here starts OAuth DIRECTLY — it does not send the
 * admin to Settings as an intermediate step. Clicking it calls
 * storageService.connectUrl() with the CURRENT page (path + query string)
 * as return_to, then navigates the whole browser to the URL that comes
 * back; Auth\GoogleDriveConnectionController::callback() reads that same
 * return_to out of the OAuth state and sends the browser right back here
 * once authorization finishes — see useDriveOAuthResult(), which the
 * calling page uses to pick that landing back up.
 *
 * Only a Company Admin can actually connect Google Drive (Section 15), so a
 * staff member sees a message pointing them at their Company Admin instead
 * of a button that would just 403 — the modal always tells the truth about
 * what THIS viewer can do next.
 */
export default function StorageLimitModal({ onClose }: { onClose: () => void }) {
  const isAdmin = getAuthType() === 'admin';
  const [connecting, setConnecting] = useState(false);

  const connectNow = async () => {
    setConnecting(true);
    try {
      const returnTo = typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined;
      const { url } = await storageService.connectUrl(returnTo);
      window.location.href = url;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(msg ?? 'Could not start Google Drive connection');
      setConnecting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: 28, boxShadow: '0 24px 70px rgba(15,23,42,0.3)' }}
      >
        <div style={{ fontSize: 36, marginBottom: 14 }}>📦</div>
        <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Storage Limit Reached</h3>
        <p style={{ margin: '0 0 8px', fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>
          Your company has used all available internal attachment storage.
        </p>
        <p style={{ margin: '0 0 22px', fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>
          {isAdmin
            ? 'Connect Google Drive to continue uploading project files, comments, client attachments and other documents.'
            : 'Ask your Company Admin to connect Google Drive to continue uploading project files, comments, client attachments and other documents.'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            disabled={connecting}
            style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600, cursor: connecting ? 'default' : 'pointer' }}
          >
            Cancel
          </button>
          {isAdmin && (
            <button
              onClick={connectNow}
              disabled={connecting}
              style={{
                padding: '9px 18px', borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: connecting ? 'default' : 'pointer',
                opacity: connecting ? 0.7 : 1,
              }}
            >
              {connecting ? 'Redirecting to Google…' : 'Connect Google Drive'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** True when a failed upload's response is specifically "storage full". */
export const isStorageLimitError = (err: unknown): boolean =>
  (err as { response?: { data?: { errors?: { error_code?: string } } } })
    ?.response?.data?.errors?.error_code === 'storage_limit_reached';
