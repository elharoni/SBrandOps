
// components/pages/ContentOpsPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ContentPiece, ContentStatus, NotificationType, BrandHubProfile, Comment, MediaItem, BrainstormedIdea, SocialPlatform, PLATFORM_ASSETS, AIQualityCheckResult, User, ContentGoal, PublisherBrief } from '../../types';
import { generateStructuredContent, improveContentWithAI, performAIQualityCheck, analyzeImageForContent, generateAIContentIdeas, modifyContent, generateContentVariations, reformatContent } from '../../services/geminiService';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { getContentBriefs } from '../../services/competitiveIntelService';
import { scoreAndSave, getContentScore } from '../../services/contentScoringService';
import type { ContentScoreResult } from '../../services/contentScoringService';
import { ContentScoreBadge, ContentScorePanel } from '../ContentScoreBadge';

interface ContentOpsPageProps {
    addNotification: (type: NotificationType, message: string) => void;
    initialContent: ContentPiece[];
    brandProfile: BrandHubProfile;
    brandId: string;
    onAddPiece: (piecesData: Omit<ContentPiece, 'id' | 'comments' | 'media' | 'assignee' | 'dueDate'>[]) => void;
    onUpdatePiece: (pieceId: string, updates: Partial<ContentPiece>) => void;
    onAddComment: (pieceId: string, text: string) => void;
    onSendToPublisher: (contentPiece: ContentPiece) => void;
    onLoadBrief: (brief: PublisherBrief) => void;
    onGenerateFromBrief: (brief: PublisherBrief) => void;
    onDeletePiece: (pieceId: string) => void;
    users: User[];
}

const statusColumns: ContentStatus[] = [
    ContentStatus.Ideas,
    ContentStatus.InProgress,
    ContentStatus.InReview,
    ContentStatus.Approved,
];

const statusTranslations: Record<ContentStatus, string> = {
    [ContentStatus.Ideas]: 'الأفكار',
    [ContentStatus.InProgress]: 'تحت الكتابة',
    [ContentStatus.InReview]: 'في انتظار المراجعة',
    [ContentStatus.Approved]: 'جاهز للنشر ✓',
};

// Empty state copy per column — guides the user on what to do next
const columnEmptyStates: Record<ContentStatus, { icon: string; title: string; hint: string }> = {
    [ContentStatus.Ideas]: {
        icon: 'fa-lightbulb',
        title: 'لا توجد أفكار بعد',
        hint: 'اكتب فكرة جديدة أو اطلب من AI توليد أفكار لك',
    },
    [ContentStatus.InProgress]: {
        icon: 'fa-pen-nib',
        title: 'لا يوجد محتوى تحت الكتابة',
        hint: 'اسحب بطاقة من "الأفكار" هنا لتبدأ الكتابة',
    },
    [ContentStatus.InReview]: {
        icon: 'fa-magnifying-glass',
        title: 'لا يوجد محتوى للمراجعة',
        hint: 'اسحب بطاقة من "تحت الكتابة" هنا لمراجعتها',
    },
    [ContentStatus.Approved]: {
        icon: 'fa-circle-check',
        title: 'لا يوجد محتوى جاهز للنشر',
        hint: 'راجع المحتوى في "انتظار المراجعة" ثم وافق عليه',
    },
};

const contentGoals: { key: ContentGoal, label: string, icon: string }[] = [
    { key: 'Increase Sales', label: 'زيادة المبيعات', icon: 'fa-dollar-sign' },
    { key: 'Increase Engagement', label: 'رفع التفاعل', icon: 'fa-comments' },
    { key: 'Increase Awareness', label: 'رفع الوعي', icon: 'fa-bullhorn' },
    { key: 'Announce Discount', label: 'إعلان خصم', icon: 'fa-tags' },
    { key: 'Educate Audience', label: 'تثقيف الجمهور', icon: 'fa-graduation-cap' },
];

const tones = ['Professional', 'Friendly', 'Witty', 'Urgent', 'Empathetic', 'Excited', 'Custom'];

const AIStudioModal: React.FC<{
    onClose: () => void;
    brandProfile: BrandHubProfile;
    onGenerate: (data: Omit<ContentPiece, 'id' | 'comments' | 'media' | 'assignee' | 'dueDate' | 'status'>[]) => void;
}> = ({ onClose, brandProfile, onGenerate }) => {
    const [step, setStep] = useState(1);
    
    // Step 1 State
    const [goal, setGoal] = useState<ContentGoal>('Increase Engagement');
    const [topic, setTopic] = useState('');
    const [platform, setPlatform] = useState<SocialPlatform>(SocialPlatform.Instagram);
    const [tone, setTone] = useState('Professional');
    const [customTone, setCustomTone] = useState('');
    
    // Step 2 State
    const [generatedResult, setGeneratedResult] = useState<{ title: string, content: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeSidebarTab, setActiveSidebarTab] = useState<'tools' | 'variations'>('tools');
    const [translationLang, setTranslationLang] = useState('English');
    const [customInstruction, setCustomInstruction] = useState('');
    const [variations, setVariations] = useState<string[]>([]);
    
    const handleGenerateInitial = async () => {
        if (!topic) return;
        setIsLoading(true);
        try {
            const selectedTone = tone === 'Custom' ? customTone : tone;
            const result = await generateStructuredContent(goal, topic, brandProfile, platform, selectedTone);
            setGeneratedResult(result as { title: string; content: string });
            setStep(2);
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    const handleModification = async (modificationType: 'improve' | 'shorten' | 'expand' | 'fix_grammar' | 'make_punchy' | 'add_emojis' | 'generate-cta' | 'add_hashtags' | 'translate' | 'custom') => {
        if (!generatedResult) return;
        setIsLoading(true);
        try {
            const modifiedContent = await modifyContent(modificationType, generatedResult.content, brandProfile, { targetLanguage: translationLang, customInstruction });
            setGeneratedResult(prev => prev ? { ...prev, content: modifiedContent } : null);
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };
    
    const handleGenerateVariations = async () => {
        if (!generatedResult) return;
        setIsLoading(true);
        try {
            const vars = await generateContentVariations(generatedResult.content, brandProfile);
            setVariations(vars);
            setActiveSidebarTab('variations');
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    const handleApplyVariation = (variant: string) => {
        setGeneratedResult(prev => prev ? { ...prev, content: variant } : null);
    };

    const handleFinalize = () => {
        if (!generatedResult) return;
        onGenerate([{ title: generatedResult.title, generatedContent: generatedResult.content, type: 'Social', platforms: [platform] }]);
        onClose();
    };

    const renderStepOne = () => (
        <>
            <div className="border-b border-light-border/20 dark:border-dark-border/20 px-8 py-6">
                <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight text-light-text dark:text-dark-text">
                    <i className="fas fa-wand-magic-sparkles text-brand-primary" />
                    استوديو المحتوى الذكي
                    <span className="ms-2 rounded-full border border-brand-primary/20 bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">الخطوة ١</span>
                </h2>
                <p className="mt-2 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">قم بإعداد تفاصيل المنشور ليقوم Gemini بصياغته لك.</p>
            </div>
            <div className="space-y-8 bg-light-bg/20 p-8 dark:bg-dark-bg/20">
                <div>
                    <label className="block text-sm font-bold text-light-text dark:text-dark-text mb-2">1. الهدف من المحتوى</label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {contentGoals.map(g => (
                            <button key={g.key} onClick={() => setGoal(g.key)} className={`p-3 flex flex-col items-center justify-center rounded-xl border-2 transition-all duration-200 ${goal === g.key ? 'border-brand-primary bg-brand-primary/10 text-brand-primary shadow-sm' : 'border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card hover:border-gray-400 text-light-text-secondary dark:text-dark-text-secondary'}`}>
                                <i className={`fas ${g.icon} text-xl mb-2`}></i>
                                <span className="text-xs font-bold text-center">{g.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-light-text dark:text-dark-text mb-2">2. المنصة</label>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                            {Object.values(SocialPlatform).map(p => {
                                const asset = PLATFORM_ASSETS[p];
                                return (
                                    <button key={p} onClick={() => setPlatform(p)} className={`w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center border-2 transition-all ${platform === p ? 'border-brand-primary ring-2 ring-brand-primary/30 scale-110' : 'border-transparent bg-light-card dark:bg-dark-card shadow-sm'}`}>
                                        <i className={`${asset.icon} text-xl`} style={{ color: platform === p ? '' : asset.hexColor }}></i>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    <div>
                         <label className="block text-sm font-bold text-light-text dark:text-dark-text mb-2">3. نبرة الصوت</label>
                         <select value={tone} onChange={e => setTone(e.target.value)} className="w-full p-3 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text focus:ring-brand-primary focus:border-brand-primary transition-shadow">
                             {tones.map(t => <option key={t} value={t}>{t}</option>)}
                         </select>
                         {tone === 'Custom' && (
                             <input 
                                type="text" 
                                value={customTone} 
                                onChange={e => setCustomTone(e.target.value)} 
                                placeholder="صف النبرة (مثال: ساخر، رسمي جدًا، شعبي...)" 
                                className="w-full mt-2 p-3 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text focus:ring-brand-primary focus:border-brand-primary animate-fade-in"
                             />
                         )}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-light-text dark:text-dark-text mb-2">4. الموضوع أو الفكرة</label>
                    <textarea 
                        value={topic} 
                        onChange={e => setTopic(e.target.value)} 
                        placeholder="عن ماذا تريد أن تكتب؟ مثال: إطلاق مجموعة الربيع الجديدة بخصم 20%..." 
                        className="w-full p-4 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text focus:ring-brand-primary focus:border-brand-primary min-h-[100px]" 
                    />
                </div>
            </div>
            <div className="p-5 bg-light-card dark:bg-dark-card border-t border-light-border dark:border-dark-border flex justify-end gap-3">
                 <button onClick={onClose} className="text-light-text-secondary dark:text-dark-text-secondary font-bold px-6 py-2 rounded-lg hover:bg-light-bg dark:hover:bg-dark-bg transition-colors">إلغاء</button>
                <button onClick={handleGenerateInitial} disabled={isLoading || !topic} className="bg-gradient-to-r from-brand-pink to-brand-purple text-white font-bold py-3 px-8 rounded-xl disabled:opacity-50 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                    {isLoading ? <><i className="fas fa-spinner fa-spin me-2"></i>جاري الكتابة...</> : <><i className="fas fa-magic me-2"></i>إنشاء المحتوى</>}
                </button>
            </div>
        </>
    );

    const renderStepTwo = () => (
         <div className="flex flex-col h-full max-h-[90vh]">
            <div className="relative z-10 flex items-center justify-between border-b border-light-border/20 px-8 py-5 shadow-sm dark:border-dark-border/20">
                <h2 className="flex items-center gap-2 text-xl font-black text-light-text dark:text-dark-text">
                    <i className="fas fa-pen-fancy text-brand-primary"></i>
                    المحرر الذكي
                    <span className="ms-2 flex items-center rounded-full border border-brand-primary/20 bg-brand-primary/10 px-3 py-1 text-[10px] font-bold tracking-wider text-brand-primary">الخطوة ٢</span>
                </h2>
                <button onClick={() => setStep(1)} className="btn rounded-xl bg-light-bg px-4 py-2.5 text-xs font-bold text-light-text-secondary transition-all hover:bg-light-bg/80 active:scale-95 dark:bg-dark-bg dark:text-dark-text-secondary">
                    <i className="fas fa-arrow-right me-2"></i>تعديل المُدخلات
                </button>
            </div>
            
            <div className="flex-grow flex overflow-hidden">
                {/* Editor Area */}
                <div className="flex-1 p-6 bg-light-bg dark:bg-dark-bg overflow-y-auto">
                    <textarea
                        value={generatedResult?.content || ''}
                        onChange={e => setGeneratedResult(prev => prev ? { ...prev, content: e.target.value } : null)}
                        className="w-full h-full min-h-[500px] p-6 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary resize-none leading-relaxed shadow-inner text-base"
                        placeholder="المحتوى سيظهر هنا..."
                    />
                </div>
                
                {/* Sidebar Toolkit */}
                <div className="w-80 bg-light-card dark:bg-dark-card border-s border-light-border dark:border-dark-border flex flex-col">
                    {/* Sidebar Tabs */}
                    <div className="flex border-b border-light-border dark:border-dark-border">
                        <button 
                            onClick={() => setActiveSidebarTab('tools')} 
                            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeSidebarTab === 'tools' ? 'text-brand-primary border-b-2 border-brand-primary bg-brand-primary/5' : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg'}`}
                        >
                            <i className="fas fa-tools me-2"></i>الأدوات
                        </button>
                        <button 
                            onClick={() => setActiveSidebarTab('variations')} 
                            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeSidebarTab === 'variations' ? 'text-brand-primary border-b-2 border-brand-primary bg-brand-primary/5' : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg'}`}
                        >
                            <i className="fas fa-layer-group me-2"></i>التنويعات
                        </button>
                    </div>

                    <div className="flex-grow overflow-y-auto p-4 space-y-6">
                        {activeSidebarTab === 'tools' ? (
                            <>
                                <div>
                                    <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-2">تحسين سريع</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => handleModification('improve')} className="btn-tool"><i className="fas fa-magic me-1 text-brand-purple"></i>تحسين</button>
                                        <button onClick={() => handleModification('fix_grammar')} className="btn-tool"><i className="fas fa-check-double me-1 text-green-500"></i>نحو</button>
                                        <button onClick={() => handleModification('shorten')} className="btn-tool"><i className="fas fa-compress-alt me-1 text-blue-400"></i>اختصار</button>
                                        <button onClick={() => handleModification('expand')} className="btn-tool"><i className="fas fa-expand-alt me-1 text-orange-400"></i>توسيع</button>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-2">الأسلوب والإضافات</p>
                                    <div className="space-y-2">
                                        <button onClick={() => handleModification('make_punchy')} className="btn-tool-full"><i className="fas fa-bolt me-2 text-yellow-400"></i>اجعله أكثر حماسًا</button>
                                        <button onClick={() => handleModification('add_emojis')} className="btn-tool-full"><i className="far fa-smile me-2 text-pink-400"></i>إضافة Emojis</button>
                                        <button onClick={() => handleModification('add_hashtags')} className="btn-tool-full"><i className="fas fa-hashtag me-2 text-blue-400"></i>إضافة هاشتاجات</button>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-2">الترجمة</p>
                                    <div className="flex gap-2">
                                        <select 
                                            value={translationLang} 
                                            onChange={(e) => setTranslationLang(e.target.value)}
                                            className="flex-1 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg text-xs p-2 text-light-text dark:text-dark-text"
                                        >
                                            <option value="English">English</option>
                                            <option value="Arabic">Arabic</option>
                                            <option value="French">French</option>
                                            <option value="Spanish">Spanish</option>
                                        </select>
                                        <button onClick={() => handleModification('translate')} className="bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg px-3 hover:border-brand-primary transition-colors">
                                            <i className="fas fa-language"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div>
                                    <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-2">تعديل مخصص</p>
                                    <div className="flex flex-col gap-2">
                                        <input 
                                            type="text" 
                                            value={customInstruction}
                                            onChange={(e) => setCustomInstruction(e.target.value)}
                                            placeholder="مثال: اجعله مضحكًا..." 
                                            className="bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg p-2 text-xs text-light-text dark:text-dark-text"
                                        />
                                        <button onClick={() => handleModification('custom')} disabled={!customInstruction} className="bg-brand-primary/10 text-brand-primary border border-brand-primary/20 font-bold py-1.5 rounded-lg text-xs hover:bg-brand-primary hover:text-white transition-all disabled:opacity-50">
                                            تطبيق
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <button onClick={handleGenerateVariations} className="w-full bg-brand-secondary/10 text-brand-secondary border border-brand-secondary/20 font-bold py-2 rounded-lg text-sm hover:bg-brand-secondary hover:text-white transition-all">
                                    <i className="fas fa-sync-alt me-2"></i>توليد 3 نسخ مختلفة
                                </button>
                                {variations.length > 0 ? (
                                    variations.map((variant, idx) => (
                                        <div key={idx} className="bg-light-bg dark:bg-dark-bg p-3 rounded-lg border border-light-border dark:border-dark-border text-xs group relative">
                                            <p className="text-light-text dark:text-dark-text line-clamp-4 mb-2">{variant}</p>
                                            <button onClick={() => handleApplyVariation(variant)} className="w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border text-light-text dark:text-dark-text font-bold py-1 rounded hover:border-brand-primary hover:text-brand-primary transition-colors">
                                                استخدام هذه النسخة
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-light-text-secondary dark:text-dark-text-secondary opacity-50">
                                        <i className="fas fa-copy text-3xl mb-2"></i>
                                        <p className="text-xs">لم يتم توليد نسخ بعد.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="p-4 bg-light-card dark:bg-dark-card border-t border-light-border dark:border-dark-border flex justify-end shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
                <button onClick={handleFinalize} className="bg-green-600 text-white font-bold py-2.5 px-8 rounded-xl shadow-lg hover:bg-green-700 hover:shadow-green-600/30 transition-all">
                    <i className="fas fa-check-circle me-2"></i>اعتماد وإضافة للمحتوى
                </button>
            </div>
            
             <style>{`
                .btn-tool {
                    @apply text-xs p-2 bg-light-bg dark:bg-dark-bg rounded-lg hover:bg-brand-primary/10 hover:text-brand-primary hover:border-brand-primary text-start border border-light-border dark:border-dark-border transition-all duration-200 flex items-center;
                }
                .btn-tool-full {
                    @apply w-full text-xs p-2 bg-light-bg dark:bg-dark-bg rounded-lg hover:bg-brand-primary/10 hover:text-brand-primary hover:border-brand-primary text-start border border-light-border dark:border-dark-border transition-all duration-200 flex items-center;
                }
            `}</style>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6 backdrop-blur-md">
            <div className="surface-panel flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2.5rem] !border-0 shadow-[var(--shadow-primary)]">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-black/50 z-50 flex flex-col items-center justify-center backdrop-blur-md">
                        <div className="relative">
                             <div className="w-16 h-16 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin"></div>
                             <i className="fas fa-magic absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-brand-primary text-xl"></i>
                        </div>
                        <p className="text-light-text dark:text-dark-text font-bold mt-4 animate-pulse text-lg">Gemini يعمل بسحره...</p>
                    </div>
                )}
                {step === 1 ? renderStepOne() : renderStepTwo()}
            </div>
        </div>
    );
};

const AIIdeationModal: React.FC<{
    onClose: () => void;
    brandProfile: BrandHubProfile;
    onGenerate: (data: Omit<ContentPiece, 'id' | 'comments' | 'media' | 'assignee' | 'dueDate' | 'status'>[]) => void;
}> = ({ onClose, brandProfile, onGenerate }) => {
    const [strategy, setStrategy] = useState<'Seasonal' | 'Trending' | 'Brand-based' | 'Competitor'>('Brand-based');
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerate = async () => {
        setIsLoading(true);
        try {
            const ideas = await generateAIContentIdeas(strategy, brandProfile);
            const contentPieces = ideas.map(idea => {
                const typeMap: Record<string, ContentPiece['type']> = { 'Reel': 'Video', 'Story': 'Video', 'Carousel': 'Social', 'Static': 'Social', 'Article': 'Blog' };
                return { title: idea.title, generatedContent: idea.description, type: typeMap[idea.format] || 'Social', platforms: [idea.platform] };
            });
            onGenerate(contentPieces);
            onClose();
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };
    
    const strategies = [
        { key: 'Seasonal', label: 'أفكار موسمية', icon: 'fa-calendar-alt' },
        { key: 'Trending', label: 'أفكار رائجة', icon: 'fa-chart-line' },
        { key: 'Brand-based', label: 'حسب هوية البراند', icon: 'fa-gem' },
        { key: 'Competitor', label: 'تحليل المنافسين', icon: 'fa-users' },
    ];

    return (
         <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-lg">
                <div className="p-5 border-b border-light-border dark:border-dark-border flex justify-between items-center">
                    <h2 className="text-xl font-bold text-light-text dark:text-dark-text">العصف الذهني الذكي</h2>
                    <button onClick={onClose} className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text">&times;</button>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">اختر استراتيجية لتوليد الأفكار. سيقوم Gemini بإنشاء مجموعة من الأفكار بناءً على اختيارك وملف البراند.</p>
                    <div className="grid grid-cols-2 gap-3">
                        {strategies.map(s => (
                            <button key={s.key} onClick={() => setStrategy(s.key as any)} className={`p-4 text-center rounded-lg border-2 ${strategy === s.key ? 'border-brand-primary bg-brand-primary/10' : 'border-light-border dark:border-dark-border hover:border-gray-500'}`}>
                                <i className={`fas ${s.icon} text-xl mb-1`}></i>
                                <p className="text-xs font-semibold">{s.label}</p>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="p-4 bg-light-bg/50 dark:bg-dark-bg/50 border-t border-light-border dark:border-dark-border flex justify-end">
                    <button onClick={handleGenerate} disabled={isLoading} className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-500">
                        {isLoading ? 'جاري التفكير...' : 'توليد الأفكار'}
                    </button>
                </div>
            </div>
        </div>
    );
};


const AIQualityCheckDisplay: React.FC<{ result: AIQualityCheckResult }> = ({ result }) => {
    const Metric: React.FC<{ title: string; score: number; feedback: string }> = ({ title, score, feedback }) => {
        const color = score > 80 ? 'bg-green-500' : score > 50 ? 'bg-yellow-500' : 'bg-red-500';
        return (
            <div>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold">{title}</span>
                    <span className="text-xs font-bold">{score}/100</span>
                </div>
                <div className="w-full bg-light-bg dark:bg-dark-bg h-2 rounded-full"><div className={`${color} h-2 rounded-full`} style={{ width: `${score}%`}}></div></div>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">{feedback}</p>
            </div>
        )
    };
    return (
        <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg border border-light-border dark:border-dark-border space-y-3">
            <Metric title="التدقيق اللغوي" {...result.grammar} />
            <Metric title="نبرة الصوت" {...result.toneOfVoice} />
            <Metric title="توافق البراند" {...result.brandFit} />
            <Metric title="الدعوة لاتخاذ إجراء (CTA)" {...result.cta} />
        </div>
    );
};

const ContentDetailModal: React.FC<{
    piece: ContentPiece;
    onClose: () => void;
    onUpdate: (id: string, updates: Partial<ContentPiece>) => void;
    onAddComment: (id: string, text: string) => void;
    onSendToPublisher: (piece: ContentPiece) => void;
    onDelete: (id: string) => void;
    brandProfile: BrandHubProfile;
    brandId: string;
    users: User[];
}> = ({ piece, onClose, onUpdate, onAddComment, onSendToPublisher, onDelete, brandProfile, brandId, users }) => {
    const [editedPiece, setEditedPiece] = useState(piece);
    const [newComment, setNewComment] = useState('');
    const [isImproving, setIsImproving] = useState(false);
    const [qualityCheckResult, setQualityCheckResult] = useState<AIQualityCheckResult | null>(null);
    const [isQualityChecking, setIsQualityChecking] = useState(false);
    const [isAnalyzingMedia, setIsAnalyzingMedia] = useState<string | null>(null);
    // AI Content Scoring
    const [scoreResult, setScoreResult] = useState<ContentScoreResult | null>(null);
    const [isScoring, setIsScoring] = useState(false);
    const [activeTab, setActiveTab] = useState<'settings' | 'content' | 'media' | 'comments'>('content');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        setEditedPiece(piece);
    }, [piece]);

    const handleFieldChange = (field: keyof ContentPiece, value: any) => {
        setEditedPiece(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        const updates: Partial<ContentPiece> = {};
        (Object.keys(editedPiece) as Array<keyof ContentPiece>).forEach(key => {
            if (JSON.stringify(editedPiece[key]) !== JSON.stringify(piece[key])) {
                (updates as any)[key] = editedPiece[key];
            }
        });
        if (Object.keys(updates).length > 0) {
            onUpdate(piece.id, updates);
        }
        onClose();
    };

    const handleCommentSubmit = () => {
        if (!newComment.trim()) return;
        onAddComment(piece.id, newComment);
        setNewComment('');
    };
    
    const handleDelete = () => {
        setShowDeleteConfirm(true);
    };

    const handleImproveContent = async () => {
        if (!editedPiece.generatedContent) return;
        setIsImproving(true);
        try {
            const improved = await improveContentWithAI(editedPiece.generatedContent, brandProfile);
            handleFieldChange('generatedContent', improved);
        } catch (error) {
            console.error("Failed to improve content", error);
        } finally {
            setIsImproving(false);
        }
    };

    const handleQualityCheck = async () => {
        if (!editedPiece.generatedContent) return;
        setIsQualityChecking(true);
        setQualityCheckResult(null);
        try {
            const result = await performAIQualityCheck(editedPiece.generatedContent, brandProfile);
            setQualityCheckResult(result);
        } catch (error) {
            console.error("Failed to perform quality check", error);
        } finally {
            setIsQualityChecking(false);
        }
    };

    const handleScoreContent = async () => {
        if (!editedPiece.generatedContent) return;
        setIsScoring(true);
        setScoreResult(null);
        try {
            const result = await scoreAndSave(
                editedPiece.generatedContent,
                brandProfile,
                brandId,
                editedPiece.id,
            );
            setScoreResult(result);
        } catch (error) {
            console.error('Failed to score content', error);
        } finally {
            setIsScoring(false);
        }
    };

    const handleAnalyzeMedia = async (mediaItem: MediaItem) => {
        if (mediaItem.type !== 'image') return;
        setIsAnalyzingMedia(mediaItem.id);
        
        const fileToBase64 = (file: File): Promise<string> => 
            new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = error => reject(error);
            });
            
        try {
            const base64 = await fileToBase64(mediaItem.file);
            const result = await analyzeImageForContent(base64);
            const newContent = `${editedPiece.generatedContent}\n\n--- AI Image Analysis ---\nDescription: ${result.description}\nAlt Text: ${result.altText}\nTags: ${result.tags.join(', ')}`;
            handleFieldChange('generatedContent', newContent);
        } catch(e) {
            console.error(e);
        } finally {
            setIsAnalyzingMedia(null);
        }
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'content': return (
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-light-text-secondary dark:text-dark-text-secondary">المحتوى</h3>
                        <div className="flex gap-2">
                            <button onClick={handleImproveContent} disabled={isImproving || !editedPiece.generatedContent} className="text-xs bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg py-1 px-3 text-light-text dark:text-dark-text hover:border-brand-primary disabled:opacity-50">
                                {isImproving ? <><i className="fas fa-spinner fa-spin"></i></> : <><i className="fas fa-magic text-brand-secondary me-2"></i>تحسين</>}
                            </button>
                            <button onClick={handleQualityCheck} disabled={isQualityChecking || !editedPiece.generatedContent} className="text-xs bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg py-1 px-3 text-light-text dark:text-dark-text hover:border-brand-primary disabled:opacity-50">
                                {isQualityChecking ? <><i className="fas fa-spinner fa-spin"></i></> : <><i className="fas fa-check-double text-brand-secondary me-2"></i>فحص الجودة</>}
                            </button>
                            <button onClick={handleScoreContent} disabled={isScoring || !editedPiece.generatedContent} className="text-xs bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg py-1 px-3 text-light-text dark:text-dark-text hover:border-brand-primary disabled:opacity-50">
                                {isScoring ? <><i className="fas fa-spinner fa-spin"></i></> : <><i className="fas fa-star-half-stroke text-brand-primary me-2"></i>تقييم المحتوى</>}
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                        <textarea
                            value={editedPiece.generatedContent}
                            onChange={(e) => handleFieldChange('generatedContent', e.target.value)}
                            rows={15}
                            className="col-span-2 w-full text-sm bg-light-bg dark:bg-dark-bg p-3 rounded-md whitespace-pre-wrap border border-light-border dark:border-dark-border"
                        />
                        <div className="col-span-1 space-y-4">
                            {(isScoring || scoreResult) && (
                                <ContentScorePanel
                                    result={scoreResult ?? { totalScore: 0, breakdown: { dnaMatch: { score: 0, feedback: '' }, historicalPerformance: { score: 0, feedback: '' }, crossBrandBenchmark: { score: 0, feedback: '' } }, topImprovement: '', predictedCtr: 'low' }}
                                    isLoading={isScoring}
                                    onRescore={handleScoreContent}
                                />
                            )}
                            {qualityCheckResult && <AIQualityCheckDisplay result={qualityCheckResult} />}
                        </div>
                    </div>
                </div>
            );
            case 'media': return (
                 <div>
                    <h3 className="font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-2">الوسائط المرفقة</h3>
                    <div className="flex gap-2 flex-wrap">
                        {editedPiece.media.map(m => (
                        <div key={m.id} className="relative group">
                            <img src={m.url} className="w-24 h-24 object-cover rounded-md" alt="media" />
                            {m.type === 'image' && (
                            <button onClick={() => handleAnalyzeMedia(m)} disabled={!!isAnalyzingMedia} className="absolute bottom-1 right-1 text-white bg-black/60 text-xs px-2 py-0.5 rounded-full hover:bg-brand-primary disabled:opacity-50">
                                {isAnalyzingMedia === m.id ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-brain"></i>}
                            </button>
                            )}
                        </div>
                        ))}
                        <button className="w-24 h-24 bg-light-bg dark:bg-dark-bg border-2 border-dashed border-light-border dark:border-dark-border rounded-md flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary">+</button>
                    </div>
                </div>
            );
            case 'settings': return (
                <div>
                    <h3 className="font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-2">الإعدادات</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-light-bg dark:bg-dark-bg p-4 rounded-lg">
                        <div className="text-sm">
                            <label className="font-semibold block mb-1">المسؤول</label>
                            <select value={editedPiece.assignee} onChange={e => handleFieldChange('assignee', e.target.value)} className="w-full p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md">
                                <option value="Unassigned">Unassigned</option>
                                {users.map(user => <option key={user.id} value={user.name}>{user.name}</option>)}
                            </select>
                        </div>
                        <div className="text-sm">
                            <label className="font-semibold block mb-1">المراجع</label>
                            <select value={editedPiece.reviewer || ''} onChange={e => handleFieldChange('reviewer', e.target.value === '' ? undefined : e.target.value)} className="w-full p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md">
                                <option value="">Unassigned</option>
                                {users.map(user => <option key={user.id} value={user.name}>{user.name}</option>)}
                            </select>
                        </div>
                        <div className="text-sm">
                            <label className="font-semibold block mb-1">تاريخ التسليم</label>
                            <input type="date" value={new Date(editedPiece.dueDate).toISOString().split('T')[0]} onChange={e => handleFieldChange('dueDate', new Date(e.target.value).toISOString())} className="w-full p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md" style={{colorScheme: 'dark'}}/>
                        </div>
                        <div className="text-sm">
                            <label className="font-semibold block mb-1">الحالة</label>
                            <select value={editedPiece.status} onChange={e => handleFieldChange('status', e.target.value as ContentStatus)} className="w-full p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md">
                                {statusColumns.map(s => <option key={s} value={s}>{statusTranslations[s]}</option>)}
                            </select>
                        </div>
                        <div className="col-span-full text-sm">
                            <label className="font-semibold block mb-1">المنصات المستهدفة</label>
                            <div className="flex flex-wrap gap-2">
                                {Object.values(SocialPlatform).map(p => (
                                    <button key={p} onClick={() => {
                                        const newPlatforms = editedPiece.platforms?.includes(p)
                                            ? editedPiece.platforms.filter(pf => pf !== p)
                                            : [...(editedPiece.platforms || []), p];
                                        handleFieldChange('platforms', newPlatforms);
                                    }} className={`px-3 py-1 text-xs rounded-full border ${editedPiece.platforms?.includes(p) ? 'bg-brand-primary border-brand-primary text-white' : 'bg-light-card dark:bg-dark-card border-light-border dark:border-dark-border'}`}>
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="col-span-full text-sm">
                            <label className="font-semibold block mb-1">معلمات UTM</label>
                            <input type="text" placeholder="utm_source=social&utm_campaign=spring_launch" value={Object.entries(editedPiece.utmParameters || {}).map(([k,v]) => `${k}=${v}`).join('&')} onChange={e => {
                                const params = new URLSearchParams(e.target.value);
                                const utmObject: Record<string, string> = {};
                                params.forEach((value, key) => { utmObject[key] = value });
                                handleFieldChange('utmParameters', utmObject);
                            }} className="w-full p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md font-mono text-xs"/>
                        </div>
                    </div>
                </div>
            );
             case 'comments': return (
                <div>
                    <h3 className="font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-2">التعليقات</h3>
                    <div className="space-y-3 max-h-60 overflow-y-auto bg-light-bg dark:bg-dark-bg p-3 rounded-lg">
                        {editedPiece.comments.map(c => (
                            <div key={c.id}>
                                <span className="font-bold text-sm text-light-text dark:text-dark-text">{c.author}</span>
                                <p className="text-sm text-light-text dark:text-dark-text bg-light-card dark:bg-dark-card p-2 rounded-md">{c.text}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                        <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="أضف تعليقًا..." className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md"/>
                        <button onClick={handleCommentSubmit} className="bg-brand-secondary text-white font-bold px-4 rounded-lg">إضافة</button>
                    </div>
                </div>
             );
            default: return null;
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b border-light-border dark:border-dark-border flex justify-between items-center">
                    <input
                        type="text"
                        value={editedPiece.title}
                        onChange={(e) => handleFieldChange('title', e.target.value)}
                        className="text-lg font-bold text-light-text dark:text-dark-text bg-transparent border-0 focus:ring-0 w-full"
                    />
                    <button onClick={onClose} className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text">&times;</button>
                </div>

                <div className="border-b border-light-border dark:border-dark-border px-6">
                    <nav className="-mb-px flex space-s-6">
                         {(['content', 'media', 'comments', 'settings'] as const).map(tab => (
                             <button key={tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === tab ? 'border-brand-pink text-brand-pink' : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}>
                                 {tab.charAt(0).toUpperCase() + tab.slice(1)}
                             </button>
                         ))}
                    </nav>
                </div>

                <div className="p-6 overflow-y-auto flex-grow space-y-4">
                    {renderTabContent()}
                </div>

                <div className="p-4 bg-light-bg/50 dark:bg-dark-bg/50 border-t border-light-border dark:border-dark-border flex justify-between items-center">
                    <div className="flex gap-3">
                        <button onClick={() => onSendToPublisher(editedPiece)} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-500 disabled:opacity-50 text-sm">
                            <i className="fas fa-paper-plane me-2"></i>إرسال للناشر
                        </button>
                         <button className="bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 font-bold py-2 px-4 rounded-lg text-sm"><i className="fas fa-file-export me-2"></i>تصدير</button>
                        <button className="bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 font-bold py-2 px-4 rounded-lg text-sm"><i className="fas fa-link me-2"></i>ربط بحملة</button>
                         <button onClick={handleDelete} className="bg-red-600/20 text-red-400 font-bold py-2 px-4 rounded-lg hover:bg-red-600 hover:text-white text-sm">
                            <i className="fas fa-trash-alt"></i>
                        </button>
                    </div>
                    <div className="flex gap-3">
                         <button onClick={onClose} className="text-light-text-secondary dark:text-dark-text-secondary font-bold py-2 px-4">إلغاء</button>
                         <button onClick={handleSave} className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg">حفظ</button>
                    </div>
                </div>
            </div>
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title={`حذف "${piece.title}"؟`}
                description="لن تتمكن من استرداد هذا العنصر بعد الحذف."
                confirmLabel="احذف العنصر"
                cancelLabel="احتفظ به"
                variant="danger"
                onCancel={() => setShowDeleteConfirm(false)}
                onConfirm={() => {
                    setShowDeleteConfirm(false);
                    onDelete(piece.id);
                    onClose();
                }}
            />
        </div>
    );
};


const ContentCard: React.FC<{
    piece: ContentPiece;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, pieceId: string) => void;
    onClick: () => void;
    users: User[];
    isSelected: boolean;
    onToggleSelect: (e: React.MouseEvent) => void;
    onSendToPublisher: (piece: ContentPiece) => void;
}> = ({ piece, onDragStart, onClick, users, isSelected, onToggleSelect, onSendToPublisher }) => {
    const assignee = users.find(u => u.name === piece.assignee);
    const reviewer = piece.reviewer ? users.find(u => u.name === piece.reviewer) : null;
    const isOverdue = piece.dueDate && new Date(piece.dueDate) < new Date() && piece.status !== ContentStatus.Approved;
    const isApproved = piece.status === ContentStatus.Approved;

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, piece.id)}
            className={`group surface-panel-soft relative w-full cursor-grab rounded-[1.4rem] !border-0 text-right transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-ambient)] active:scale-95 active:cursor-grabbing
                ${isSelected
                    ? 'bg-brand-primary/10 ring-2 ring-brand-primary/50'
                    : ''
                }`}
        >
            {/* Checkbox for bulk select */}
            <button
                onClick={onToggleSelect}
                className={`absolute top-2.5 start-2.5 z-10 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
                    ${isSelected
                        ? 'bg-brand-primary border-brand-primary'
                        : 'bg-light-card dark:bg-dark-card border-light-border dark:border-dark-border opacity-0 group-hover:opacity-100'
                    }`}
                title="تحديد"
            >
                {isSelected && <i className="fas fa-check text-white" style={{ fontSize: '9px' }}></i>}
            </button>

            <button onClick={onClick} className="w-full text-right p-3 space-y-2.5">
                {/* Type badge */}
                <div className="flex items-start justify-between gap-2 ps-6">
                    <p className="font-bold text-light-text dark:text-dark-text text-sm leading-snug">{piece.title}</p>
                    <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-light-card dark:bg-dark-card text-light-text-secondary dark:text-dark-text-secondary border border-light-border dark:border-dark-border">
                        {piece.type || 'Social'}
                    </span>
                </div>

                {/* Platform icons */}
                {piece.platforms && piece.platforms.length > 0 && (
                    <div className="flex items-center gap-1.5 ps-1">
                        {piece.platforms.map(p => {
                            const asset = PLATFORM_ASSETS[p];
                            return <i key={p} className={`${asset.icon} text-sm ${asset.textColor}`} title={p}></i>;
                        })}
                    </div>
                )}

                {/* Footer: meta info */}
                <div className="flex justify-between items-center pt-2 border-t border-light-border/40 dark:border-dark-border/40">
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                            <i className="far fa-comments"></i>{piece.comments.length}
                        </span>
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                            <i className="far fa-paperclip"></i>{piece.media.length}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {(piece as any).contentScore !== undefined && (
                            <ContentScoreBadge score={(piece as any).contentScore} size="sm" />
                        )}
                        {piece.dueDate && (
                            <span className={`text-xs font-semibold flex items-center gap-1 px-1.5 py-0.5 rounded-md
                                ${isOverdue
                                    ? 'text-red-500 bg-red-500/10'
                                    : 'text-light-text-secondary dark:text-dark-text-secondary'
                                }`}>
                                {isOverdue && <i className="fas fa-exclamation-triangle text-[9px]"></i>}
                                <i className="far fa-calendar-alt text-[10px]"></i>
                                <span>{new Date(piece.dueDate).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</span>
                            </span>
                        )}
                        <div className="flex -space-x-1.5">
                            {assignee && (
                                <img src={assignee.avatarUrl} title={`مسند إلى: ${assignee.name}`} className="w-5 h-5 rounded-full border-2 border-light-bg dark:border-dark-bg" alt={assignee.name} />
                            )}
                            {reviewer && (
                                <img src={reviewer.avatarUrl} title={`مراجع: ${reviewer.name}`} className="w-5 h-5 rounded-full border-2 border-light-bg dark:border-dark-bg" alt={reviewer.name} />
                            )}
                        </div>
                    </div>
                </div>
            </button>

            {/* Send to Publisher - visible on Approved cards */}
            {isApproved && (
                <button
                    onClick={(e) => { e.stopPropagation(); onSendToPublisher(piece); }}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-brand-primary border-t border-brand-primary/20 hover:bg-brand-primary hover:text-white transition-all rounded-b-xl group/pub"
                    title="انقل هذا المحتوى إلى الناشر لجدولته ونشره"
                >
                    <i className="fas fa-paper-plane group-hover/pub:animate-bounce text-[10px]"></i>
                    نشر الآن ←
                </button>
            )}
        </div>
    );
};

const COLUMN_COLORS: Record<ContentStatus, { dot: string; badge: string; ring: string }> = {
    [ContentStatus.Ideas]:      { dot: 'bg-gray-400',    badge: 'bg-gray-400/10 text-gray-400',    ring: 'ring-gray-400/50 border-gray-400/50' },
    [ContentStatus.InProgress]: { dot: 'bg-blue-400',    badge: 'bg-blue-400/10 text-blue-400',    ring: 'ring-blue-400/50 border-blue-400/50' },
    [ContentStatus.InReview]:   { dot: 'bg-yellow-400',  badge: 'bg-yellow-400/10 text-yellow-400', ring: 'ring-yellow-400/50 border-yellow-400/50' },
    [ContentStatus.Approved]:   { dot: 'bg-emerald-400', badge: 'bg-emerald-400/10 text-emerald-400', ring: 'ring-emerald-400/50 border-emerald-400/50' },
};

const KanbanColumn: React.FC<{
    status: ContentStatus;
    pieces: ContentPiece[];
    onDragStart: (e: React.DragEvent<HTMLDivElement>, pieceId: string) => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>, status: ContentStatus) => void;
    onCardClick: (piece: ContentPiece) => void;
    onAddPiece: () => void;
    onAIIdeation: () => void;
    users: User[];
    selectedIds: Set<string>;
    onToggleSelect: (id: string, e: React.MouseEvent) => void;
    onSendToPublisher: (piece: ContentPiece) => void;
}> = ({ status, pieces, onDragStart, onDrop, onCardClick, onAddPiece, onAIIdeation, users, selectedIds, onToggleSelect, onSendToPublisher }) => {
    // Counter-based drag tracking to avoid flickering on child hover
    const [dragCount, setDragCount] = useState(0);
    const isOver = dragCount > 0;
    const colors = COLUMN_COLORS[status];

    return (
        <div
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setDragCount(c => c + 1)}
            onDragLeave={() => setDragCount(c => Math.max(0, c - 1))}
            onDrop={(e) => { onDrop(e, status); setDragCount(0); }}
            className={`bg-light-card dark:bg-dark-card p-3 rounded-xl border w-64 md:w-72 flex-shrink-0 flex flex-col transition-all duration-200
                ${isOver
                    ? `ring-2 ${colors.ring} bg-brand-primary/5 dark:bg-brand-primary/5 scale-[1.01]`
                    : 'border-light-border dark:border-dark-border'
                }`}
        >
            {/* Column header */}
            <div className="flex items-center justify-between mb-3 px-1 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${colors.dot}`}></span>
                    <h3 className="font-bold text-light-text dark:text-dark-text text-sm">{statusTranslations[status]}</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>{pieces.length}</span>
                </div>
                <div className="flex gap-1">
                    {status === ContentStatus.Ideas && (
                        <button onClick={onAIIdeation} title="توليد أفكار بالذكاء الاصطناعي"
                            className="w-6 h-6 rounded-lg bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary hover:border-brand-primary transition-colors">
                            <i className="fas fa-magic text-[10px]"></i>
                        </button>
                    )}
                    <button onClick={onAddPiece} title="إضافة يدوي"
                        className="w-6 h-6 rounded-lg bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary hover:border-brand-primary transition-colors text-sm font-bold">
                        +
                    </button>
                </div>
            </div>

            {/* Drop indicator — when dragging over empty column */}
            {isOver && pieces.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-brand-primary/40 rounded-xl m-1 py-8 animate-pulse">
                    <i className="fas fa-arrow-down text-brand-primary text-xl mb-2 opacity-60"></i>
                    <p className="text-brand-primary text-xs font-semibold opacity-70">أفلت هنا</p>
                </div>
            )}

            {/* Empty state — when column is genuinely empty and not being dragged over */}
            {!isOver && pieces.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-10 px-3 text-center">
                    <div className="w-10 h-10 rounded-xl bg-light-bg dark:bg-dark-bg flex items-center justify-center mb-3">
                        <i className={`fas ${columnEmptyStates[status].icon} text-light-text-secondary dark:text-dark-text-secondary`}></i>
                    </div>
                    <p className="text-xs font-semibold text-light-text dark:text-dark-text mb-1">{columnEmptyStates[status].title}</p>
                    <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">{columnEmptyStates[status].hint}</p>
                </div>
            )}

            {/* Cards list */}
            <div className={`space-y-2.5 flex-grow overflow-y-auto p-0.5 ${isOver && pieces.length > 0 ? 'ring-1 ring-inset ring-brand-primary/30 rounded-xl bg-brand-primary/5' : ''}`}>
                {/* Drop indicator (non-empty column) */}
                {isOver && pieces.length > 0 && (
                    <div className="h-1 bg-brand-primary rounded-full mx-2 animate-pulse"></div>
                )}
                {pieces.map(p => (
                    <ContentCard
                        key={p.id}
                        piece={p}
                        onDragStart={onDragStart}
                        onClick={() => onCardClick(p)}
                        users={users}
                        isSelected={selectedIds.has(p.id)}
                        onToggleSelect={(e) => onToggleSelect(p.id, e)}
                        onSendToPublisher={onSendToPublisher}
                    />
                ))}
            </div>
        </div>
    );
};

export const ContentOpsPage: React.FC<ContentOpsPageProps> = ({ addNotification, initialContent, brandProfile, brandId, onAddPiece, onUpdatePiece, onAddComment, onSendToPublisher, onLoadBrief, onGenerateFromBrief, onDeletePiece, users }) => {
    const [content, setContent] = useState<ContentPiece[]>(initialContent);
    const [savedBriefs, setSavedBriefs] = useState<PublisherBrief[]>([]);
    const [briefsLoading, setBriefsLoading] = useState(false);
    const [selectedPiece, setSelectedPiece] = useState<ContentPiece | null>(null);
    const [showAIStudio, setShowAIStudio] = useState(false);
    const [showAIIdeation, setShowAIIdeation] = useState(false);
    const [activeTab, setActiveTab] = useState<'plan' | 'assets' | 'approvals'>('plan');
    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const isBulkMode = selectedIds.size > 0;
    // Confirm dialog state
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        setContent(initialContent);
    }, [initialContent]);

    useEffect(() => {
        let isMounted = true;

        const loadBriefs = async () => {
            setBriefsLoading(true);
            try {
                const briefs = await getContentBriefs(brandId);
                if (isMounted) {
                    setSavedBriefs(briefs.slice(0, 6));
                }
            } finally {
                if (isMounted) {
                    setBriefsLoading(false);
                }
            }
        };

        void loadBriefs();

        return () => {
            isMounted = false;
        };
    }, [brandId]);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, pieceId: string) => {
        e.dataTransfer.setData("pieceId", pieceId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, newStatus: ContentStatus) => {
        e.preventDefault();
        const pieceId = e.dataTransfer.getData("pieceId");
        const piece = content.find(p => p.id === pieceId);

        if (piece && piece.status !== newStatus) {
            setContent(prev => prev.map(p => p.id === pieceId ? { ...p, status: newStatus } : p));
            onUpdatePiece(pieceId, { status: newStatus });
            addNotification(NotificationType.Success, `✅ تم نقل "${piece.title}" إلى ${statusTranslations[newStatus]}`);
        }
    };

    const handleToggleSelect = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleBulkDelete = () => {
        setConfirmDelete(true);
    };

    const confirmBulkDelete = () => {
        const count = selectedIds.size;
        selectedIds.forEach(id => onDeletePiece(id));
        setContent(prev => prev.filter(p => !selectedIds.has(p.id)));
        addNotification(NotificationType.Info, `🗑️ تم حذف ${count} عنصر من خطة المحتوى`);
        setSelectedIds(new Set());
        setConfirmDelete(false);
    };

    const handleBulkArchive = () => {
        const count = selectedIds.size;
        selectedIds.forEach(id => onUpdatePiece(id, { status: ContentStatus.Approved }));
        setContent(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, status: ContentStatus.Approved } : p));
        addNotification(NotificationType.Success, `✅ تمت الموافقة على ${count} عنصر — جاهز للنشر`);
        setSelectedIds(new Set());
    };

    const handleBulkMove = (status: ContentStatus) => {
        const count = selectedIds.size;
        selectedIds.forEach(id => onUpdatePiece(id, { status }));
        setContent(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, status } : p));
        addNotification(NotificationType.Info, `↪ تم نقل ${count} عنصر إلى "${statusTranslations[status]}"`);
        setSelectedIds(new Set());
    };
    
    const handleAIGenerate = (data: Omit<ContentPiece, 'id' | 'comments' | 'media' | 'assignee' | 'dueDate' | 'status'>[]) => {
        const piecesWithStatus = data.map(p => ({ ...p, status: ContentStatus.Ideas }));
        onAddPiece(piecesWithStatus);
        addNotification(NotificationType.Success, `تمت إضافة ${data.length} أفكار جديدة إلى قائمة الانتظار.`);
    };


    const handleUpdateFromModal = (pieceId: string, updates: Partial<ContentPiece>) => {
        setContent(prev => prev.map(p => (p.id === pieceId ? { ...p, ...updates } : p)));
        onUpdatePiece(pieceId, updates);
        addNotification(NotificationType.Info, "تم تحديث المحتوى.");
    };
    
    const handleAddCommentToPiece = (pieceId: string, text: string) => {
        const tempComment: Comment = { id: crypto.randomUUID(), author: 'أنت', text, timestamp: new Date() };
        
        setContent(prev => prev.map(p => {
            if (p.id === pieceId) {
                const updatedPiece = { ...p, comments: [...p.comments, tempComment] };
                if (selectedPiece && selectedPiece.id === pieceId) {
                    setSelectedPiece(updatedPiece);
                }
                return updatedPiece;
            }
            return p;
        }));
        
        onAddComment(pieceId, text);
    };

    const handleAddNewPiece = () => {
        onAddPiece([{
            title: 'فكرة جديدة - اضغط للتعديل',
            type: 'Social',
            status: ContentStatus.Ideas,
            generatedContent: '',
        }]);
        addNotification(NotificationType.Success, 'تم إنشاء فكرة محتوى جديدة.');
    };
    
    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center flex-shrink-0">
                 <div>
                     <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">خطة المحتوى</h1>
                     <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                         {content.length} قطعة محتوى في الخط الإنتاجي
                     </p>
                 </div>
                 <div className="flex items-center gap-2">
                    <button onClick={() => setShowAIStudio(true)} className="bg-gradient-to-r from-brand-pink to-brand-purple text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
                        <i className="fas fa-magic me-2"></i>✨ استوديو AI — أنشئ محتوى
                    </button>
                 </div>
            </div>

            {/* ── Bulk Actions Toolbar ── */}
            {isBulkMode && (
                <div className="mt-4 flex items-center gap-2 flex-wrap p-3 bg-brand-primary/10 border border-brand-primary/30 rounded-xl animate-fade-in flex-shrink-0">
                    <span className="text-sm font-bold text-brand-primary flex items-center gap-2">
                        <i className="fas fa-check-square"></i>
                        {selectedIds.size} {selectedIds.size === 1 ? 'عنصر محدد' : 'عناصر محددة'}
                    </span>
                    <div className="flex items-center gap-1.5 ms-2 flex-wrap">
                        {statusColumns.map(s => (
                            <button key={s} onClick={() => handleBulkMove(s)}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border hover:border-brand-primary hover:text-brand-primary transition-colors">
                                نقل → {statusTranslations[s]}
                            </button>
                        ))}
                        <button onClick={handleBulkArchive}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20 transition-colors">
                            <i className="fas fa-check me-1"></i>الموافقة على الكل
                        </button>
                        <button onClick={handleBulkDelete}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 transition-colors">
                            <i className="fas fa-trash me-1"></i>حذف ({selectedIds.size})
                        </button>
                    </div>
                    <button onClick={() => setSelectedIds(new Set())} className="ms-auto text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text">
                        <i className="fas fa-times me-1"></i>إلغاء التحديد
                    </button>
                </div>
            )}

            {/* ── Confirm Delete Dialog ── */}
            <ConfirmDialog
                isOpen={confirmDelete}
                title={`حذف ${selectedIds.size} ${selectedIds.size === 1 ? 'عنصر' : 'عناصر'}؟`}
                description="لن تتمكن من استرداد المحتوى المحذوف. تأكد قبل المتابعة."
                confirmLabel={`احذف ${selectedIds.size === 1 ? 'العنصر' : 'العناصر'}`}
                cancelLabel="احتفظ بها"
                variant="danger"
                onConfirm={confirmBulkDelete}
                onCancel={() => setConfirmDelete(false)}
            />

            <div className="mt-5 rounded-2xl border border-light-border bg-light-card p-4 dark:border-dark-border dark:bg-dark-card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-primary">Saved Briefs</p>
                        <h2 className="mt-2 text-lg font-semibold text-light-text dark:text-dark-text">أعد استخدام briefs المحفوظة داخل Content Ops</h2>
                        <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            افتح الـ brief كسياق داخل الناشر أو حوّله مباشرة إلى draft جديد بدل بدء الكتابة من الصفر.
                        </p>
                    </div>
                    <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">
                        {savedBriefs.length} briefs
                    </span>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {briefsLoading ? (
                        <div className="col-span-full rounded-xl border border-light-border bg-light-bg px-4 py-5 text-sm text-light-text-secondary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-secondary">
                            جارٍ تحميل briefs المحفوظة...
                        </div>
                    ) : savedBriefs.length === 0 ? (
                        <div className="col-span-full rounded-xl border border-dashed border-light-border bg-light-bg px-4 py-5 text-sm text-light-text-secondary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-secondary">
                            لا توجد briefs محفوظة بعد. احفظ briefs من Social Search لتظهر هنا.
                        </div>
                    ) : (
                        savedBriefs.map((brief) => (
                            <div key={brief.id} className="rounded-xl border border-light-border bg-light-bg p-4 dark:border-dark-border dark:bg-dark-bg">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-primary">{brief.source === 'social-search' ? 'Social Search' : 'Content Ops'}</p>
                                        <h3 className="mt-2 text-sm font-semibold text-light-text dark:text-dark-text">{brief.title}</h3>
                                    </div>
                                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-light-text-secondary dark:bg-dark-card dark:text-dark-text-secondary">
                                        {brief.suggestedPlatforms.length} قنوات
                                    </span>
                                </div>
                                <p className="mt-3 line-clamp-3 text-xs leading-6 text-light-text-secondary dark:text-dark-text-secondary">{brief.angle}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {brief.keywords.slice(0, 4).map((keyword) => (
                                        <span key={keyword} className="rounded-full bg-white px-2 py-1 text-[11px] text-light-text-secondary dark:bg-dark-card dark:text-dark-text-secondary">
                                            {keyword}
                                        </span>
                                    ))}
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                        onClick={() => onLoadBrief(brief)}
                                        className="rounded-lg border border-light-border px-3 py-2 text-xs font-semibold text-light-text transition-colors hover:border-brand-primary hover:text-brand-primary dark:border-dark-border dark:text-dark-text"
                                    >
                                        فتح الـ brief
                                    </button>
                                    <button
                                        onClick={() => onGenerateFromBrief(brief)}
                                        className="rounded-lg bg-brand-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-secondary"
                                    >
                                        توليد draft
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="border-b border-light-border dark:border-dark-border mt-6">
                <nav className="-mb-px flex space-s-8">
                    <button
                        onClick={() => setActiveTab('plan')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'plan'
                                ? 'border-brand-pink text-brand-pink'
                                : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                        }`}
                    >
                        خطة المحتوى
                    </button>
                    <button
                        onClick={() => setActiveTab('assets')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'assets'
                                ? 'border-brand-pink text-brand-pink'
                                : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                        }`}
                    >
                        الأصول
                    </button>
                    <button
                        onClick={() => setActiveTab('approvals')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'approvals'
                                ? 'border-brand-pink text-brand-pink'
                                : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                        }`}
                    >
                        الموافقات
                    </button>
                </nav>
            </div>
            
            <div className="flex-grow pt-6 flex flex-col overflow-hidden">
                {activeTab === 'plan' && (
                    <div className="flex gap-4 overflow-x-auto pb-4 flex-grow">
                        {statusColumns.map(status => (
                            <KanbanColumn
                                key={status}
                                status={status}
                                pieces={content.filter(p => p.status === status)}
                                onDragStart={handleDragStart}
                                onDrop={handleDrop}
                                onCardClick={setSelectedPiece}
                                onAddPiece={handleAddNewPiece}
                                onAIIdeation={() => setShowAIIdeation(true)}
                                users={users}
                                selectedIds={selectedIds}
                                onToggleSelect={handleToggleSelect}
                                onSendToPublisher={onSendToPublisher}
                            />
                        ))}
                    </div>
                )}
                {/* CON-2: Media Library */}
                {activeTab === 'assets' && (() => {
                    const allMedia: MediaItem[] = content.flatMap(p => p.media ?? []);
                    const [mediaFilter, setMediaFilter] = React.useState<'all' | 'image' | 'video'>('all');
                    const filteredMedia = allMedia.filter(m => mediaFilter === 'all' || m.type === mediaFilter);
                    // Seed mock items if no real media
                    interface MockMedia { id: string; type: 'image' | 'video'; url: string; label: string }
                    const MOCK_MEDIA: MockMedia[] = filteredMedia.length > 0
                        ? filteredMedia.map(m => ({ id: m.id, type: m.type, url: m.url, label: m.id }))
                        : ([
                            { id: 'm1', type: 'image', url: 'https://picsum.photos/seed/1/400/300', label: 'hero-image.jpg' },
                            { id: 'm2', type: 'video', url: '',                                      label: 'product-video.mp4' },
                            { id: 'm3', type: 'image', url: 'https://picsum.photos/seed/2/400/300', label: 'brand-logo.png' },
                            { id: 'm5', type: 'image', url: 'https://picsum.photos/seed/3/400/300', label: 'campaign-bg.jpg' },
                            { id: 'm6', type: 'video', url: '',                                      label: 'promo-reel.mp4' },
                        ] as MockMedia[]).filter(m => mediaFilter === 'all' || m.type === mediaFilter);
                    return (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex gap-1">
                                    {(['all', 'image', 'video'] as const).map(f => (
                                        <button key={f} onClick={() => setMediaFilter(f)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${mediaFilter === f ? 'bg-brand-primary text-white' : 'bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/30 dark:hover:bg-dark-border/30'}`}>
                                            {f === 'all' ? `الكل (${allMedia.length || 5})` : f === 'image' ? '🖼️ صور' : '🎬 فيديو'}
                                        </button>
                                    ))}
                                </div>
                                <label className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary-dark transition-colors cursor-pointer ms-auto">
                                    <i className="fas fa-upload text-xs" /> رفع ملف
                                    <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => {
                                        if (e.target.files && e.target.files.length > 0)
                                            addNotification(NotificationType.Info, `تم تحديد ${e.target.files.length} ملف — سيتم الرفع قريباً`);
                                    }} />
                                </label>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {MOCK_MEDIA.map(item => (
                                    <div key={item.id} className="group bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                                        <div className="aspect-square bg-light-surface dark:bg-dark-surface flex items-center justify-center relative">
                                            {item.type === 'image' && item.url ? (
                                                <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                                            ) : (
                                                <i className="fas fa-film text-3xl text-brand-primary" />
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <button className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-xs hover:scale-110 transition-transform" aria-label="View">
                                                    <i className="fas fa-eye" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-2">
                                            <p className="text-xs font-medium text-light-text dark:text-dark-text truncate">{item.label}</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{item.type}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {MOCK_MEDIA.length === 0 && (
                                <div className="text-center py-16 text-light-text-secondary dark:text-dark-text-secondary">
                                    <i className="fas fa-photo-video text-4xl mb-3 opacity-30" />
                                    <p>لا توجد أصول — ارفع ملفاتك الأولى</p>
                                </div>
                            )}
                        </div>
                    );
                })()}
                {/* CON-1: Approval Workflow */}
                {activeTab === 'approvals' && (() => {
                    const inReview = content.filter(p => p.status === ContentStatus.InReview);
                    const [approvalFilter, setApprovalFilter] = React.useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
                    const [localStatuses, setLocalStatuses] = React.useState<Record<string, 'pending' | 'approved' | 'rejected'>>({});

                    const getStatus = (id: string) => localStatuses[id] ?? 'pending';

                    const handleApprove = (piece: ContentPiece) => {
                        setLocalStatuses(s => ({ ...s, [piece.id]: 'approved' }));
                        onUpdatePiece(piece.id, { status: ContentStatus.Approved });
                        addNotification(NotificationType.Success, `✅ تمت الموافقة على "${piece.title}"`);
                    };
                    const handleReject = (piece: ContentPiece) => {
                        setLocalStatuses(s => ({ ...s, [piece.id]: 'rejected' }));
                        addNotification(NotificationType.Warning, `❌ تم رفض "${piece.title}"`);
                    };

                    const filteredPieces = inReview.filter(p => {
                        const s = getStatus(p.id);
                        return approvalFilter === 'all' || s === approvalFilter;
                    });

                    const PLATFORM_ICON: Record<string, string> = {
                        Facebook: 'fa-facebook', Instagram: 'fa-instagram', TikTok: 'fa-tiktok',
                        X: 'fa-x-twitter', LinkedIn: 'fa-linkedin',
                    };

                    return (
                        <div className="space-y-5">
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex gap-1">
                                    {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                                        <button key={f} onClick={() => setApprovalFilter(f)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${approvalFilter === f ? 'bg-brand-primary text-white' : 'bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary'}`}>
                                            {f === 'all' ? `الكل (${inReview.length})` : f === 'pending' ? `⏳ بانتظار الموافقة` : f === 'approved' ? `✅ موافق` : `❌ مرفوض`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {filteredPieces.length === 0 ? (
                                <div className="text-center py-16">
                                    <i className="fas fa-check-double text-5xl text-green-500 mb-3 opacity-60" />
                                    <p className="text-light-text-secondary dark:text-dark-text-secondary">لا يوجد محتوى بانتظار الموافقة</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredPieces.map(piece => {
                                        const status = getStatus(piece.id);
                                        return (
                                            <div key={piece.id} className={`bg-light-card dark:bg-dark-card border rounded-2xl p-5 transition-all ${status === 'approved' ? 'border-green-300 dark:border-green-700' : status === 'rejected' ? 'border-red-300 dark:border-red-700' : 'border-light-border dark:border-dark-border'}`}>
                                                <div className="flex items-start gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                            <span className="font-semibold text-light-text dark:text-dark-text">{piece.title}</span>
                                                            {piece.platforms && piece.platforms.length > 0 && (
                                                                <span className="text-xs text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full">
                                                                    <i className={`fab ${PLATFORM_ICON[piece.platforms[0]] ?? 'fa-globe'} mr-1`} />
                                                                    {piece.platforms[0]}
                                                                </span>
                                                            )}
                                                            {status !== 'pending' && (
                                                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                                                                    {status === 'approved' ? '✅ موافق عليه' : '❌ مرفوض'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed line-clamp-3">{piece.generatedContent || 'لا يوجد محتوى معاين'}</p>
                                                        {piece.comments.length > 0 && (
                                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-2">
                                                                <i className="fas fa-comment mr-1" /> {piece.comments.length} تعليق
                                                            </p>
                                                        )}
                                                    </div>
                                                    {status === 'pending' && (
                                                        <div className="flex gap-2 shrink-0">
                                                            <button onClick={() => handleApprove(piece)}
                                                                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">
                                                                <i className="fas fa-check" /> موافقة
                                                            </button>
                                                            <button onClick={() => handleReject(piece)}
                                                                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors">
                                                                <i className="fas fa-times" /> رفض
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>

            {showAIStudio && <AIStudioModal onClose={() => setShowAIStudio(false)} brandProfile={brandProfile} onGenerate={handleAIGenerate} />}
            {showAIIdeation && <AIIdeationModal onClose={() => setShowAIIdeation(false)} brandProfile={brandProfile} onGenerate={handleAIGenerate} />}
            {selectedPiece && (
                <ContentDetailModal
                    piece={selectedPiece}
                    onClose={() => setSelectedPiece(null)}
                    onUpdate={handleUpdateFromModal}
                    onAddComment={handleAddCommentToPiece}
                    onSendToPublisher={onSendToPublisher}
                    onDelete={onDeletePiece}
                    brandProfile={brandProfile}
                    brandId={brandId}
                    users={users}
                />
            )}
        </div>
    );
};
