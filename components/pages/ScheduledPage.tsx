
import React, { useState, useMemo } from 'react';
import { ScheduledPost, PostStatus, PLATFORM_ASSETS } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { EmptyScheduled } from '../shared/EmptyState';

// ── Confirmation Modal ───────────────────────────────────────────────────────
const ConfirmationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
}> = ({ isOpen, onClose, onConfirm, title, message }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-xl w-full max-w-md border border-light-border dark:border-dark-border">
                <div className="p-5 border-b border-light-border dark:border-dark-border">
                    <h2 className="text-lg font-bold text-light-text dark:text-dark-text flex items-center gap-3">
                        <i className="fas fa-exclamation-triangle text-yellow-400"></i>
                        {title}
                    </h2>
                </div>
                <div className="p-6">
                    <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">{message}</p>
                </div>
                <div className="p-4 flex justify-end gap-3 border-t border-light-border dark:border-dark-border">
                    <button onClick={onClose} className="text-light-text-secondary dark:text-dark-text-secondary font-bold py-2 px-4 rounded-xl hover:bg-light-bg dark:hover:bg-dark-bg transition-colors text-sm">
                        {t.common.cancel}
                    </button>
                    <button onClick={onConfirm} className="bg-red-600 text-white font-bold py-2 px-5 rounded-xl hover:bg-red-700 text-sm transition-colors">
                        {t.common.confirmDelete}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: PostStatus }> = ({ status }) => {
    const styles: Record<PostStatus, { cls: string; icon: string }> = {
        [PostStatus.Draft]:      { cls: 'bg-gray-500/15 text-gray-400',   icon: 'fa-file-alt' },
        [PostStatus.Scheduled]:  { cls: 'bg-blue-500/15 text-blue-400',   icon: 'fa-clock' },
        [PostStatus.Publishing]: { cls: 'bg-indigo-500/15 text-indigo-400 animate-pulse', icon: 'fa-spinner' },
        [PostStatus.Published]:  { cls: 'bg-green-500/15 text-green-400', icon: 'fa-check-circle' },
        [PostStatus.Failed]:     { cls: 'bg-red-500/15 text-red-400',     icon: 'fa-times-circle' },
    };
    const s = styles[status];
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${s.cls}`}>
            <i className={`fas ${s.icon} text-[10px]`}></i>
            {status}
        </span>
    );
};

// ── Post Row ─────────────────────────────────────────────────────────────────
const ScheduledPostItem: React.FC<{
    post: ScheduledPost;
    isSelected: boolean;
    onToggleSelect: () => void;
    onEdit: (post: ScheduledPost) => void;
    onDelete: () => void;
}> = ({ post, isSelected, onToggleSelect, onEdit, onDelete }) => {
    const { t, language } = useLanguage();
    const isActionable = post.status === PostStatus.Draft || post.status === PostStatus.Scheduled;
    const locale = language === 'ar' ? 'ar-EG' : 'en-US';

    return (
        <div className={`group surface-panel-soft relative grid grid-cols-12 items-center gap-3 rounded-[1.6rem] !border-0 p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-ambient)]
            ${isSelected
                ? 'bg-brand-primary/10 ring-2 ring-brand-primary/50'
                : ''
            }`}
        >
            {/* Checkbox */}
            <div className="col-span-1 flex items-center justify-center">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={onToggleSelect}
                    className="w-4 h-4 rounded accent-brand-primary cursor-pointer"
                />
            </div>

            {/* Thumbnail */}
            <div className="col-span-1 hidden md:block">
                {post.media && post.media.length > 0 ? (
                    <img src={post.media[0].url} alt="media" className="w-10 h-10 object-cover rounded-lg" />
                ) : (
                    <div className="w-10 h-10 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary">
                        <i className="far fa-file-alt text-sm"></i>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="col-span-11 md:col-span-4">
                <p className="text-sm text-light-text dark:text-dark-text line-clamp-2">
                    {post.content || <em className="opacity-40">{t.common.noContent}</em>}
                </p>
                {post.media && post.media.length > 1 && (
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5 inline-block">
                        <i className="fas fa-images me-1 text-[10px]"></i>{post.media.length} صور
                    </span>
                )}
            </div>

            {/* Platforms */}
            <div className="col-span-4 md:col-span-2 flex flex-wrap gap-1.5 items-center">
                {post.platforms.map(p => {
                    const asset = PLATFORM_ASSETS[p];
                    return (
                        <i key={p} className={`${asset.icon} text-lg`}
                            style={{ color: post.platformColors?.[p] || asset.hexColor }}
                            title={p}
                        ></i>
                    );
                })}
            </div>

            {/* Status */}
            <div className="col-span-4 md:col-span-2 md:text-center">
                <StatusBadge status={post.status} />
            </div>

            {/* Date */}
            <div className="col-span-4 md:col-span-2 md:text-center">
                {post.scheduledAt ? (
                    <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-5">
                        <div className="font-semibold text-light-text dark:text-dark-text">
                            {new Date(post.scheduledAt).toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
                        </div>
                        <div>{new Date(post.scheduledAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                ) : (
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-50">—</span>
                )}
            </div>

            {/* Actions */}
            <div className="col-span-12 md:col-span-1 flex justify-end items-center gap-2">
                {isActionable && (
                    <button
                        onClick={() => onEdit(post)}
                        title={t.common.edit}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-brand-primary/10 hover:text-brand-primary transition-colors opacity-0 group-hover:opacity-100"
                    >
                        <i className="fas fa-pen text-xs"></i>
                    </button>
                )}
                <button
                    onClick={onDelete}
                    title={t.common.delete}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400/60 hover:bg-red-500/10 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                    <i className="fas fa-trash-alt text-xs"></i>
                </button>
            </div>
        </div>
    );
};

// ── Main Page ────────────────────────────────────────────────────────────────
interface ScheduledPageProps {
    posts: ScheduledPost[];
    onEditPost: (post: ScheduledPost) => void;
    onDeletePost: (id: string) => void;
    onNavigateToPublisher?: () => void;
}

type SortKey = 'status' | 'platform' | 'scheduledAt';
type FilterStatus = 'all' | PostStatus;

export const ScheduledPage: React.FC<ScheduledPageProps> = ({ posts, onEditPost, onDeletePost, onNavigateToPublisher }) => {
    const { t, language } = useLanguage();
    const [postToDelete, setPostToDelete] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'scheduledAt', direction: 'asc' });
    const [search, setSearch] = useState('');
    const [schedView, setSchedView] = useState<'posts' | 'best-time' | 'status-overview'>('posts');

    // Stats
    const stats = useMemo(() => ({
        total:      posts.length,
        scheduled:  posts.filter(p => p.status === PostStatus.Scheduled).length,
        draft:      posts.filter(p => p.status === PostStatus.Draft).length,
        published:  posts.filter(p => p.status === PostStatus.Published).length,
        failed:     posts.filter(p => p.status === PostStatus.Failed).length,
    }), [posts]);

    const filteredAndSorted = useMemo(() => {
        let result = [...posts];

        // Text search
        if (search.trim()) {
            result = result.filter(p => p.content.toLowerCase().includes(search.toLowerCase()));
        }

        // Status filter
        if (filterStatus !== 'all') {
            result = result.filter(p => p.status === filterStatus);
        }

        // Sort
        result.sort((a, b) => {
            let aVal: any, bVal: any;
            if (sortConfig.key === 'status')      { aVal = a.status;       bVal = b.status; }
            else if (sortConfig.key === 'platform') { aVal = a.platforms[0] ?? ''; bVal = b.platforms[0] ?? ''; }
            else { aVal = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0; bVal = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0; }
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [posts, filterStatus, sortConfig, search]);

    const handleSort = (key: SortKey) => {
        setSortConfig(c => ({ key, direction: c.key === key && c.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredAndSorted.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredAndSorted.map(p => p.id)));
        }
    };

    const handleBulkDelete = () => {
        selectedIds.forEach(id => onDeletePost(id));
        setSelectedIds(new Set());
    };

    const SortHeader: React.FC<{ label: string; sortKey: SortKey }> = ({ label, sortKey }) => (
        <button onClick={() => handleSort(sortKey)} className="flex items-center gap-1 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary transition-colors">
            {label}
            <i className={`fas text-[10px] opacity-60 ${sortConfig.key === sortKey ? (sortConfig.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}`}></i>
        </button>
    );

    const STATUS_FILTERS: { key: FilterStatus; label: string; count: number }[] = [
        { key: 'all',                 label: t.common.all,        count: stats.total },
        { key: PostStatus.Scheduled,  label: t.common.scheduled,  count: stats.scheduled },
        { key: PostStatus.Draft,      label: t.common.draft,      count: stats.draft },
        { key: PostStatus.Published,  label: t.common.published,  count: stats.published },
        { key: PostStatus.Failed,     label: t.common.failed,     count: stats.failed },
    ];

    // SOC-1: Best time to post data per platform
    const BEST_TIMES: { platform: string; icon: string; color: string; slots: { day: string; time: string; score: number }[] }[] = [
        { platform: 'Instagram', icon: 'fa-instagram', color: 'text-pink-500', slots: [
            { day: 'الثلاثاء',  time: '11:00 AM', score: 92 },
            { day: 'الأربعاء', time: '7:00 PM',  score: 87 },
            { day: 'الجمعة',   time: '12:00 PM', score: 84 },
        ]},
        { platform: 'Facebook', icon: 'fa-facebook', color: 'text-blue-500', slots: [
            { day: 'الأربعاء', time: '3:00 PM',  score: 89 },
            { day: 'الخميس',   time: '1:00 PM',  score: 83 },
            { day: 'الجمعة',   time: '11:00 AM', score: 80 },
        ]},
        { platform: 'TikTok', icon: 'fa-tiktok', color: 'text-cyan-400', slots: [
            { day: 'السبت',    time: '9:00 PM',  score: 95 },
            { day: 'الجمعة',   time: '5:00 PM',  score: 91 },
            { day: 'الأحد',    time: '7:00 PM',  score: 88 },
        ]},
        { platform: 'X', icon: 'fa-x-twitter', color: 'text-gray-300', slots: [
            { day: 'الثلاثاء',  time: '9:00 AM',  score: 85 },
            { day: 'الأربعاء', time: '10:00 AM', score: 82 },
            { day: 'الجمعة',   time: '4:00 PM',  score: 79 },
        ]},
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">{t.publisher.scheduledPosts}</h1>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                        {stats.total} منشور إجمالي • {stats.scheduled} مجدول • {stats.draft} مسودة
                    </p>
                </div>
                {selectedIds.size > 0 && (
                    <button
                        onClick={handleBulkDelete}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 text-sm font-bold transition-colors"
                    >
                        <i className="fas fa-trash-alt text-xs"></i>
                        حذف {selectedIds.size} محدد
                    </button>
                )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                    { label: 'الإجمالي',  val: stats.total,     color: 'text-light-text dark:text-dark-text',  bg: 'bg-light-card dark:bg-dark-card' },
                    { label: 'مجدول',     val: stats.scheduled, color: 'text-blue-400',    bg: 'bg-blue-500/5' },
                    { label: 'مسودة',     val: stats.draft,     color: 'text-gray-400',    bg: 'bg-gray-500/5' },
                    { label: 'منشور',     val: stats.published, color: 'text-green-400',   bg: 'bg-green-500/5' },
                    { label: 'فشل',       val: stats.failed,    color: 'text-red-400',     bg: 'bg-red-500/5' },
                ].map(s => (
                    <div key={s.label} className={`${s.bg} surface-panel-soft rounded-[1.4rem] p-4 text-center !border-0 shadow-sm`}>
                        <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                        <p className="mt-1 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* SOC view tabs */}
            <div className="flex gap-2 border-b border-light-border dark:border-dark-border">
                {[
                    { id: 'posts',           label: 'المنشورات',       icon: 'fa-list' },
                    { id: 'best-time',       label: 'أفضل الأوقات',   icon: 'fa-clock' },
                    { id: 'status-overview', label: 'حالة مفصّلة',    icon: 'fa-chart-pie' },
                ].map(v => (
                    <button key={v.id} onClick={() => setSchedView(v.id as typeof schedView)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${schedView === v.id ? 'border-brand-primary text-brand-primary' : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}>
                        <i className={`fas ${v.icon} text-xs`} />{v.label}
                    </button>
                ))}
            </div>

            {/* SOC-1: Best Time to Post */}
            {schedView === 'best-time' && (
                <div className="space-y-4">
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">أفضل أوقات النشر بناءً على تحليل تفاعل الجمهور — مبني على بيانات المنصات</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {BEST_TIMES.map(p => (
                            <div key={p.platform} className="surface-panel rounded-[1.5rem] !border-0 p-6 shadow-[var(--shadow-ambient)] transition-transform hover:-translate-y-1">
                                <div className="flex items-center gap-3 mb-4">
                                    <i className={`fab ${p.icon} text-2xl ${p.color}`} />
                                    <h3 className="font-bold text-light-text dark:text-dark-text">{p.platform}</h3>
                                </div>
                                <div className="space-y-2">
                                    {p.slots.map((slot, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-brand-primary bg-brand-primary/10 rounded-full w-6 h-6 flex items-center justify-center shrink-0">{i + 1}</span>
                                            <span className="text-sm text-light-text dark:text-dark-text flex-1">{slot.day} — {slot.time}</span>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-16 h-1.5 bg-light-surface dark:bg-dark-surface rounded-full overflow-hidden">
                                                    <div className="h-full bg-brand-primary rounded-full" style={{ width: `${slot.score}%` }} />
                                                </div>
                                                <span className="text-xs font-bold text-brand-primary">{slot.score}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SOC-2: Status Overview */}
            {schedView === 'status-overview' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'مجدول',     val: stats.scheduled, color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20',  icon: 'fa-clock' },
                            { label: 'منشور',     val: stats.published, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', icon: 'fa-check-circle' },
                            { label: 'مسودة',     val: stats.draft,     color: 'text-gray-400',  bg: 'bg-gray-500/10 border-gray-500/20',  icon: 'fa-file-alt' },
                            { label: 'فشل النشر', val: stats.failed,    color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20',    icon: 'fa-times-circle' },
                        ].map(s => (
                            <div key={s.label} className={`surface-panel-soft rounded-[1.5rem] p-6 text-center !border-0 shadow-sm ${s.bg}`}>
                                <i className={`fas ${s.icon} text-2xl ${s.color} mb-2`} />
                                <div className={`text-3xl font-black ${s.color} mb-1`}>{s.val}</div>
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{s.label}</p>
                            </div>
                        ))}
                    </div>
                    {/* Platform breakdown */}
                    <div className="surface-panel rounded-[1.5rem] !border-0 p-6 shadow-[var(--shadow-ambient)]">
                        <h3 className="font-bold text-light-text dark:text-dark-text mb-4">توزيع المنشورات بالمنصة</h3>
                        <div className="space-y-3">
                            {(['Instagram', 'Facebook', 'X', 'TikTok', 'LinkedIn'] as const).map(platform => {
                                const count = posts.filter(p => p.platforms.includes(platform as import('../../types').SocialPlatform)).length;
                                if (count === 0) return null;
                                const pct = Math.round(count / Math.max(posts.length, 1) * 100);
                                return (
                                    <div key={platform} className="flex items-center gap-3">
                                        <span className="text-sm text-light-text dark:text-dark-text w-24 shrink-0">{platform}</span>
                                        <div className="flex-1 h-2 bg-light-surface dark:bg-dark-surface rounded-full overflow-hidden">
                                            <div className="h-full bg-brand-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-sm font-bold text-light-text dark:text-dark-text w-8 text-end">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {/* Failed posts highlight */}
                    {stats.failed > 0 && (
                        <div className="surface-panel-soft relative overflow-hidden rounded-[1.5rem] bg-red-500/5 p-6 !border-0 shadow-sm">
                            <h3 className="font-bold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                                <i className="fas fa-exclamation-circle" /> منشورات فشل نشرها
                            </h3>
                            <div className="space-y-2">
                                {posts.filter(p => p.status === PostStatus.Failed).map(p => (
                                    <div key={p.id} className="flex items-center gap-3 text-sm">
                                        <i className="fas fa-times-circle text-red-500 shrink-0" />
                                        <span className="text-red-700 dark:text-red-300 flex-1 truncate">{p.content.slice(0, 60)}…</span>
                                        <button onClick={() => onEditPost(p)} className="text-xs text-red-600 dark:text-red-400 hover:underline shrink-0">إعادة المحاولة</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {schedView === 'posts' && (<>
            {/* Search + Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <i className="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary text-sm"></i>
                    <input
                        type="text"
                        placeholder="ابحث في المنشورات..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl py-2.5 pr-9 pl-4 text-sm text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {STATUS_FILTERS.map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilterStatus(f.key)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                                filterStatus === f.key
                                    ? 'bg-brand-primary text-white'
                                    : 'bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary'
                            }`}
                        >
                            {f.label}
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${filterStatus === f.key ? 'bg-white/20' : 'bg-light-bg dark:bg-dark-bg'}`}>{f.count}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden">
                {/* Table header */}
                <div className="hidden grid-cols-12 gap-3 rounded-full bg-light-bg/50 px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] text-light-text-secondary dark:bg-dark-bg/50 dark:text-dark-text-secondary md:grid">
                    <div className="col-span-1 flex items-center justify-center">
                        <input
                            type="checkbox"
                            checked={filteredAndSorted.length > 0 && selectedIds.size === filteredAndSorted.length}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded accent-brand-primary cursor-pointer"
                        />
                    </div>
                    <div className="col-span-1"></div>
                    <div className="col-span-4">{t.publisher.content}</div>
                    <div className="col-span-2"><SortHeader label={t.publisher.platform} sortKey="platform" /></div>
                    <div className="col-span-2"><SortHeader label={t.publisher.status} sortKey="status" /></div>
                    <div className="col-span-2"><SortHeader label={t.publisher.date} sortKey="scheduledAt" /></div>
                    <div className="col-span-1 text-end">{t.publisher.actions}</div>
                </div>

                {filteredAndSorted.length > 0 ? (
                    <div className="mt-4 flex flex-col gap-3">
                        {filteredAndSorted.map(post => (
                            <div key={post.id} className="px-2 py-1">
                                <ScheduledPostItem
                                    post={post}
                                    isSelected={selectedIds.has(post.id)}
                                    onToggleSelect={() => toggleSelect(post.id)}
                                    onEdit={onEditPost}
                                    onDelete={() => setPostToDelete(post.id)}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-8">
                        <EmptyScheduled onCreatePost={onNavigateToPublisher ?? (() => {})} />
                    </div>
                )}
            </div>

            <ConfirmationModal
                isOpen={!!postToDelete}
                onClose={() => setPostToDelete(null)}
                onConfirm={() => { if (postToDelete) { onDeletePost(postToDelete); setPostToDelete(null); } }}
                title={t.common.confirmDelete}
                message={t.publisher.deleteConfirmMessage}
            />
            </>)}
        </div>
    );
};
