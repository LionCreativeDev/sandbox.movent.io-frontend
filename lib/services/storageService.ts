import api from '@/lib/axios';

/**
 * Company Admin > Settings > Storage.
 *
 * Company Admin ONLY — there is no staff-guard (`/user/storage/*`)
 * counterpart at all (see App\Http\Controllers\Api\Admin\StorageController's
 * class note), so this service only ever calls the `/admin/*` prefix,
 * unlike most other services in this app that switch prefix by auth type.
 */

export interface StorageStatus {
  limit_bytes: number;
  limit_mb: number;
  used_bytes: number;
  remaining_bytes: number;
  used_percentage: number;
  is_full: boolean;
  drive: { connected: boolean; email: string | null; status: string | null };
}

export interface StorageBreakdownRow {
  label: string;
  internal_bytes: number;
  internal_files: number;
  drive_files: number;
}

export interface DriveSummary {
  status: 'connected' | 'disconnected' | 'error';
  connected: boolean;
  email: string | null;
  connected_at: string | null;
  last_error: string | null;
}

export interface StorageOverview {
  requires_company_selection: boolean;
  company_id?: number;
  storage?: StorageStatus;
  breakdown?: StorageBreakdownRow[];
  drive?: DriveSummary;
  drive_configured?: boolean;
}

export const storageService = {
  show: async (): Promise<StorageOverview> => (await api.get('/admin/storage')).data.data,

  /**
   * $returnTo is the exact page to land back on once OAuth completes — pass
   * `window.location.pathname + window.location.search` from wherever
   * "Connect Google Drive" was clicked (an attachment upload, Settings,
   * anywhere) so the admin never has to renavigate there by hand. Omit it
   * only when there genuinely is nowhere better to return to (the backend
   * then falls back to Settings > Storage, same as before this existed).
   * Validated again server-side (App\Support\SafeReturnPath) — this is
   * never trusted on its own.
   */
  connectUrl: async (returnTo?: string): Promise<{ url: string }> =>
    (await api.get('/admin/storage/google-drive/connect-url', {
      params: returnTo ? { return_to: returnTo } : undefined,
    })).data.data,

  disconnect: async (): Promise<{ drive: DriveSummary }> =>
    (await api.post('/admin/storage/google-drive/disconnect')).data.data,
};

/** Bytes → "7.8 MB", the format every storage figure in this UI uses. */
export const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
};
