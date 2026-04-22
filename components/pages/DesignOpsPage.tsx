// components/pages/DesignOpsPage.tsx
// UX: Single screen, no wizard — like Meta Ads creative generator
import React, { useState, useRef, useCallback } from 'react';
import {
    DesignAsset, DesignWorkflow, DesignJob, DesignAssetType,
    DesignWorkflowFormat, BrandHubProfile, NotificationType, DESIGN_FORMAT_MAP,
} from '../../types';
import { uploadFile }          from '../../services/storageService';
import { createDesignAsset, deleteDesignAsset } from '../../services/designAssetsService';
import { createDesignJob, runDesignJob }         from '../../services/designJobsService';
import { AIImageProvider }                        from '../../services/geminiService';
import { buildFinalPrompt }    from '../../services/designWorkflowsService';

// ── Props ─────────────────────────────────────────────────────────────────────

interface DesignOpsPageProps {
    brandId: string;
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

const FORMAT_CHIPS: { key: string; label: string; ar: '1:1' | '9:16' | '16:9'; icon: string }[] = [
    { key: 'instagram-post',      label: '1:1 مربع',   ar: '1:1',  icon: 'fa-square' },
    { key: 'instagram-story',     label: '9:16 رأسي',  ar: '9:16', icon: 'fa-mobile-alt' },
    { key: 'facebook-post',       label: '16:9 أفقي',  ar: '16:9', icon: 'fa-tv' },
    { key: 'ad-banner-landscape', label: 'إعلان أفقي', ar: '16:9', icon: 'fa-rectangle-landscape' },
    { key: 'ad-banner-square',    label: 'إعلان مربع', ar: '1:1',  icon: 'fa-ad' },
];

const TONE_CHIPS = ['احترافي', 'ودود', 'عاجل', 'ملهم', 'تعليمي', 'فاخر', 'مرح'];

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
    'ai-generated': { label: 'AI',   cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
    'upload':       { label: 'رفع',  cls: 'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-300'   },
    'stock':        { label: 'Stock',cls: 'bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-300'  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export const DesignOpsPage: React.FC<DesignOpsPageProps> = ({
    brandId, brandProfile, designAssets, designWorkflows, recentJobs,
    addNotification, onSendToPublisher, onAssetAdded, onJobAdded,
    onJobUpdated, onAssetDeleted, onRefresh,
}) => {
    // ── Generator state ──────────────────────────────────────────────────────
    const [topic,          setTopic]          = useState('');
    const [selectedFormat, setSelectedFormat] = useState<DesignWorkflowFormat>(DESIGN_FORMAT_MAP['instagram-post']);
    const [selectedTone,   setSelectedTone]   = useState('احترافي');
    const [activePreset,   setActivePreset]   = useState<string>('ig-post');
    const [cta,            setCta]            = useState('');
    const [useBrandColors, setUseBrandColors] = useState(true);
    const [imageProvider,  setImageProvider]  = useState<AIImageProvider>('google');

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

    const brandName = brandProfile?.brandName || 'البراند';
    const brandColors = useBrandColors
        ? (brandProfile?.styleGuidelines?.filter(g => g.toLowerCase().includes('color') || g.includes('#')).join(', ') || '')
        : '';

    // ── Apply preset ─────────────────────────────────────────────────────────

    const applyPreset = (p: Preset) => {
        setActivePreset(p.id);
        setSelectedFormat(p.format);
        if (p.tone) setSelectedTone(p.tone);
        // don't wipe the topic they already typed
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
                job = await runDesignJob(job, wf, brandProfile, brandId, setProgressMsg, imageProvider);
            } else {
                // Fallback: build a simple prompt inline without a workflow record
                setProgressMsg('جاري التوليد...');
                const presetObj = PRESETS.find(p => p.id === activePreset);
                const basePrompt = `${presetObj?.promptHint || ''} Brand: ${brandName}. Topic: ${topic}. Tone: ${selectedTone}. ${cta ? `CTA: ${cta}.` : ''} ${brandColors ? `Brand colors: ${brandColors}.` : ''} High quality, professional, no placeholder text.`;

                const fakeWorkflow: any = {
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
                job = await runDesignJob(job, fakeWorkflow, brandProfile, brandId, setProgressMsg, imageProvider);
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
    }, [topic, selectedFormat, selectedTone, cta, activePreset, useBrandColors,
        brandId, brandProfile, brandName, brandColors, designWorkflows,
        addNotification, onJobAdded, onJobUpdated, onAssetAdded]);

    // ── Upload ────────────────────────────────────────────────────────────────

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploadingAsset(true);
        let n = 0;
        for (const file of Array.from(files)) {
            try {
                const res = await uploadFile(file, 'design-assets', brandId);
                if (res.success && res.url) {
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
                    n++;
                }
            } catch { /* skip */ }
        }
        setUploadingAsset(false);
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
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{brandName} • Imagen 4.0 + Gemini Flash</p>
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

                    {/* Format + Tone Row */}
                    <div className="p-5 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {/* Format */}
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-light-text dark:text-dark-text">المقاس</p>
                            <div className="flex flex-wrap gap-1.5">
                                {FORMAT_CHIPS.map(f => (
                                    <button
                                        key={f.key}
                                        onClick={() => setSelectedFormat(DESIGN_FORMAT_MAP[f.key as keyof typeof DESIGN_FORMAT_MAP])}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                            selectedFormat.format === f.key
                                                ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                                                : 'border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-brand-primary/40'
                                        }`}
                                    >
                                        <i className={`fas ${f.icon} text-[10px]`}></i>
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tone */}
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
                            <div
                                onClick={() => setUseBrandColors(v => !v)}
                                className={`w-10 h-5 rounded-full transition-colors relative ${useBrandColors ? 'bg-brand-primary' : 'bg-light-border dark:bg-dark-border'}`}
                            >
                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${useBrandColors ? 'start-5' : 'start-0.5'}`} />
                            </div>
                            <span className="text-xs font-bold text-light-text dark:text-dark-text">ألوان البراند</span>
                        </label>
                    </div>

                    {/* Image Provider Selector */}
                    <div className="px-5 pb-3">
                        <div className="flex rounded-xl overflow-hidden border border-light-border dark:border-dark-border text-xs font-bold">
                            <button
                                onClick={() => setImageProvider('google')}
                                className={`flex-1 py-2 transition ${imageProvider === 'google' ? 'bg-brand-primary text-white' : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg'}`}
                            >
                                Imagen 4.0
                            </button>
                            <button
                                onClick={() => setImageProvider('gemini-native')}
                                className={`flex-1 py-2 transition ${imageProvider === 'gemini-native' ? 'bg-brand-primary text-white' : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg'}`}
                            >
                                Gemini ✦ عربي
                            </button>
                        </div>
                    </div>

                    {/* Generate Button */}
                    <div className="px-5 pb-5">
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
                                    <span>توليد 3 تصاميم</span>
                                    <span className="opacity-70 font-normal">{imageProvider === 'gemini-native' ? 'Gemini' : 'Imagen 4.0'}</span>
                                    <span className="text-xs opacity-70">• Imagen 4.0</span>
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
                                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                        <span className="text-white text-[10px] font-bold">Variant {idx + 1}</span>
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
    );
};
