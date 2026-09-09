import clientApi from '@/lib/clientAxios';

// The Client Portal's "Grow Your Business With Us" section.

export interface PortalService {
  id: number;
  slug: string | null;
  name: string;
  short_description: string | null;
  /** An uploaded banner, when the company added one. */
  icon_url: string | null;
  /** The catalogue's emoji — always present, so a card is never iconless. */
  icon_emoji: string;
  group: string;
  starting_price: number | null;
  is_featured: boolean;
}

export interface PortalServices {
  /** Worked out from what this client already has. Strongest reason first. */
  recommended: PortalService[];
  /** The company's own picks, minus anything already recommended. */
  featured: PortalService[];
  /** Everything else enabled, so nothing is unreachable. */
  all: PortalService[];
  /** The service names the recommendations were derived from. */
  based_on: string[];
}

export type ServiceIntent = 'quote' | 'new_project' | 'consultation';

const list = async (): Promise<PortalServices> => {
  const res = await clientApi.get('/client/services');
  return res.data.data;
};

// "Contact Support" is deliberately absent as an intent — that button routes
// to the existing support ticket flow instead, because a support request
// belongs in the support queue rather than the sales pipeline.
const request = async (payload: {
  company_service_id?: number | null;
  intent: ServiceIntent;
  message?: string | null;
  preferred_date?: string | null;
}): Promise<{ id: number; lead_id: number | null }> => {
  const res = await clientApi.post('/client/services/request', payload);
  return res.data.data;
};

export const clientServicesService = { list, request };
