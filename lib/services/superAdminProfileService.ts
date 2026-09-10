import api from '@/lib/axios';

// The Super Admin's own account — password only.
//
// Name and email are read-only by design: login matches the submitted email
// against SUPER_ADMIN_EMAIL (see Api\Auth\SuperAdminAuthController), so
// changing it from the console would lock the account out.

export interface SuperAdminProfile {
  id: number;
  name: string;
  email: string;
  last_login_at: string | null;
  password_changed_at: string | null;
  /**
   * True while the account still signs in with SUPER_ADMIN_PASSWORD from the
   * environment. The first password change here turns it off for good.
   */
  uses_env_password: boolean;
  email_locked: boolean;
}

export interface ChangePasswordPayload {
  current_password: string;
  password: string;
  password_confirmation: string;
}

const get = async (): Promise<SuperAdminProfile> => {
  const res = await api.get('/super-admin/profile');
  return res.data.data;
};

const changePassword = async (payload: ChangePasswordPayload): Promise<void> => {
  await api.post('/super-admin/profile/change-password', payload);
};

export const superAdminProfileService = { get, changePassword };
