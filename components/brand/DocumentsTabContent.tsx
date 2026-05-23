import React, { useState } from 'react';
import { BrandHubProfile, NotificationType } from '../../types';
import { BrandDocument, DOC_TYPE_LABELS } from '../../services/brandDocumentService';
import { BrandImportModal } from '../BrandImportModal';

interface DocumentsTabContentProps {
    profile: BrandHubProfile;
    brandId: string;
    documents: BrandDocument[];
    isLoadingDocs: boolean;
    handleDeleteDocument: (docId: string) => Promise<void>;
    refreshBrandHubData: () => Promise<void>;
    addNotification: (type: NotificationType, message: string) => void;
    onNavigate?: (page: string) => void;
    setActiveTab: (tab: 'identity' | 'voice' | 'audience' | 'ai-memory' | 'assets' | 'documents' | 'intelligence') => void;
}

export const DocumentsTabContent: React.FC<DocumentsTabContentProps> = ({
    profile,
    brandId,
    documents,
    isLoadingDocs,
    handleDeleteDocument,
    refreshBrandHubData,
    addNotification,
    onNavigate,
    setActiveTab,
}) => {
    const [showImportModal, setShowImportModal] = useState(false);
    const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

    const onDeleteClick = async (docId: string) => {
        setDeletingDocId(docId);
        try {
            await handleDeleteDocument(docId);
        } finally {
            setDeletingDocId(null);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            {showImportModal && (
                <BrandImportModal
                    onClose={() => setShowImportModal(false)}
                    existingBrandId={brandId}
                    onImported={async () => {
                        setShowImportModal(false);
                        await refreshBrandHubData();
                        addNotification(NotificationType.Success, 'تم إضافة الوثائق إلى مكتبة التعلم بنجاح');
                    }}
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <i className="fas fa-book-open text-brand-pink" />
                        مكتبة التعلم (Learning Library)
                    </h2>
                    <p className="text-xs text-dark-text-secondary mt-0.5">
                        الوثائق والمستندات التي تُغذّي ذكاء البراند — كلما أضفت أكثر، تعلّم النظام تفاصيل عملك بدقة أكبر.
                    </p>
                </div>
                <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-brand-pink to-brand-purple text-white font-bold py-2.5 px-4 rounded-xl hover:opacity-95 hover:shadow-lg transition-all text-xs"
                >
                    <i className="fas fa-plus text-[10px]" />
                    إضافة وثائق جديدة
                </button>
            </div>

            {/* Document Listing or Skeletons */}
            {isLoadingDocs ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-slate-900/40 border border-white/5 backdrop-blur-md rounded-2xl p-5 animate-pulse flex gap-4 items-start">
                            <div className="w-11 h-11 bg-white/5 rounded-xl shrink-0" />
                            <div className="flex-1 space-y-2.5">
                                <div className="h-4 bg-white/10 rounded w-1/3" />
                                <div className="h-3 bg-white/5 rounded w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : documents.length === 0 ? (
                <div className="text-center py-16 bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-7 space-y-4 shadow-xl relative overflow-hidden group">
                    <div className="absolute -right-24 -top-24 w-48 h-48 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />
                    <div className="w-16 h-16 rounded-2xl bg-slate-950/50 border border-white/5 flex items-center justify-center mx-auto shadow-inner">
                        <i className="fas fa-book-open text-2xl text-brand-pink" />
                    </div>
                    <p className="text-white font-extrabold text-base">لا توجد وثائق في المكتبة بعد</p>
                    <p className="text-dark-text-secondary text-xs max-w-sm mx-auto leading-relaxed">
                        ارفع كتاب البراند، وثائق المنتجات، أمثلة المحتوى السابقة، أو ملفات نبرة الصوت ليتعلم الـ AI منها ويحسن مخرجاته.
                    </p>
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="mx-auto flex items-center gap-2 bg-slate-950/40 border border-dashed border-brand-pink/50 text-brand-pink hover:border-brand-pink font-extrabold py-3 px-6 rounded-xl text-xs transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] transform shadow-md"
                    >
                        <i className="fas fa-file-import text-xs" />
                        استيراد أول وثيقة تعليمية
                    </button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {documents.map(doc => {
                        const completenessColor = doc.completenessScore >= 75 ? 'text-emerald-400' : doc.completenessScore >= 50 ? 'text-yellow-400' : 'text-orange-400';
                        const typeLabel = DOC_TYPE_LABELS[doc.docType] ?? doc.docType;
                        const date = new Date(doc.createdAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
                        return (
                            <div key={doc.id} className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-5 flex gap-4.5 items-start shadow-xl relative overflow-hidden group hover:border-brand-primary/15 transition-all duration-300">
                                <div className="absolute -right-24 -top-24 w-48 h-48 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none group-hover:bg-brand-primary/10 transition-all duration-500" />
                                <div className="w-11 h-11 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-secondary text-base shrink-0 shadow-inner relative z-10">
                                    <i className="fas fa-file-invoice text-sm" />
                                </div>
                                <div className="flex-1 min-w-0 relative z-10">
                                    <div className="flex items-start justify-between gap-3 flex-wrap">
                                        <div>
                                            <p className="font-extrabold text-white text-sm leading-relaxed">{doc.title}</p>
                                            <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                                                <span className="text-[9px] bg-brand-pink/15 text-brand-pink px-2.5 py-0.5 rounded-full font-bold border border-brand-pink/20">{typeLabel}</span>
                                                <span className="text-[9px] text-dark-text-secondary">{(doc.charCount / 1000).toFixed(1)}K حرف</span>
                                                <span className="text-[9px] text-dark-text-secondary">{date}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onDeleteClick(doc.id)}
                                            disabled={deletingDocId === doc.id}
                                            className="text-dark-text-secondary hover:text-red-400 text-xs transition-colors p-2 hover:bg-red-500/10 rounded-lg disabled:opacity-50 border border-transparent hover:border-white/5"
                                            title="حذف الوثيقة"
                                        >
                                            {deletingDocId === doc.id ? (
                                                <i className="fas fa-spinner fa-spin" />
                                            ) : (
                                                <i className="fas fa-trash-can" />
                                            )}
                                        </button>
                                    </div>

                                    {doc.extractedSummary && (
                                        <p className="text-xs text-dark-text-secondary/85 mt-3 leading-relaxed line-clamp-2 bg-slate-950/30 p-3 rounded-xl border border-white/5 shadow-inner">{doc.extractedSummary}</p>
                                    )}

                                    {(doc.fileName || doc.fileType || doc.analysisProvider || doc.analysisModel || doc.detectedLanguage) && (
                                        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                                            {doc.fileName && (
                                                <span className="text-[9px] px-2.5 py-0.5 rounded-md bg-white/5 text-dark-text-secondary border border-white/5 font-medium">
                                                    {doc.fileName}
                                                </span>
                                            )}
                                            {doc.fileType && (
                                                <span className="text-[9px] px-2.5 py-0.5 rounded-md bg-white/5 text-dark-text-secondary border border-white/5 font-medium">
                                                    {doc.fileType.toUpperCase()}
                                                </span>
                                            )}
                                            {doc.analysisProvider && (
                                                <span className="text-[9px] px-2.5 py-0.5 rounded-md bg-brand-pink/10 text-brand-pink border border-brand-pink/10 font-bold">
                                                    {doc.analysisProvider}
                                                </span>
                                            )}
                                            {doc.analysisModel && (
                                                <span className="text-[9px] px-2.5 py-0.5 rounded-md bg-brand-primary/10 text-brand-secondary border border-brand-primary/10 font-bold">
                                                    {doc.analysisModel}
                                                </span>
                                            )}
                                            {doc.detectedLanguage && (
                                                <span className="text-[9px] px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 font-bold">
                                                    {doc.detectedLanguage}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-4 mt-4 pt-3.5 border-t border-white/5 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-black ${completenessColor}`}>{doc.completenessScore}%</span>
                                            <span className="text-[10px] text-dark-text-secondary font-bold">اكتمال تحليل البيانات</span>
                                        </div>
                                        {doc.knowledgeEntriesSaved > 0 && (
                                            <button onClick={() => onNavigate?.('brand-knowledge')} className="flex items-center gap-1.5 text-[10px] text-brand-secondary hover:text-white transition-colors bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 hover:bg-white/10 hover:border-white/10 active:scale-95 transform duration-150 font-bold">
                                                <i className="fas fa-database text-[8px]" />
                                                {doc.knowledgeEntriesSaved} معرفة مضافة
                                            </button>
                                        )}
                                        {doc.memoryEntriesSaved > 0 && (
                                            <button onClick={() => setActiveTab('ai-memory')} className="flex items-center gap-1.5 text-[10px] text-brand-pink hover:text-white transition-colors bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 hover:bg-white/10 hover:border-white/10 active:scale-95 transform duration-150 font-bold">
                                                <i className="fas fa-brain text-[8px]" />
                                                {doc.memoryEntriesSaved} أمثلة ذاكرة نشطة
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {documents.length > 0 && (
                <div className="p-4 bg-slate-950/30 rounded-2xl border border-white/5 text-[11px] text-dark-text-secondary text-center shadow-inner font-bold">
                    مكتبة التعلم تحتوي على <strong className="text-white font-extrabold">{documents.length}</strong> وثائق •{' '}
                    <strong className="text-white font-extrabold">{documents.reduce((s, d) => s + d.knowledgeEntriesSaved, 0)}</strong> إدخال معرفة مستخلص •{' '}
                    <strong className="text-white font-extrabold">{documents.reduce((s, d) => s + d.memoryEntriesSaved, 0)}</strong> أمثلة ذاكرة نشطة
                </div>
            )}
        </div>
    );
};
