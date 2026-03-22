/**
 * LAUNCH SAFETY — Pricing / Plan Configuration
 *
 * Ensures plan definitions are consistent, complete, and correctly ordered.
 */
import { describe, it, expect } from "vitest";
import { PLANS, PLAN_ORDER, formatLimit, getPlanFeatures } from "@/config/pricing";

describe("Pricing — Plan Configuration", () => {
  it("PLAN_ORDER contains all defined plans", () => {
    PLAN_ORDER.forEach((planId) => {
      expect(PLANS[planId]).toBeDefined();
      expect(PLANS[planId].id).toBe(planId);
    });
  });

  it("every plan has required fields", () => {
    Object.values(PLANS).forEach((plan) => {
      expect(plan.name).toBeTruthy();
      expect(plan.monthlyPrice).toBeGreaterThanOrEqual(0);
      expect(plan.limits).toBeDefined();
      expect(typeof plan.limits.clients).toBe("number");
      expect(typeof plan.limits.events).toBe("number");
      expect(typeof plan.limits.seats).toBe("number");
      expect(plan.features.length).toBeGreaterThan(0);
      expect(plan.description).toBeTruthy();
      expect(plan.buttonText).toBeTruthy();
    });
  });

  it("plans are in ascending price order", () => {
    const prices = PLAN_ORDER.map((id) => PLANS[id].monthlyPrice);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });

  it("plan limits are monotonically non-decreasing", () => {
    const limits = PLAN_ORDER.map((id) => PLANS[id].limits);
    for (let i = 1; i < limits.length; i++) {
      expect(limits[i].clients).toBeGreaterThanOrEqual(limits[i - 1].clients);
      expect(limits[i].events).toBeGreaterThanOrEqual(limits[i - 1].events);
      expect(limits[i].seats).toBeGreaterThanOrEqual(limits[i - 1].seats);
    }
  });

  it("starter plan has specific limits, not Infinity", () => {
    const starter = PLANS.starter;
    expect(starter.limits.clients).toBeLessThan(Infinity);
    expect(starter.limits.events).toBeLessThan(Infinity);
    expect(starter.limits.seats).toBeLessThan(Infinity);
  });

  it("enterprise plan has Infinity limits where expected", () => {
    const enterprise = PLANS.enterprise;
    expect(enterprise.limits.clients).toBe(Infinity);
    expect(enterprise.limits.events).toBe(Infinity);
    expect(enterprise.limits.seats).toBe(Infinity);
  });
});

describe("formatLimit", () => {
  it("returns 'Unlimited' for Infinity", () => {
    expect(formatLimit(Infinity)).toBe("Unlimited");
  });

  it("formats finite numbers as locale string", () => {
    expect(formatLimit(20)).toBe("20");
    expect(formatLimit(0)).toBe("0");
  });
});

describe("getPlanFeatures", () => {
  it("returns feature strings for valid plan", () => {
    const features = getPlanFeatures("starter");
    expect(features.length).toBeGreaterThan(0);
    features.forEach((f) => expect(typeof f).toBe("string"));
  });

  it("returns empty array for invalid plan", () => {
    expect(getPlanFeatures("nonexistent")).toEqual([]);
  });
});
