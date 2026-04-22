/**
 * AssetLibraryPage — Brand Asset Management
 *
 * Centralized library for all brand visual assets:
 * - Upload images/logos/icons
 * - Generate with AI and save directly
 * - Filter by type and source
 * - Download, rename, delete, tag assets
 * - Send assets directly to Publisher
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DesignAsset, DesignAssetType, DesignAssetSource, NotificationType, MediaItem } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import {
    getDesignAssets,
    createDesignAsset,
    deleteDesignAsset,
    updateDesignAsset,
} from '../../services/designAssetsService';
import { AIImageGeneratorModal } from '../AIImageGeneratorModal';

// ─────────────────────────────────────────────────────────────────────────────

interface AssetLibraryPageProps {
    brandId: string;
    addNotification: (type: NotificationType, message: string) => void;
    onSendToPublisher?: (mediaItem: MediaItem) => void;
}

type FilterType = 'all' | DesignAssetType;
type FilterSource = 'all' | DesignAssetSource;
type SortBy = 'newest' | 'oldest' | 'name';

const TYPE_LABELS: Record<DesignAssetType, { ar: string; en: string; icon: string }> = {
    image:    { ar: 'صورة',    en: 'Image',    icon: 'fa-image' },
    logo:     { ar: 'شعار',    en: 'Logo',     icon: 'fa-copyright' },
    template: { ar: 'قالب',    en: 'Template', icon: 'fa-object-group' },
    video:    { ar: 'فيديو',   en: 'Video',    icon: 'fa-film' },
    icon:     { ar: 'أيقونة',  en: 'Icon',     icon: 'fa-icons' },
    font:     { ar: 'خط',      en: 'Font',     icon: 'fa-font' },
};

const SOURCE_LABELS: Record<DesignAssetSource, { ar: string; en: string; color: string }> = {
    upload:       { ar: 'مرفوع',       en: 'Upload',    color: 'text-blue-400 bg-blue-400/10' },
    'ai-generated': { ar: 'AI',          en: 'AI',        color: 'text-purple-400 bg-purple-400/10' },
    stock:        { ar: 'مخزون',       en: 'Stock',     color: 'text-amber-400 bg-amber-400/10' },
    canva:        { ar: 'Canva',       en: 'Canva',     color: 'text-emerald-400 bg-emerald-400/10' },
    figma:        { ar: 'Figma',       en: 'Figma',     color: 'text-rose-400 bg-rose-400/10' },
};

// ─────────────────────────────────────────────────────────────────────────────

export const AssetLibraryPage: React.FC<AssetLibraryPageProps> = ({
    brandId,
    addNotification,
    onSendToPublisher,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    // ── State ─────────────────────────────────────────────────────────────────
    const [assets, setAssets] = useState<DesignAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<FilterType>('all');
    const [filterSource, setFilterSource] = useState<FilterSource>('all');
    const [sortBy, setSortBy] = useState<SortBy>('newest');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showAIModal, setShowAIModal] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [editingAsset, setEditingAsset] = useState<DesignAsset | null>(null);
    const [editName, setEditName] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [activeAsset, setActiveAsset] = useState<DesignAsset | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Load assets ───────────────────────────────────────────────────────────
    const loadAssets = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getDesignAssets(brandId);
            setAssets(data);
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل تحميل الأصول.' : 'Failed to load assets.');
        } finally {
            setIsLoading(false);
        }
    }, [brandId, addNotification, ar]);

    useEffect(() => { loadAssets(); }, [loadAssets]);

    // ── Filtering + Sorting ───────────────────────────────────────────────────
    const filtered = assets
        .filter(a => {
            if (filterType !== 'all' && a.type !== filterType) return false;
            if (filterSource !== 'all' && a.source !== filterSource) return false;
            if (searchQuery && !a.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
        })
        .sort((a, b) => {
            if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            return a.name.localeCompare(b.name);
        });

    // ── Upload ────────────────────────────────────────────────────────────────
    const handleFileUpload = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setIsUploading(true);
        let successCount = 0;

        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/')) continue;
            try {
                const url = URL.createObjectURL(file);
                const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
                await createDesignAsset(brandId, {
                    name: file.name.replace(/\.[^.]+$/, ''),
                    url,
                    type: 'image',
                    source: 'upload',
                    tags: [],
                    mimeType: file.type,
                    fileSize: file.size,
                });
                successCount++;
            } catch {
                // skip failed file
            }
        }

        setIsUploading(false);
        if (successCount > 0) {
            addNotification(
                NotificationType.Success,
                ar ? `تم رفع ${successCount} ملف بنجاح.` : `${successCount} file(s) uploaded.`,
            );
            loadAssets();
        }
    }, [brandId, addNotification, ar, loadAssets]);

    // ── Delete ────────────────────────────────────────────────────────────────
    const handleDelete = useCallback(async (assetId: string) => {
        try {
            await deleteDesignAsset(brandId, assetId);
            setAssets(prev => prev.filter(a => a.id !== assetId));
            setSelectedIds(prev => { const s = new Set(prev); s.delete(assetId); return s; });
            if (activeAsset?.id === assetId) setActiveAsset(null);
            addNotification(NotificationType.Success, ar ? 'تم حذف الأصل.' : 'Asset deleted.');
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل الحذف.' : 'Delete failed.');
        }
    }, [brandId, addNotification, ar, activeAsset]);

    const handleDeleteSelected = useCallback(async () => {
        if (selectedIds.size === 0) return;
        for (const id of selectedIds) {
            await deleteDesignAsset(brandId, id).catch(() => {});
        }
        setAssets(prev => prev.filter(a => !selectedIds.has(a.id)));
        addNotification(
            NotificationType.Success,
            ar ? `تم حذف ${selectedIds.size} أصل.` : `${selectedIds.size} asset(s) deleted.`,
        );
        setSelectedIds(new Set());
    }, [brandId, selectedIds, addNotification, ar]);

    // ── Rename ────────────────────────────────────────────────────────────────
    const handleRename = useCallback(async () => {
        if (!editingAsset || !editName.trim()) return;
        try {
            const updated = await updateDesignAsset(brandId, editingAsset.id, { name: editName.trim() });
            setAssets(prev => prev.map(a => a.id === updated.id ? updated : a));
            setEditingAsset(null);
            addNotification(NotificationType.Success, ar ? 'تم تغيير الاسم.' : 'Renamed successfully.');
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل التغيير.' : 'Rename failed.');
        }
    }, [brandId, editingAsset, editName, addNotification, ar]);

    // ── Download ──────────────────────────────────────────────────────────────
    const handleDownload = useCallback(async (asset: DesignAsset) => {
        try {
            const res = await fetch(asset.url);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${asset.name}.jpg`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            window.open(asset.url, '_blank');
        }
    }, []);

    // ── Selection ─────────────────────────────────────────────────────────────
    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const s = new Set(prev);
            s.has(id) ? s.delete(id) : s.add(id);
            return s;
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelectedIds(filtered.every(a => selectedIds.has(a.id))
            ? new Set()
            : new Set(filtered.map(a => a.id))
        );
    }, [filtered, selectedIds]);

    // ── AI image saved ────────────────────────────────────────────────────────
    const handleAIImageAdded = useCallback((_: MediaItem) => {
        // The modal already saves to library if brandId is passed; just refresh
        loadAssets();
    }, [loadAssets]);

    // ─────────────────────────────────────────────────────────────────────────
    // Stats
    // ─────────────────────────────────────────────────────────────────────────
    const stats = {
        total: assets.length,
        ai: assets.filter(a => a.source === 'ai-generated').length,
        uploaded: assets.filter(a => a.source === 'upload').length,
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-6">
            {/* ── Page header ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-brand-secondary">
                        {ar ? 'استوديو AI' : 'AI Studio'}
                    </p>
                    <h1 className="mt-1.5 text-2xl font-black tracking-tight text-light-text dark:text-dark-text">
                        {ar ? 'مكتبة الأصول' : 'Asset Library'}
                    </h1>
                    <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {ar
                            ? 'كل صور وتصاميم البراند في مكان واحد — أنشئ، ارفع، واستخدم.'
                            : 'All brand visuals in one place — create, upload, and use.'}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {/* Upload */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2 rounded-xl border border-dark-border bg-dark-card px-4 py-2.5 text-sm font-semibold text-dark-text-secondary transition-all hover:text-white disabled:opacity-50"
                    >
                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'} text-xs`} />
                        {ar ? 'رفع صور' : 'Upload'}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={e => handleFileUpload(e.target.files)}
                    />

                    {/* AI Generate */}
                    <button
                        type="button"
                        onClick={() => setShowAIModal(true)}
                        className="flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-0.5 active:scale-95"
                    >
                        <i className="fas fa-wand-magic-sparkles text-xs" />
                        {ar ? 'توليد بالذكاء الاصطناعي' : 'Generate with AI'}
                    </button>
                </div>
            </div>

            {/* ── Stats row ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: ar ? 'إجمالي الأصول' : 'Total Assets', value: stats.total, icon: 'fa-images', color: 'text-brand-secondary' },
                    { label: ar ? 'مُولَّد بـ AI' : 'AI Generated', value: stats.ai, icon: 'fa-wand-magic-sparkles', color: 'text-purple-400' },
                    { label: ar ? 'مرفوع' : 'Uploaded', value: stats.uploaded, icon: 'fa-upload', color: 'text-blue-400' },
                ].map(stat => (
                    <div key={stat.label} className="surface-panel rounded-2xl p-4 flex items-center gap-3">
                        <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-dark-bg ${stat.color}`}>
                            <i className={`fas ${stat.icon} text-sm`} />
                        </span>
                        <div>
                            <p className="text-xl font-black text-white">{stat.value}</p>
                            <p className="text-[11px] text-dark-text-secondary">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Filters + Search ─────────────────────────────────────────── */}
            <div className="surface-panel rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <i className="fas fa-search absolute start-3 top-1/2 -translate-y-1/2 text-dark-text-secondary text-xs" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={ar ? 'بحث في الأصول...' : 'Search assets...'}
                            className="w-full rounded-xl border border-dark-border bg-dark-bg ps-9 pe-4 py-2.5 text-sm text-white outline-none placeholder:text-dark-text-secondary/50 focus:border-brand-primary/60"
                        />
                    </div>

                    {/* Sort */}
                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value as SortBy)}
                        className="rounded-xl border border-dark-border bg-dark-bg px-3 py-2.5 text-sm text-dark-text-secondary outline-none focus:border-brand-primary/60"
                    >
                        <option value="newest">{ar ? 'الأحدث' : 'Newest'}</option>
                        <option value="oldest">{ar ? 'الأقدم' : 'Oldest'}</option>
                        <option value="name">{ar ? 'الاسم' : 'Name'}</option>
                    </select>

                    {/* View toggle */}
                    <div className="flex overflow-hidden rounded-xl border border-dark-border">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={`px-3 py-2.5 transition-colors ${viewMode === 'grid' ? 'bg-brand-primary text-white' : 'bg-dark-bg text-dark-text-secondary hover:text-white'}`}
                        >
                            <i className="fas fa-th-large text-xs" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-2.5 transition-colors ${viewMode === 'list' ? 'bg-brand-primary text-white' : 'bg-dark-bg text-dark-text-secondary hover:text-white'}`}
                        >
                            <i className="fas fa-list text-xs" />
                        </button>
                    </div>
                </div>

                {/* Type + Source filters */}
                <div className="flex flex-wrap gap-2">
                    {/* All types */}
                    <button
                        type="button"
                        onClick={() => setFilterType('all')}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${filterType === 'all' ? 'bg-brand-primary text-white' : 'border border-dark-border text-dark-text-secondary hover:text-white'}`}
                    >
                        {ar ? 'الكل' : 'All Types'}
                    </button>
                    {(Object.keys(TYPE_LABELS) as DesignAssetType[]).map(type => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => setFilterType(filterType === type ? 'all' : type)}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                                filterType === type
                                    ? 'bg-brand-primary text-white'
                                    : 'border border-dark-border text-dark-text-secondary hover:text-white'
                            }`}
                        >
                            <i className={`fas ${TYPE_LABELS[type].icon} text-[9px]`} />
                            {ar ? TYPE_LABELS[type].ar : TYPE_LABELS[type].en}
                        </button>
                    ))}

                    <span className="h-5 w-px self-center bg-dark-border mx-1" />

                    {/* Source filters */}
                    {(Object.keys(SOURCE_LABELS) as DesignAssetSource[]).map(src => (
                        <button
                            key={src}
                            type="button"
                            onClick={() => setFilterSource(filterSource === src ? 'all' : src)}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                                filterSource === src
                                    ? `${SOURCE_LABELS[src].color} ring-1 ring-current`
                                    : 'border border-dark-border text-dark-text-secondary hover:text-white'
                            }`}
                        >
                            {ar ? SOURCE_LABELS[src].ar : SOURCE_LABELS[src].en}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Bulk actions bar ─────────────────────────────────────────── */}
            {selectedIds.size > 0 && (
                <div className="surface-panel flex items-center justify-between gap-4 rounded-2xl p-3 border border-brand-primary/20 bg-brand-primary/5">
                    <p className="text-sm font-semibold text-white">
                        {ar ? `تم تحديد ${selectedIds.size} أصل` : `${selectedIds.size} asset(s) selected`}
                    </p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={selectAll}
                            className="rounded-lg border border-dark-border px-3 py-1.5 text-xs font-semibold text-dark-text-secondary hover:text-white transition-colors"
                        >
                            {filtered.every(a => selectedIds.has(a.id))
                                ? (ar ? 'إلغاء التحديد' : 'Deselect all')
                                : (ar ? 'تحديد الكل' : 'Select all')
                            }
                        </button>
                        <button
                            type="button"
                            onClick={handleDeleteSelected}
                            className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition-colors"
                        >
                            <i className="fas fa-trash text-[10px]" />
                            {ar ? 'حذف المحدد' : 'Delete selected'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Assets grid / list ───────────────────────────────────────── */}
            {isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="aspect-square rounded-2xl bg-dark-card animate-pulse" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="surface-panel flex flex-col items-center justify-center rounded-2xl py-20 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-dark-bg text-dark-text-secondary">
                        <i className="fas fa-images text-3xl" />
                    </div>
                    <p className="text-base font-semibold text-dark-text-secondary">
                        {searchQuery || filterType !== 'all' || filterSource !== 'all'
                            ? (ar ? 'لا توجد نتائج مطابقة' : 'No matching assets')
                            : (ar ? 'المكتبة فارغة' : 'Library is empty')
                        }
                    </p>
                    <p className="mt-1 text-sm text-dark-text-secondary/60">
                        {ar ? 'ارفع صور أو ولّد بالذكاء الاصطناعي للبدء.' : 'Upload images or generate with AI to get started.'}
                    </p>
                    <div className="mt-5 flex gap-2">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 rounded-xl border border-dark-border px-4 py-2.5 text-sm font-semibold text-dark-text-secondary hover:text-white transition-colors"
                        >
                            <i className="fas fa-upload text-xs" />
                            {ar ? 'رفع صور' : 'Upload'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowAIModal(true)}
                            className="flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white"
                        >
                            <i className="fas fa-wand-magic-sparkles text-xs" />
                            {ar ? 'توليد AI' : 'Generate AI'}
                        </button>
                    </div>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {filtered.map(asset => (
                        <div
                            key={asset.id}
                            className={`group relative overflow-hidden rounded-2xl border-2 cursor-pointer transition-all ${
                                selectedIds.has(asset.id)
                                    ? 'border-brand-primary shadow-[0_0_0_3px_rgba(var(--color-brand-primary),0.2)]'
                                    : 'border-dark-border hover:border-dark-text-secondary/40'
                            }`}
                            onClick={() => setActiveAsset(asset)}
                        >
                            {/* Thumbnail */}
                            <div className="aspect-square bg-dark-card overflow-hidden">
                                {asset.type === 'image' || asset.type === 'logo' ? (
                                    <img
                                        src={asset.thumbnailUrl ?? asset.url}
                                        alt={asset.name}
                                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center text-dark-text-secondary">
                                        <i className={`fas ${TYPE_LABELS[asset.type]?.icon ?? 'fa-file'} text-3xl`} />
                                    </div>
                                )}
                            </div>

                            {/* Overlay on hover */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all" />

                            {/* Select checkbox */}
                            <div
                                className="absolute top-2 start-2"
                                onClick={e => { e.stopPropagation(); toggleSelect(asset.id); }}
                            >
                                <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                                    selectedIds.has(asset.id)
                                        ? 'border-brand-primary bg-brand-primary text-white'
                                        : 'border-white/60 bg-black/40 text-transparent group-hover:border-white'
                                }`}>
                                    <i className="fas fa-check text-[9px]" />
                                </div>
                            </div>

                            {/* Source badge */}
                            <div className={`absolute top-2 end-2 rounded-lg px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm ${SOURCE_LABELS[asset.source]?.color ?? 'text-white bg-black/50'}`}>
                                {ar ? SOURCE_LABELS[asset.source]?.ar : SOURCE_LABELS[asset.source]?.en}
                            </div>

                            {/* Action buttons on hover */}
                            <div
                                className="absolute bottom-0 inset-x-0 translate-y-full group-hover:translate-y-0 transition-transform bg-gradient-to-t from-black/80 to-transparent p-2 flex items-center justify-between gap-1"
                                onClick={e => e.stopPropagation()}
                            >
                                <p className="truncate text-[10px] font-semibold text-white/80 flex-1 me-1">{asset.name}</p>
                                <div className="flex gap-1 flex-shrink-0">
                                    <button
                                        type="button"
                                        title={ar ? 'تنزيل' : 'Download'}
                                        onClick={() => handleDownload(asset)}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
                                    >
                                        <i className="fas fa-download text-[10px]" />
                                    </button>
                                    {onSendToPublisher && (
                                        <button
                                            type="button"
                                            title={ar ? 'إرسال للناشر' : 'Send to Publisher'}
                                            onClick={() => onSendToPublisher({ id: asset.id, type: 'image', url: asset.url, file: new File([], asset.name) })}
                                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-primary/80 text-white hover:bg-brand-primary transition-colors backdrop-blur-sm"
                                        >
                                            <i className="fas fa-paper-plane text-[10px]" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        title={ar ? 'حذف' : 'Delete'}
                                        onClick={() => handleDelete(asset.id)}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600/80 text-white hover:bg-rose-600 transition-colors backdrop-blur-sm"
                                    >
                                        <i className="fas fa-trash text-[10px]" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* List view */
                <div className="surface-panel rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-dark-border bg-dark-bg/60">
                                <th className="px-4 py-3 text-start">
                                    <input
                                        type="checkbox"
                                        checked={filtered.length > 0 && filtered.every(a => selectedIds.has(a.id))}
                                        onChange={selectAll}
                                        className="accent-brand-primary"
                                    />
                                </th>
                                <th className="px-4 py-3 text-start text-xs font-bold uppercase tracking-widest text-dark-text-secondary">
                                    {ar ? 'الأصل' : 'Asset'}
                                </th>
                                <th className="px-4 py-3 text-start text-xs font-bold uppercase tracking-widest text-dark-text-secondary">
                                    {ar ? 'النوع' : 'Type'}
                                </th>
                                <th className="px-4 py-3 text-start text-xs font-bold uppercase tracking-widest text-dark-text-secondary">
                                    {ar ? 'المصدر' : 'Source'}
                                </th>
                                <th className="px-4 py-3 text-start text-xs font-bold uppercase tracking-widest text-dark-text-secondary">
                                    {ar ? 'التاريخ' : 'Date'}
                                </th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {filtered.map(asset => (
                                <tr
                                    key={asset.id}
                                    className={`group transition-colors hover:bg-dark-bg/40 ${selectedIds.has(asset.id) ? 'bg-brand-primary/5' : ''}`}
                                >
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(asset.id)}
                                            onChange={() => toggleSelect(asset.id)}
                                            className="accent-brand-primary"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-dark-bg">
                                                {(asset.type === 'image' || asset.type === 'logo') ? (
                                                    <img src={asset.thumbnailUrl ?? asset.url} alt={asset.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex h-full items-center justify-center text-dark-text-secondary">
                                                        <i className={`fas ${TYPE_LABELS[asset.type]?.icon ?? 'fa-file'} text-sm`} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-white">{asset.name}</p>
                                                {asset.prompt && (
                                                    <p className="truncate text-[11px] text-dark-text-secondary">{asset.prompt.slice(0, 50)}…</p>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="flex items-center gap-1.5 text-xs text-dark-text-secondary">
                                            <i className={`fas ${TYPE_LABELS[asset.type]?.icon ?? 'fa-file'} text-[9px]`} />
                                            {ar ? TYPE_LABELS[asset.type]?.ar : TYPE_LABELS[asset.type]?.en}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${SOURCE_LABELS[asset.source]?.color ?? ''}`}>
                                            {ar ? SOURCE_LABELS[asset.source]?.ar : SOURCE_LABELS[asset.source]?.en}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-dark-text-secondary">
                                        {new Date(asset.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                title={ar ? 'تنزيل' : 'Download'}
                                                onClick={() => handleDownload(asset)}
                                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-dark-border text-dark-text-secondary hover:text-white transition-colors"
                                            >
                                                <i className="fas fa-download text-[10px]" />
                                            </button>
                                            <button
                                                type="button"
                                                title={ar ? 'تعديل الاسم' : 'Rename'}
                                                onClick={() => { setEditingAsset(asset); setEditName(asset.name); }}
                                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-dark-border text-dark-text-secondary hover:text-white transition-colors"
                                            >
                                                <i className="fas fa-pen text-[10px]" />
                                            </button>
                                            {onSendToPublisher && (
                                                <button
                                                    type="button"
                                                    title={ar ? 'إرسال للناشر' : 'Send to Publisher'}
                                                    onClick={() => onSendToPublisher({ id: asset.id, type: 'image', url: asset.url, file: new File([], asset.name) })}
                                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand-primary/30 bg-brand-primary/10 text-brand-secondary hover:bg-brand-primary hover:text-white transition-colors"
                                                >
                                                    <i className="fas fa-paper-plane text-[10px]" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                title={ar ? 'حذف' : 'Delete'}
                                                onClick={() => handleDelete(asset.id)}
                                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors"
                                            >
                                                <i className="fas fa-trash text-[10px]" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Asset detail side panel ──────────────────────────────────── */}
            {activeAsset && (
                <div className="fixed inset-0 z-40 flex" onClick={() => setActiveAsset(null)}>
                    <div className="ms-auto h-full w-full max-w-sm bg-dark-card border-s border-dark-border shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-dark-border">
                            <h3 className="font-bold text-white truncate me-2">{activeAsset.name}</h3>
                            <button onClick={() => setActiveAsset(null)} className="flex-shrink-0 text-dark-text-secondary hover:text-white transition-colors">
                                <i className="fas fa-times" />
                            </button>
                        </div>

                        <div className="p-5 space-y-5">
                            {/* Preview */}
                            <div className="overflow-hidden rounded-xl bg-dark-bg">
                                <img src={activeAsset.url} alt={activeAsset.name} className="w-full object-contain max-h-64" />
                            </div>

                            {/* Meta */}
                            <div className="space-y-2 text-sm divide-y divide-dark-border rounded-xl border border-dark-border overflow-hidden">
                                {[
                                    { label: ar ? 'النوع' : 'Type', value: ar ? TYPE_LABELS[activeAsset.type]?.ar : TYPE_LABELS[activeAsset.type]?.en },
                                    { label: ar ? 'المصدر' : 'Source', value: ar ? SOURCE_LABELS[activeAsset.source]?.ar : SOURCE_LABELS[activeAsset.source]?.en },
                                    activeAsset.aspectRatio && { label: ar ? 'النسبة' : 'Ratio', value: activeAsset.aspectRatio },
                                    { label: ar ? 'التاريخ' : 'Date', value: new Date(activeAsset.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US') },
                                ].filter(Boolean).map(row => row && (
                                    <div key={row.label} className="flex items-center justify-between px-3 py-2.5">
                                        <span className="text-dark-text-secondary">{row.label}</span>
                                        <span className="font-semibold text-white">{row.value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Prompt */}
                            {activeAsset.prompt && (
                                <div className="space-y-1.5">
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-dark-text-secondary">Prompt</p>
                                    <p className="text-xs leading-5 text-dark-text-secondary">{activeAsset.prompt}</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => handleDownload(activeAsset)}
                                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-dark-border py-2.5 text-sm font-semibold text-dark-text-secondary hover:text-white transition-colors"
                                >
                                    <i className="fas fa-download text-xs" />
                                    {ar ? 'تنزيل الصورة' : 'Download Image'}
                                </button>
                                {onSendToPublisher && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onSendToPublisher({ id: activeAsset.id, type: 'image', url: activeAsset.url, file: new File([], activeAsset.name) });
                                            setActiveAsset(null);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-primary py-2.5 text-sm font-bold text-white transition-all hover:opacity-90"
                                    >
                                        <i className="fas fa-paper-plane text-xs" />
                                        {ar ? 'إرسال للناشر' : 'Send to Publisher'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => { setEditingAsset(activeAsset); setEditName(activeAsset.name); setActiveAsset(null); }}
                                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-dark-border py-2.5 text-sm font-semibold text-dark-text-secondary hover:text-white transition-colors"
                                >
                                    <i className="fas fa-pen text-xs" />
                                    {ar ? 'تعديل الاسم' : 'Rename'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { handleDelete(activeAsset.id); setActiveAsset(null); }}
                                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 py-2.5 text-sm font-semibold text-rose-400 hover:bg-rose-500 hover:text-white transition-colors"
                                >
                                    <i className="fas fa-trash text-xs" />
                                    {ar ? 'حذف' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Rename modal ─────────────────────────────────────────────── */}
            {editingAsset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-sm rounded-2xl border border-dark-border bg-dark-card p-6 shadow-2xl">
                        <h3 className="mb-4 font-bold text-white">{ar ? 'تعديل الاسم' : 'Rename Asset'}</h3>
                        <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleRename()}
                            autoFocus
                            className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/60"
                        />
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                onClick={() => setEditingAsset(null)}
                                className="rounded-xl border border-dark-border px-4 py-2 text-sm font-semibold text-dark-text-secondary hover:text-white transition-colors"
                            >
                                {ar ? 'إلغاء' : 'Cancel'}
                            </button>
                            <button
                                onClick={handleRename}
                                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition-opacity"
                            >
                                {ar ? 'حفظ' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── AI Image Generator Modal ─────────────────────────────────── */}
            {showAIModal && (
                <AIImageGeneratorModal
                    onClose={() => { setShowAIModal(false); loadAssets(); }}
                    onAddImage={handleAIImageAdded}
                    brandId={brandId}
                />
            )}
        </div>
    );
};
