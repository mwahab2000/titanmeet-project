/**
 * SINGLE SOURCE OF TRUTH — TitanMeet Pricing
 *
 * Every pricing surface in the product (landing page, billing page,
 * upgrade modals, usage widgets, admin screens) imports from here.
 *
 * Paddle price IDs are read from env vars at build time.
 */

export interface PlanFeature {
  text: string;
  highlight?: boolean;
}

export interface PlanConfig {
  id: string;
  name: string;
  monthlyPrice: number;
  /** Paddle monthly price ID — read from env */
  paddlePriceIdMonthly: string;
  limits: {
    clients: number;
    events: number;
    seats: number;
  };
  features: PlanFeature[];
  /** Short tagline for the billing page */
  description: string;
  highlight: boolean;
  buttonText: string;
}

export const PLANS: Record<string, PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 49,
    paddlePriceIdMonthly: import.meta.env.VITE_PADDLE_PRICE_STARTER_MONTHLY || '',
    limits: {
      clients: 3,
      events: 20,
      seats: 1,
    },
    features: [
      { text: '3 clients' },
      { text: '20 events / month' },
      { text: 'Invitations (WhatsApp + email) + tracking' },
      { text: 'Surveys + stats + Excel export' },
      { text: '1 admin seat' },
    ],
    description: 'Everything a small HR team needs to launch polished events.',
    highlight: false,
    buttonText: 'Get Started',
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    monthlyPrice: 149,
    paddlePriceIdMonthly: import.meta.env.VITE_PADDLE_PRICE_PROFESSIONAL_MONTHLY || '',
    limits: {
      clients: 20,
      events: Infinity,
      seats: 5,
    },
    features: [
      { text: '20 clients' },
      { text: 'Unlimited events' },
      { text: 'Templates + readiness automation' },
      { text: '5 admin seats' },
    ],
    description: 'For growing teams running frequent events across departments.',
    highlight: true,
    buttonText: 'Get Started',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 399,
    paddlePriceIdMonthly: import.meta.env.VITE_PADDLE_PRICE_ENTERPRISE_MONTHLY || '',
    limits: {
      clients: Infinity,
      events: Infinity,
      seats: Infinity,
    },
    features: [
      { text: 'Unlimited clients' },
      { text: 'Unlimited events' },
      { text: 'Governance + audit exports + SLA' },
      { text: 'Unlimited admin seats' },
    ],
    description: 'Enterprise-grade governance for large-scale operations.',
    highlight: false,
    buttonText: 'Get Started',
  },
};

export const PLAN_ORDER = ['starter', 'professional', 'enterprise'] as const;
export type PlanId = (typeof PLAN_ORDER)[number];

/** Format a limit value for display (handles Infinity → "Unlimited") */
export function formatLimit(value: number): string {
  if (value === Infinity) return 'Unlimited';
  return value.toLocaleString();
}

/** Build the short feature list for a plan (used by billing cards) */
export function getPlanFeatures(planId: string): string[] {
  const plan = PLANS[planId];
  if (!plan) return [];
  return plan.features.map((f) => f.text);
}

/** Demo site URL — single constant for all marketing CTAs */
export const DEMO_SITE_URL = 'https://quantumdynamics.titanmeet.com/board-meeting2026';
