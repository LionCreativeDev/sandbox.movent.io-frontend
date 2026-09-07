import api from '@/lib/axios';

export interface SubscriptionPolicy {
  id: number;
  trial_enabled: boolean;
  trial_duration_days: number;
  trial_modules: string[] | null;
  grace_period_days: number;
  renewal_reminder_days: number[];
  auto_suspend_on_trial_expiry: boolean;
  auto_suspend_on_renewal_failure: boolean;
  trial_expiry_behavior: 'grace_period' | 'suspend_immediately';
  renewal_failure_behavior: 'grace_period' | 'suspend_immediately';
  payment_policy_notes: string | null;
  updated_at: string;
}

export type SubscriptionPolicyPayload = Omit<SubscriptionPolicy, 'id' | 'updated_at'>;

export const subscriptionPolicyService = {
  get: async (): Promise<SubscriptionPolicy> => {
    const res = await api.get('/super-admin/subscription-policy');
    return res.data.data;
  },

  update: async (payload: SubscriptionPolicyPayload): Promise<SubscriptionPolicy> => {
    const res = await api.put('/super-admin/subscription-policy', payload);
    return res.data.data;
  },
};
