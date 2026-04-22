// components/seo/TechnicalSEOAudit.tsx
import React, { useState, useMemo } from 'react';
import { TechnicalSEOAuditResult, NotificationType, AuditIssue } from '../../types';
import { runTechnicalSEOAudit } from '../../services/seoAuditService';

interface TechnicalSEOAuditProps {
    addNotification: (type: NotificationType, message: string) => void;
}

// ─── Score Donut ─────────────────────────────────────────────────────────────
const ScoreDonut: React.FC<{ score: number; label: string }> = ({ score, label }) => {
    const color = score >= 85 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    return (
        <div className="relative w-36 h-36 mx-auto">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle className="text-light-bg dark:text-dark-bg" cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="10" />
                <circle
                    className={color} cx="50" cy="50" r="45"
                    fill="none" stroke="currentColor" strokeWidth="10"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${color}`}>{score}</span>
                <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{label}</span>
            </div>
        </div>
    );
};

// ─── Category Score Bar ───────────────────────────────────────────────────────
const CategoryScore: React.FC<{ label: string; score: number; icon: string }> = ({ label, score, icon }) => {
    const color = score >= 85 ? 'bg-green-400' : score >= 50 ? 'bg-yellow-400' : 'bg-red-400';
    const textColor = score >= 85 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium text-light-text dark:text-dark-text">
                    <i className={`fas ${icon} text-xs`} />
                    {label}
                </span>
                <span className={`font-bold ${textColor}`}>{score}</span>
            </div>
            <div className="h-1.5 rounded-full bg-light-bg dark:bg-dark-bg overflow-hidden">
                <div
                    className={`h-1.5 rounded-full ${color} transition-all duration-700`}
                    style={{ width: `${score}%` }}
                />
            </div>
        </div>
    );
};

// ─── Core Web Vitals Card ─────────────────────────────────────────────────────
const VitalCard: React.FC<{ metric: string; value: number; unit: string; rating: 'good' | 'average' | 'poor' }> = ({ metric, value, unit, rating }) => {
    const colors = { good: 'text-green-400', average: 'text-yellow-400', poor: 'text-red-400' };
    const bgColors = { good: 'bg-green-400/10', average: 'bg-yellow-400/10', poor: 'bg-red-400/10' };
    const labels = { good: 'جيد', average: 'يحتاج تحسين', poor: 'ضعيف' };
    return (
        <div className={`p-3 rounded-lg text-center ${bgColors[rating]}`}>
            <p className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">{metric}</p>
            <p className={`text-2xl font-bold ${colors[rating]} mt-1`}>{value}<span className="text-base font-normal">{unit}</span></p>
            <p className={`text-xs mt-1 font-medium ${colors[rating]}`}>{labels[rating]}</p>
        </div>
    );
};

// ─── Issue Card ───────────────────────────────────────────────────────────────
const IssueCard: React.FC<{ issue: AuditIssue }> = ({ issue }) => {
    const [expanded, setExpanded] = useState(false);
    const config = {
        error:   { icon: 'fa-times-circle', border: 'border-red-500',    badge: 'bg-red-500/15 text-red-400',    label: 'خطأ' },
        warning: { icon: 'fa-exclamation-triangle', border: 'border-yellow-500', badge: 'bg-yellow-500/15 text-yellow-400', label: 'تحذير' },
        good:    { icon: 'fa-check-circle', border: 'border-green-500',  badge: 'bg-green-500/15 text-green-400', label: 'جيد' },
    }[issue.severity];
    return (
        <div className={`bg-light-bg dark:bg-dark-bg rounded-lg border-l-4 ${config.border} overflow-hidden`}>
            <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                className="w-full flex items-start justify-between p-4 text-start hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
                <div className="flex items-start gap-3 flex-1">
                    <i className={`fas ${config.icon} mt-0.5 flex-shrink-0 ${
                        issue.severity === 'error' ? 'text-red-400' : issue.severity === 'warning' ? 'text-yellow-400' : 'text-green-400'
                    }`} />
                    <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="font-semibold text-light-text dark:text-dark-text text-sm">{issue.title}</h5>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${config.badge}`}>{config.label}</span>
                        </div>
                        {!expanded && (
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 line-clamp-1">{issue.description}</p>
                        )}
                    </div>
                </div>
                <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} text-xs text-light-text-secondary dark:text-dark-text-secondary ms-2 flex-shrink-0 mt-1`} />
            </button>
            {expanded && (
                <div className="px-4 pb-4 space-y-2">
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary leading-6">{issue.description}</p>
                    <div className="rounded-md bg-light-card dark:bg-dark-card p-3">
                        <p className="text-xs font-semibold text-brand-secondary mb-1">التوصية:</p>
                        <p className="text-xs text-light-text dark:text-dark-text leading-6">{issue.recommendation}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Audit Section ────────────────────────────────────────────────────────────
const AuditSection: React.FC<{ title: string; icon: string; issueCount: number; children: React.ReactNode }> = ({ title, icon, issueCount, children }) => (
    <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border">
        <h3 className="font-bold text-light-text dark:text-dark-text mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
                <i className={`fas ${icon} text-brand-primary`} />
                {title}
            </span>
            {issueCount > 0 && (
                <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-semibold">
                    {issueCount} مشكلة
                </span>
            )}
        </h3>
        {children}
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export const TechnicalSEOAudit: React.FC<TechnicalSEOAuditProps> = ({ addNotification }) => {
    const [url, setUrl] = useState('https://');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<TechnicalSEOAuditResult | null>(null);
    const [loadingStep, setLoadingStep] = useState('');

    const handleRunAudit = async () => {
        if (!url.trim() || !url.startsWith('https://')) {
            addNotification(NotificationType.Warning, 'الرجاء إدخال عنوان URL صالح يبدأ بـ https://');
            return;
        }
        setIsLoading(true);
        setResult(null);
        setLoadingStep('يتصل بـ PageSpeed Insights API...');
        try {
            setLoadingStep('يحلل الأداء و Core Web Vitals...');
            const auditResult = await runTechnicalSEOAudit(url);
            setResult(auditResult);
            const totalIssues = [
                ...auditResult.crawling.issues,
                ...auditResult.performance.issues,
                ...auditResult.structuredData.issues,
            ].length;
            addNotification(
                totalIssues === 0 ? NotificationType.Success : NotificationType.Info,
                `اكتمل التدقيق — درجة الصحة: ${auditResult.overallScore}/100 · ${totalIssues} مشكلة`
            );
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'خطأ غير معروف';
            addNotification(NotificationType.Error, `فشل التدقيق: ${msg}`);
        } finally {
            setIsLoading(false);
            setLoadingStep('');
        }
    };

    const { allIssues, errors, warnings } = useMemo(() => {
        const all = result ? [
            ...result.crawling.issues,
            ...result.performance.issues,
            ...result.structuredData.issues,
        ] : [];
        return {
            allIssues: all,
            errors:   all.filter(i => i.severity === 'error').length,
            warnings: all.filter(i => i.severity === 'warning').length,
        };
    }, [result]);

    return (
        <div className="space-y-6">
            {/* URL Input */}
            <div className="bg-light-card dark:bg-dark-card p-6 rounded-lg border border-light-border dark:border-dark-border">
                <label htmlFor="url-input" className="block text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
                    أدخل عنوان URL لبدء التدقيق التقني الكامل
                </label>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-3">
                    يستخدم Google PageSpeed Insights API للحصول على بيانات حقيقية — Lighthouse + Core Web Vitals
                </p>
                <div className="flex gap-3">
                    <input
                        id="url-input"
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void handleRunAudit()}
                        placeholder="https://example.com"
                        className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg py-2 px-4 text-light-text dark:text-dark-text focus:ring-brand-primary focus:border-brand-primary"
                    />
                    <button
                        onClick={() => void handleRunAudit()}
                        disabled={isLoading}
                        className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50 flex-shrink-0 flex items-center gap-2"
                    >
                        {isLoading ? <><i className="fas fa-spinner fa-spin" />جارٍ التدقيق...</> : <><i className="fas fa-search" />بدء التدقيق</>}
                    </button>
                </div>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="text-center py-10">
                    <i className="fas fa-cogs fa-spin text-4xl text-brand-secondary mb-4" />
                    <h2 className="text-xl font-bold text-light-text dark:text-dark-text">يفحص موقعك عبر Google PSI...</h2>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-2 text-sm">{loadingStep}</p>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1 text-xs opacity-70">قد تستغرق هذه العملية 15-30 ثانية</p>
                </div>
            )}

            {/* Results */}
            {result && !isLoading && (
                <div className="space-y-6 animate-fade-in">
                    <style>{`
                        @keyframes fade-in { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
                        .animate-fade-in { animation: fade-in 0.5s ease-out; }
                    `}</style>

                    {/* Score Summary */}
                    <div className="bg-light-card dark:bg-dark-card p-6 rounded-lg border border-light-border dark:border-dark-border">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                            {/* Overall Donut */}
                            <div className="md:col-span-1 flex flex-col items-center gap-2">
                                <ScoreDonut score={result.overallScore} label="درجة الصحة" />
                                <p className="text-xs text-center text-light-text-secondary dark:text-dark-text-secondary leading-5">
                                    perf×30% + seo×35%<br />+ bp×20% + a11y×15%
                                </p>
                            </div>
                            {/* Category bars */}
                            <div className="md:col-span-2 space-y-4">
                                {result.scores && (
                                    <>
                                        <CategoryScore label="الأداء (Performance)" score={result.scores.performance} icon="fa-tachometer-alt" />
                                        <CategoryScore label="SEO" score={result.scores.seo} icon="fa-search" />
                                        <CategoryScore label="أفضل الممارسات" score={result.scores.bestPractices} icon="fa-shield-alt" />
                                        <CategoryScore label="الوصول (Accessibility)" score={result.scores.accessibility} icon="fa-universal-access" />
                                    </>
                                )}
                            </div>
                            {/* Issue counts */}
                            <div className="md:col-span-1 space-y-3">
                                <div className="bg-red-500/10 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-red-400">{errors}</p>
                                    <p className="text-xs text-red-400 mt-1">أخطاء حرجة</p>
                                </div>
                                <div className="bg-yellow-500/10 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-yellow-400">{warnings}</p>
                                    <p className="text-xs text-yellow-400 mt-1">تحذيرات</p>
                                </div>
                                <p className="text-xs text-center text-light-text-secondary dark:text-dark-text-secondary">
                                    {result.auditedAt.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Core Web Vitals */}
                    <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border">
                        <h3 className="font-bold text-light-text dark:text-dark-text mb-4 flex items-center gap-2">
                            <i className="fas fa-heartbeat text-brand-primary" />
                            Core Web Vitals
                            <span className="text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary">(بيانات حقيقية من Google)</span>
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            <VitalCard metric="LCP" value={result.performance.vitals.lcp.value} unit="s" rating={result.performance.vitals.lcp.rating} />
                            <VitalCard metric="CLS" value={result.performance.vitals.cls.value} unit="" rating={result.performance.vitals.cls.rating} />
                            <VitalCard metric="INP" value={result.performance.vitals.inp.value} unit="ms" rating={result.performance.vitals.inp.rating} />
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            <div className="text-center">LCP &lt; 2.5s جيد</div>
                            <div className="text-center">CLS &lt; 0.10 جيد</div>
                            <div className="text-center">INP &lt; 200ms جيد</div>
                        </div>
                    </div>

                    {/* Issue Sections */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <AuditSection title="الزحف والفهرسة (SEO)" icon="fa-spider" issueCount={result.crawling.issues.length}>
                            <div className="space-y-2">
                                {result.crawling.issues.length === 0
                                    ? <p className="text-sm text-green-400 flex items-center gap-2"><i className="fas fa-check-circle" />لا توجد مشاكل SEO مكتشفة.</p>
                                    : result.crawling.issues.map(issue => <IssueCard key={issue.id} issue={issue} />)
                                }
                            </div>
                        </AuditSection>

                        <AuditSection title="الأداء والتحميل" icon="fa-tachometer-alt" issueCount={result.performance.issues.length}>
                            <div className="space-y-2">
                                {result.performance.issues.length === 0
                                    ? <p className="text-sm text-green-400 flex items-center gap-2"><i className="fas fa-check-circle" />أداء الموقع جيد.</p>
                                    : result.performance.issues.map(issue => <IssueCard key={issue.id} issue={issue} />)
                                }
                            </div>
                        </AuditSection>

                        <AuditSection title="البيانات المنظمة (Schema)" icon="fa-sitemap" issueCount={result.structuredData.issues.length}>
                            <div className="space-y-3">
                                {result.structuredData.typesFound.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {result.structuredData.typesFound.map(type => (
                                            <span key={type} className="bg-brand-primary/20 text-brand-primary text-xs font-semibold px-2 py-1 rounded-full">{type}</span>
                                        ))}
                                    </div>
                                )}
                                {result.structuredData.issues.length === 0
                                    ? <p className="text-sm text-green-400 flex items-center gap-2"><i className="fas fa-check-circle" />البيانات المنظمة سليمة.</p>
                                    : result.structuredData.issues.map(issue => <IssueCard key={issue.id} issue={issue} />)
                                }
                            </div>
                        </AuditSection>
                    </div>
                </div>
            )}
        </div>
    );
};
