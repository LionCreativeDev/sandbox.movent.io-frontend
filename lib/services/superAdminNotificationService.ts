import api from '@/lib/axios';

// The Super Admin's bell. Platform-level events only — the server decides
// what qualifies (App\Services\SuperAdminNotificationService::TYPES) and
// filters the feed to it, so nothing here needs to know the list.

export type SuperAdminNotificationCategory =
  | 'accounts' | 'companies' | 'payments' | 'subscriptions'
  | 'system' | 'compliance' | 'support';

export interface SuperAdminNotification {
  id: number;
  type: string;
  category: SuperAdminNotificationCategory | null;
  category_label: string | null;
  title: string | null;
  body: string | null;
  /** Null for events that belong to no single tenant (a new account, a payment). */
  company_id: number | null;
  company_name: string | null;
  is_read: boolean;
  created_at: string;
  link: string | null;
}

export interface SuperAdminNotificationCategoryCount {
  key: SuperAdminNotificationCategory;
  label: string;
  unread: number;
}

export interface SuperAdminNotificationIndex {
  notifications: SuperAdminNotification[];
  unread_count: number;
  categories: SuperAdminNotificationCategoryCount[];
}

const list = async (category?: string): Promise<SuperAdminNotificationIndex> => {
  const res = await api.get('/super-admin/notifications', {
    params: category ? { category } : {},
  });
  return res.data.data;
};

const unreadCount = async (): Promise<number> => {
  const res = await api.get('/super-admin/notifications/unread-count');
  return res.data.data.unread_count;
};

const markRead     = async (id: number): Promise<void> => { await api.patch(`/super-admin/notifications/${id}/read`); };
const markAllRead  = async (): Promise<void> => { await api.patch('/super-admin/notifications/read-all'); };
const clear        = async (id: number): Promise<void> => { await api.delete(`/super-admin/notifications/${id}`); };
const clearAll     = async (): Promise<void> => { await api.delete('/super-admin/notifications'); };

export const superAdminNotificationService = {
  list, unreadCount, markRead, markAllRead, clear, clearAll,
};
