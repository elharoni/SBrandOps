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
import { AIImageProvider, enhanceImagePrompt }    from '../../services/geminiService';

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

const SOURCE_BADGE: Record<string, { label: string; style: React.CSSProperties }> = {
    'ai-generated': { label: 'AI',   style: { background: 'rgba(139,92,246,0.7)', color: 'white', backdropFilter: 'blur(4px)' } },
    'upload':       { label: 'رفع',  style: { background: 'rgba(59,130,246,0.7)', color: 'white', backdropFilter: 'blur(4px)' } },
    'stock':        { label: 'Stock',style: { background: 'rgba(34,197,94,0.7)',  color: 'white', backdropFilter: 'blur(4px)' } },
};

// ── Component ─────────────────────────────────────────────────────────────────

export const DesignOpsPage: React.FC<DesignOpsPageProps> = ({
    brandId, brand, brandProfile, designAssets, designWorkflows, recentJobs,
    addNotification, onSendToPublisher, onAssetAdded, onJobAdded,
    onJobUpdated, onAssetDeleted, onRefresh: _onRefresh,
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

    // ── Prompt enhancement state ─────────────────────────────────────────────
    const [enhancedPrompt, setEnhancedPrompt] = useState('');
    const [isEnhancing,    setIsEnhancing]    = useState(false);
    const [showEnhanced,   setShowEnhanced]   = useState(false);
    const [previewAsset,   setPreviewAsset]   = useState<DesignAsset | null>(null);

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
        setEnhancedPrompt('');
        setShowEnhanced(false);
    };

    // ── Generate ─────────────────────────────────────────────────────────────

    // ── Enhance prompt ───────────────────────────────────────────────────────

    const handleEnhancePrompt = useCallback(async () => {
        if (!topic.trim()) return;
        setIsEnhancing(true);
        try {
            const pg = PLATFORM_GROUPS.find(g => g.id === selectedPlatform);
            const enhanced = await enhanceImagePrompt(
                topic,
                brandName,
                pg?.nameAr || selectedPlatform,
                selectedTone,
                selectedFormat.labelAr || selectedFormat.format,
                brandColors || undefined,
            );
            setEnhancedPrompt(enhanced);
            setShowEnhanced(true);
        } catch {
            // silent — will use original topic
        } finally {
            setIsEnhancing(false);
        }
    }, [topic, brandName, selectedPlatform, selectedTone, selectedFormat, brandColors]);

    const handleGenerate = useCallback(async () => {
        if (!topic.trim()) {
            addNotification(NotificationType.Warning, 'اكتب وصف التصميم أولاً');
            return;
        }

        setIsGenerating(true);
        setShowResults(false);
        setResults([]);
        setPickedAsset(null);

        // Enhance prompt first if not already done
        let finalTopic: string;
        if (!enhancedPrompt) {
            try {
                setProgressMsg('جاري تحويل النص لبرومت احترافي...');
                const pg = PLATFORM_GROUPS.find(g => g.id === selectedPlatform);
                finalTopic = await enhanceImagePrompt(
                    topic, brandName,
                    pg?.nameAr || selectedPlatform,
                    selectedTone,
                    selectedFormat.labelAr || selectedFormat.format,
                    brandColors || undefined,
                );
                setEnhancedPrompt(finalTopic);
                setShowEnhanced(true);
            } catch {
                finalTopic = topic;
            }
        } else {
            finalTopic = enhancedPrompt;
        }

        // Find matching workflow for the active preset (or use first active one)
        const wf = designWorkflows.find(w =>
            w.status === 'active' &&
            (activePreset === 'free' ? w.category === 'custom' : w.category !== 'custom')
        ) || designWorkflows.find(w => w.status === 'active');

        // Build inputs
        const inputs: Record<string, string> = {
            'input-topic':        finalTopic,
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
                const basePrompt = `${presetObj?.promptHint || ''} ${finalTopic}. ${cta ? `CTA text visible in image: ${cta}.` : ''} High quality, professional commercial photography, no placeholder text.`;

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
    }, [topic, enhancedPrompt, selectedFormat, selectedTone, cta, activePreset, useBrandColors, variantCount,
        brandName, brandColors, selectedPlatform, brandId, brand, brandProfile, designWorkflows,
        addNotification, onJobAdded, onJobUpdated, onAssetAdded, imageProvider]);

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

    // ── Brand-primary color helpers (use CSS var, not hardcoded purple) ────────
    const BP   = 'var(--color-brand-primary)';
    const bpa  = (a: number) => `color-mix(in srgb, var(--color-brand-primary) ${Math.round(a * 100)}%, transparent)`;
    const bpl  = (w: number) => `color-mix(in srgb, var(--color-brand-primary) ${Math.round((1 - w) * 100)}%, white)`;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
        <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#080c14' }}>
            <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 space-y-5">

                {/* ── Hero ── */}
                <div className="relative rounded-2xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0a0f1e] to-slate-900" />
                    <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 80% 0%, ${bpa(0.28)} 0%, transparent 60%)` }} />
                    <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 20% 100%, ${bpa(0.15)} 0%, transparent 50%)` }} />
                    <div className="absolute top-0 inset-x-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${bpa(0.7)}, transparent)` }} />
                    <div className="relative px-5 py-4 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2.5 mb-1">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: bpa(0.2), border: `1px solid ${bpa(0.35)}` }}>
                                    <i className="fas fa-palette text-sm" style={{ color: bpl(0.35) }} />
                                </div>
                                <h1 className="text-base font-black text-white tracking-tight">استوديو التصميم</h1>
                            </div>
                            <p className="text-[11px] ps-[2.6rem]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                                {brandName} · {imageProvider === 'openai' ? 'GPT Image 1' : imageProvider === 'gemini-native' ? 'Gemini 2.0 Flash' : 'Imagen 4 Pro'}
                            </p>
                        </div>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition"
                            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.14)'; (e.currentTarget as HTMLElement).style.color = 'white'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
                        >
                            <i className="fas fa-upload text-[10px]"></i>رفع
                        </button>
                    </div>
                </div>
                <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => handleFileUpload(e.target.files)} />

                {/* ── Quick-start Presets ── */}
                <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                    {PRESETS.map(p => {
                        const isActive = activePreset === p.id;
                        return (
                            <button
                                key={p.id}
                                onClick={() => { applyPreset(p); setEnhancedPrompt(''); setShowEnhanced(false); }}
                                style={isActive
                                    ? { background: 'var(--color-brand-primary)', border: '2px solid var(--color-brand-primary)', color: 'white', boxShadow: bpa(0.35) }
                                    : { background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }
                                }
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 hover:scale-[1.02]"
                            >
                                <i className={`${p.icon.startsWith('fa-instagram') || p.icon.startsWith('fa-facebook') || p.icon.startsWith('fa-linkedin') ? 'fab' : 'fas'} ${p.icon} text-[11px]`}></i>
                                {p.label}
                            </button>
                        );
                    })}
                </div>

                {/* ── Generator Card ── */}
                <div className="rounded-3xl overflow-hidden shadow-2xl" style={{ background: 'rgba(15,15,25,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}>

                    {/* Brand identity */}
                    {(brandProfile || brand) && (
                        <div className="px-5 pt-5">
                            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: bpa(0.1), border: `1px solid ${bpa(0.25)}` }}>
                                {logoUrl ? (
                                    <img src={logoUrl} alt="logo" className="w-6 h-6 rounded-lg object-contain flex-shrink-0" />
                                ) : (
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bpa(0.2) }}>
                                        <i className="fas fa-store text-[10px]" style={{ color: bpl(0.35) }} />
                                    </div>
                                )}
                                <p className="text-[11px] font-bold text-white truncate flex-1">{brandName}</p>
                                <span className="text-[9px] flex items-center gap-1 flex-shrink-0" style={{ color: bpl(0.35) }}>
                                    <i className="fas fa-circle-check text-[8px]" />هوية مُطبَّقة
                                </span>
                                {brandColors && brandColorList.filter(c => c.startsWith('#')).slice(0, 4).map((color, i) => (
                                    <div key={i} className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: color, border: '1px solid rgba(255,255,255,0.2)' }} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Prompt */}
                    <div className="p-5 pb-4 space-y-3">
                        <textarea
                            value={topic}
                            onChange={e => { setTopic(e.target.value); setEnhancedPrompt(''); setShowEnhanced(false); }}
                            placeholder={PRESETS.find(p => p.id === activePreset)?.placeholder || 'صف التصميم اللي تريده...'}
                            rows={3}
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)' }}
                            className="w-full rounded-2xl p-4 text-sm resize-none outline-none transition-all leading-relaxed placeholder:text-white/20"
                            onFocus={e => { e.currentTarget.style.border = `1px solid ${bpa(0.55)}`; e.currentTarget.style.boxShadow = `0 0 0 3px ${bpa(0.12)}`; }}
                            onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
                            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
                        />

                        {/* Enhance button + shortcut */}
                        <div className="flex items-center justify-between">
                            <button
                                onClick={handleEnhancePrompt}
                                disabled={isEnhancing || !topic.trim()}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-30"
                                style={{ background: bpa(0.15), border: `1px solid ${bpa(0.3)}`, color: bpl(0.35) }}
                            >
                                {isEnhancing
                                    ? <><i className="fas fa-spinner fa-spin text-[10px]" />جاري التحسين...</>
                                    : <><i className="fas fa-wand-magic-sparkles text-[10px]" />✨ حوّل لبرومت احترافي</>
                                }
                            </button>
                            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>Cmd+Enter للتوليد</p>
                        </div>

                        {/* Enhanced prompt preview */}
                        {showEnhanced && enhancedPrompt && (
                            <div className="rounded-xl p-3 space-y-2" style={{ background: bpa(0.08), border: `1px solid ${bpa(0.28)}` }}>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: bpl(0.35) }}>
                                        <i className="fas fa-sparkles text-[9px]" />البرومت المحسّن
                                    </span>
                                    <div className="flex gap-1.5">
                                        <button onClick={() => { setEnhancedPrompt(''); setShowEnhanced(false); }}
                                            className="text-[9px] px-2 py-0.5 rounded-lg transition-all"
                                            style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.06)' }}>
                                            ✕ حذف
                                        </button>
                                        <button onClick={handleEnhancePrompt}
                                            className="text-[9px] px-2 py-0.5 rounded-lg transition-all"
                                            style={{ color: bpl(0.35), background: bpa(0.15) }}>
                                            ↻ إعادة
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)', fontFamily: 'monospace', direction: 'ltr', textAlign: 'left' }}>{enhancedPrompt}</p>
                            </div>
                        )}
                    </div>

                    {/* ── Model Selector ── */}
                    <div className="px-5 pb-5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-[10px] font-black uppercase tracking-widest pt-5 mb-3" style={{ color: bpa(0.6) }}>اختر نموذج التوليد</p>
                        <div className="grid grid-cols-3 gap-2.5">
                            {([
                                { id: 'openai'        as AIImageProvider, name: 'GPT Image', version: 'gpt-image-1', tagAr: 'الأفضل', icon: 'fas fa-robot' },
                                { id: 'gemini-native' as AIImageProvider, name: 'Gemini',    version: '2.0 Flash',   tagAr: 'عربي',   icon: 'fas fa-gem'   },
                                { id: 'google'        as AIImageProvider, name: 'Imagen 4',  version: 'Pro',         tagAr: 'PRO',    icon: 'fas fa-image' },
                            ]).map(m => {
                                const isActive = imageProvider === m.id;
                                return (
                                    <button key={m.id} onClick={() => setImageProvider(m.id)}
                                        style={{
                                            background: isActive ? bpa(0.18) : 'rgba(255,255,255,0.03)',
                                            border: `2px solid ${isActive ? bpa(0.55) : 'rgba(255,255,255,0.08)'}`,
                                            boxShadow: isActive ? `0 4px 20px ${bpa(0.25)}` : 'none',
                                        }}
                                        className="relative flex flex-col gap-2.5 p-3.5 rounded-2xl transition-all text-start hover:scale-[1.02]"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: isActive ? bpa(0.2) : 'rgba(255,255,255,0.06)' }}>
                                                <i className={`${m.icon} text-sm`} style={{ color: isActive ? bpl(0.3) : 'rgba(255,255,255,0.3)' }} />
                                            </div>
                                            {isActive ? (
                                                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: BP }}>
                                                    <i className="fas fa-check text-white" style={{ fontSize: '7px' }} />
                                                </div>
                                            ) : (
                                                <div className="w-5 h-5 rounded-full" style={{ border: '2px solid rgba(255,255,255,0.15)' }} />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-[12px] font-black leading-none mb-1" style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.6)' }}>{m.name}</p>
                                            <p className="text-[9px] leading-none" style={{ color: isActive ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)' }}>{m.version}</p>
                                        </div>
                                        <span className="self-start text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: bpa(0.15), color: bpl(0.35), border: `1px solid ${bpa(0.3)}` }}>{m.tagAr}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Platform & Format ── */}
                    <div className="px-5 pb-5 pt-4 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: bpa(0.6) }}>المنصة والمقاس</p>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg" style={{ color: bpl(0.35), background: bpa(0.15), border: `1px solid ${bpa(0.3)}` }}>
                                {selectedFormat.width}×{selectedFormat.height}{selectedFormat.aspectRatio !== '1:1' && ` · ${selectedFormat.aspectRatio}`}
                            </span>
                        </div>
                        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                            {PLATFORM_GROUPS.map(pg => {
                                const isActive = selectedPlatform === pg.id;
                                const hasSelected = pg.formats.includes(selectedFormat.format as any);
                                return (
                                    <button key={pg.id} onClick={() => setSelectedPlatform(pg.id)}
                                        style={isActive
                                            ? { background: BP, border: `2px solid ${BP}`, color: 'white' }
                                            : hasSelected
                                                ? { background: bpa(0.12), border: `2px solid ${bpa(0.4)}`, color: bpl(0.35) }
                                                : { background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }
                                        }
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all flex-shrink-0 hover:scale-[1.02]"
                                    >
                                        <i className={`${pg.icon} text-[10px]`} />
                                        {pg.nameAr}
                                    </button>
                                );
                            })}
                        </div>
                        {(() => {
                            const pg = PLATFORM_GROUPS.find(g => g.id === selectedPlatform);
                            if (!pg) return null;
                            return (
                                <div className="flex gap-2 flex-wrap">
                                    {pg.formats.map(fKey => {
                                        const fmt = DESIGN_FORMAT_MAP[fKey];
                                        if (!fmt) return null;
                                        const isSelected = selectedFormat.format === fmt.format;
                                        const maxW = 28, maxH = 36;
                                        const ratio = fmt.width / fmt.height;
                                        let bw: number, bh: number;
                                        if (ratio >= 1) { bw = maxW; bh = Math.max(10, Math.round(maxW / ratio)); }
                                        else            { bh = maxH; bw = Math.max(10, Math.round(maxH * ratio)); }
                                        return (
                                            <button key={fmt.format} onClick={() => setSelectedFormat(fmt)}
                                                style={isSelected
                                                    ? { border: `2px solid ${bpa(0.7)}`, background: bpa(0.15), boxShadow: `0 2px 12px ${bpa(0.22)}` }
                                                    : { border: '2px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }
                                                }
                                                className="relative flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl transition-all min-w-[66px] hover:scale-[1.02]"
                                            >
                                                <div className="flex items-center justify-center" style={{ width: `${maxW}px`, height: `${maxH}px` }}>
                                                    <div className="rounded-sm transition-colors" style={{ width: `${bw}px`, height: `${bh}px`, background: isSelected ? bpl(0.3) : 'rgba(255,255,255,0.18)' }} />
                                                </div>
                                                <span className="text-[10px] font-bold text-center leading-tight" style={{ color: isSelected ? bpl(0.35) : 'rgba(255,255,255,0.6)' }}>{fmt.labelAr}</span>
                                                <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{fmt.width}×{fmt.height}</span>
                                                {fmt.recommended && <span className="absolute -top-1.5 -end-1 text-[8px] font-bold bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full">✦</span>}
                                                {isSelected && (
                                                    <span className="absolute top-1.5 start-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full" style={{ background: BP }}>
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

                    {/* ── Tone ── */}
                    <div className="px-5 pb-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-2.5" style={{ color: bpa(0.6) }}>الأسلوب</p>
                        <div className="flex flex-wrap gap-1.5">
                            {TONE_CHIPS.map(t => (
                                <button key={t} onClick={() => setSelectedTone(t)}
                                    style={selectedTone === t
                                        ? { border: `1px solid ${bpa(0.6)}`, background: bpa(0.15), color: bpl(0.35) }
                                        : { border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)' }
                                    }
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                                >{t}</button>
                            ))}
                        </div>
                    </div>

                    {/* ── CTA + Colors + Count + Generate ── */}
                    <div className="px-5 pb-6 pt-4 space-y-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex gap-3 items-center">
                            <input type="text" value={cta} onChange={e => setCta(e.target.value)} placeholder="نص CTA فوق الصورة (اختياري)"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}
                                className="flex-1 px-3 py-2 rounded-xl text-xs outline-none transition-all placeholder:text-white/20"
                            />
                            <label className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0">
                                <input type="checkbox" className="sr-only" checked={useBrandColors} onChange={() => setUseBrandColors(v => !v)} />
                                <div className="w-10 h-5 rounded-full transition-colors relative" style={{ background: useBrandColors ? 'var(--color-brand-primary)' : 'rgba(255,255,255,0.12)' }}>
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${useBrandColors ? 'start-5' : 'start-0.5'}`} />
                                </div>
                                <span className="text-xs font-bold" style={{ color: useBrandColors ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)' }}>ألوان البراند</span>
                            </label>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] font-bold flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>عدد التصاميم</span>
                            <div className="flex gap-1.5">
                                {([1, 2, 3] as const).map(n => (
                                    <button key={n} onClick={() => setVariantCount(n)}
                                        style={variantCount === n
                                            ? { background: 'var(--color-brand-primary)', border: '2px solid var(--color-brand-primary)', color: 'white', boxShadow: `0 2px 10px ${bpa(0.4)}` }
                                            : { background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }
                                        }
                                        className="w-9 h-9 rounded-xl text-sm font-bold transition-all hover:scale-[1.05]"
                                    >{n}</button>
                                ))}
                            </div>
                            <span className="text-[10px] ms-auto" style={{ color: 'rgba(255,255,255,0.2)' }}>
                                {variantCount === 1 ? 'تصميم واحد مركّز' : variantCount === 2 ? 'خيارين للمقارنة' : 'ثلاثة متنوعة'}
                            </span>
                        </div>
                        {/* ✨ Generate */}
                        <button onClick={handleGenerate} disabled={isGenerating || !topic.trim()}
                            className="w-full py-4 rounded-2xl text-white font-black text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 relative overflow-hidden group transition-all"
                            style={{ background: `linear-gradient(135deg, ${BP} 0%, ${bpl(0.2)} 50%, ${BP} 100%)`, backgroundSize: '200% 100%', boxShadow: isGenerating ? 'none' : `0 4px 28px ${bpa(0.45)}` }}
                        >
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0) 100%)' }} />
                            {isGenerating ? (
                                <><i className="fas fa-spinner fa-spin text-base"></i><span>{progressMsg || 'جاري التوليد...'}</span></>
                            ) : (
                                <>
                                    <i className="fas fa-wand-magic-sparkles text-base"></i>
                                    <span>توليد {variantCount} تصميم{variantCount > 1 ? 'ات' : ''}</span>
                                    <span className="text-xs font-normal opacity-50">· {imageProvider === 'openai' ? 'GPT Image' : imageProvider === 'google' ? 'Imagen 4' : 'Gemini 2.0'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* ── Results ── */}
                {showResults && results.length > 0 && (
                    <div className="rounded-3xl overflow-hidden shadow-2xl" style={{ background: 'rgba(15,15,25,0.97)', border: `1px solid ${bpa(0.3)}` }}>
                        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.25)' }}>
                                    <i className="fas fa-check text-xs" style={{ color: 'rgb(74,222,128)' }} />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-white">تم التوليد بنجاح ✨</p>
                                    <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{selectedFormat.labelAr} · {selectedFormat.width}×{selectedFormat.height}px</p>
                                </div>
                            </div>
                            <button onClick={() => setShowResults(false)} className="w-7 h-7 rounded-xl flex items-center justify-center text-sm font-bold transition-all" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>×</button>
                        </div>
                        {/* Model + format info strip */}
                        <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
                            {(() => {
                                const modelName = imageProvider === 'openai' ? 'GPT Image 1' : imageProvider === 'gemini-native' ? 'Gemini 2.0 Flash' : 'Imagen 4 Pro';
                                const modelIcon = imageProvider === 'openai' ? 'fas fa-robot' : imageProvider === 'gemini-native' ? 'fas fa-gem' : 'fas fa-image';
                                return (
                                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: bpa(0.15), border: `1px solid ${bpa(0.3)}`, color: bpl(0.35) }}>
                                        <i className={`${modelIcon} text-[9px]`} />{modelName}
                                    </span>
                                );
                            })()}
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                                <i className="fas fa-expand-arrows-alt text-[9px]" />{selectedFormat.width}×{selectedFormat.height}
                            </span>
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                                <i className="fas fa-layer-group text-[9px]" />{results.length} نسخة
                            </span>
                        </div>

                        <div className={`px-5 pb-5 grid gap-3 ${results.length === 1 ? 'grid-cols-1' : results.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                            {results.map((asset, idx) => (
                                <div key={asset.id} className="relative rounded-2xl overflow-hidden transition-all group cursor-pointer"
                                    style={pickedAsset?.id === asset.id
                                        ? { boxShadow: `0 0 0 2px ${BP}, 0 0 0 4px ${bpa(0.2)}` }
                                        : { boxShadow: '0 0 0 1px rgba(255,255,255,0.08)' }
                                    }
                                    onClick={() => setPickedAsset(asset)}
                                >
                                    <img src={asset.url} alt={`Variant ${idx + 1}`} className="w-full aspect-square object-cover" />

                                    {/* Selection badge */}
                                    {pickedAsset?.id === asset.id && (
                                        <div className="absolute top-2 end-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg" style={{ background: BP }}>
                                            <i className="fas fa-check text-white text-[10px]"></i>
                                        </div>
                                    )}

                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)' }}>
                                        {/* Top info */}
                                        <div className="absolute top-2 start-2">
                                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{
                                                background: bpa(0.85),
                                                color: 'white',
                                                backdropFilter: 'blur(8px)',
                                            }}>
                                                {imageProvider === 'openai' ? 'GPT' : imageProvider === 'gemini-native' ? 'Gemini' : 'Imagen'}
                                            </span>
                                        </div>
                                        {/* Bottom actions */}
                                        <div className="absolute bottom-0 inset-x-0 p-2.5 flex items-end justify-between">
                                            <span className="text-white/60 text-[10px] font-black">{selectedFormat.width}×{selectedFormat.height}</span>
                                            <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => setPreviewAsset(asset)}
                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-white text-[10px] font-bold"
                                                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
                                                ><i className="fas fa-expand text-[9px]" />معاينة</button>
                                                <button
                                                    onClick={() => setEditingAsset(asset)}
                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-white text-[10px] font-bold"
                                                    style={{ background: bpa(0.75), backdropFilter: 'blur(8px)' }}
                                                ><i className="fas fa-crop-simple text-[9px]" />تحرير</button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Variant number badge (always visible) */}
                                    {results.length > 1 && (
                                        <div className="absolute top-2 start-2 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black group-hover:opacity-0 transition-opacity"
                                            style={{ background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)' }}>
                                            {idx + 1}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {pickedAsset && (
                            <div className="px-5 pb-5 flex gap-2.5">
                                <button onClick={() => { onSendToPublisher(pickedAsset); setShowResults(false); }}
                                    className="flex-1 py-3 rounded-2xl text-white text-sm font-bold transition-all hover:opacity-90 flex items-center justify-center gap-2"
                                    style={{ background: BP, boxShadow: `0 4px 16px ${bpa(0.35)}` }}
                                ><i className="fas fa-paper-plane text-xs"></i>إرسال للـ Publisher</button>
                                <button onClick={() => { addNotification(NotificationType.Success, 'تم الحفظ في مكتبة الأصول'); setShowResults(false); }}
                                    className="px-5 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2"
                                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
                                ><i className="fas fa-bookmark text-xs"></i>حفظ</button>
                                <button onClick={handleGenerate} className="px-4 py-3 rounded-2xl transition-all" title="إعادة التوليد"
                                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
                                ><i className="fas fa-redo text-sm"></i></button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Asset Library ── */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>
                            مكتبة الأصول
                            <span className="ms-2 text-xs font-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>({filteredAssets.length})</span>
                        </p>
                        <div className="flex gap-1.5">
                            {(['all', 'image', 'logo', 'video'] as const).map(f => (
                                <button key={f} onClick={() => setAssetFilter(f as any)}
                                    style={assetFilter === f
                                        ? { background: BP, color: 'white', border: `1px solid ${BP}` }
                                        : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)' }
                                    }
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition"
                                >{{ all: 'الكل', image: 'صور', logo: 'لوغو', video: 'فيديو' }[f]}</button>
                            ))}
                        </div>
                    </div>
                    {filteredAssets.length === 0 ? (
                        <div className="rounded-2xl py-14 flex flex-col items-center gap-3 cursor-pointer transition"
                            style={{ border: '2px dashed rgba(255,255,255,0.1)' }}
                            onClick={() => fileInputRef.current?.click()}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = bpa(0.4)}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'}
                        >
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                <i className="fas fa-images text-xl" style={{ color: 'rgba(255,255,255,0.2)' }}></i>
                            </div>
                            <p className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>المكتبة فارغة</p>
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>ولّد تصميم أو ارفع صورة</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                            {filteredAssets.map(asset => (
                                <div key={asset.id} className="group relative rounded-xl overflow-hidden transition-all"
                                    style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}
                                    onMouseEnter={e => { setHoveredAsset(asset.id); (e.currentTarget as HTMLElement).style.borderColor = bpa(0.4); }}
                                    onMouseLeave={e => { setHoveredAsset(null); (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                >
                                    <div className="aspect-square overflow-hidden" style={{ background: 'rgba(0,0,0,0.2)' }}>
                                        <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" loading="lazy" />
                                    </div>
                                    <div className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1.5 p-2 transition-opacity ${hoveredAsset === asset.id ? 'opacity-100' : 'opacity-0'}`}>
                                        <button onClick={() => onSendToPublisher(asset)} className="w-full py-1.5 rounded-lg text-white text-[11px] font-bold transition hover:opacity-90" style={{ background: BP }}><i className="fas fa-paper-plane me-1"></i>Publisher</button>
                                        <button onClick={() => handleDeleteAsset(asset)} className="w-full py-1.5 rounded-lg text-white text-[11px] font-bold hover:bg-red-500/80 transition" style={{ background: 'rgba(255,255,255,0.15)' }}><i className="fas fa-trash me-1"></i>حذف</button>
                                    </div>
                                    <div className="absolute top-1.5 start-1.5">
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={SOURCE_BADGE[asset.source]?.style || { background: 'rgba(0,0,0,0.5)', color: 'white' }}>{SOURCE_BADGE[asset.source]?.label || asset.source}</span>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAsset}
                                className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition"
                                style={{ border: '2px dashed rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.25)' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = bpa(0.4)}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'}
                            >
                                {uploadingAsset ? <i className="fas fa-spinner fa-spin" style={{ color: BP }}></i> : <i className="fas fa-plus text-sm"></i>}
                                <span className="text-[10px] font-bold">{uploadingAsset ? 'جاري...' : 'رفع'}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Recent Jobs ── */}
                {recentJobs.length > 0 && (
                    <div className="space-y-2 pb-4">
                        <p className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.25)' }}>آخر التوليدات</p>
                        <div className="space-y-2">
                            {recentJobs.slice(0, 5).map(job => (
                                <div key={job.id} className="rounded-xl px-4 py-3 flex items-center gap-4" style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
                                    {job.assets.length > 0 && (
                                        <div className="flex gap-1 flex-shrink-0">
                                            {job.assets.slice(0, 3).map(a => <img key={a.id} src={a.url} alt="" className="w-10 h-10 rounded-lg object-cover" />)}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold truncate" style={{ color: 'rgba(255,255,255,0.65)' }}>{job.inputs['input-topic'] || job.workflowName || 'توليد'}</p>
                                        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{job.format.labelAr} · {new Date(job.createdAt).toLocaleDateString('ar-SA')}</p>
                                    </div>
                                    <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0" style={
                                        job.status === 'done'  ? { background: 'rgba(34,197,94,0.15)',  color: 'rgb(74,222,128)'  } :
                                        job.status === 'error' ? { background: 'rgba(239,68,68,0.15)',  color: 'rgb(252,165,165)' } :
                                                                  { background: 'rgba(234,179,8,0.15)',  color: 'rgb(253,224,71)'  }
                                    }>{job.status === 'done' ? 'مكتمل' : job.status === 'error' ? 'خطأ' : 'جاري'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>

        {/* ── Image Preview Modal ── */}
        {previewAsset && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }} onClick={() => setPreviewAsset(null)}>
                <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
                    <img src={previewAsset.url} alt="Preview" className="w-full rounded-2xl shadow-2xl" style={{ maxHeight: '80vh', objectFit: 'contain' }} />

                    {/* Info strip */}
                    <div className="absolute bottom-0 inset-x-0 rounded-b-2xl px-5 py-4 flex items-end justify-between" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)' }}>
                        <div>
                            <p className="text-white font-bold text-sm mb-1">{previewAsset.name}</p>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                                    background: bpa(0.8),
                                    color: 'white',
                                }}>
                                    {imageProvider === 'openai' ? 'GPT Image 1' : imageProvider === 'gemini-native' ? 'Gemini 2.0 Flash' : 'Imagen 4 Pro'}
                                </span>
                                <span className="text-[10px] text-white/50">{selectedFormat.width}×{selectedFormat.height}px · {selectedFormat.labelAr}</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setPickedAsset(previewAsset); setPreviewAsset(null); onSendToPublisher(previewAsset); }}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition"
                                style={{ background: BP, boxShadow: `0 4px 16px ${bpa(0.4)}` }}>
                                <i className="fas fa-paper-plane text-xs" />Publisher
                            </button>
                            <button onClick={() => setPreviewAsset(null)}
                                className="w-10 h-10 rounded-xl flex items-center justify-center transition"
                                style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>
                                <i className="fas fa-times" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

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
