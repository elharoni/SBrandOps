// components/pages/ErrorCenterPage.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { OperationalError, NotificationType, ErrorSeverity, ErrorSource, ErrorStatus, AIErrorAnalysis } from '../../types';
import { analyzeOperationalErrors } from '../../services/geminiService';

interface ErrorCenterPageProps {
    addNotification: (type: NotificationType, message: string) => void;
    errors: OperationalError[];
}

const SEVERITY_CONFIG: { [key in ErrorSeverity]: { icon: string; color: string; } } = {
    [ErrorSeverity.Critical]: { icon: 'fa-times-circle', color: 'text-red-400' },
    [ErrorSeverity.Warning]: { icon: 'fa-exclamation-triangle', color: 'text-yellow-400' },
    [ErrorSeverity.Info]: { icon: 'fa-info-circle', color: 'text-blue-400' },
};

const SOURCE_CONFIG: { [key in ErrorSource]: { icon: string; } } = {
    [ErrorSource.SocialOps]: { icon: 'fa-share-alt' },
    [ErrorSource.AdsOps]: { icon: 'fa-bullhorn' },
    [ErrorSource.SEOOps]: { icon: 'fa-search-location' },
    [ErrorSource.System]: { icon: 'fa-cogs' },
};

const STATUS_CONFIG: { [key in ErrorStatus]: { color: string; } } = {
    [ErrorStatus.New]: { color: 'text-blue-400' },
    [ErrorStatus.Acknowledged]: { color: 'text-yellow-400' },
    [ErrorStatus.Resolved]: { color: 'text-green-400' },
};


const ErrorCard: React.FC<{
    error: OperationalError;
    onUpdateStatus: (id: string, status: ErrorStatus) => void;
}> = ({ error, onUpdateStatus }) => {
    const severity = SEVERITY_CONFIG[error.severity];
    const source = SOURCE_CONFIG[error.source];
    const status = STATUS_CONFIG[error.status];

    return (
        <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg border border-light-border dark:border-dark-border">
            <div className="flex justify-between items-start gap-4">
                <div>
                    <h3 className={`font-bold text-light-text dark:text-dark-text flex items-center gap-2 ${severity.color}`}>
                        <i className={`fas ${severity.icon}`}></i>
                        {error.title}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-light-text-secondary dark:text-dark-text-secondary mt-2">
                        <span><i className={`fas ${source.icon} me-1`}></i>{error.source}</span>
                        <span><i className="far fa-clock me-1"></i>{new Date(error.timestamp).toLocaleString('ar-EG')}</span>
                        <span>الحالة: <span className={`font-semibold ${status.color}`}>{error.status}</span></span>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {error.status === ErrorStatus.New && (
                        <button onClick={() => onUpdateStatus(error.id, ErrorStatus.Acknowledged)} className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text px-3 py-1.5 rounded-md bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border">
                            <i className="fas fa-check me-1"></i>รับทราบ
                        </button>
                    )}
                    {error.status !== ErrorStatus.Resolved && (
                         <button onClick={() => onUpdateStatus(error.id, ErrorStatus.Resolved)} className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-md">
                           <i className="fas fa-check-double me-1"></i>وضع علامة "تم الحل"
                        </button>
                    )}
                </div>
            </div>
            <p className="text-sm text-light-text dark:text-dark-text mt-3 pt-3 border-t border-light-border/50 dark:border-dark-border/50">{error.description}</p>
        </div>
    );
};

export const ErrorCenterPage: React.FC<ErrorCenterPageProps> = ({ addNotification, errors }) => {
    const [localErrors, setLocalErrors] = useState<OperationalError[]>(errors);
    const [aiAnalysis, setAiAnalysis] = useState<AIErrorAnalysis | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    
    // Filters
    const [severityFilter, setSeverityFilter] = useState<'all' | ErrorSeverity>('all');
    const [sourceFilter, setSourceFilter] = useState<'all' | ErrorSource>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | ErrorStatus>('all');

    useEffect(() => {
        setLocalErrors(errors);
    }, [errors]);
    
    const filteredErrors = useMemo(() => {
        return localErrors.filter(e => {
            const severityMatch = severityFilter === 'all' || e.severity === severityFilter;
            const sourceMatch = sourceFilter === 'all' || e.source === sourceFilter;
            const statusMatch = statusFilter === 'all' || e.status === statusFilter;
            return severityMatch && sourceMatch && statusMatch;
        });
    }, [localErrors, severityFilter, sourceFilter, statusFilter]);
    
    const newErrorsCount = useMemo(() => localErrors.filter(e => e.status === ErrorStatus.New).length, [localErrors]);

    const handleAnalyzeErrors = () => {
        const errorsToAnalyze = filteredErrors.filter(e => e.status === ErrorStatus.New);
        if(errorsToAnalyze.length === 0) {
            addNotification(NotificationType.Info, "لا توجد أخطاء جديدة في العرض الحالي لتحليلها.");
            return;
        }
        setIsAiLoading(true);
        analyzeOperationalErrors(errorsToAnalyze)
            .then(setAiAnalysis)
            .catch(() => addNotification(NotificationType.Error, "فشل في توليد تحليل الأخطاء."))
            .finally(() => setIsAiLoading(false));
    };

    const handleUpdateStatus = (id: string, status: ErrorStatus) => {
        setLocalErrors(prevErrors => 
            prevErrors.map(err => err.id === id ? { ...err, status } : err)
        );
        addNotification(NotificationType.Success, `تم تحديث حالة الخطأ إلى "${status}".`);
        // In a real app, an API call would be made here to persist the change.
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">مركز الأخطاء والعمليات</h1>
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
                هنا يمكنك مراجعة أي مشاكل تشغيلية تتطلب انتباهك.
            </p>

            <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border">
                <div className="flex justify-between items-center">
                    <div>
                         <h2 className="text-xl font-bold text-light-text dark:text-dark-text">تحليل الذكاء الاصطناعي للأخطاء</h2>
                         <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">يوجد {newErrorsCount} خطأ جديد يتطلب المراجعة.</p>
                    </div>
                    <button onClick={handleAnalyzeErrors} disabled={isAiLoading} className="bg-brand-primary text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-500">
                        {isAiLoading ? 'جاري التحليل...' : 'تحليل الأخطاء الجديدة'}
                    </button>
                </div>
                 {isAiLoading && <p className="text-center py-6 text-light-text-secondary dark:text-dark-text-secondary">يقوم Gemini بتحليل المشاكل...</p>}
                 {aiAnalysis && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-sm animate-fade-in">
                        <style>{`@keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } } .animate-fade-in { animation: fade-in 0.5s ease-out; }`}</style>
                        <div className="md:col-span-1 bg-light-bg dark:bg-dark-bg p-4 rounded-md">
                            <h4 className="font-semibold text-light-text dark:text-dark-text mb-2">الملخص</h4>
                            <p className="text-light-text-secondary dark:text-dark-text-secondary">{aiAnalysis.summary}</p>
                        </div>
                        <div className="md:col-span-2 bg-light-bg dark:bg-dark-bg p-4 rounded-md">
                            <h4 className="font-semibold text-light-text dark:text-dark-text mb-2">التوصيات ذات الأولوية</h4>
                            <ul className="space-y-2">
                                {aiAnalysis.recommendations.sort((a,b) => a.priority - b.priority).map((rec) => (
                                    <li key={rec.priority} className="flex items-start">
                                        <span className="bg-brand-secondary text-white font-bold rounded-full w-5 h-5 flex items-center justify-center text-xs me-3 mt-0.5">{rec.priority}</span>
                                        <span className="text-light-text-secondary dark:text-dark-text-secondary flex-1">{rec.text}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
            
             <div className="space-y-4">
                 <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-light-text dark:text-dark-text">سجل الأخطاء ({filteredErrors.length})</h2>
                    <div className="flex items-center gap-2">
                        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value as any)} className="bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg py-1 px-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            <option value="all">كل الخطورة</option>
                            {Object.values(ErrorSeverity).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value as any)} className="bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg py-1 px-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            <option value="all">كل المصادر</option>
                            {Object.values(ErrorSource).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg py-1 px-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            <option value="all">كل الحالات</option>
                            {Object.values(ErrorStatus).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
                {filteredErrors.length > 0 ? (
                    filteredErrors.map(error => <ErrorCard key={error.id} error={error} onUpdateStatus={handleUpdateStatus} />)
                ) : (
                    <div className="text-center py-10 bg-light-card dark:bg-dark-card rounded-lg border border-light-border dark:border-dark-border">
                        <i className="fas fa-check-circle text-4xl text-green-400 mb-3"></i>
                        <p className="text-light-text-secondary dark:text-dark-text-secondary">لا توجد أخطاء تطابق الفلاتر المحددة.</p>
                    </div>
                )}
            </div>
        </div>
    );
};