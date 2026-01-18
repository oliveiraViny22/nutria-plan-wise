import { CommercialPlan } from './types';

export interface Plan {
  id: string;
  name: CommercialPlan;
  type: 'personal' | 'professional';
  description: string | null;
  diet_limit: number;
  substitution_limit: number;
  adjustment_limit: number;
  chat_messages_per_day: number;
  patients_limit: number;
  has_chat: boolean;
  history_days: number;
  price_monthly: number;
  price_quarterly: number;
  price_semiannual: number;
  price_annual: number;
  stripe_product_id?: string;
  stripe_price_monthly?: string;
  stripe_price_quarterly?: string;
  stripe_price_semiannual?: string;
  stripe_price_annual?: string;
  is_active: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'trial' | 'active' | 'past_due' | 'canceled' | 'expired';
  billing_cycle: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  provider?: string;
  provider_subscription_id?: string;
  provider_customer_id?: string;
  stripe_price_id?: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserUsage {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  diets_used: number;
  substitutions_used: number;
  adjustments_used: number;
  chat_messages_today: number;
  last_chat_reset: string;
  created_at: string;
  updated_at: string;
}

export interface StudentAccess {
  hasAccess: boolean;
  accessLevel: 'full' | 'read_only' | 'suspended';
  canViewPlan: boolean;
  canViewHistory: boolean;
  canUseChat: boolean;
  canGenerate: boolean;
  canSubstitute: boolean;
  professionalStatus: string | null;
}

export interface SubscriptionInfo {
  subscribed: boolean;
  subscription?: {
    id: string;
    status: string;
    billingCycle: string;
    periodEnd: string;
    cancelAtPeriodEnd: boolean;
    gracePeriodEnd?: string;
  };
  plan?: Plan;
  usage?: {
    diets_used: number;
    substitutions_used: number;
    adjustments_used: number;
    chat_messages_today: number;
  };
  accountType: 'personal' | 'professional';
  isLinkedToProfessional?: boolean;
  studentAccess?: StudentAccess;
}

export type BillingCycle = 'monthly';

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Mensal',
};

// Mapeamento de planos comerciais para exibição
export const PLAN_DISPLAY_NAMES: Record<CommercialPlan, string> = {
  gratuito: 'Gratuito',
  premium: 'Premium Aluno',
  plano_pessoal_pago: 'Pessoal',
  profissional: 'Profissional',
};

// Descrições dos planos
export const PLAN_DESCRIPTIONS: Record<CommercialPlan, string> = {
  gratuito: 'IA educacional básica',
  premium: 'IA educacional ampliada',
  plano_pessoal_pago: 'IA completa com autonomia',
  profissional: 'IA como assistente clínica',
};

// Preços mensais dos planos
export const PLAN_PRICES: Record<CommercialPlan, number> = {
  gratuito: 0,
  premium: 4.90,
  plano_pessoal_pago: 14.90,
  profissional: 99.00,
};

// Limites de mensagens por dia
export const PLAN_CHAT_LIMITS: Record<CommercialPlan, number> = {
  gratuito: 3,
  premium: 10,
  plano_pessoal_pago: 30,
  profissional: 100,
};
