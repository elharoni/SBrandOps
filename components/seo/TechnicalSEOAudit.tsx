// components/seo/TechnicalSEOAudit.tsx
import React, { useState } from 'react';
import { TechnicalSEOAuditResult, NotificationType, AuditIssue, CoreWebVitals } from '../../types';
import { runTechnicalSEOAudit } from '../../services/seoAuditService';

interface TechnicalSEOAuditProps {
    addNotification: (type: NotificationType, message: string) => void;
}

const ScoreDonut: React.FC<{ score: number }> = ({ score }) => {
    const color = score >= 85 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
        <div className="relative w-48 h-48 mx-auto">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle className="text-light-bg dark:text-dark-bg" cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="10" />
                <circle
                    className={color} cx="50" cy="50" r="45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">درجة الصحة</span>
                <span className={`text-5xl font-bold ${color}`}>{score}</span>
            </div>
        </div>
    );
};

const VitalCard: React.FC<{ metric: string, value: number, unit: string, rating: 'good' | 'average' | 'poor' }> = ({ metric, value, unit, rating }) => {
    const colors = {
        good: 'text-green-400',
        average: 'text-yellow-400',
        poor: 'text-red-400',
    };
    return (
        <div className="bg-light-bg dark:bg-dark-bg p-3 rounded-md text-center">
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{metric}</p>
            <p className={`text-2xl font-bold ${colors[rating]}`}>{value}<span className="text-base">{unit}</span></p>
        </div>
    );
};

const IssueCard: React.FC<{ issue: AuditIssue }> = ({ issue }) => {
    const severityConfig = {
        error: { icon: 'fa-times-circle', color: 'border-red-500' },
        warning: { icon: 'fa-exclamation-triangle', color: 'border-yellow-500' },
        good: { icon: 'fa-check-circle', color: 'border-green-500' },
    };
    const config = severityConfig[issue.severity];
    return (
        <div className={`bg-light-bg dark:bg-dark-bg p-4 rounded-lg border-l-4 ${config.color}`}>
            <h5 className="font-bold text-light-text dark:text-dark-text flex items-center"><i className={`fas ${config.icon} me-2`}></i>{issue.title}</h5>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary my-2">{issue.description}</p>
            <p className="text-xs bg-light-card dark:bg-dark-card p-2 rounded-md"><strong className="text-brand-secondary">توصية:</strong> {issue.recommendation}</p>
        </div>
    );
};

const AuditSection: React.FC<{ title: string, icon: string, children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border">
        <h3 className="font-bold text-light-text dark:text-dark-text mb-4 text-lg flex items-center">
            <i className={`fas ${icon} me-3 text-brand-primary`}></i>{title}
        </h3>
        {children}
    </div>
);


export const TechnicalSEOAudit: React.FC<TechnicalSEOAuditProps> = ({ addNotification }) => {
    const [url, setUrl] = useState('https://confort-tex.com');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<TechnicalSEOAuditResult | null>(null);

    const handleRunAudit = async () => {
        if (!url.trim() || !url.startsWith('https://')) {
            addNotification(NotificationType.Warning, 'الرجاء إدخال عنوان URL صالح يبدأ بـ https://');
            return;
        }
        setIsLoading(true);
        setResult(null);
        try {
            const auditResult = await runTechnicalSEOAudit(url);
            setResult(auditResult);
        } catch (error) {
            addNotification(NotificationType.Error, 'حدث خطأ أثناء إجراء التدقيق.');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const renderResults = () => {
        if (!result) return null;
        const allIssues = [...result.crawling.issues, ...result.performance.issues, ...result.structuredData.issues];
        const errors = allIssues.filter(i => i.severity === 'error').length;
        const warnings = allIssues.filter(i => i.severity === 'warning').length;

        return (
             <div className="mt-6 space-y-6 animate-fade-in">
                <style>{`
                    @keyframes fade-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
                    .animate-fade-in { animation: fade-in 0.5s ease-out; }
                `}</style>
                <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    <div className="md:col-span-1">
                        <ScoreDonut score={result.overallScore} />
                    </div>
                    <div className="md:col-span-2 grid grid-cols-2 gap-4">
                        <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg text-center">
                            <p className="text-4xl font-bold text-light-text dark:text-dark-text">{errors}</p>
                            <p className="text-sm text-red-400">أخطاء حرجة</p>
                        </div>
                        <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg text-center">
                            <p className="text-4xl font-bold text-light-text dark:text-dark-text">{warnings}</p>
                            <p className="text-sm text-yellow-400">تحذيرات هامة</p>
                        </div>
                        <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg text-center col-span-2">
                             <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">تم تدقيق {result.url} في {result.auditedAt.toLocaleDateString('ar-EG')}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <AuditSection title="الزحف والفهرسة" icon="fa-spider">
                        <div className="space-y-3">
                            {result.crawling.issues.length > 0 ? (
                                result.crawling.issues.map(issue => <IssueCard key={issue.id} issue={issue} />)
                            ) : (
                                <p className="text-sm text-green-400"><i className="fas fa-check-circle me-2"></i>لا توجد مشاكل حرجة في الزحف.</p>
                            )}
                        </div>
                    </AuditSection>
                    <AuditSection title="الأداء والتجربة" icon="fa-tachometer-alt">
                         <div className="grid grid-cols-3 gap-3 mb-4">
                             <VitalCard metric="LCP" value={result.performance.vitals.lcp.value} unit="s" rating={result.performance.vitals.lcp.rating} />
                             <VitalCard metric="CLS" value={result.performance.vitals.cls.value} unit="" rating={result.performance.vitals.cls.rating} />
                             <VitalCard metric="INP" value={result.performance.vitals.inp.value} unit="ms" rating={result.performance.vitals.inp.rating} />
                         </div>
                         <div className="space-y-3">
                            {result.performance.issues.length > 0 ? (
                                result.performance.issues.map(issue => <IssueCard key={issue.id} issue={issue} />)
                            ) : (
                                <p className="text-sm text-green-400"><i className="fas fa-check-circle me-2"></i>مؤشرات الأداء تبدو جيدة.</p>
                            )}
                        </div>
                    </AuditSection>
                     <AuditSection title="هيكلة البيانات (Schema)" icon="fa-sitemap">
                         <div className="space-y-3">
                             <div className="flex flex-wrap gap-2">
                                {result.structuredData.typesFound.map(type => (
                                    <span key={type} className="bg-brand-primary/20 text-brand-primary text-xs font-semibold px-2 py-1 rounded-full">{type}</span>
                                ))}
                            </div>
                            {result.structuredData.issues.length > 0 ? (
                                result.structuredData.issues.map(issue => <IssueCard key={issue.id} issue={issue} />)
                            ) : (
                                <p className="text-sm text-green-400"><i className="fas fa-check-circle me-2"></i>لا توجد مشاكل في البيانات المنظمة.</p>
                            )}
                        </div>
                    </AuditSection>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
             <div className="bg-light-card dark:bg-dark-card p-6 rounded-lg border border-light-border dark:border-dark-border">
                <label htmlFor="url-input" className="block text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary mb-2">
                    أدخل عنوان URL لموقعك لبدء التدقيق الفني
                </label>
                <div className="flex gap-3">
                    <input
                        id="url-input"
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg py-2 px-4 text-light-text dark:text-dark-text focus:ring-brand-primary focus:border-brand-primary"
                    />
                    <button onClick={handleRunAudit} disabled={isLoading} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-500 flex-shrink-0">
                        {isLoading ? <><i className="fas fa-spinner fa-spin me-2"></i>جارٍ التدقيق...</> : 'بدء التدقيق'}
                    </button>
                </div>
            </div>
            {isLoading && (
                <div className="text-center py-10">
                    <i className="fas fa-cogs fa-spin text-4xl text-brand-secondary mb-4"></i>
                    <h2 className="text-xl font-bold text-light-text dark:text-dark-text">نقوم بفحص موقعك...</h2>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-2">قد تستغرق هذه العملية دقيقة.</p>
                </div>
            )}
            {renderResults()}
        </div>
    );
};