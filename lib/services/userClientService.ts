import api from '@/lib/axios';
import { Client } from '@/types';

// Sub-user side of Client management — a basic record only (name/contact/
// notes/status). Portal access, client login, and document/support features
// are Company-Admin-only and have no sub-user endpoint.
export interface UserClientPayload {
  name: string;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: 'active' | 'inactive' | 'blocked';
}

export const userClientService = {
  list: async (): Promise<Client[]> => {
    const res = await api.get('/user/clients');
    return res.data.data;
  },

  getOne: async (id: number): Promise<Client> => {
    const res = await api.get(`/user/clients/${id}`);
    return res.data.data;
  },

  create: async (payload: UserClientPayload): Promise<Client> => {
    const res = await api.post('/user/clients', payload);
    return res.data.data;
  },

  update: async (id: number, payload: Partial<UserClientPayload>): Promise<Client> => {
    const res = await api.put(`/user/clients/${id}`, payload);
    return res.data.data;
  },
};
