// components/DesignEditorModal.tsx
// محرر التصميمات: تحويل المقاس + اقتصاص بالسحب + تعديلات لونية + تصدير
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Brand, DesignAsset, DesignWorkflowFormat, NotificationType, DESIGN_FORMAT_MAP } from '../types';
import { useModalClose } from '../hooks/useModalClose';
import { createDesignAsset } from '../services/designAssetsService';
import { uploadFile } from '../services/storageService';

// ── Format groups (compact, for the editor side panel) ────────────────────────

const EDITOR_PLATFORM_GROUPS = [
    { id: 'ig',        nameAr: 'إنستاغرام', icon: 'fab fa-instagram',  color: 'text-pink-500',   formats: ['instagram-post', 'instagram-portrait', 'instagram-story', 'instagram-reel-cover'] },
    { id: 'fb',        nameAr: 'فيسبوك',    icon: 'fab fa-facebook',   color: 'text-blue-400',   formats: ['facebook-post', 'facebook-story'] },
    { id: 'tiktok',    nameAr: 'تيك توك',   icon: 'fab fa-tiktok',     color: 'text-white',      formats: ['tiktok-cover'] },
    { id: 'x',         nameAr: 'X',         icon: 'fab fa-x-twitter',  color: 'text-white',      formats: ['twitter-post', 'twitter-portrait'] },
    { id: 'linkedin',  nameAr: 'لينكدإن',   icon: 'fab fa-linkedin',   color: 'text-blue-400',   formats: ['linkedin-post', 'linkedin-banner'] },
    { id: 'youtube',   nameAr: 'يوتيوب',    icon: 'fab fa-youtube',    color: 'text-red-500',    formats: ['youtube-thumbnail'] },
    { id: 'pinterest', nameAr: 'بينتريست',  icon: 'fab fa-pinterest',  color: 'text-red-500',    formats: ['pinterest-pin'] },
    { id: 'snap',      nameAr: 'سناب',      icon: 'fab fa-snapchat',   color: 'text-yellow-400', formats: ['snapchat-story'] },
    { id: 'whatsapp',  nameAr: 'واتساب',    icon: 'fab fa-whatsapp',   color: 'text-green-500',  formats: ['whatsapp-status'] },
    { id: 'ads',       nameAr: 'إعلانات',   icon: 'fas fa-rectangle-ad', color: 'text-orange-400', formats: ['ad-banner-square', 'ad-banner-landscape', 'ad-banner-portrait'] },
] as const;

type FitMode = 'crop' | 'fit' | 'fill';
type ActiveTab = 'size' | 'adjust';

// ── Props ─────────────────────────────────────────────────────────────────────

interface DesignEditorModalProps {
    imageUrl: string;
    sourceFormat?: DesignWorkflowFormat;
    brand?: Brand | null;
    brandId?: string;
    onClose: () => void;
    onSaveToLibrary?: (asset: DesignAsset) => void;
    onSendToPublisher?: (url: string) => void;
    addNotification?: (type: NotificationType, msg: string) => void;
}

// ── Preview size helpers ──────────────────────────────────────────────────────

const MAX_PREVIEW_H = 420;
const RAW_PREVIEW_W = 300;

function calcPreview(fmt: DesignWorkflowFormat) {
    const rawH = RAW_PREVIEW_W * fmt.height / fmt.width;
    const h    = Math.min(rawH, MAX_PREVIEW_H);
    const w    = rawH > MAX_PREVIEW_H ? Math.round(MAX_PREVIEW_H * fmt.width / fmt.height) : RAW_PREVIEW_W;
    return { w, h };
}

// ── Component ─────────────────────────────────────────────────────────────────

export const DesignEditorModal: React.FC<DesignEditorModalProps> = ({
    imageUrl,
    sourceFormat,
    brand,
    brandId,
    onClose,
    onSaveToLibrary,
    onSendToPublisher,
    addNotification,
}) => {
    useModalClose(onClose);

    // ── Tab & format ────────────────────────────────────────────────────────
    const [activeTab,     setActiveTab]     = useState<ActiveTab>('size');
    const [targetFormat,  setTargetFormat]  = useState<DesignWorkflowFormat>(
        sourceFormat ?? DESIGN_FORMAT_MAP['instagram-post']
    );
    const [activePlatform, setActivePlatform] = useState('ig');

    // ── Fit mode & canvas position ──────────────────────────────────────────
    const [fitMode,  setFitMode]  = useState<FitMode>('crop');
    const [zoom,     setZoom]     = useState(1);
    const [offsetX,  setOffsetX]  = useState(0);
    const [offsetY,  setOffsetY]  = useState(0);

    // ── Image natural size ───────────────────────────────────────────────────
    const [imgNatW, setImgNatW] = useState(0);
    const [imgNatH, setImgNatH] = useState(0);

    // ── Adjustments ─────────────────────────────────────────────────────────
    const [brightness,  setBrightness]  = useState(100);
    const [contrast,    setContrast]    = useState(100);
    const [saturation,  setSaturation]  = useState(100);
    const [sepia,       setSepia]       = useState(0);
    const [grayscale,   setGrayscale]   = useState(0);

    // ── Export state ─────────────────────────────────────────────────────────
    const [isSaving,  setIsSaving]  = useState(false);

    // ── Drag ────────────────────────────────────────────────────────────────
    const isDragging  = useRef(false);
    const dragOrigin  = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

    // ── Derived preview dimensions ───────────────────────────────────────────
    const { w: PREV_W, h: PREV_H } = calcPreview(targetFormat);

    // ── Load natural image dimensions ────────────────────────────────────────
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { setImgNatW(img.naturalWidth); setImgNatH(img.naturalHeight); };
        img.src = imageUrl;
    }, [imageUrl]);

    // ── Recenter when format or fitMode changes ───────────────────────────────
    useEffect(() => {
        setOffsetX(0);
        setOffsetY(0);
        setZoom(1);
    }, [targetFormat, fitMode]);

    // ── Compute rendered image dimensions in preview ──────────────────────────
    const { imgW, imgH } = (() => {
        if (!imgNatW || !imgNatH) return { imgW: PREV_W, imgH: PREV_H };
        const baseScale = fitMode === 'fit'
            ? Math.min(PREV_W / imgNatW, PREV_H / imgNatH)
            : Math.max(PREV_W / imgNatW, PREV_H / imgNatH);
        return {
            imgW: Math.round(imgNatW * baseScale * zoom),
            imgH: Math.round(imgNatH * baseScale * zoom),
        };
    })();

    const imgX = (PREV_W - imgW) / 2 + offsetX;
    const imgY = (PREV_H - imgH) / 2 + offsetY;

    // ── Clamp helper ─────────────────────────────────────────────────────────
    const clamp = useCallback((ox: number, oy: number) => {
        if (fitMode === 'fit') return { ox: 0, oy: 0 };
        const maxOX = Math.max(0, (imgW - PREV_W) / 2);
        const maxOY = Math.max(0, (imgH - PREV_H) / 2);
        return {
            ox: Math.max(-maxOX, Math.min(maxOX, ox)),
            oy: Math.max(-maxOY, Math.min(maxOY, oy)),
        };
    }, [fitMode, imgW, imgH, PREV_W, PREV_H]);

    // ── Drag handlers ─────────────────────────────────────────────────────────
    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if (fitMode === 'fit') return;
        isDragging.current = true;
        dragOrigin.current = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY };
        e.preventDefault();
    }, [fitMode, offsetX, offsetY]);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - dragOrigin.current.x;
        const dy = e.clientY - dragOrigin.current.y;
        const { ox, oy } = clamp(dragOrigin.current.ox + dx, dragOrigin.current.oy + dy);
        setOffsetX(ox);
        setOffsetY(oy);
    }, [clamp]);

    const onMouseUp = useCallback(() => { isDragging.current = false; }, []);

    // ── Touch drag (mobile) ──────────────────────────────────────────────────
    const onTouchStart = useCallback((e: React.TouchEvent) => {
        if (fitMode === 'fit') return;
        const t = e.touches[0];
        isDragging.current = true;
        dragOrigin.current = { x: t.clientX, y: t.clientY, ox: offsetX, oy: offsetY };
    }, [fitMode, offsetX, offsetY]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isDragging.current) return;
        const t = e.touches[0];
        const dx = t.clientX - dragOrigin.current.x;
        const dy = t.clientY - dragOrigin.current.y;
        const { ox, oy } = clamp(dragOrigin.current.ox + dx, dragOrigin.current.oy + dy);
        setOffsetX(ox);
        setOffsetY(oy);
    }, [clamp]);

    // ── CSS filter string ─────────────────────────────────────────────────────
    const filterStr = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) sepia(${sepia}%) grayscale(${grayscale}%)`;

    // ── Export to canvas → dataURL ────────────────────────────────────────────
    const exportToDataUrl = useCallback(async (): Promise<string> => {
        const canvas = document.createElement('canvas');
        canvas.width  = targetFormat.width;
        canvas.height = targetFormat.height;
        const ctx = canvas.getContext('2d')!;

        const exportScaleX = targetFormat.width  / PREV_W;
        const exportScaleY = targetFormat.height / PREV_H;

        if (fitMode === 'fit') {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.filter = filterStr;

        const src = new Image();
        src.crossOrigin = 'anonymous';
        src.src = imageUrl;
        if (!src.complete) await new Promise<void>(r => { src.onload = () => r(); src.onerror = () => r(); });

        ctx.drawImage(src,
            imgX  * exportScaleX,
            imgY  * exportScaleY,
            imgW  * exportScaleX,
            imgH  * exportScaleY,
        );

        ctx.filter = 'none';
        return canvas.toDataURL('image/jpeg', 0.92);
    }, [targetFormat, PREV_W, PREV_H, fitMode, filterStr, imageUrl, imgX, imgY, imgW, imgH]);

    // ── Download ─────────────────────────────────────────────────────────────
    const handleDownload = useCallback(async () => {
        const dataUrl = await exportToDataUrl();
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `design-${targetFormat.format}-${Date.now()}.jpg`;
        a.click();
    }, [exportToDataUrl, targetFormat]);

    // ── Save to Library ──────────────────────────────────────────────────────
    const handleSaveToLibrary = useCallback(async () => {
        if (!brandId || !onSaveToLibrary) return;
        setIsSaving(true);
        try {
            const dataUrl = await exportToDataUrl();
            const blob  = await (await fetch(dataUrl)).blob();
            const fname = `edited-${targetFormat.format}-${Date.now()}.jpg`;
            const file  = new File([blob], fname, { type: 'image/jpeg' });

            const upload = await uploadFile(file, 'design-assets', brandId);
            const url    = upload.success && upload.url ? upload.url : dataUrl;

            const asset = await createDesignAsset(brandId, {
                name:        `تصميم معدّل — ${targetFormat.labelAr}`,
                url,
                thumbnailUrl: url,
                type:        'image',
                source:      'ai-generated',
                tags:        ['edited', targetFormat.format],
                width:       targetFormat.width,
                height:      targetFormat.height,
                aspectRatio: targetFormat.aspectRatio,
            });
            onSaveToLibrary(asset);
            addNotification?.(NotificationType.Success, 'تم الحفظ في مكتبة الأصول ✅');
            onClose();
        } catch {
            addNotification?.(NotificationType.Error, 'فشل الحفظ — حاول مرة أخرى');
        } finally {
            setIsSaving(false);
        }
    }, [brandId, onSaveToLibrary, exportToDataUrl, targetFormat, addNotification, onClose]);

    // ── Send to Publisher ────────────────────────────────────────────────────
    const handleSendToPublisher = useCallback(async () => {
        const dataUrl = await exportToDataUrl();
        onSendToPublisher?.(dataUrl);
        onClose();
    }, [exportToDataUrl, onSendToPublisher, onClose]);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-dark-card rounded-2xl shadow-2xl border border-dark-border w-full max-w-5xl flex flex-col max-h-[92vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-primary/20 text-brand-secondary">
                            <i className="fas fa-crop-simple text-sm" />
                        </span>
                        <div>
                            <h2 className="text-base font-bold text-white">تحرير وتحويل التصميم</h2>
                            <p className="text-[10px] text-dark-text-secondary">{targetFormat.labelAr} • {targetFormat.width}×{targetFormat.height}px</p>
                        </div>
                    </div>

                    {/* Export actions */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dark-border text-xs font-bold text-dark-text-secondary hover:text-white hover:border-dark-text-secondary/50 transition"
                        >
                            <i className="fas fa-download text-[10px]" />
                            تنزيل
                        </button>
                        {onSendToPublisher && (
                            <button
                                onClick={handleSendToPublisher}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 transition"
                            >
                                <i className="fas fa-paper-plane text-[10px]" />
                                إرسال للـ Publisher
                            </button>
                        )}
                        {brandId && onSaveToLibrary && (
                            <button
                                onClick={handleSaveToLibrary}
                                disabled={isSaving}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 transition"
                            >
                                <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-save'} text-[10px]`} />
                                {isSaving ? 'جاري الحفظ...' : 'حفظ في المكتبة'}
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-text-secondary hover:bg-dark-bg hover:text-white transition"
                        >
                            <i className="fas fa-times" />
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="flex flex-1 overflow-hidden">

                    {/* ── Left Panel: Controls ── */}
                    <div className="w-72 flex-shrink-0 border-e border-dark-border flex flex-col overflow-hidden">

                        {/* Tabs */}
                        <div className="flex border-b border-dark-border flex-shrink-0">
                            {(['size', 'adjust'] as ActiveTab[]).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-3 text-xs font-bold transition ${
                                        activeTab === tab
                                            ? 'text-brand-secondary border-b-2 border-brand-primary'
                                            : 'text-dark-text-secondary hover:text-white'
                                    }`}
                                >
                                    {tab === 'size' ? '↔ المقاس والمنصة' : '🎨 التعديلات'}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">

                            {/* ── SIZE TAB ── */}
                            {activeTab === 'size' && (
                                <>
                                    {/* Platform group selector */}
                                    <div className="flex flex-wrap gap-1.5">
                                        {EDITOR_PLATFORM_GROUPS.map(pg => (
                                            <button
                                                key={pg.id}
                                                onClick={() => setActivePlatform(pg.id)}
                                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                                                    activePlatform === pg.id
                                                        ? 'border-brand-primary bg-brand-primary text-white'
                                                        : 'border-dark-border text-dark-text-secondary hover:border-brand-primary/40 bg-dark-bg'
                                                }`}
                                            >
                                                <i className={`${pg.icon} text-[9px] ${activePlatform === pg.id ? 'text-white' : pg.color}`} />
                                                {pg.nameAr}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Format list for active platform */}
                                    <div className="space-y-1.5">
                                        {(EDITOR_PLATFORM_GROUPS.find(g => g.id === activePlatform)?.formats ?? []).map(fKey => {
                                            const fmt = DESIGN_FORMAT_MAP[fKey as keyof typeof DESIGN_FORMAT_MAP];
                                            if (!fmt) return null;
                                            const isActive = targetFormat.format === fmt.format;
                                            return (
                                                <button
                                                    key={fmt.format}
                                                    onClick={() => setTargetFormat(fmt)}
                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-start transition ${
                                                        isActive
                                                            ? 'border-brand-primary bg-brand-primary/10'
                                                            : 'border-dark-border bg-dark-bg hover:border-brand-primary/30'
                                                    }`}
                                                >
                                                    {/* Mini aspect ratio box */}
                                                    {(() => {
                                                        const maxW = 24, maxH = 30;
                                                        const r = fmt.width / fmt.height;
                                                        const bw = r >= 1 ? maxW : Math.round(maxH * r);
                                                        const bh = r < 1  ? maxH : Math.round(maxW / r);
                                                        return (
                                                            <div style={{ width: maxW, height: maxH }} className="flex items-center justify-center flex-shrink-0">
                                                                <div
                                                                    className={`rounded-sm ${isActive ? 'bg-brand-primary' : 'bg-dark-text-secondary/30'}`}
                                                                    style={{ width: bw, height: bh }}
                                                                />
                                                            </div>
                                                        );
                                                    })()}
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`text-xs font-bold truncate ${isActive ? 'text-brand-secondary' : 'text-dark-text'}`}>{fmt.labelAr}</p>
                                                        <p className="text-[10px] text-dark-text-secondary">{fmt.width}×{fmt.height}</p>
                                                        {fmt.tipAr && <p className="text-[9px] text-dark-text-secondary/70 mt-0.5">{fmt.tipAr}</p>}
                                                    </div>
                                                    {fmt.recommended && (
                                                        <span className="text-[9px] font-bold text-amber-400 flex-shrink-0">✦</span>
                                                    )}
                                                    {isActive && (
                                                        <i className="fas fa-check text-brand-primary text-[10px] flex-shrink-0" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Fit mode */}
                                    <div className="space-y-2 pt-2 border-t border-dark-border">
                                        <p className="text-xs font-bold text-dark-text-secondary">وضع الملاءمة</p>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {([
                                                { id: 'crop', labelAr: 'اقتصاص', icon: 'fa-crop', tip: 'يملأ الإطار' },
                                                { id: 'fit',  labelAr: 'ملاءمة', icon: 'fa-compress', tip: 'بحواف سوداء' },
                                                { id: 'fill', labelAr: 'تكبير', icon: 'fa-expand', tip: 'ملء مع تكبير' },
                                            ] as const).map(m => (
                                                <button
                                                    key={m.id}
                                                    onClick={() => setFitMode(m.id)}
                                                    title={m.tip}
                                                    className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[10px] font-bold transition ${
                                                        fitMode === m.id
                                                            ? 'border-brand-primary bg-brand-primary/10 text-brand-secondary'
                                                            : 'border-dark-border text-dark-text-secondary hover:border-brand-primary/30'
                                                    }`}
                                                >
                                                    <i className={`fas ${m.icon} text-xs`} />
                                                    {m.labelAr}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Zoom */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-bold text-dark-text-secondary">التكبير</p>
                                            <span className="text-[10px] text-brand-secondary">{Math.round(zoom * 100)}%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(1)))}
                                                className="w-7 h-7 rounded-lg bg-dark-bg border border-dark-border text-white text-sm font-bold flex items-center justify-center hover:border-brand-primary/50"
                                            >−</button>
                                            <input
                                                type="range" min={0.5} max={3} step={0.05}
                                                value={zoom}
                                                onChange={e => setZoom(+e.target.value)}
                                                className="flex-1 h-1.5 rounded-full accent-brand-primary cursor-pointer"
                                            />
                                            <button
                                                onClick={() => setZoom(z => Math.min(3, +(z + 0.1).toFixed(1)))}
                                                className="w-7 h-7 rounded-lg bg-dark-bg border border-dark-border text-white text-sm font-bold flex items-center justify-center hover:border-brand-primary/50"
                                            >+</button>
                                        </div>
                                        <button
                                            onClick={() => { setZoom(1); setOffsetX(0); setOffsetY(0); }}
                                            className="w-full text-[10px] text-dark-text-secondary hover:text-white border border-dark-border rounded-lg py-1.5 transition"
                                        >
                                            إعادة ضبط
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* ── ADJUST TAB ── */}
                            {activeTab === 'adjust' && (
                                <div className="space-y-5">
                                    {([
                                        { label: 'السطوع', value: brightness, set: setBrightness, min: 0, max: 200, default: 100 },
                                        { label: 'التباين', value: contrast,   set: setContrast,   min: 0, max: 200, default: 100 },
                                        { label: 'التشبع',  value: saturation, set: setSaturation, min: 0, max: 200, default: 100 },
                                        { label: 'دفء (Sepia)', value: sepia, set: setSepia, min: 0, max: 100, default: 0 },
                                        { label: 'أبيض وأسود', value: grayscale, set: setGrayscale, min: 0, max: 100, default: 0 },
                                    ] as const).map(s => (
                                        <div key={s.label} className="space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <label className="text-xs font-bold text-dark-text-secondary">{s.label}</label>
                                                <span className={`text-[10px] font-semibold ${s.value !== s.default ? 'text-brand-secondary' : 'text-dark-text-secondary'}`}>
                                                    {s.value}
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min={s.min} max={s.max}
                                                value={s.value}
                                                onChange={e => s.set(+e.target.value as any)}
                                                className="w-full h-1.5 rounded-full accent-brand-primary cursor-pointer"
                                            />
                                        </div>
                                    ))}

                                    {/* Quick filters */}
                                    <div className="space-y-2 pt-2 border-t border-dark-border">
                                        <p className="text-xs font-bold text-dark-text-secondary">فلاتر سريعة</p>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {[
                                                { nameAr: 'ناعم', v: { brightness: 105, contrast: 90, saturation: 95, sepia: 0, grayscale: 0 } },
                                                { nameAr: 'حيوي', v: { brightness: 110, contrast: 115, saturation: 130, sepia: 0, grayscale: 0 } },
                                                { nameAr: 'دافئ', v: { brightness: 100, contrast: 105, saturation: 110, sepia: 25, grayscale: 0 } },
                                                { nameAr: 'أبيض وأسود', v: { brightness: 100, contrast: 110, saturation: 0, sepia: 0, grayscale: 100 } },
                                            ].map(f => (
                                                <button
                                                    key={f.nameAr}
                                                    onClick={() => {
                                                        setBrightness(f.v.brightness);
                                                        setContrast(f.v.contrast);
                                                        setSaturation(f.v.saturation);
                                                        setSepia(f.v.sepia);
                                                        setGrayscale(f.v.grayscale);
                                                    }}
                                                    className="py-2 rounded-xl border border-dark-border text-xs font-bold text-dark-text-secondary hover:border-brand-primary/40 hover:text-white transition"
                                                >
                                                    {f.nameAr}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => { setBrightness(100); setContrast(100); setSaturation(100); setSepia(0); setGrayscale(0); }}
                                            className="w-full py-2 rounded-xl border border-dark-border text-xs font-bold text-dark-text-secondary hover:text-white transition"
                                        >
                                            إعادة كل التعديلات
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Right Panel: Canvas Preview ── */}
                    <div className="flex-1 flex flex-col items-center justify-center bg-dark-bg/60 p-6 gap-4 overflow-hidden">

                        {/* Preview label */}
                        <p className="text-[10px] text-dark-text-secondary font-semibold uppercase tracking-wider">
                            {targetFormat.labelAr} — {targetFormat.width}×{targetFormat.height}px
                            {fitMode !== 'fit' && ' • اسحب لتحديد المنطقة'}
                        </p>

                        {/* Canvas preview area */}
                        <div
                            className={`relative overflow-hidden rounded-lg border-2 border-brand-primary/40 shadow-xl ${fitMode !== 'fit' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
                            style={{ width: PREV_W, height: PREV_H, flexShrink: 0 }}
                            onMouseDown={onMouseDown}
                            onMouseMove={onMouseMove}
                            onMouseUp={onMouseUp}
                            onMouseLeave={onMouseUp}
                            onTouchStart={onTouchStart}
                            onTouchMove={onTouchMove}
                            onTouchEnd={onMouseUp}
                        >
                            {/* Background (for letterbox) */}
                            {fitMode === 'fit' && (
                                <div className="absolute inset-0 bg-black" />
                            )}

                            {/* The image */}
                            <img
                                src={imageUrl}
                                alt="preview"
                                draggable={false}
                                style={{
                                    position:       'absolute',
                                    left:           imgX,
                                    top:            imgY,
                                    width:          imgW,
                                    height:         imgH,
                                    filter:         filterStr,
                                    userSelect:     'none',
                                    pointerEvents:  'none',
                                }}
                            />

                            {/* Frame overlay (shows target boundaries) */}
                            <div className="absolute inset-0 border border-white/10 rounded-lg pointer-events-none" />

                            {/* Drag hint */}
                            {fitMode !== 'fit' && (
                                <div className="absolute bottom-2 inset-x-0 flex justify-center pointer-events-none">
                                    <span className="text-[9px] font-bold text-white/50 bg-black/40 px-2 py-0.5 rounded-full">
                                        اسحب لتحديد المنطقة
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Quick info */}
                        <div className="flex items-center gap-4 text-[10px] text-dark-text-secondary">
                            <span>المقاس الأصلي: {imgNatW || '?'}×{imgNatH || '?'}px</span>
                            <span>→</span>
                            <span className="text-brand-secondary font-semibold">{targetFormat.width}×{targetFormat.height}px</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
