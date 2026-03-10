export interface PlanConfig {
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  annualTotal: number;
  limits: {
    clients: number;
    activeEvents: number;
    attendeesPerMonth: number;
    emailsPerMonth: number;
    storageGB: number;
  };
  support: string;
  description: string;
  highlight: boolean;
  buttonText: string;
}

export const PLANS: Record<string, PlanConfig> = {
  starter: {
    name: 'Starter',
    monthlyPrice: 49,
    annualPrice: 39,
    annualTotal: 468,
    limits: {
      clients: 3,
      activeEvents: 5,
      attendeesPerMonth: 500,
      emailsPerMonth: 2000,
      storageGB: 5,
    },
    support: 'Standard support',
    description: 'Perfect for individuals launching their first few events.',
    highlight: false,
    buttonText: 'Start with Starter',
  },
  professional: {
    name: 'Professional',
    monthlyPrice: 149,
    annualPrice: 119,
    annualTotal: 1428,
    limits: {
      clients: 15,
      activeEvents: 25,
      attendeesPerMonth: 5000,
      emailsPerMonth: 20000,
      storageGB: 25,
    },
    support: 'Priority support',
    description: 'Designed for growing agencies and frequent organizers.',
    highlight: true,
    buttonText: 'Get Started Now',
  },
  enterprise: {
    name: 'Enterprise',
    monthlyPrice: 399,
    annualPrice: 319,
    annualTotal: 3828,
    limits: {
      clients: Infinity,
      activeEvents: Infinity,
      attendeesPerMonth: 50000,
      emailsPerMonth: 200000,
      storageGB: 100,
    },
    support: 'Dedicated support',
    description: 'Enterprise-grade volume for large-scale operations.',
    highlight: false,
    buttonText: 'Start with Enterprise',
  },
};

export const PLAN_ORDER = ['starter', 'professional', 'enterprise'] as const;
export type PlanId = (typeof PLAN_ORDER)[number];

/** Format a limit value for display (handles Infinity → "Unlimited") */
export function formatLimit(value: number): string {
  if (value === Infinity) return 'Unlimited';
  return value.toLocaleString();
}

/** Build the feature list strings for a plan */
export function getPlanFeatures(planId: string): string[] {
  const plan = PLANS[planId];
  if (!plan) return [];
  return [
    `${formatLimit(plan.limits.clients)} clients`,
    `${formatLimit(plan.limits.activeEvents)} active events/mo`,
    `${formatLimit(plan.limits.attendeesPerMonth)} attendees/mo`,
    `${formatLimit(plan.limits.emailsPerMonth)} emails/mo`,
    `${plan.limits.storageGB} GB storage`,
    plan.support,
  ];
}
