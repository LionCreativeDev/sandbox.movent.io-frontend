import api from '@/lib/axios';
import { getAuthType } from '@/lib/auth';

// Brands — the trading names a company bills under, part of the Invoice
// module. One screen serves both portals: a Company Admin hits
// /admin/brands/*, a staff member with the Invoice-module brand permissions
// hits /user/brands/*, which answers with the same shapes but is scoped to
// the company they are currently working under.
const base = () => (getAuthType() === 'admin' ? '/admin/brands' : '/user/brands');

export interface Brand {
  id: number;
  company_id: number;
  company: { id: number; name: string } | null;
  name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  address: string | null;
  logo_url: string | null;
  is_active: boolean;
  // The staff member responsible for this brand's invoicing, if any.
  assigned_to: { id: number; name: string } | null;
  created_by: string | null;
  created_at: string | null;
}

// Someone who may be assigned a brand: staff of the same company holding at
// least one Invoice create/manage permission. Seller and Lead Manager qualify
// through their role defaults; a view-only invoice user never appears.
export interface AssignableUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface BrandPayload {
  name: string;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  address?: string | null;
  is_active?: boolean;
  company_id?: number;
  // A File replaces the logo; leaving it out keeps whatever is stored.
  logo?: File | null;
}

export interface BrandPermissions {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  // True for anyone who isn't the brand keeper (Company Admin / Admin role):
  // they are looking at the brands ASSIGNED to them, read-only, and can do
  // nothing here but pick one while raising an invoice.
  view_only?: boolean;
}

// multipart/form-data because of the logo. Booleans go over as 1/0 — PHP
// reads "false" as a truthy string, so sending the raw word would flip every
// inactive brand back to active on save.
const toFormData = (payload: BrandPayload): FormData => {
  const fd = new FormData();
  fd.append('name', payload.name);
  if (payload.email   !== undefined) fd.append('email',   payload.email   ?? '');
  if (payload.phone   !== undefined) fd.append('phone',   payload.phone   ?? '');
  if (payload.country !== undefined) fd.append('country', payload.country ?? '');
  if (payload.address !== undefined) fd.append('address', payload.address ?? '');
  if (payload.is_active !== undefined) fd.append('is_active', payload.is_active ? '1' : '0');
  if (payload.company_id) fd.append('company_id', String(payload.company_id));
  if (payload.logo) fd.append('logo', payload.logo);
  return fd;
};

const list = async (params?: { active?: boolean; search?: string }): Promise<Brand[]> => {
  const res = await api.get(base(), {
    params: {
      ...(params?.active ? { active: 1 } : {}),
      ...(params?.search ? { search: params.search } : {}),
    },
  });
  return res.data.data.brands;
};

const getOne = async (id: number): Promise<Brand> => {
  const res = await api.get(`${base()}/${id}`);
  return res.data.data;
};

const create = async (payload: BrandPayload): Promise<Brand> => {
  const res = await api.post(base(), toFormData(payload));
  return res.data.data;
};

// POST, not PUT: PHP doesn't parse multipart bodies on PUT, so the route is
// declared as POST on both sides (see routes/api.php).
const update = async (id: number, payload: BrandPayload): Promise<Brand> => {
  const res = await api.post(`${base()}/${id}`, toFormData(payload));
  return res.data.data;
};

const toggleStatus = async (id: number): Promise<Brand> => {
  const res = await api.patch(`${base()}/${id}/toggle-status`);
  return res.data.data;
};

const remove = async (id: number): Promise<void> => {
  await api.delete(`${base()}/${id}`);
};

// Who the Assign dropdown may offer. Company-scoped on both sides: the admin
// API takes the company explicitly (they may own several), the staff API uses
// whichever company the caller is working under.
const assignableUsers = async (companyId?: number): Promise<AssignableUser[]> => {
  const res = await api.get(`${base()}/assignable-users`, {
    params: getAuthType() === 'admin' && companyId ? { company_id: companyId } : {},
  });
  return res.data.data;
};

// null unassigns. The server re-checks the chosen user against the same rule
// that built the dropdown, so a stale option can't slip through.
const assign = async (id: number, userId: number | null): Promise<Brand> => {
  const res = await api.patch(`${base()}/${id}/assign`, { user_id: userId });
  return res.data.data;
};

// Admin-only: which company to file a brand under. A staff member never
// picks — their brands go to the company they're working in.
const companyOptions = async (): Promise<{ id: number; name: string }[]> => {
  const res = await api.get('/admin/brands/company-options');
  return res.data.data;
};

// Staff-only: which buttons to render. A Company Admin holds all four
// implicitly (the admin guard is the gate), so the page assumes them.
const permissions = async (): Promise<BrandPermissions> => {
  const res = await api.get('/user/brands/permissions');
  return res.data.data;
};

export const brandService = {
  list, getOne, create, update, toggleStatus, remove, companyOptions, permissions,
  assignableUsers, assign,
};
