import api from '@/lib/axios';

/**
 * Company Admin > Settings > Storage.
 *
 * Company Admin ONLY — there is no staff-guard (`/user/storage/*`)
 * counterpart at all (see App\Http\Controllers\Api\Admin\StorageController's
 * class note), so this service only ever calls the `/admin/*` prefix,
 * unlike most other services in this app that switch prefix by auth type.
 */

export type StorageWarningLevel = 'normal' | 'high' | 'critical' | 'full';

export interface StorageStatus {
  limit_bytes: number;
  limit_mb: number;
  used_bytes: number;
  remaining_bytes: number;
  used_percentage: number;
  is_full: boolean;
  warning_level: StorageWarningLevel;
  drive: { connected: boolean; email: string | null; status: string | null };
}

export interface StorageBreakdownRow {
  label: string;
  internal_bytes: number;
  drive_bytes: number;
  total_bytes: number;
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

/** The connected Google account's REAL storage quota — null until Drive is connected. */
export interface DriveQuota {
  connected: boolean;
  unlimited: boolean;
  total_bytes: number | null;
  used_bytes: number;
  available_bytes: number | null;
  used_percentage: number | null;
  last_synced_at: string | null;
  warning_level: StorageWarningLevel;
  stale: boolean;
}

export interface StorageOverview {
  requires_company_selection: boolean;
  company_id?: number;
  storage?: StorageStatus;
  breakdown?: StorageBreakdownRow[];
  drive?: DriveSummary;
  drive_quota?: DriveQuota | null;
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

  /** The "Refresh Storage" button — forces a live re-fetch past the passive cache window. */
  refreshQuota: async (): Promise<{ drive_quota: DriveQuota }> =>
    (await api.post('/admin/storage/google-drive/refresh')).data.data,
};

/** Bytes → "7.8 MB", the format every INTERNAL (small, MB-scale) storage figure in this UI uses. */
export const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
};

/**
 * Bytes → "850 MB" / "7.4 GB" / "1.2 TB" — auto-picks the unit, for
 * GB-scale figures (the real Google Drive account quota, and breakdown
 * totals once files have moved to Drive) where a fixed-MB format would read
 * as an unreadable 5-6 digit number.
 */
export const formatStorageAuto = (bytes: number): string => {
  if (bytes <= 0) return '0 MB';
  const units: Array<[number, string]> = [[1024 ** 4, 'TB'], [1024 ** 3, 'GB'], [1024 ** 2, 'MB']];
  for (const [factor, unit] of units) {
    if (bytes >= factor) {
      const value = bytes / factor;
      return `${value.toFixed(value < 10 ? 1 : 0)} ${unit}`;
    }
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
};
