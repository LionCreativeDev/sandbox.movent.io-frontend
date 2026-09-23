'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const DRIVE_ERROR_MESSAGES: Record<string, string> = {
  authorization_denied: 'Google Drive connection was not completed. Please try again.',
  session_expired: 'That connection attempt expired. Please try again.',
  authorization_failed: 'Google Drive connection was not completed. Please try again.',
  no_refresh_token: 'Google did not grant lasting access. Please try connecting again and approve all requested permissions.',
};

/**
 * Call once, on mount, from ANY page that can be an OAuth `return_to`
 * destination — right now that is any page rendering a Google-Drive-aware
 * upload control (see components/storage/StorageLimitModal) plus
 * app/settings/page.tsx itself.
 *
 * Google Drive OAuth is a full browser round trip (Connect → accounts.
 * google.com → Auth\GoogleDriveConnectionController::callback() → back
 * here), so there is no in-memory state to restore — this hook's only job
 * is reading the one-time `?drive=connected|error&reason=…` result query
 * param the callback appended to whatever page it sent the browser back to,
 * showing the right toast, and stripping those params so a refresh doesn't
 * re-toast. Nothing to invalidate/refetch here: the page landed on is a
 * FRESH navigation (full page load), so every component on it already
 * mounts fresh and reads current data — see the class note on
 * Auth\GoogleDriveConnectionController for why that is what actually fixes
 * "reconnect not recognized" rather than a targeted cache-bust.
 *
 * Never used with next/navigation's useSearchParams() (which would force
 * every caller into a <Suspense> boundary for one one-time read) — reads
 * window.location directly instead, same pattern already established in
 * components/settings/StorageSettingsPanel.tsx.
 */
export function useDriveOAuthResult(onConnected?: () => void) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const drive = params.get('drive');
    if (!drive) return;

    if (drive === 'connected') {
      toast.success('Google Drive connected');
      onConnected?.();
    } else if (drive === 'error') {
      const reason = params.get('reason') ?? '';
      toast.error(DRIVE_ERROR_MESSAGES[reason] ?? 'Google Drive connection was not completed. Please try again.');
    }

    // Strip the one-time result params so a page refresh/bookmark never
    // re-shows the toast — keep every OTHER param (e.g. ?tab=documents)
    // exactly as the page already had it.
    params.delete('drive');
    params.delete('reason');
    const clean = params.toString();
    router.replace(clean ? `${window.location.pathname}?${clean}` : window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
