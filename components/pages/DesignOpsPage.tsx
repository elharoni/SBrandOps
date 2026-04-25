// components/pages/DesignOpsPage.tsx
// UX: Single screen, no wizard — like Meta Ads creative generator
import React, { useState, useRef, useCallback } from 'react';
import {
    DesignAsset, DesignWorkflow, DesignJob, DesignAssetType,
    DesignWorkflowFormat, BrandHubProfile, Brand, NotificationType, DESIGN_FORMAT_MAP,
} from '../../types';
import { uploadFile }          from '../../services/storageService';
import { createDesignAsset, deleteDesignAsset } from '../../services/designAssetsService';
import { createDesignJob, runDesignJob }         from '../../services/designJobsService';
import { AIImageProvider }                        from '../../services/geminiService';
import { buildFinalPrompt }    from '../../services/designWorkflowsService';
import { extractBrandColors }  from '../../services/brandDesignUtils';
import { DesignEditorModal }   from '../DesignEditorModal';

// ── Props ─────────────────────────────────────────────────────────────────────

interface DesignOpsPageProps {
    brandId: string;
    brand?: Brand | null;
    brandProfile: BrandHubProfile | null;
    designAssets: DesignAsset[];
    designWorkflows: DesignWorkflow[];
    recentJobs: DesignJob[];
    addNotification: (type: NotificationType, msg: string) => void;
    onSendToPublisher: (asset: DesignAsset) => void;
    onAssetAdded:   (asset: DesignAsset) => void;
    onJobAdded:     (job: DesignJob)     => void;
    onJobUpdated:   (job: DesignJob)     => void;
    onAssetDeleted: (assetId: string)    => void;
    onRefresh: () => void;
}

// ── Quick-start presets ───────────────────────────────────────────────────────
// كل preset بيملّي الـ form تلقائياً — مش wizard

interface Preset {
    id: string;
    label: string;
    icon: string;
    format: DesignWorkflowFormat;
    tone: string;
    placeholder: string;
    promptHint: string;   // prefix يُضاف للـ prompt
}

const PRESETS: Preset[] = [
    {
        id: 'ig-post',
        label: 'منشور',
        icon: 'fa-instagram',
        format: DESIGN_FORMAT_MAP['instagram-post'],
        tone: 'احترافي',
        placeholder: 'مثال: خصم 30% على كل منتجاتنا...',
        promptHint: 'Create a professional Instagram post visual.',
    },
    {
        id: 'story',
        label: 'ستوري',
        icon: 'fa-mobile-alt',
        format: DESIGN_FORMAT_MAP['instagram-story'],
        tone: 'ملهم',
        placeholder: 'مثال: إطلاق منتج جديد اليوم...',
        promptHint: 'Create a bold vertical story/reel cover.',
    },
    {
        id: 'ad',
        label: 'إعلان',
        icon: 'fa-bullhorn',
        format: DESIGN_FORMAT_MAP['ad-banner-square'],
        tone: 'عاجل',
        placeholder: 'مثال: عرض لفترة محدودة على...',
        promptHint: 'Create a high-converting ad creative with clear CTA.',
    },
    {
        id: 'facebook',
        label: 'فيسبوك',
        icon: 'fa-facebook',
        format: DESIGN_FORMAT_MAP['facebook-post'],
        tone: 'ودود',
        placeholder: 'مثال: مشاركة قصة البراند...',
        promptHint: 'Create a Facebook post visual, warm and engaging.',
    },
    {
        id: 'linkedin',
        label: 'لينكدإن',
        icon: 'fa-linkedin',
        format: DESIGN_FORMAT_MAP['linkedin-post'],
        tone: 'احترافي',
        placeholder: 'مثال: إنجاز جديد للفريق...',
        promptHint: 'Create a professional LinkedIn post, corporate style.',
    },
    {
        id: 'free',
        label: 'حر',
        icon: 'fa-wand-magic-sparkles',
        format: DESIGN_FORMAT_MAP['instagram-post'],
        tone: '',
        placeholder: 'اكتب أي وصف تريده بالعربي...',
        promptHint: '',
    },
];

// ── Platform groups for the format picker ─────────────────────────────────────

interface PlatformGroup {
    id: string;
    nameAr: string;
    icon: string;       // FontAwesome class (fab or fas)
    iconColor: string;  // Tailwind text color
    formats: (keyof typeof DESIGN_FORMAT_MAP)[];
}

const PLATFORM_GROUPS: PlatformGroup[] = [
    { id: 'instagram', nameAr: 'إنستاغرام', icon: 'fab fa-instagram',     iconColor: 'text-pink-500',   formats: ['instagram-post', 'instagram-portrait', 'instagram-story', 'instagram-reel-cover'] },
    { id: 'facebook',  nameAr: 'فيسبوك',    icon: 'fab fa-facebook',      iconColor: 'text-blue-500',   formats: ['facebook-post', 'facebook-story'] },
    { id: 'tiktok',    nameAr: 'تيك توك',   icon: 'fab fa-tiktok',        iconColor: 'text-white',      formats: ['tiktok-cover'] },
    { id: 'x',         nameAr: 'X / تويتر', icon: 'fab fa-x-twitter',     iconColor: 'text-white',      formats: ['twitter-post', 'twitter-portrait'] },
    { id: 'linkedin',  nameAr: 'لينكدإن',   icon: 'fab fa-linkedin',      iconColor: 'text-blue-400',   formats: ['linkedin-post', 'linkedin-banner'] },
    { id: 'youtube',   nameAr: 'يوتيوب',    icon: 'fab fa-youtube',       iconColor: 'text-red-500',    formats: ['youtube-thumbnail'] },
    { id: 'pinterest', nameAr: 'بينتريست',  icon: 'fab fa-pinterest',     iconColor: 'text-red-500',    formats: ['pinterest-pin'] },
    { id: 'snapchat',  nameAr: 'سناب شات',  icon: 'fab fa-snapchat',      iconColor: 'text-yellow-400', formats: ['snapchat-story'] },
    { id: 'whatsapp',  nameAr: 'واتساب',    icon: 'fab fa-whatsapp',      iconColor: 'text-green-500',  formats: ['whatsapp-status'] },
    { id: 'ads',       nameAr: 'إعلانات',   icon: 'fas fa-rectangle-ad',  iconColor: 'text-orange-400', formats: ['ad-banner-square', 'ad-banner-landscape', 'ad-banner-portrait'] },
];

// Preset → platform mapping for auto-selecting the platform tab
const PRESET_PLATFORM_MAP: Record<string, string> = {
    'ig-post':  'instagram',
    'story':    'instagram',
    'ad':       'ads',
    'facebook': 'facebook',
    'linkedin': 'linkedin',
    'free':     'instagram',
};

const TONE_CHIPS = ['احترافي', 'ودود', 'عاجل', 'ملهم', 'تعليمي', 'فاخر', 'مرح'];

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
    'ai-generated': { label: 'AI',   cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
    'upload':       { label: 'رفع',  cls: 'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-300'   },
    'stock':        { label: 'Stock',cls: 'bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-300'  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export const DesignOpsPage: React.FC<DesignOpsPageProps> = ({
    brandId, brand, brandProfile, designAssets, designWorkflows, recentJobs,
    addNotification, onSendToPublisher, onAssetAdded, onJobAdded,
    onJobUpdated, onAssetDeleted, onRefresh,
}) => {
    // ── Generator state ──────────────────────────────────────────────────────
    const [topic,            setTopic]            = useState('');
    const [selectedFormat,   setSelectedFormat]   = useState<DesignWorkflowFormat>(DESIGN_FORMAT_MAP['instagram-post']);
    const [selectedTone,     setSelectedTone]     = useState('احترافي');
    const [activePreset,     setActivePreset]     = useState<string>('ig-post');
    const [selectedPlatform, setSelectedPlatform] = useState<string>('instagram');
    const [variantCount,     setVariantCount]     = useState<1|2|3>(3);
    const [cta,              setCta]              = useState('');
    const [useBrandColors,   setUseBrandColors]   = useState(true);
    const [imageProvider,    setImageProvider]    = useState<AIImageProvider>('openai');
    const [editingAsset,     setEditingAsset]     = useState<DesignAsset | null>(null);

    // ── Generation state ─────────────────────────────────────────────────────
    const [isGenerating, setIsGenerating]     = useState(false);
    const [progressMsg,  setProgressMsg]      = useState('');
    const [results,      setResults]          = useState<DesignAsset[]>([]);
    const [pickedAsset,  setPickedAsset]      = useState<DesignAsset | null>(null);
    const [showResults,  setShowResults]      = useState(false);

    // ── Library state ────────────────────────────────────────────────────────
    const [assetFilter,    setAssetFilter]    = useState<'all' | DesignAssetType>('all');
    const [hoveredAsset,   setHoveredAsset]   = useState<string | null>(null);
    const [uploadingAsset, setUploadingAsset] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const brandName      = brandProfile?.brandName || brand?.name || 'البراند';
    const brandColorList = extractBrandColors(brandProfile?.styleGuidelines);
    const brandColors    = useBrandColors ? brandColorList.join(', ') : '';
    const logoUrl        = brand?.logoUrl || '';

    // ── Apply preset ─────────────────────────────────────────────────────────

    const applyPreset = (p: Preset) => {
        setActivePreset(p.id);
        setSelectedFormat(p.format);
        if (p.tone) setSelectedTone(p.tone);
        const platform = PRESET_PLATFORM_MAP[p.id] ?? 'instagram';
        setSelectedPlatform(platform);
    };

    // ── Generate ─────────────────────────────────────────────────────────────

    const handleGenerate = useCallback(async () => {
        if (!topic.trim()) {
            addNotification(NotificationType.Warning, 'اكتب وصف التصميم أولاً');
            return;
        }

        setIsGenerating(true);
        setShowResults(false);
        setResults([]);
        setPickedAsset(null);

        // Find matching workflow for the active preset (or use first active one)
        const wf = designWorkflows.find(w =>
            w.status === 'active' &&
            (activePreset === 'free' ? w.category === 'custom' : w.category !== 'custom')
        ) || designWorkflows.find(w => w.status === 'active');

        // Build inputs
        const inputs: Record<string, string> = {
            'input-topic':        topic,
            'input-tone':         selectedTone,
            'input-text-overlay': cta,
        };

        try {
            let job: DesignJob;

            if (wf) {
                // Use the workflow's prompt template
                setProgressMsg('جاري تحسين الـ prompt بـ Gemini Flash...');
                job = await createDesignJob(brandId, {
                    workflowId:   wf.id,
                    workflowName: wf.name,
                    inputs,
                    format:       selectedFormat,
                    prompt:       '',
                });
                onJobAdded(job);
                job = await runDesignJob(job, { ...wf, variantsCount: variantCount }, brandProfile, brandId, setProgressMsg, imageProvider, brand);
            } else {
                // Fallback: build a simple prompt inline without a workflow record
                setProgressMsg('جاري التوليد...');
                const presetObj = PRESETS.find(p => p.id === activePreset);
                const basePrompt = `${presetObj?.promptHint || ''} Brand: ${brandName}. Topic: ${topic}. Tone: ${selectedTone}. ${cta ? `CTA: ${cta}.` : ''} ${brandColors ? `Brand colors: ${brandColors}.` : ''} High quality, professional, no placeholder text.`;

                const fakeWorkflow: DesignWorkflow = {
                    id: 'inline', brandId, name: 'توليد سريع', nameEn: 'Quick Generate',
                    category: 'custom', variantsCount: 3, steps: [],
                    promptTemplate: basePrompt,
                    useBrandColors, useBrandVoice: false,
                    formats: [selectedFormat], icon: 'fa-magic',
                    description: '', status: 'active',
                    usageCount: 0, createdAt: new Date().toISOString(),
                };
                job = await createDesignJob(brandId, {
                    workflowId: undefined, workflowName: 'توليد سريع',
                    inputs, format: selectedFormat, prompt: basePrompt,
                });
                onJobAdded(job);
                job = await runDesignJob(job, { ...fakeWorkflow, variantsCount: variantCount }, brandProfile, brandId, setProgressMsg, imageProvider, brand);
            }

            onJobUpdated(job);

            if (job.status === 'done' && job.assets.length > 0) {
                job.assets.forEach(a => onAssetAdded(a));
                setResults(job.assets);
                setPickedAsset(job.assets[0]);
                setShowResults(true);
                addNotification(NotificationType.Success, `تم توليد ${job.assets.length} تصاميم ✨`);
            } else {
                addNotification(NotificationType.Error, job.error || 'فشل التوليد — حاول مرة أخرى');
            }
        } catch (err: any) {
            addNotification(NotificationType.Error, err.message || 'خطأ غير متوقع');
        } finally {
            setIsGenerating(false);
            setProgressMsg('');
        }
    }, [topic, selectedFormat, selectedTone, cta, activePreset, useBrandColors, variantCount,
        brandId, brand, brandProfile, designWorkflows,
        addNotification, onJobAdded, onJobUpdated, onAssetAdded]);

    // ── Upload ────────────────────────────────────────────────────────────────

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploadingAsset(true);
        const results = await Promise.allSettled(
            Array.from(files).map(async file => {
                const res = await uploadFile(file, 'design-assets', brandId);
                if (!res.success || !res.url) throw new Error('upload failed');
                const asset = await createDesignAsset(brandId, {
                    name:     file.name.replace(/\.[^/.]+$/, ''),
                    url:      res.url,
                    type:     file.type.startsWith('video') ? 'video' : 'image',
                    source:   'upload',
                    tags:     [],
                    fileSize: file.size,
                    mimeType: file.type,
                });
                onAssetAdded(asset);
            })
        );
        setUploadingAsset(false);
        const n = results.filter(r => r.status === 'fulfilled').length;
        if (n > 0) addNotification(NotificationType.Success, `تم رفع ${n} ملف`);
    };

    const handleDeleteAsset = async (asset: DesignAsset) => {
        try {
            await deleteDesignAsset(brandId, asset.id);
            onAssetDeleted(asset.id);
        } catch {
            addNotification(NotificationType.Error, 'فشل الحذف');
        }
    };

    const filteredAssets = assetFilter === 'all'
        ? designAssets
        : designAssets.filter(a => a.type === assetFilter);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
        <div className="flex flex-col h-full bg-light-bg dark:bg-dark-bg overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">

                {/* ── Page Title ── */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-purple flex items-center justify-center">
                            <i className="fas fa-palette text-white text-sm"></i>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-light-text dark:text-dark-text">استوديو التصميم</h1>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                {brandName} • {imageProvider === 'openai' ? 'ChatGPT (DALL-E 3)' : imageProvider === 'gemini-native' ? 'Gemini 2.0' : imageProvider === 'google' ? 'Imagen 4.0' : 'AI Engine'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-light-border dark:border-dark-border text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-card dark:hover:bg-dark-card transition"
                    >
                        <i className="fas fa-upload text-[10px]"></i>رفع صورة
                    </button>
                    <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => handleFileUpload(e.target.files)} />
                </div>

                {/* ── Brand Identity Panel ── */}
                {(brandProfile || brand) && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-brand-primary/8 to-brand-purple/8 border border-brand-primary/20">
                        {/* Logo */}
                        {logoUrl ? (
                            <img
                                src={logoUrl}
                                alt="logo"
                                className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1 flex-shrink-0 border border-brand-primary/20"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-brand-primary/20 flex items-center justify-center flex-shrink-0">
                                <i className="fas fa-store text-brand-secondary text-sm" />
                            </div>
                        )}

                        {/* Name + status */}
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-light-text dark:text-dark-text truncate">{brandName}</p>
                            <p className="text-[10px] text-brand-secondary mt-0.5 flex items-center gap-1">
                                <i className="fas fa-circle-check text-[8px]" />
                                هوية البراند مُطبَّقة تلقائياً
                            </p>
                        </div>

                        {/* Color swatches */}
                        {brandColors && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                                {brandColorList.slice(0, 5).map((color, i) => (
                                    color.startsWith('#') ? (
                                        <div
                                            key={i}
                                            title={color}
                                            className="w-5 h-5 rounded-full border-2 border-white/20 shadow-sm flex-shrink-0"
                                            style={{ backgroundColor: color }}
                                        />
                                    ) : null
                                ))}
                            </div>
                        )}

                        {/* Logo overlay badge */}
                        {logoUrl && (
                            <div className="flex-shrink-0 text-[10px] font-bold bg-brand-primary/15 text-brand-secondary px-2 py-1 rounded-lg border border-brand-primary/20 whitespace-nowrap">
                                <i className="fas fa-layer-group me-1 text-[8px]" />
                                لوجو على التصميم
                            </div>
                        )}
                    </div>
                )}

                {/* ── Quick-start Presets ── */}
                <div className="flex gap-2 flex-wrap">
                    {PRESETS.map(p => (
                        <button
                            key={p.id}
                            onClick={() => applyPreset(p)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                                activePreset === p.id
                                    ? 'border-brand-primary bg-brand-primary text-white shadow-sm shadow-brand-primary/30'
                                    : 'border-light-border dark:border-dark-border text-light-text dark:text-dark-text hover:border-brand-primary/50 bg-light-card dark:bg-dark-card'
                            }`}
                        >
                            <i className={`fab ${p.icon} text-xs`}></i>
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* ── Generator Panel ── */}
                <div className="bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border overflow-hidden shadow-sm">

                    {/* Topic Input */}
                    <div className="p-5 pb-0">
                        <textarea
                            value={topic}
                            onChange={e => setTopic(e.target.value)}
                            placeholder={PRESETS.find(p => p.id === activePreset)?.placeholder || 'صف التصميم اللي تريده...'}
                            rows={3}
                            className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl p-4 text-light-text dark:text-dark-text text-sm resize-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition placeholder:text-light-text-secondary dark:placeholder:text-dark-text-secondary"
                            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
                        />
                        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1.5 me-1 text-end">
                            Cmd+Enter للتوليد السريع
                        </p>
                    </div>

                    {/* ── AI Provider Selector ── */}
                    <div className="px-5 py-4 border-y border-light-border dark:border-dark-border bg-light-bg/30 dark:bg-dark-bg/30">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold text-light-text dark:text-dark-text">محرك التصميم (AI Provider)</p>
                            <span className="text-[10px] text-brand-secondary font-medium">اختر الذكاء الاصطناعي المفضل</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => setImageProvider('openai')}
                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                    imageProvider === 'openai'
                                        ? 'border-brand-primary bg-brand-primary/10 shadow-sm shadow-brand-primary/20'
                                        : 'border-light-border dark:border-dark-border hover:border-brand-primary/40 bg-light-card dark:bg-dark-card'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${imageProvider === 'openai' ? 'bg-brand-primary text-white' : 'bg-light-bg dark:bg-dark-bg text-light-text-secondary'}`}>
                                    <i className="fas fa-robot text-xs"></i>
                                </div>
                                <div className="text-center">
                                    <p className={`text-[11px] font-bold ${imageProvider === 'openai' ? 'text-brand-primary' : 'text-light-text dark:text-dark-text'}`}>ChatGPT</p>
                                    <p className="text-[8px] text-light-text-secondary dark:text-dark-text-secondary">DALL-E 3 (Latest)</p>
                                </div>
                                {imageProvider === 'openai' && <i className="fas fa-check-circle text-brand-primary text-[10px] absolute top-2 right-2"></i>}
                            </button>

                            <button
                                onClick={() => setImageProvider('google')}
                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all relative ${
                                    imageProvider === 'google'
                                        ? 'border-brand-primary bg-brand-primary/10 shadow-sm shadow-brand-primary/20'
                                        : 'border-light-border dark:border-dark-border hover:border-brand-primary/40 bg-light-card dark:bg-dark-card'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${imageProvider === 'google' ? 'bg-brand-primary text-white' : 'bg-light-bg dark:bg-dark-bg text-light-text-secondary'}`}>
                                    <i className="fas fa-image text-xs"></i>
                                </div>
                                <div className="text-center">
                                    <p className={`text-[11px] font-bold ${imageProvider === 'google' ? 'text-brand-primary' : 'text-light-text dark:text-dark-text'}`}>Imagen</p>
                                    <p className="text-[8px] text-light-text-secondary dark:text-dark-text-secondary">Google Pro</p>
                                </div>
                                {imageProvider === 'google' && <i className="fas fa-check-circle text-brand-primary text-[10px] absolute top-2 right-2"></i>}
                            </button>

                            <button
                                onClick={() => setImageProvider('gemini-native')}
                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all relative ${
                                    imageProvider === 'gemini-native'
                                        ? 'border-brand-primary bg-brand-primary/10 shadow-sm shadow-brand-primary/20'
                                        : 'border-light-border dark:border-dark-border hover:border-brand-primary/40 bg-light-card dark:bg-dark-card'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${imageProvider === 'gemini-native' ? 'bg-brand-primary text-white' : 'bg-light-bg dark:bg-dark-bg text-light-text-secondary'}`}>
                                    <i className="fas fa-sparkles text-xs"></i>
                                </div>
                                <div className="text-center">
                                    <p className={`text-[11px] font-bold ${imageProvider === 'gemini-native' ? 'text-brand-primary' : 'text-light-text dark:text-dark-text'}`}>Gemini</p>
                                    <p className="text-[8px] text-light-text-secondary dark:text-dark-text-secondary">Google AI</p>
                                </div>
                                {imageProvider === 'gemini-native' && <i className="fas fa-check-circle text-brand-primary text-[10px] absolute top-2 right-2"></i>}
                            </button>
                        </div>
                    </div>

                    {/* ── Platform Format Picker ── */}
                    <div className="p-5 pt-4 space-y-3">
                        {/* Header row */}
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-light-text dark:text-dark-text">المنصة والمقاس</p>
                            <span className="text-[10px] font-semibold text-brand-secondary bg-brand-primary/10 px-2 py-0.5 rounded-lg border border-brand-primary/20">
                                {selectedFormat.width}×{selectedFormat.height}px
                                {selectedFormat.aspectRatio !== '1:1' && ` • ${selectedFormat.aspectRatio}`}
                            </span>
                        </div>

                        {/* Platform tabs */}
                        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                            {PLATFORM_GROUPS.map(pg => {
                                const isActive = selectedPlatform === pg.id;
                                const hasSelected = pg.formats.includes(selectedFormat.format as any);
                                return (
                                    <button
                                        key={pg.id}
                                        onClick={() => setSelectedPlatform(pg.id)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border-2 whitespace-nowrap transition-all flex-shrink-0 ${
                                            isActive
                                                ? 'border-brand-primary bg-brand-primary text-white shadow-sm'
                                                : hasSelected
                                                    ? 'border-brand-primary/40 bg-brand-primary/8 text-brand-secondary'
                                                    : 'border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-brand-primary/30 bg-light-card dark:bg-dark-card'
                                        }`}
                                    >
                                        <i className={`${pg.icon} text-[10px] ${isActive ? 'text-white' : pg.iconColor}`} />
                                        {pg.nameAr}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Format cards for selected platform */}
                        {(() => {
                            const pg = PLATFORM_GROUPS.find(g => g.id === selectedPlatform);
                            if (!pg) return null;
                            return (
                                <div className="flex gap-2 flex-wrap">
                                    {pg.formats.map(fKey => {
                                        const fmt = DESIGN_FORMAT_MAP[fKey];
                                        if (!fmt) return null;
                                        const isSelected = selectedFormat.format === fmt.format;

                                        // Visual ratio box — normalize to max 30×40 area
                                        const maxW = 30, maxH = 38;
                                        const ratio = fmt.width / fmt.height;
                                        let bw: number, bh: number;
                                        if (ratio >= 1) { bw = maxW; bh = Math.max(10, Math.round(maxW / ratio)); }
                                        else            { bh = maxH; bw = Math.max(10, Math.round(maxH * ratio)); }

                                        return (
                                            <button
                                                key={fmt.format}
                                                onClick={() => setSelectedFormat(fmt)}
                                                className={`relative flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border-2 transition-all min-w-[72px] ${
                                                    isSelected
                                                        ? 'border-brand-primary bg-brand-primary/10 shadow-sm shadow-brand-primary/20'
                                                        : 'border-light-border dark:border-dark-border hover:border-brand-primary/40 bg-light-bg dark:bg-dark-bg'
                                                }`}
                                            >
                                                {/* Aspect ratio visual */}
                                                <div className="flex items-center justify-center" style={{ width: `${maxW}px`, height: `${maxH}px` }}>
                                                    <div
                                                        className={`rounded-sm transition-colors ${isSelected ? 'bg-brand-primary' : 'bg-light-text-secondary/30 dark:bg-dark-text-secondary/30'}`}
                                                        style={{ width: `${bw}px`, height: `${bh}px` }}
                                                    />
                                                </div>

                                                {/* Format name */}
                                                <span className={`text-[10px] font-bold text-center leading-tight ${isSelected ? 'text-brand-primary' : 'text-light-text dark:text-dark-text'}`}>
                                                    {fmt.labelAr}
                                                </span>

                                                {/* Dimensions */}
                                                <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary">
                                                    {fmt.width}×{fmt.height}
                                                </span>

                                                {/* Tip */}
                                                {fmt.tipAr && (
                                                    <span className="text-[8px] text-light-text-secondary dark:text-dark-text-secondary/70 text-center leading-tight">
                                                        {fmt.tipAr}
                                                    </span>
                                                )}

                                                {/* Recommended badge */}
                                                {fmt.recommended && (
                                                    <span className="absolute -top-1.5 -end-1 text-[8px] font-bold bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full leading-none">
                                                        ✦
                                                    </span>
                                                )}

                                                {/* Selected checkmark */}
                                                {isSelected && (
                                                    <span className="absolute top-1.5 start-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-primary">
                                                        <i className="fas fa-check text-white" style={{ fontSize: '6px' }} />
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>

                    {/* ── Tone Row ── */}
                    <div className="px-5 pb-4">
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-light-text dark:text-dark-text">الأسلوب</p>
                            <div className="flex flex-wrap gap-1.5">
                                {TONE_CHIPS.map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setSelectedTone(t)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                            selectedTone === t
                                                ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                                                : 'border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-brand-primary/40'
                                        }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* CTA + Brand Colors Row */}
                    <div className="px-5 pb-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                        <div className="flex-1">
                            <input
                                type="text"
                                value={cta}
                                onChange={e => setCta(e.target.value)}
                                placeholder="نص فوق الصورة — CTA (اختياري)"
                                className="w-full px-3 py-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-xs text-light-text dark:text-dark-text focus:ring-2 focus:ring-brand-primary focus:border-transparent transition"
                            />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0">
                            <input type="checkbox" className="sr-only" checked={useBrandColors} onChange={() => setUseBrandColors(v => !v)} />
                            <div className={`w-10 h-5 rounded-full transition-colors relative ${useBrandColors ? 'bg-brand-primary' : 'bg-light-border dark:bg-dark-border'}`}>
                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${useBrandColors ? 'start-5' : 'start-0.5'}`} />
                            </div>
                            <span className="text-xs font-bold text-light-text dark:text-dark-text">ألوان البراند</span>
                        </label>
                    </div>


                    {/* Variant Count + Generate Row */}
                    <div className="px-5 pb-5 space-y-3">
                        {/* Variant count selector */}
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-light-text dark:text-dark-text flex-shrink-0">عدد التصاميم:</span>
                            <div className="flex gap-1.5">
                                {([1, 2, 3] as const).map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setVariantCount(n)}
                                        className={`w-9 h-9 rounded-xl text-sm font-bold border-2 transition-all ${
                                            variantCount === n
                                                ? 'border-brand-primary bg-brand-primary text-white shadow-sm'
                                                : 'border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-brand-primary/50'
                                        }`}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                            <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary ms-auto">
                                {variantCount === 1 ? 'تصميم واحد مركّز' : variantCount === 2 ? 'مقارنة بين خيارين' : 'ثلاثة خيارات متنوعة'}
                            </span>
                        </div>

                        {/* Generate button */}
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !topic.trim()}
                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-primary to-brand-purple text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-brand-primary/20"
                        >
                            {isGenerating ? (
                                <>
                                    <i className="fas fa-spinner fa-spin"></i>
                                    <span>{progressMsg || 'جاري التوليد...'}</span>
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-wand-magic-sparkles"></i>
                                    <span>توليد {variantCount} تصميم{variantCount > 1 ? 'ات' : ''}</span>
                                    <span className="opacity-70 font-normal">• {imageProvider === 'openai' ? 'بواسطة ChatGPT' : imageProvider === 'google' ? 'بواسطة Imagen' : 'بواسطة Gemini'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* ── Results (inline, no modal) ── */}
                {showResults && results.length > 0 && (
                    <div className="bg-light-card dark:bg-dark-card rounded-2xl border border-brand-primary/30 overflow-hidden shadow-sm">
                        <div className="px-5 py-4 border-b border-light-border dark:border-dark-border flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-light-text dark:text-dark-text">
                                    <i className="fas fa-check-circle text-green-500 me-2"></i>
                                    تم التوليد — اختر التصميم المناسب
                                </p>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                    {selectedFormat.labelAr} • {selectedFormat.width}×{selectedFormat.height}px
                                </p>
                            </div>
                            <button
                                onClick={() => setShowResults(false)}
                                className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text text-lg w-7 h-7 flex items-center justify-center"
                            >×</button>
                        </div>

                        {/* Variants */}
                        <div className={`p-5 grid gap-4 ${results.length === 1 ? 'grid-cols-1 max-w-xs' : results.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                            {results.map((asset, idx) => (
                                <button
                                    key={asset.id}
                                    onClick={() => setPickedAsset(asset)}
                                    className={`relative rounded-xl overflow-hidden border-3 transition-all group ${
                                        pickedAsset?.id === asset.id
                                            ? 'ring-2 ring-brand-primary ring-offset-2 ring-offset-light-card dark:ring-offset-dark-card'
                                            : 'hover:ring-1 hover:ring-brand-primary/50'
                                    }`}
                                >
                                    <img src={asset.url} alt={`Variant ${idx + 1}`} className="w-full aspect-square object-cover" />
                                    {pickedAsset?.id === asset.id && (
                                        <div className="absolute top-2 end-2 w-6 h-6 rounded-full bg-brand-primary flex items-center justify-center">
                                            <i className="fas fa-check text-white text-[10px]"></i>
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2 flex items-center justify-between">
                                        <span className="text-white text-[10px] font-bold">Variant {idx + 1}</span>
                                        <button
                                            onClick={e => { e.stopPropagation(); setEditingAsset(asset); }}
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 text-white text-[9px] font-bold backdrop-blur-sm hover:bg-black/80 transition"
                                        >
                                            <i className="fas fa-crop-simple text-[8px]" />
                                            تحرير
                                        </button>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Action buttons */}
                        {pickedAsset && (
                            <div className="px-5 pb-5 flex gap-3">
                                <button
                                    onClick={() => { onSendToPublisher(pickedAsset); setShowResults(false); }}
                                    className="flex-1 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-bold hover:opacity-90 transition flex items-center justify-center gap-2"
                                >
                                    <i className="fas fa-paper-plane"></i>إرسال للـ Publisher
                                </button>
                                <button
                                    onClick={() => {
                                        addNotification(NotificationType.Success, 'تم الحفظ في مكتبة الأصول');
                                        setShowResults(false);
                                    }}
                                    className="px-5 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-sm font-bold text-light-text dark:text-dark-text hover:bg-light-bg dark:hover:bg-dark-bg transition flex items-center gap-2"
                                >
                                    <i className="fas fa-save"></i>حفظ
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    className="px-4 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition"
                                    title="إعادة التوليد"
                                >
                                    <i className="fas fa-redo"></i>
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Asset Library ── */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-light-text dark:text-dark-text">
                            مكتبة الأصول
                            <span className="ms-2 text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary">
                                ({filteredAssets.length})
                            </span>
                        </p>
                        {/* Type filter */}
                        <div className="flex gap-1.5">
                            {(['all', 'image', 'logo', 'video'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setAssetFilter(f as any)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                                        assetFilter === f
                                            ? 'bg-brand-primary text-white'
                                            : 'bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-brand-primary/40'
                                    }`}
                                >
                                    {{ all: 'الكل', image: 'صور', logo: 'لوغو', video: 'فيديو' }[f]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filteredAssets.length === 0 ? (
                        /* Empty / Upload Drop Zone */
                        <div
                            className="border-2 border-dashed border-light-border dark:border-dark-border rounded-2xl py-14 flex flex-col items-center gap-3 cursor-pointer hover:border-brand-primary/40 transition"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="w-12 h-12 rounded-2xl bg-light-bg dark:bg-dark-bg flex items-center justify-center">
                                <i className="fas fa-images text-light-text-secondary dark:text-dark-text-secondary text-xl"></i>
                            </div>
                            <p className="text-sm font-bold text-light-text dark:text-dark-text">المكتبة فارغة</p>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">ولّد تصميم أو ارفع صورة</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                            {filteredAssets.map(asset => (
                                <div
                                    key={asset.id}
                                    className="group relative rounded-xl overflow-hidden border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card hover:border-brand-primary/50 transition-all"
                                    onMouseEnter={() => setHoveredAsset(asset.id)}
                                    onMouseLeave={() => setHoveredAsset(null)}
                                >
                                    <div className="aspect-square bg-light-bg dark:bg-dark-bg overflow-hidden">
                                        <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" loading="lazy" />
                                    </div>

                                    {/* Hover overlay */}
                                    <div className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1.5 p-2 transition-opacity ${hoveredAsset === asset.id ? 'opacity-100' : 'opacity-0'}`}>
                                        <button
                                            onClick={() => onSendToPublisher(asset)}
                                            className="w-full py-1.5 rounded-lg bg-brand-primary text-white text-[11px] font-bold hover:opacity-90 transition"
                                        >
                                            <i className="fas fa-paper-plane me-1"></i>Publisher
                                        </button>
                                        <button
                                            onClick={() => handleDeleteAsset(asset)}
                                            className="w-full py-1.5 rounded-lg bg-white/20 text-white text-[11px] font-bold hover:bg-red-500/80 transition"
                                        >
                                            <i className="fas fa-trash me-1"></i>حذف
                                        </button>
                                    </div>

                                    {/* Source badge */}
                                    <div className="absolute top-1.5 start-1.5">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${SOURCE_BADGE[asset.source]?.cls || ''}`}>
                                            {SOURCE_BADGE[asset.source]?.label || asset.source}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {/* Upload tile */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingAsset}
                                className="aspect-square rounded-xl border-2 border-dashed border-light-border dark:border-dark-border flex flex-col items-center justify-center gap-1 hover:border-brand-primary/50 transition text-light-text-secondary dark:text-dark-text-secondary"
                            >
                                {uploadingAsset
                                    ? <i className="fas fa-spinner fa-spin text-brand-primary"></i>
                                    : <i className="fas fa-plus text-sm"></i>
                                }
                                <span className="text-[10px] font-bold">{uploadingAsset ? 'جاري...' : 'رفع'}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Recent Jobs (minimal) ── */}
                {recentJobs.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">آخر التوليدات</p>
                        <div className="space-y-2">
                            {recentJobs.slice(0, 5).map(job => (
                                <div key={job.id} className="bg-light-card dark:bg-dark-card rounded-xl border border-light-border dark:border-dark-border px-4 py-3 flex items-center gap-4">
                                    {/* Thumbnails */}
                                    {job.assets.length > 0 && (
                                        <div className="flex gap-1 flex-shrink-0">
                                            {job.assets.slice(0, 3).map(a => (
                                                <img key={a.id} src={a.url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-light-text dark:text-dark-text truncate">
                                            {job.inputs['input-topic'] || job.workflowName || 'توليد'}
                                        </p>
                                        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                                            {job.format.labelAr} • {new Date(job.createdAt).toLocaleDateString('ar-SA')}
                                        </p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${
                                        job.status === 'done'  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                        job.status === 'error' ? 'bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-300'   :
                                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                    }`}>
                                        {job.status === 'done' ? 'مكتمل' : job.status === 'error' ? 'خطأ' : 'جاري'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>

        {editingAsset && (
            <DesignEditorModal
                imageUrl={editingAsset.url}
                sourceFormat={selectedFormat}
                brand={brand}
                brandId={brandId}
                onClose={() => setEditingAsset(null)}
                onSaveToLibrary={asset => { onAssetAdded(asset); setEditingAsset(null); }}
                onSendToPublisher={url => {
                    onSendToPublisher({ ...editingAsset, url });
                    setEditingAsset(null);
                }}
                addNotification={addNotification}
            />
        )}
        </>
    );
};
