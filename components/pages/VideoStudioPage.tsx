import React, { useState } from 'react';
import { NotificationType, MarketingPlan } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface VideoTool {
    id: string;
    icon: string;
    titleAr: string;
    titleEn: string;
    descAr: string;
    descEn: string;
    comingSoon: boolean;
    color: string;
}

const VIDEO_TOOLS: VideoTool[] = [
    {
        id: 'text-to-video',
        icon: 'fa-wand-magic-sparkles',
        titleAr: 'نص إلى فيديو',
        titleEn: 'Text to Video',
        descAr: 'حوّل أي نص أو فكرة إلى فيديو احترافي مباشرة.',
        descEn: 'Turn any text or idea into a professional video instantly.',
        comingSoon: false,
        color: 'from-violet-500 to-purple-600',
    },
    {
        id: 'reels-templates',
        icon: 'fa-film',
        titleAr: 'قوالب ريلز وشورتس',
        titleEn: 'Reels & Shorts Templates',
        descAr: 'قوالب جاهزة مُحسَّنة للمنصات — انستغرام، تيك توك، يوتيوب.',
        descEn: 'Ready-made templates optimized for Instagram, TikTok, YouTube.',
        comingSoon: false,
        color: 'from-pink-500 to-rose-600',
    },
    {
        id: 'auto-captions',
        icon: 'fa-closed-captioning',
        titleAr: 'ترجمة وكابشن تلقائي',
        titleEn: 'Auto Captions',
        descAr: 'ترجمة صوتية تلقائية وإضافة كابشن بجميع اللغات.',
        descEn: 'Automatic speech transcription and caption overlay in all languages.',
        comingSoon: true,
        color: 'from-sky-500 to-blue-600',
    },
    {
        id: 'video-editor',
        icon: 'fa-scissors',
        titleAr: 'محرر الفيديو',
        titleEn: 'Video Editor',
        descAr: 'قص ودمج ومونتاج مقاطع الفيديو بسرعة.',
        descEn: 'Cut, trim, and assemble clips quickly.',
        comingSoon: true,
        color: 'from-amber-500 to-orange-600',
    },
    {
        id: 'music',
        icon: 'fa-music',
        titleAr: 'موسيقى ذكاء اصطناعي',
        titleEn: 'AI Music',
        descAr: 'موسيقى خلفية مولّدة بالذكاء الاصطناعي تناسب نبرة البراند.',
        descEn: 'AI-generated background music that matches your brand tone.',
        comingSoon: true,
        color: 'from-emerald-500 to-teal-600',
    },
    {
        id: 'plan-to-video',
        icon: 'fa-clipboard-list',
        titleAr: 'خطة → فيديو',
        titleEn: 'Plan to Video',
        descAr: 'حوّل بنود خطة التسويق مباشرة إلى سكريبت فيديو.',
        descEn: 'Convert marketing plan items directly into a video script.',
        comingSoon: false,
        color: 'from-indigo-500 to-brand-primary',
    },
];

interface VideoStudioPageProps {
    addNotification: (type: NotificationType, message: string) => void;
    brandId?: string;
    marketingPlans?: MarketingPlan[];
    onNavigate?: (page: string) => void;
}

export const VideoStudioPage: React.FC<VideoStudioPageProps> = ({
    addNotification,
    brandId,
    marketingPlans = [],
    onNavigate,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const [activeTool, setActiveTool] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('');
    const [selectedPlan, setSelectedPlan] = useState<string>('');

    const handleLaunch = (tool: VideoTool) => {
        if (tool.comingSoon) {
            addNotification(NotificationType.Info, ar ? 'هذه الأداة ستكون متاحة قريباً.' : 'This tool will be available soon.');
            return;
        }
        setActiveTool(tool.id);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-brand-secondary">
                    {ar ? 'استوديو AI' : 'AI Studio'}
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-light-text dark:text-dark-text">
                    {ar ? 'استوديو الفيديو' : 'Video Studio'}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-light-text-secondary dark:text-dark-text-secondary">
                    {ar
                        ? 'أدوات الذكاء الاصطناعي لإنشاء وتحرير محتوى الفيديو — مرتبطة مباشرة بخطط التسويق.'
                        : 'AI-powered tools for creating and editing video content — directly linked to your marketing plans.'}
                </p>
            </div>

            {/* Marketing Plan Link Banner */}
            {marketingPlans.length > 0 && (
                <div className="surface-panel rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                            <i className="fas fa-clipboard-list" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-light-text dark:text-dark-text">
                                {ar ? 'ربط بخطة التسويق' : 'Link to Marketing Plan'}
                            </p>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                {ar ? 'اختر خطة لتوليد محتوى الفيديو بناءً عليها' : 'Select a plan to generate video content from it'}
                            </p>
                        </div>
                    </div>
                    <select
                        value={selectedPlan}
                        onChange={e => setSelectedPlan(e.target.value)}
                        className="rounded-xl border border-dark-border bg-dark-bg px-4 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand-primary/30"
                    >
                        <option value="">{ar ? 'بدون خطة' : 'No plan'}</option>
                        {marketingPlans.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Active tool workspace */}
            {activeTool && (
                <div className="surface-panel rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="font-bold text-light-text dark:text-dark-text">
                            {ar
                                ? VIDEO_TOOLS.find(t => t.id === activeTool)?.titleAr
                                : VIDEO_TOOLS.find(t => t.id === activeTool)?.titleEn}
                        </h2>
                        <button onClick={() => setActiveTool(null)} className="text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text">
                            <i className="fas fa-times" />
                        </button>
                    </div>
                    <textarea
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        rows={4}
                        placeholder={ar ? 'اكتب فكرة الفيديو أو الرسالة الرئيسية...' : 'Write your video idea or main message...'}
                        className="w-full rounded-2xl border-0 bg-dark-bg px-5 py-4 text-sm leading-relaxed text-white outline-none ring-2 ring-brand-primary/20 placeholder:text-dark-text-secondary focus:ring-brand-primary/40"
                    />
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => addNotification(NotificationType.Info, ar ? 'جارٍ توليد الفيديو...' : 'Generating video...')}
                            disabled={!prompt.trim()}
                            className="btn rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                        >
                            <i className="fas fa-wand-magic-sparkles me-2" />
                            {ar ? 'توليد الفيديو' : 'Generate Video'}
                        </button>
                        <button
                            onClick={() => setPrompt('')}
                            className="btn rounded-xl bg-dark-bg px-5 py-2.5 text-sm font-semibold text-dark-text-secondary hover:text-white"
                        >
                            {ar ? 'مسح' : 'Clear'}
                        </button>
                    </div>
                    <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-dark-border bg-dark-bg/50 p-12 text-center">
                        <div>
                            <i className="fas fa-video text-3xl text-dark-text-secondary mb-3 block" />
                            <p className="text-sm font-semibold text-dark-text-secondary">
                                {ar ? 'الفيديو سيظهر هنا بعد التوليد' : 'Generated video will appear here'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Tools Grid */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {VIDEO_TOOLS.map(tool => (
                    <button
                        key={tool.id}
                        type="button"
                        onClick={() => handleLaunch(tool)}
                        className={`group surface-panel rounded-2xl p-6 text-start transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-primary)] active:scale-95 ${tool.comingSoon ? 'opacity-60' : ''}`}
                    >
                        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tool.color} text-white text-xl shadow-lg`}>
                            <i className={`fas ${tool.icon}`} />
                        </div>
                        <h3 className="font-bold text-light-text dark:text-dark-text">
                            {ar ? tool.titleAr : tool.titleEn}
                        </h3>
                        <p className="mt-1 text-sm leading-5 text-light-text-secondary dark:text-dark-text-secondary">
                            {ar ? tool.descAr : tool.descEn}
                        </p>
                        <div className="mt-4 flex items-center gap-2">
                            {tool.comingSoon ? (
                                <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-400">
                                    {ar ? 'قريباً' : 'Coming Soon'}
                                </span>
                            ) : (
                                <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-secondary group-hover:bg-brand-primary group-hover:text-white transition-colors">
                                    {ar ? 'ابدأ الآن' : 'Get Started'}
                                </span>
                            )}
                        </div>
                    </button>
                ))}
            </div>

            {/* Link to Marketing Plans CTA */}
            {marketingPlans.length === 0 && onNavigate && (
                <div className="surface-panel rounded-2xl p-6 text-center">
                    <i className="fas fa-clipboard-list mb-3 text-3xl text-brand-secondary block" />
                    <h3 className="font-bold text-light-text dark:text-dark-text">
                        {ar ? 'اربط الفيديو بخطة التسويق' : 'Link Video to Marketing Plan'}
                    </h3>
                    <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary max-w-sm mx-auto">
                        {ar
                            ? 'أنشئ خطة تسويقية أولاً حتى يتمكن الذكاء الاصطناعي من توليد فيديوهات مرتبطة بأهدافك.'
                            : 'Create a marketing plan first so AI can generate videos aligned with your goals.'}
                    </p>
                    <button
                        onClick={() => onNavigate('marketing-plans')}
                        className="mt-4 btn rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white"
                    >
                        <i className="fas fa-plus me-2" />
                        {ar ? 'إنشاء خطة تسويق' : 'Create Marketing Plan'}
                    </button>
                </div>
            )}
        </div>
    );
};
