import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BrandHubProfile, NotificationType } from '../../types';
import { getBrandDocuments, deleteBrandDocument, BrandDocument } from '../../services/brandDocumentService';
import { getBrandHubProfile, updateBrandProfile, updateBrandMeta } from '../../services/brandHubService';

// Import modular subcomponents
import { AIOnboardingModal } from '../brand/AIOnboardingModal';
import { IdentityTabContent } from '../brand/IdentityTabContent';
import { AssetsTabContent } from '../brand/AssetsTabContent';
import { VoiceTabContent } from '../brand/VoiceTabContent';
import { AudienceTabContent } from '../brand/AudienceTabContent';
import { DocumentsTabContent } from '../brand/DocumentsTabContent';
import { AIMemoryTabContent } from '../brand/AIMemoryTabContent';
import { IntelligenceTabContent } from '../brand/IntelligenceTabContent';

interface BrandHubPageProps {
    brandId: string;
    initialProfile: BrandHubProfile;
    onUpdate: (profile: BrandHubProfile) => void;
    addNotification: (type: NotificationType, message: string) => void;
    onNavigate?: (page: string) => void;
}

type ActiveTab = 'identity' | 'voice' | 'audience' | 'ai-memory' | 'assets' | 'documents' | 'intelligence';

export const BrandHubPage: React.FC<BrandHubPageProps> = ({ brandId, initialProfile, onUpdate, addNotification, onNavigate }) => {
    const [profile, setProfile] = useState(initialProfile);
    const [searchParams, setSearchParams] = useSearchParams();
    const rawTab = searchParams.get('tab');
    const activeTab: ActiveTab = (rawTab && ['identity', 'voice', 'audience', 'ai-memory', 'assets', 'documents', 'intelligence'].includes(rawTab))
        ? (rawTab as ActiveTab)
        : 'identity';
    
    const setActiveTab = (tab: ActiveTab) => {
        setSearchParams({ tab }, { replace: true });
    };
    
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [documents, setDocuments] = useState<BrandDocument[]>([]);
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);
    const [isSavingIdentity, setIsSavingIdentity] = useState(false);

    const loadDocuments = useCallback(async () => {
        if (!brandId) return;
        setIsLoadingDocs(true);
        try {
            const docs = await getBrandDocuments(brandId);
            setDocuments(docs);
        } catch {
            // silent
        } finally {
            setIsLoadingDocs(false);
        }
    }, [brandId]);

    const refreshBrandHubData = useCallback(async () => {
        if (!brandId) return;

        const refreshed = await getBrandHubProfile(
            brandId,
            profile.brandName || initialProfile.brandName || 'Brand',
        );
        setProfile(refreshed);
        onUpdate(refreshed);
        await loadDocuments();
    }, [brandId, initialProfile.brandName, loadDocuments, onUpdate, profile.brandName]);

    useEffect(() => {
        if (activeTab === 'documents') loadDocuments();
    }, [activeTab, loadDocuments]);

    const handleDeleteDocument = async (docId: string) => {
        try {
            await deleteBrandDocument(brandId, docId);
            setDocuments(prev => prev.filter(d => d.id !== docId));
            addNotification(NotificationType.Success, 'تم حذف الوثيقة');
        } catch {
            addNotification(NotificationType.Error, 'فشل الحذف');
        }
    };

    const handleSaveIdentity = async () => {
        setIsSavingIdentity(true);
        try {
            await updateBrandProfile(brandId, profile);
            if (profile.website !== undefined || profile.country !== undefined) {
                await updateBrandMeta(brandId, { website: profile.website, country: profile.country });
            }
            onUpdate(profile);
            addNotification(NotificationType.Success, '✅ تم حفظ هوية البراند بنجاح');
        } catch {
            addNotification(NotificationType.Error, 'تعذّر الحفظ — حاول مرة أخرى');
        } finally {
            setIsSavingIdentity(false);
        }
    };

    useEffect(() => {
        setProfile(initialProfile);
        // Check if the profile is "empty" to trigger onboarding
        if (!initialProfile.industry && initialProfile.brandAudiences.length === 0) {
            setShowOnboarding(true);
        } else {
            setShowOnboarding(false);
        }
    }, [initialProfile]);

    const handleAIOnboarding = async (partialProfile: Partial<BrandHubProfile>) => {
        const newProfile: BrandHubProfile = {
            ...profile,
            ...partialProfile,
            brandVoice: {
                ...profile.brandVoice,
                ...partialProfile.brandVoice,
            },
            brandAudiences: partialProfile.brandAudiences || profile.brandAudiences,
        };
        setProfile(newProfile);
        onUpdate(newProfile);
        try {
            await updateBrandProfile(brandId, newProfile);
            addNotification(NotificationType.Success, "✅ تم إنشاء هوية البراند وحفظها بنجاح!");
        } catch {
            addNotification(NotificationType.Warning, "تم إنشاء هوية البراند — اضغط 'حفظ التغييرات' لتأكيد الحفظ");
        }
    };

    const handleUpdateProfile = (updatedProfile: BrandHubProfile) => {
        setProfile(updatedProfile);
        onUpdate(updatedProfile);
    };

    // Calculate Brand Readiness
    const checks = [
        !!profile.brandName,
        !!profile.industry,
        !!profile.description,
        (profile.values?.length ?? 0) > 0,
        (profile.brandVoice?.toneDescription?.length ?? 0) > 0,
        (profile.brandVoice?.voiceGuidelines?.dos?.length ?? 0) > 0,
        (profile.brandAudiences?.length ?? 0) > 0,
        !!profile.valueProp,
        !!profile.brandPromise,
        (profile.businessModel?.length ?? 0) > 0,
    ];
    const filled = checks.filter(Boolean).length;
    const readinessPct = Math.round((filled / checks.length) * 100);
    const barGradient = readinessPct >= 80 
        ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.45)]' 
        : readinessPct >= 50 
            ? 'bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_12px_rgba(245,158,11,0.45)]' 
            : 'bg-gradient-to-r from-rose-500 to-pink-500 shadow-[0_0_12px_rgba(239,68,68,0.45)]';
    const readinessLabel = readinessPct >= 80 ? 'جاهز للنشر' : readinessPct >= 50 ? 'يحتاج إكمال' : 'ابدأ بملء البيانات';

    return (
        <div className="space-y-6" dir="rtl">
            {showOnboarding && (
                <AIOnboardingModal
                    brandId={brandId}
                    brandName={profile.brandName}
                    onClose={() => setShowOnboarding(false)}
                    onGenerate={handleAIOnboarding}
                />
            )}

            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-4 pb-2">
                <div>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400">مركز البراند</h1>
                    <p className="text-dark-text-secondary text-xs mt-1">
                        هذا هو مصدر الحقيقة للذكاء الاصطناعي. حافظ على تحديثه لضمان أفضل النتائج.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            const data = {
                                brand: profile.brandName,
                                exportedAt: new Date().toISOString(),
                                identity: {
                                    industry: profile.industry,
                                    description: profile.description,
                                    businessModel: profile.businessModel,
                                    language: profile.language,
                                    country: profile.country,
                                    website: profile.website,
                                    ageRange: profile.ageRange,
                                    targetAudienceSummary: profile.targetAudienceSummary,
                                    goals: profile.goals,
                                    values: profile.values,
                                    keySellingPoints: profile.keySellingPoints,
                                    styleGuidelines: profile.styleGuidelines,
                                    contactInfo: profile.contactInfo,
                                },
                                strategy: {
                                    valueProp: profile.valueProp,
                                    brandPromise: profile.brandPromise,
                                    messagingPillars: profile.messagingPillars,
                                },
                                voice: {
                                    tone: profile.brandVoice.toneDescription,
                                    keywords: profile.brandVoice.keywords,
                                    negativeKeywords: profile.brandVoice.negativeKeywords,
                                    toneStrength: profile.brandVoice.toneStrength,
                                    toneSentiment: profile.brandVoice.toneSentiment,
                                    guidelines: profile.brandVoice.voiceGuidelines,
                                },
                                audiences: profile.brandAudiences,
                                consistencyScore: profile.consistencyScore,
                            };
                            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${profile.brandName.replace(/\s+/g, '_')}_brand_profile.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                            addNotification(NotificationType.Success, 'تم تصدير ملف البراند.');
                        }}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-2.5 text-xs font-bold text-dark-text-secondary transition-all hover:text-white hover:border-white/20 hover:bg-slate-900/60 active:scale-[0.98] transform"
                    >
                        <i className="fas fa-download text-[10px]" />
                        تصدير البروفايل
                    </button>
                    {activeTab === 'identity' && (
                        <button
                            onClick={handleSaveIdentity}
                            disabled={isSavingIdentity}
                            className="flex items-center gap-2 bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-black py-2.5 px-6 rounded-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 transition-all shadow-lg shadow-brand-primary/20"
                        >
                            {isSavingIdentity
                                ? <><i className="fas fa-spinner fa-spin text-xs" /> جاري الحفظ...</>
                                : <><i className="fas fa-save text-xs" /> حفظ التغييرات</>
                            }
                        </button>
                    )}
                </div>
            </div>

            {/* Brand Readiness Bar */}
            <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-slate-900/50 via-slate-900/30 to-slate-950/60 border border-white/5 backdrop-blur-md px-6 py-5 shadow-2xl relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                <div className="absolute -right-24 -top-24 w-48 h-48 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none group-hover:bg-brand-primary/10 transition-all duration-500" />
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-brand-secondary flex-shrink-0 shadow-inner">
                    <i className="fas fa-gauge-high text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-dark-text-secondary">مستوى جاهزية البراند الرقمية</span>
                        <span className={`text-xs font-black ${readinessPct >= 80 ? 'text-emerald-400' : readinessPct >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                            {readinessPct}% — {readinessLabel}
                        </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-950/60 overflow-hidden p-[1px]">
                        <div className={`h-full rounded-full transition-all duration-1000 ${barGradient}`} style={{ width: `${readinessPct}%` }} />
                    </div>
                </div>
                <button
                    onClick={() => setActiveTab('intelligence')}
                    className="text-xs font-extrabold text-brand-secondary hover:text-white transition-colors flex-shrink-0 bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-lg border border-white/5"
                >
                    عرض التفاصيل
                </button>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-slate-950/60 backdrop-blur-lg p-2 rounded-2xl border border-white/5 flex items-center gap-2 flex-wrap shadow-inner">
                {([
                    { id: 'identity',     label: 'الهوية',        icon: 'fa-building' },
                    { id: 'assets',       label: 'الأصول',        icon: 'fa-palette' },
                    { id: 'voice',        label: 'الصوت',         icon: 'fa-microphone' },
                    { id: 'audience',     label: 'الجمهور',       icon: 'fa-users' },
                    { id: 'documents',    label: 'مكتبة التعلم',  icon: 'fa-book-open' },
                    { id: 'intelligence', label: 'الذكاء',        icon: 'fa-lightbulb' },
                    { id: 'ai-memory',    label: 'ذاكرة AI',      icon: 'fa-brain' },
                ] as const).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 text-center py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all duration-300 transform active:scale-[0.98]
                            ${activeTab === tab.id
                                ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-[1.03] transform'
                                : 'text-dark-text-secondary hover:bg-white/5 hover:text-white hover:-translate-y-0.5'
                            }`}
                    >
                        <i className={`fas ${tab.icon} text-[11px]`}></i>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content Box */}
            <div className="bg-slate-900/40 border border-white/5 backdrop-blur-md p-7 rounded-3xl shadow-2xl shadow-black/40 relative overflow-hidden transition-all duration-300">
                <div className="absolute -left-32 -bottom-32 w-64 h-64 bg-brand-secondary/5 rounded-full blur-3xl pointer-events-none" />
                {activeTab === 'identity' && (
                    <IdentityTabContent
                        profile={profile}
                        setProfile={setProfile}
                        brandId={brandId}
                        addNotification={addNotification}
                        onRefresh={refreshBrandHubData}
                        setShowOnboarding={setShowOnboarding}
                        documents={documents}
                        loadDocuments={loadDocuments}
                        isLoadingDocs={isLoadingDocs}
                    />
                )}

                {activeTab === 'assets' && (
                    <AssetsTabContent
                        profile={profile}
                        brandId={brandId}
                        addNotification={addNotification}
                        onUpdate={handleUpdateProfile}
                    />
                )}

                {activeTab === 'voice' && (
                    <VoiceTabContent
                        profile={profile}
                        brandId={brandId}
                        addNotification={addNotification}
                        onUpdate={handleUpdateProfile}
                    />
                )}

                {activeTab === 'audience' && (
                    <AudienceTabContent
                        profile={profile}
                        brandId={brandId}
                        addNotification={addNotification}
                        onUpdate={handleUpdateProfile}
                    />
                )}

                {activeTab === 'documents' && (
                    <DocumentsTabContent
                        profile={profile}
                        brandId={brandId}
                        documents={documents}
                        isLoadingDocs={isLoadingDocs}
                        handleDeleteDocument={handleDeleteDocument}
                        refreshBrandHubData={refreshBrandHubData}
                        addNotification={addNotification}
                        onNavigate={onNavigate}
                        setActiveTab={setActiveTab}
                    />
                )}

                {activeTab === 'intelligence' && (
                    <IntelligenceTabContent
                        profile={profile}
                        brandId={brandId}
                        onNavigate={onNavigate}
                        setActiveTab={setActiveTab}
                    />
                )}

                {activeTab === 'ai-memory' && (
                    <AIMemoryTabContent
                        profile={profile}
                        brandId={brandId}
                        addNotification={addNotification}
                    />
                )}
            </div>
        </div>
    );
};
