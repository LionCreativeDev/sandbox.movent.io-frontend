import api from '@/lib/axios';
import { User, CompanyOption } from '@/types';

// The delegated Users LIST screen (/user-management). Add User and Edit User
// are the Company Admin's own pages — those go through userService, which
// switches its base path to /user/users/* for a staff caller, so there is one
// set of screens rather than a second copy.
//
// Everything here is scoped server-side to the companies this person is
// assigned to AND holds the User Management Permission in
// (Api\User\UserManagementController::manageableCompanyIds()).

export interface StaffUserListResponse {
  users: User[];
  count: number;
  used: number;
  limit: number | null;
}

const list = async (companyId?: number, status?: 'invited'): Promise<StaffUserListResponse> => {
  const res = await api.get('/user/users', {
    params: { ...(companyId ? { company_id: companyId } : {}), ...(status ? { status } : {}) },
  });
  return res.data.data;
};

// Only the companies this manager may act in — the list's company picker is
// built straight from this, which is what keeps other companies invisible.
const companyOptions = async (): Promise<CompanyOption[]> => {
  const res = await api.get('/user/users/company-options');
  return res.data.data;
};

// Suspend/activate is per company: the same person keeps working normally in
// every other company they belong to.
const toggleStatus = async (id: number, status: 'active' | 'suspended', companyId?: number): Promise<User> => {
  const res = await api.patch(`/user/users/${id}/toggle-status`, { status, company_id: companyId });
  return res.data.data;
};

export const staffUserService = { list, companyOptions, toggleStatus };
