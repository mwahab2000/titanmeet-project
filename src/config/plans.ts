/**
 * DEPRECATED — Use src/config/pricing.ts instead.
 * This file re-exports from pricing.ts for backward compatibility.
 */
export {
  PLANS,
  PLAN_ORDER,
  formatLimit,
  getPlanFeatures,
  type PlanId,
} from './pricing';

// Re-export PlanConfig type (mapped from new shape for any legacy consumers)
export type { PlanConfig } from './pricing';
