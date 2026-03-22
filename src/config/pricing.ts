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
  annualMonthlyPrice: number;
  annualTotalPrice: number;
  /** Paddle monthly price ID — read from env */
  paddlePriceIdMonthly: string;
  paddlePriceIdAnnual: string;
  limits: {
    clients: number;
    events: number;
    seats: number;
    attendeesPerEvent: number;
    aiPrompts: number;
    aiImages: number;
    whatsappMessages: number;
    emailMessages: number;
    brandKits: number;
  };
  features: PlanFeature[];
  /** Short tagline for the billing page */
  description: string;
  bestFor: string;
  highlight: boolean;
  buttonText: string;
}

export const PLANS: Record<string, PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 79,
    annualMonthlyPrice: 63,
    annualTotalPrice: 756,
    paddlePriceIdMonthly: import.meta.env.VITE_PADDLE_PRICE_STARTER_MONTHLY || '',
    paddlePriceIdAnnual: import.meta.env.VITE_PADDLE_PRICE_STARTER_ANNUAL || '',
    limits: {
      clients: 3,
      events: 3,
      seats: 1,
      attendeesPerEvent: 300,
      aiPrompts: 500,
      aiImages: 20,
      whatsappMessages: 500,
      emailMessages: 2000,
      brandKits: 0,
    },
    features: [
      { text: 'Up to 3 events / month' },
      { text: 'Up to 300 attendees per event' },
      { text: 'AI Builder (500 prompts / month)' },
      { text: 'AI image generation (20 images / month)' },
      { text: 'Email + WhatsApp communication' },
      { text: 'RSVP & attendance tracking' },
      { text: 'Public event pages' },
      { text: 'Basic analytics' },
    ],
    description: 'Create and manage professional events with AI support and essential tools.',
    bestFor: 'Small teams, pilots, internal events',
    highlight: false,
    buttonText: 'Start with Starter',
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    monthlyPrice: 199,
    annualMonthlyPrice: 159,
    annualTotalPrice: 1908,
    paddlePriceIdMonthly: import.meta.env.VITE_PADDLE_PRICE_PROFESSIONAL_MONTHLY || '',
    paddlePriceIdAnnual: import.meta.env.VITE_PADDLE_PRICE_PROFESSIONAL_ANNUAL || '',
    limits: {
      clients: 15,
      events: 15,
      seats: 3,
      attendeesPerEvent: 2000,
      aiPrompts: 3000,
      aiImages: 150,
      whatsappMessages: 5000,
      emailMessages: 15000,
      brandKits: 10,
    },
    features: [
      { text: 'Everything in Starter, plus:' },
      { text: 'Up to 15 events / month' },
      { text: 'Up to 2,000 attendees per event' },
      { text: 'AI Builder (3,000 prompts / month)' },
      { text: 'AI image generation (150 images / month)' },
      { text: 'Advanced communication campaigns' },
      { text: 'Segmentation & smart reminders' },
      { text: 'Workspace analytics dashboard' },
      { text: 'Live event monitoring' },
      { text: 'Brand kits (up to 10)' },
      { text: 'Visual packs & templates' },
    ],
    description: 'Everything you need to scale events with automation, AI, and full visibility.',
    bestFor: 'Companies, conferences, recurring events',
    highlight: true,
    buttonText: 'Upgrade to Professional',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 499,
    annualMonthlyPrice: 399,
    annualTotalPrice: 4788,
    paddlePriceIdMonthly: import.meta.env.VITE_PADDLE_PRICE_ENTERPRISE_MONTHLY || '',
    paddlePriceIdAnnual: import.meta.env.VITE_PADDLE_PRICE_ENTERPRISE_ANNUAL || '',
    limits: {
      clients: Infinity,
      events: 50,
      seats: 10,
      attendeesPerEvent: 5000,
      aiPrompts: 10000,
      aiImages: 500,
      whatsappMessages: 15000,
      emailMessages: 50000,
      brandKits: Infinity,
    },
    features: [
      { text: 'Everything in Professional, plus:' },
      { text: 'Up to 50 events / month' },
      { text: 'Up to 5,000+ attendees per event' },
      { text: 'AI Builder (10,000+ prompts / month)' },
      { text: 'AI image generation (500+ images / month)' },
      { text: 'Priority support' },
      { text: 'Multi-admin access (up to 10 users)' },
      { text: 'Advanced analytics & insights' },
      { text: 'Dedicated onboarding assistance' },
      { text: 'Early access to new features' },
    ],
    description: 'Advanced scale, higher limits, and priority support for large operations.',
    bestFor: 'Enterprises, large conferences, high-frequency events',
    highlight: false,
    buttonText: 'Go Enterprise',
  },
};

export const PLAN_ORDER = ['starter', 'professional', 'enterprise'] as const;
export type PlanId = (typeof PLAN_ORDER)[number];

/** Annual billing discount percentage */
export const ANNUAL_DISCOUNT_PERCENT = 20;

/** Validate pricing env vars and log warnings for missing ones */
export function validatePricingConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const planId of PLAN_ORDER) {
    const plan = PLANS[planId];
    if (!plan.paddlePriceIdMonthly) {
      missing.push(`VITE_PADDLE_PRICE_${planId.toUpperCase()}_MONTHLY`);
    }
  }
  if (missing.length > 0) {
    console.warn(
      `[TitanMeet Pricing] Missing Paddle price IDs for: ${missing.join(', ')}. ` +
      `Set these in your .env file or Lovable secrets to enable checkout.`
    );
  }
  return { valid: missing.length === 0, missing };
}

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

/** Feature comparison table rows */
export interface ComparisonRow {
  feature: string;
  starter: string;
  professional: string;
  enterprise: string;
}

export const COMPARISON_TABLE: ComparisonRow[] = [
  { feature: 'Events / month', starter: '3', professional: '15', enterprise: '50' },
  { feature: 'Attendees / event', starter: '300', professional: '2,000', enterprise: '5,000+' },
  { feature: 'Admin users', starter: '1', professional: '3', enterprise: '10' },
  { feature: 'AI Builder prompts', starter: '500', professional: '3,000', enterprise: '10,000+' },
  { feature: 'AI image generation', starter: '20', professional: '150', enterprise: '500+' },
  { feature: 'Public event pages', starter: '✓', professional: '✓', enterprise: '✓' },
  { feature: 'RSVP & attendance tracking', starter: '✓', professional: '✓', enterprise: '✓' },
  { feature: 'Email messages', starter: '2,000', professional: '15,000', enterprise: '50,000+' },
  { feature: 'WhatsApp messages', starter: '500', professional: '5,000', enterprise: '15,000+' },
  { feature: 'Communication campaigns', starter: 'Basic', professional: 'Advanced', enterprise: 'Advanced' },
  { feature: 'Segmentation & reminders', starter: '—', professional: '✓', enterprise: '✓' },
  { feature: 'AI recommendations', starter: 'Limited', professional: 'Full', enterprise: 'Full' },
  { feature: 'Media library', starter: 'Basic', professional: 'Full', enterprise: 'Full' },
  { feature: 'Upload-from-chat', starter: '✓', professional: '✓', enterprise: '✓' },
  { feature: 'Brand kits', starter: '—', professional: '10', enterprise: 'Unlimited' },
  { feature: 'Visual templates', starter: 'Basic', professional: 'Full', enterprise: 'Full' },
  { feature: 'Event analytics', starter: 'Basic', professional: 'Advanced', enterprise: 'Advanced' },
  { feature: 'Workspace analytics', starter: '—', professional: '✓', enterprise: '✓' },
  { feature: 'Live event dashboard', starter: '—', professional: '✓', enterprise: '✓' },
  { feature: 'AI Event Concierge', starter: '—', professional: 'Basic', enterprise: 'Advanced' },
  { feature: 'Priority support', starter: '—', professional: '✓', enterprise: '✓' },
  { feature: 'Onboarding support', starter: '—', professional: 'Guided', enterprise: 'Dedicated' },
];
