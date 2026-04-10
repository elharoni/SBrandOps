export type BillingPlanId = 'starter' | 'growth' | 'agency' | 'enterprise';
export type BillingCycle = 'monthly' | 'yearly';

export interface PricingPlanDefinition {
    id: BillingPlanId;
    name: string;
    tagline: string;
    description: string;
    badge?: string;
    highlighted?: boolean;
    audience: string;
    monthlyPrice: number | null;
    yearlyPrice: number | null;
    currency: string;
    trialDays: number;
    maxBrands: number | null;
    maxUsers: number | null;
    aiTokensMonthly: number | null;
    features: string[];
    ctaLabel: string;
    paddlePriceIdMonthlyEnv?: string;
    paddlePriceIdYearlyEnv?: string;
}

export const PRICING_PLANS: PricingPlanDefinition[] = [
    {
        id: 'starter',
        name: 'Starter',
        tagline: 'Launch one brand fast',
        description: 'For solo operators and small brands that need core publishing, content planning, and basic analytics.',
        audience: '1 brand, lean team',
        monthlyPrice: 29,
        yearlyPrice: 290,
        currency: 'USD',
        trialDays: 14,
        maxBrands: 1,
        maxUsers: 2,
        aiTokensMonthly: 1_000_000,
        ctaLabel: 'Start Free Trial',
        features: [
            '1 brand workspace',
            'Content calendar and publishing',
            'Basic analytics and reporting',
            'Starter AI credits',
            'Core team access',
        ],
        paddlePriceIdMonthlyEnv: 'VITE_PADDLE_STARTER_MONTHLY_PRICE_ID',
        paddlePriceIdYearlyEnv: 'VITE_PADDLE_STARTER_YEARLY_PRICE_ID',
    },
    {
        id: 'growth',
        name: 'Growth',
        tagline: 'Scale execution with one team',
        description: 'For growing brands that need campaign execution, SEO, inbox workflows, and better reporting.',
        badge: 'Recommended',
        highlighted: true,
        audience: 'Multi-channel growth teams',
        monthlyPrice: 99,
        yearlyPrice: 990,
        currency: 'USD',
        trialDays: 14,
        maxBrands: 5,
        maxUsers: 10,
        aiTokensMonthly: 5_000_000,
        ctaLabel: 'Start Growth Trial',
        features: [
            'Everything in Starter',
            'Ads analytics and campaign visibility',
            'SEO writer and briefs',
            'Inbox lite and workflow automations',
            'Advanced reporting',
        ],
        paddlePriceIdMonthlyEnv: 'VITE_PADDLE_GROWTH_MONTHLY_PRICE_ID',
        paddlePriceIdYearlyEnv: 'VITE_PADDLE_GROWTH_YEARLY_PRICE_ID',
    },
    {
        id: 'agency',
        name: 'Agency',
        tagline: 'Operate multiple brands with controls',
        description: 'For agencies and multi-brand teams that need approvals, client workflows, and higher usage ceilings.',
        audience: 'Agencies and portfolio operators',
        monthlyPrice: 249,
        yearlyPrice: 2490,
        currency: 'USD',
        trialDays: 14,
        maxBrands: 25,
        maxUsers: 50,
        aiTokensMonthly: 10_000_000,
        ctaLabel: 'Start Agency Trial',
        features: [
            'Everything in Growth',
            'Multiple brand workspaces',
            'Roles, permissions, and approvals',
            'Expanded analytics and webhook logs',
            'Higher AI and publishing limits',
        ],
        paddlePriceIdMonthlyEnv: 'VITE_PADDLE_AGENCY_MONTHLY_PRICE_ID',
        paddlePriceIdYearlyEnv: 'VITE_PADDLE_AGENCY_YEARLY_PRICE_ID',
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        tagline: 'Custom rollout and governance',
        description: 'For larger organizations that need custom onboarding, SSO, security review, and tailored integrations.',
        audience: 'Enterprise and regulated teams',
        monthlyPrice: null,
        yearlyPrice: null,
        currency: 'USD',
        trialDays: 0,
        maxBrands: null,
        maxUsers: null,
        aiTokensMonthly: null,
        ctaLabel: 'Talk to Sales',
        features: [
            'Custom onboarding and migration',
            'SSO and security review',
            'Custom integrations',
            'Priority support and success plan',
            'Commercial terms by agreement',
        ],
    },
];

export const DEFAULT_PUBLIC_PRICING_PLAN_IDS: BillingPlanId[] = ['starter', 'growth', 'agency'];

export function getPricingPlan(planId: string): PricingPlanDefinition | undefined {
    return PRICING_PLANS.find(plan => plan.id === planId);
}

export function getBillingAmount(plan: PricingPlanDefinition, cycle: BillingCycle): number | null {
    return cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
}
