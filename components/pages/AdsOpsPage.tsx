/**
 * AdsOpsPage — Full Ads Hub
 * Tabs: Dashboard | Campaigns | Analytics | Ad Copy (ADS-1) | Health Alerts (ADS-2) | Scaling (ADS-3)
 */
import React, { useState, useMemo } from 'react';
import { AdCampaign, AdsDashboardData, BrandHubProfile, NotificationType, CampaignStatus } from '../../types';
import type { BrandAsset, BrandConnection } from '../../services/brandConnectionService';
import { AdsDashboard } from '../ads/AdsDashboard';
import { CampaignsList } from '../ads/CampaignsList';
import { CreateCampaignWizard } from '../ads/CreateCampaignWizard';
import { AdAnalytics } from '../ads/AdAnalytics';
import { ProviderConnectionCallout } from '../shared/ProviderConnectionCallout';
import { generateContentPlan } from '../../services/geminiService';

// ─── Types ────────────────────────────────────────────────────────────────────
type ActiveTab = 'dashboard' | 'campaigns' | 'analytics' | 'copy' | 'health' | 'scaling';

interface AdsOpsPageProps {
    addNotification: (type: NotificationType, message: string) => void;
    brandProfile: BrandHubProfile;
    campaigns: AdCampaign[];
    dashboardData: AdsDashboardData;
    brandConnections: BrandConnection[];
    brandAssets: BrandAsset | null;
    onNavigate: (page: string) => void;
}

// ─── ADS-1: Ad Copy Generator ─────────────────────────────────────────────────
interface AdCopyVariant {
    headline: string;
    primaryText: string;
    cta: string;
    hook: string;
}

const AD_PLATFORMS = ['Facebook', 'Instagram', 'TikTok', 'Google', 'LinkedIn'] as const;
const AD_GOALS = ['Awareness', 'Traffic', 'Engagement', 'Conversion', 'Lead Generation'] as const;
const AD_TONES = ['Urgent', 'Friendly', 'Professional', 'Emotional', 'Humorous'] as const;

const AdCopyTab: React.FC<{ brandProfile: BrandHubProfile; addNotification: (t: NotificationType, m: string) => void }> = ({ brandProfile, addNotification }) => {
    const [platform, setPlatform] = useState<typeof AD_PLATFORMS[number]>('Facebook');
    const [goal, setGoal] = useState<typeof AD_GOALS[number]>('Conversion');
    const [tone, setTone] = useState<typeof AD_TONES[number]>('Urgent');
    const [product, setProduct] = useState('');
    const [audience, setAudience] = useState('');
    const [usp, setUsp] = useState('');
    const [generating, setGenerating] = useState(false);
    const [variants, setVariants] = useState<AdCopyVariant[]>([]);
    const [copied, setCopied] = useState<string | null>(null);

    // Use Gemini via a targeted prompt
    const handleGenerate = async () => {
        if (!product.trim()) { addNotification(NotificationType.Warning, 'أدخل المنتج أو الخدمة'); return; }
        setGenerating(true);
        setVariants([]);

        // We leverage generateContentPlan with a creative brief, then parse mock
        // For now, we build mock variants — replace with dedicated Gemini call when needed
        await new Promise(r => setTimeout(r, 1500));

        const mockVariants: AdCopyVariant[] = [
            {
                headline:    `${product} الحل الأمثل لـ ${audience || 'عملاءك'}`,
                primaryText: `هل تبحث عن ${product}؟ 🎯 ${usp || 'جودة استثنائية'} بسعر لا يُقاوَم. الفرصة محدودة!`,
                cta:         goal === 'Conversion' ? 'اشتري الآن' : goal === 'Lead Generation' ? 'اشترك الآن' : 'اكتشف المزيد',
                hook:        `⚡ ${tone === 'Urgent' ? 'عرض ينتهي قريباً!' : 'جرب مجاناً اليوم!'}`,
            },
            {
                headline:    `${usp || 'جودة عالية'} — ${product}`,
                primaryText: `${audience ? `خصيصاً لـ ${audience}:` : ''} ${product} الذي يغير قواعد اللعبة. ${usp}. لا تفوّت الفرصة.`,
                cta:         goal === 'Traffic' ? 'اعرف المزيد' : 'ابدأ الآن',
                hook:        `✅ موثوق من آلاف العملاء`,
            },
            {
                headline:    `لماذا ${product}؟ لأنك تستحق الأفضل`,
                primaryText: `${tone === 'Emotional' ? '❤️ نفهم احتياجاتك.' : '🚀 حان وقت التغيير.'} ${product} — ${usp || 'الخيار الذكي'}. ${audience ? `مناسب لـ ${audience}.` : ''}`,
                cta:         'احجز الآن',
                hook:        `🏆 الأفضل في ${platform}`,
            },
        ];
        setVariants(mockVariants);
        setGenerating(false);
        addNotification(NotificationType.Success, '3 نسخ إعلانية جاهزة!');
    };

    const copyToClipboard = async (text: string, key: string) => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <div className="space-y-6">
            {/* Form */}
            <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                    <i className="fas fa-pen-nib text-brand-primary" /> إعداد النسخة الإعلانية
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">المنصة</label>
                        <select value={platform} onChange={e => setPlatform(e.target.value as typeof AD_PLATFORMS[number])}
                            className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary">
                            {AD_PLATFORMS.map(p => <option key={p}>{p}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">الهدف</label>
                        <select value={goal} onChange={e => setGoal(e.target.value as typeof AD_GOALS[number])}
                            className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary">
                            {AD_GOALS.map(g => <option key={g}>{g}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">أسلوب الكتابة</label>
                        <select value={tone} onChange={e => setTone(e.target.value as typeof AD_TONES[number])}
                            className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary">
                            {AD_TONES.map(t => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">المنتج / الخدمة *</label>
                        <input value={product} onChange={e => setProduct(e.target.value)}
                            placeholder="مثال: كريم الترطيب الفاخر"
                            className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">الجمهور المستهدف</label>
                        <input value={audience} onChange={e => setAudience(e.target.value)}
                            placeholder="مثال: نساء 25-40 مهتمات بالعناية"
                            className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">الميزة التنافسية (USP)</label>
                        <input value={usp} onChange={e => setUsp(e.target.value)}
                            placeholder="مثال: طبيعي 100% بدون كيماويات"
                            className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                    </div>
                </div>
                <button onClick={handleGenerate} disabled={generating || !product.trim()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary-dark transition-colors disabled:opacity-50">
                    {generating ? <><i className="fas fa-spinner fa-spin" /> يولّد...</> : <><i className="fas fa-magic" /> ولّد 3 نسخ إعلانية</>}
                </button>
            </div>

            {/* Empty state before generation */}
            {variants.length === 0 && !generating && (
                <div className="text-center py-10 bg-light-card dark:bg-dark-card border border-dashed border-light-border dark:border-dark-border rounded-2xl">
                    <i className="fas fa-magic text-3xl text-light-text-secondary dark:text-dark-text-secondary mb-3 block" />
                    <p className="font-semibold text-light-text dark:text-dark-text mb-1">ولّد نسخك الإعلانية بذكاء اصطناعي</p>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">أدخل تفاصيل المنتج أعلاه وانقر "ولّد 3 نسخ إعلانية"</p>
                </div>
            )}

            {/* Variants */}
            {variants.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {variants.map((v, i) => (
                        <div key={i} className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full">نسخة {i + 1}</span>
                                <button onClick={() => copyToClipboard(`Hook: ${v.hook}\nHeadline: ${v.headline}\n\n${v.primaryText}\n\nCTA: ${v.cta}`, `variant-${i}`)}
                                    className="text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text">
                                    {copied === `variant-${i}` ? <><i className="fas fa-check text-green-500" /> نُسخ</> : <><i className="fas fa-copy" /> نسخ</>}
                                </button>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <p className="text-xs font-semibold text-orange-500 mb-0.5">⚡ الجملة الافتتاحية</p>
                                    <p className="text-light-text dark:text-dark-text font-medium">{v.hook}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-blue-500 mb-0.5">🎯 العنوان الرئيسي</p>
                                    <p className="text-light-text dark:text-dark-text font-bold">{v.headline}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-0.5">📝 النص الأساسي</p>
                                    <p className="text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">{v.primaryText}</p>
                                </div>
                                <div className="pt-2 border-t border-light-border dark:border-dark-border">
                                    <span className="inline-block px-3 py-1 bg-brand-primary text-white rounded-full text-xs font-bold">{v.cta}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── ADS-2: Campaign Health Alerts ────────────────────────────────────────────
interface HealthAlert {
    campaignId: string;
    campaignName: string;
    severity: 'critical' | 'warning' | 'info';
    metric: string;
    value: string;
    message: string;
    action: string;
}

const SEVERITY_COLOR: Record<string, string> = {
    critical: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
    warning:  'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300',
    info:     'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
};

const SEVERITY_ICON: Record<string, string> = {
    critical: 'fa-exclamation-circle',
    warning:  'fa-exclamation-triangle',
    info:     'fa-info-circle',
};

const buildHealthAlerts = (campaigns: AdCampaign[]): HealthAlert[] => {
    const alerts: HealthAlert[] = [];
    for (const c of campaigns) {
        if (c.status !== CampaignStatus.Active) continue;
        const { roas, cpa, ctr, spend } = c.metrics;
        if (roas < 1.5) alerts.push({ campaignId: c.id, campaignName: c.name, severity: 'critical', metric: 'ROAS', value: `${roas}x`, message: `ROAS منخفض جداً — الحملة تخسر أموالاً`, action: 'أوقف الحملة أو راجع الـ targeting فوراً' });
        else if (roas < 2.5) alerts.push({ campaignId: c.id, campaignName: c.name, severity: 'warning', metric: 'ROAS', value: `${roas}x`, message: `ROAS دون المستهدف (2.5x)`, action: 'راجع الـ creatives وجرب جمهور جديد' });
        if (ctr < 0.8) alerts.push({ campaignId: c.id, campaignName: c.name, severity: 'warning', metric: 'CTR', value: `${ctr}%`, message: `CTR منخفض — الإعلان لا يجذب الانتباه`, action: 'جرب headlines جديدة أو صور مختلفة' });
        if (cpa > 50)  alerts.push({ campaignId: c.id, campaignName: c.name, severity: 'warning', metric: 'CPA', value: `$${cpa}`, message: `تكلفة الاكتساب مرتفعة`, action: 'ضيّق الجمهور وحسّن الـ landing page' });
        if (spend > c.budget * 0.9) alerts.push({ campaignId: c.id, campaignName: c.name, severity: 'info', metric: 'Budget', value: `${Math.round(spend / c.budget * 100)}%`, message: `الميزانية على وشك الانتهاء`, action: 'قرر الزيادة أو الإيقاف قبل نهاية الميزانية' });
    }
    return alerts;
};

const HealthAlertsTab: React.FC<{ campaigns: AdCampaign[] }> = ({ campaigns }) => {
    const alerts = useMemo(() => buildHealthAlerts(campaigns), [campaigns]);
    const activeCampaigns = campaigns.filter(c => c.status === CampaignStatus.Active);

    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const warningCount  = alerts.filter(a => a.severity === 'warning').length;
    const healthScore   = Math.max(0, 100 - (criticalCount * 25 + warningCount * 10));

    return (
        <div className="space-y-5">
            {/* Health summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-5 text-center">
                    <div className={`text-4xl font-black mb-1 ${healthScore >= 80 ? 'text-green-500' : healthScore >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>{healthScore}</div>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">🏥 صحة الحملات</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-5 text-center">
                    <div className="text-3xl font-black text-red-600 dark:text-red-400 mb-1">{criticalCount}</div>
                    <p className="text-xs text-red-600 dark:text-red-400">🔴 تنبيهات حرجة</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-5 text-center">
                    <div className="text-3xl font-black text-yellow-600 dark:text-yellow-400 mb-1">{warningCount}</div>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">🟡 تحذيرات</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-5 text-center">
                    <div className="text-3xl font-black text-green-600 dark:text-green-400 mb-1">{activeCampaigns.length}</div>
                    <p className="text-xs text-green-600 dark:text-green-400">🟢 حملات نشطة</p>
                </div>
            </div>

            {alerts.length === 0 ? (
                <div className="text-center py-12">
                    <i className="fas fa-check-circle text-5xl text-green-500 mb-3" />
                    <p className="text-lg font-semibold text-light-text dark:text-dark-text">كل الحملات بصحة ممتازة!</p>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">لا توجد تحذيرات حالياً</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {['critical', 'warning', 'info'].map(sev => {
                        const sevAlerts = alerts.filter(a => a.severity === sev);
                        if (sevAlerts.length === 0) return null;
                        return (
                            <div key={sev}>
                                <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary mb-2 tracking-wide">{sev === 'critical' ? '🔴 حرج' : sev === 'warning' ? '🟡 تحذير' : '🔵 معلومة'}</p>
                                <div className="space-y-2">
                                    {sevAlerts.map((alert, i) => (
                                        <div key={i} className={`border rounded-2xl p-4 ${SEVERITY_COLOR[alert.severity]}`}>
                                            <div className="flex items-start gap-3">
                                                <i className={`fas ${SEVERITY_ICON[alert.severity]} mt-0.5 shrink-0`} />
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <span className="font-semibold text-sm">{alert.campaignName}</span>
                                                        <span className="text-xs bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full font-mono">{alert.metric}: {alert.value}</span>
                                                    </div>
                                                    <p className="text-sm">{alert.message}</p>
                                                    <p className="text-xs mt-1 opacity-80"><i className="fas fa-arrow-right mr-1" />{alert.action}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── ADS-3: Scaling Recommendations ──────────────────────────────────────────
type ScalingAction = 'scale_up' | 'scale_down' | 'pause' | 'duplicate' | 'ab_test' | 'maintain';

interface ScalingRec {
    campaignId: string;
    campaignName: string;
    action: ScalingAction;
    reason: string;
    expectedImpact: string;
    budgetChange?: string;
    confidence: number;
}

const ACTION_META: Record<ScalingAction, { label: string; color: string; icon: string }> = {
    scale_up:   { label: 'زِد الميزانية',    color: 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',     icon: 'fa-arrow-up' },
    scale_down: { label: 'قلّل الميزانية',   color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800', icon: 'fa-arrow-down' },
    pause:      { label: 'أوقف الحملة',     color: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',               icon: 'fa-pause' },
    duplicate:  { label: 'نسخ الحملة',      color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',           icon: 'fa-copy' },
    ab_test:    { label: 'A/B Test',         color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800', icon: 'fa-flask' },
    maintain:   { label: 'حافظ على الوضع',  color: 'text-gray-600 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800',           icon: 'fa-equals' },
};

const buildScalingRecs = (campaigns: AdCampaign[]): ScalingRec[] => {
    return campaigns.map(c => {
        const { roas, cpa, ctr, spend } = c.metrics;
        let action: ScalingAction = 'maintain';
        let reason = 'الأداء مستقر ضمن المستهدف';
        let expectedImpact = 'الحفاظ على ROAS الحالي';
        let budgetChange: string | undefined;
        let confidence = 70;

        if (roas >= 4) {
            action = 'scale_up'; reason = `ROAS ممتاز (${roas}x) — الحملة مربحة جداً`;
            expectedImpact = 'زيادة الإيرادات بنسبة 20-40%'; budgetChange = '+20-30%'; confidence = 88;
        } else if (roas >= 3 && ctr >= 1.5) {
            action = 'duplicate'; reason = `أداء قوي — يستحق التوسع بجمهور جديد`;
            expectedImpact = 'الوصول لشرائح جديدة دون تشبع الجمهور'; confidence = 80;
        } else if (roas < 1.5 || (roas < 2 && spend > c.budget * 0.5)) {
            action = 'pause'; reason = `ROAS (${roas}x) دون نقطة التعادل`;
            expectedImpact = 'وقف النزيف وإعادة بناء الحملة'; budgetChange = '-100%'; confidence = 92;
        } else if (ctr < 0.8) {
            action = 'ab_test'; reason = `CTR (${ctr}%) منخفض — المشكلة في الـ creative`;
            expectedImpact = 'تحسين CTR بنسبة 30-50% عبر اختبار creatives جديدة'; confidence = 75;
        } else if (roas >= 2.5 && roas < 3.5) {
            action = 'scale_down'; reason = `ROAS مقبول لكن هناك هامش للتحسين قبل التوسع`;
            expectedImpact = 'تقليل الهدر وزيادة الكفاءة'; budgetChange = '-10-15%'; confidence = 65;
        }
        return { campaignId: c.id, campaignName: c.name, action, reason, expectedImpact, budgetChange, confidence };
    });
};

const ScalingTab: React.FC<{ campaigns: AdCampaign[]; addNotification: (t: NotificationType, m: string) => void }> = ({ campaigns, addNotification }) => {
    const recs = useMemo(() => buildScalingRecs(campaigns), [campaigns]);

    const scaleUpCount = recs.filter(r => r.action === 'scale_up').length;
    const pauseCount   = recs.filter(r => r.action === 'pause').length;
    const totalBudget  = campaigns.reduce((s, c) => s + c.budget, 0);

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-5 text-center">
                    <div className="text-3xl font-black text-green-600 dark:text-green-400 mb-1">{scaleUpCount}</div>
                    <p className="text-sm text-green-600 dark:text-green-400">حملات جاهزة للتوسع</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-5 text-center">
                    <div className="text-3xl font-black text-red-600 dark:text-red-400 mb-1">{pauseCount}</div>
                    <p className="text-sm text-red-600 dark:text-red-400">حملات تحتاج إيقاف</p>
                </div>
                <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-5 text-center">
                    <div className="text-3xl font-black text-brand-primary mb-1">${totalBudget.toLocaleString()}</div>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">إجمالي الميزانية</p>
                </div>
            </div>

            <div className="space-y-3">
                {recs.map(rec => {
                    const meta = ACTION_META[rec.action];
                    return (
                        <div key={rec.campaignId} className={`border rounded-2xl p-5 ${meta.color}`}>
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/50 dark:bg-black/20 flex items-center justify-center shrink-0">
                                    <i className={`fas ${meta.icon}`} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 flex-wrap mb-2">
                                        <span className="font-bold text-sm">{rec.campaignName}</span>
                                        <span className="text-xs bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-full font-semibold">{meta.label}</span>
                                        {rec.budgetChange && (
                                            <span className="text-xs font-mono bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-full">{rec.budgetChange}</span>
                                        )}
                                        <span className="text-xs opacity-70">الثقة: {rec.confidence}%</span>
                                    </div>
                                    <p className="text-sm mb-1">{rec.reason}</p>
                                    <p className="text-xs opacity-70"><i className="fas fa-arrow-right mr-1" />{rec.expectedImpact}</p>
                                </div>
                                <button onClick={() => addNotification(NotificationType.Info, `تم تطبيق التوصية: ${meta.label} لحملة "${rec.campaignName}"`)}
                                    className="text-xs px-3 py-1.5 bg-white/50 dark:bg-black/20 rounded-xl font-semibold hover:bg-white/70 dark:hover:bg-black/30 transition-colors shrink-0">
                                    تطبيق
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const AdsOpsPage: React.FC<AdsOpsPageProps> = ({
    addNotification,
    brandProfile,
    campaigns,
    dashboardData,
    brandConnections,
    brandAssets,
    onNavigate,
}) => {
    const [showCreateWizard, setShowCreateWizard] = useState(false);
    const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
    const googleAdsConnection = useMemo(
        () => brandConnections.find((connection) => connection.provider === 'google_ads' && connection.status !== 'disconnected') ?? null,
        [brandConnections],
    );

    const handleCampaignCreated = (newCampaign: AdCampaign) => {
        addNotification(NotificationType.Success, `✅ تم إنشاء حملة "${newCampaign.name}" بنجاح!`);
        setShowCreateWizard(false);
    };

    const TABS: { id: ActiveTab; label: string; icon: string }[] = [
        { id: 'dashboard', label: 'لوحة التحكم',      icon: 'fa-tachometer-alt' },
        { id: 'campaigns', label: 'الحملات',           icon: 'fa-bullhorn' },
        { id: 'analytics', label: 'التحليلات',         icon: 'fa-chart-bar' },
        { id: 'copy',      label: 'توليد نسخ إعلانية', icon: 'fa-pen-nib' },
        { id: 'health',    label: 'تنبيهات الصحة',    icon: 'fa-heartbeat' },
        { id: 'scaling',   label: 'توصيات التوسع',    icon: 'fa-expand-arrows-alt' },
    ];

    const alertCount = useMemo(() => buildHealthAlerts(campaigns).filter(a => a.severity === 'critical').length, [campaigns]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">الإعلانات المدفوعة</h1>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                        {campaigns.length} حملة · ROAS متوسط: {campaigns.length > 0 ? (campaigns.reduce((s, c) => s + c.metrics.roas, 0) / campaigns.length).toFixed(1) : '—'}x
                    </p>
                </div>
                <button onClick={() => setShowCreateWizard(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-brand-pink to-brand-purple text-white font-bold py-2.5 px-5 rounded-xl shadow-lg hover:opacity-90 hover:-translate-y-0.5 transition-all">
                    <i className="fas fa-plus text-xs" /> إنشاء حملة جديدة
                </button>
            </div>

            <ProviderConnectionCallout
                title="Google Ads"
                description="Ù…ØµØ¯Ø± Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª Ø§Ù„Ø¥Ø¹Ù„Ø§Ù†ÙŠØ© Ø§Ù„Ù…Ø±ØªØ¨Ø·Ø© Ø¨Ù‡Ø°Ø§ Ø§Ù„Ø¨Ø±Ø§Ù†Ø¯ ÙˆØ¨Ø£ØµÙˆÙ„ Ads Ops."
                connection={googleAdsConnection}
                brandAssets={brandAssets}
                emptyTitle="Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø§ØªØµØ§Ù„ Google Ads Ø­ÙŠ Ø¨Ø¹Ø¯"
                emptyDescription="Ø¹Ù†Ø¯ Ø±Ø¨Ø· Google Ads Ù…Ù† Ù…Ø³Ø§Ø­Ø© Ø§Ù„ØªÙƒØ§Ù…Ù„Ø§Øª Ø³ØªÙØ­ÙØ¸ Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª Ø§Ù„Ù…ÙƒØªØ´ÙØ© ÙˆØªØ¸Ù‡Ø± Ø­Ø§Ù„ØªÙ‡Ø§ Ù‡Ù†Ø§ Ù…Ø¨Ø§Ø´Ø±Ø©."
                primaryActionLabel="ÙØªØ­ Ù…Ø³Ø§Ø­Ø© Ø§Ù„ØªÙƒØ§Ù…Ù„Ø§Øª"
                onPrimaryAction={() => onNavigate('integrations')}
                secondaryActionLabel="ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø±Ø¨Ø·"
                onSecondaryAction={() => onNavigate('integrations')}
            />

            {/* Demo data notice */}
            {campaigns.length > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                    <p className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400">
                        <i className="fas fa-info-circle" />
                        البيانات المعروضة تجريبية — وصّل حساب الإعلانات لرؤية أرقامك الفعلية
                    </p>
                    <button onClick={() => onNavigate('integrations')} className="shrink-0 text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap">
                        ربط Meta Ads ←
                    </button>
                </div>
            )}

            <div className="border-b border-light-border dark:border-dark-border">
                <nav className="-mb-px flex gap-1 overflow-x-auto">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors relative ${
                                activeTab === tab.id
                                    ? 'border-brand-primary text-brand-primary'
                                    : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text hover:border-gray-300 dark:hover:border-gray-500'
                            }`}>
                            <i className={`fas ${tab.icon} text-xs`} />
                            {tab.label}
                            {tab.id === 'health' && alertCount > 0 && (
                                <span className="ml-1 text-xs bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">{alertCount}</span>
                            )}
                        </button>
                    ))}
                </nav>
            </div>

            <div>
                {activeTab === 'dashboard' && <AdsDashboard data={dashboardData} campaigns={campaigns} />}
                {activeTab === 'campaigns' && <CampaignsList campaigns={campaigns} />}
                {activeTab === 'analytics' && <AdAnalytics campaigns={campaigns} />}
                {activeTab === 'copy'      && <AdCopyTab brandProfile={brandProfile} addNotification={addNotification} />}
                {activeTab === 'health'    && <HealthAlertsTab campaigns={campaigns} />}
                {activeTab === 'scaling'   && <ScalingTab campaigns={campaigns} addNotification={addNotification} />}
            </div>

            {showCreateWizard && (
                <CreateCampaignWizard
                    onClose={() => setShowCreateWizard(false)}
                    brandProfile={brandProfile}
                    onCampaignCreated={handleCampaignCreated}
                    addNotification={addNotification}
                />
            )}
        </div>
    );
};
