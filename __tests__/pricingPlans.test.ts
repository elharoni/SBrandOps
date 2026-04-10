import { describe, expect, it } from 'vitest';
import { DEFAULT_PUBLIC_PRICING_PLAN_IDS, PRICING_PLANS, getBillingAmount, getPricingPlan } from '../config/pricingPlans';

describe('pricingPlans config', () => {
  it('keeps public plans in the expected order', () => {
    expect(DEFAULT_PUBLIC_PRICING_PLAN_IDS).toEqual(['starter', 'growth', 'agency']);
  });

  it('exposes public plans with both monthly and yearly prices', () => {
    const publicPlans = PRICING_PLANS.filter(plan => DEFAULT_PUBLIC_PRICING_PLAN_IDS.includes(plan.id));

    expect(publicPlans).toHaveLength(3);
    for (const plan of publicPlans) {
      expect(getBillingAmount(plan, 'monthly')).toBeGreaterThan(0);
      expect(getBillingAmount(plan, 'yearly')).toBeGreaterThan(0);
    }
  });

  it('keeps enterprise as a custom-sales plan', () => {
    const enterprise = getPricingPlan('enterprise');

    expect(enterprise).toBeDefined();
    expect(enterprise?.monthlyPrice).toBeNull();
    expect(enterprise?.yearlyPrice).toBeNull();
    expect(enterprise?.ctaLabel).toBe('Talk to Sales');
  });
});
