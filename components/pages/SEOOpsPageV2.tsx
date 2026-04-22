/**
 * SEOOpsPageV2 — SEO Operating System
 * ─────────────────────────────────────────────────────────────────────────
 * 7-tab OS: Overview · Page Audit · Keyword Ops · Opportunities · Issues · Briefs · Reporting
 * Lumina Axiom design system — always dark, no-border tonal layering.
 * ─────────────────────────────────────────────────────────────────────────
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    getSeoOverviewKPIs, getSeoPages, getSeoIssues, getOpportunities,
    getCannibalizationIssues, getRankingGapPages, getDecayedPages, getOrphanPages,
    getKeywordClusters, getKeywordMap, detectKeywordGaps,
    getContentBriefs, updateBriefStatus, runAutoIssueDetection, updateIssueStatus,
    getSeoBusinessImpact, getChangeLogs, computePageAuditScore,
    type SeoOverviewKPIs, type SeoPage, type SeoIssue, type SeoOpportunity,
    type SeoKeywordMapping, type SeoContentBrief, type SeoBusinessImpactRow,
    type IssueStatus, type BriefStatus, type SeoKeywordCluster, type SeoDataScope,
} from '../../services/seoIntelligenceService';
import { NotificationType } from '../../types';
import { crawlWebsite, type SyncProgress, type CrawlResult } from '../../services/seoSyncService';
import type { BrandHubProfile, SeoArticle } from '../../types';
import type { BrandAsset, BrandConnection } from '../../services/brandConnectionService';
import {
    getReferencedAnalyticsProperty,
    getReferencedSearchConsoleProperty,
    getReferencedWebsite,
    getSavedWordPressCredentials,
} from '../../services/providerConnectionService';
import { exportToWordPress, getSeoArticles, updateSeoArticle } from '../../services/seoOpsService';
import { ProviderConnectionCallout } from '../shared/ProviderConnectionCallout';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

type ActiveTab = 'overview' | 'pages' | 'keywords' | 'opportunities' | 'issues' | 'briefs' | 'reporting' | 'sync';
type WordPressCredentials = NonNullable<ReturnType<typeof getSavedWordPressCredentials>>;

interface SEOOpsPageV2Props {
    brandId:        string;
    brandProfile:   BrandHubProfile;
    addNotification:(type: NotificationType, message: string) => void;
    brandConnections: BrandConnection[];
    brandAssets: BrandAsset | null;
    onNavigate: (page: string) => void;
}

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
    critical: { bg: 'bg-red-500/15',    text: 'text-red-400',    label: 'Critical'  },
    high:     { bg: 'bg-orange-500/15', text: 'text-orange-400', label: 'High'      },
    medium:   { bg: 'bg-yellow-500/15', text: 'text-yellow-400', label: 'Medium'    },
    low:      { bg: 'bg-blue-500/15',   text: 'text-blue-400',   label: 'Low'       },
};

const INTENT_CONFIG: Record<string, { color: string; label: string }> = {
    informational:  { color: 'text-blue-400',   label: 'Info'    },
    navigational:   { color: 'text-purple-400', label: 'Nav'     },
    commercial:     { color: 'text-orange-400', label: 'Comm'    },
    transactional:  { color: 'text-emerald-400',label: 'Trans'   },
};

const OPP_TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
    ranking_gap:          { icon: 'bolt',         label: 'Ranking Gap (5–20)',   color: 'text-yellow-400'  },
    low_ctr:              { icon: 'mouse-pointer', label: 'Low CTR',             color: 'text-orange-400'  },
    high_rank_low_traffic:{ icon: 'trending-up',  label: 'High Rank / Low Clicks', color: 'text-sky-400'  },
    monitor:              { icon: 'eye',           label: 'Monitor',             color: 'text-slate-400'   },
};

function getLatestActiveConnection(
    connections: BrandConnection[],
    provider: BrandConnection['provider'],
): BrandConnection | null {
    return [...connections]
        .filter((connection) => connection.provider === provider && connection.status !== 'disconnected')
        .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED MICRO-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
    label: string;
    value: string | number;
    sub?: string;
    delta?: number;
    icon: string;
    accentColor?: string;
}> = ({ label, value, sub, delta, icon, accentColor = '#2563eb' }) => (
    <div className="rounded-lg p-4" style={{ backgroundColor: '#19202e' }}>
        <div className="flex items-start justify-between mb-3">
            <span className="text-xs" style={{ color: '#c3c6d7' }}>{label}</span>
            <span className="material-symbols-outlined text-base" style={{ color: accentColor, fontSize: '18px' }}>{icon}</span>
        </div>
        <div className="text-2xl font-semibold" style={{ color: '#dce2f6' }}>{value}</div>
        {sub && <div className="text-xs mt-1" style={{ color: '#c3c6d7' }}>{sub}</div>}
        {delta !== undefined && (
            <div className={`text-xs mt-1 font-medium ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% vs prev 30d
            </div>
        )}
    </div>
);

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
    const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.medium;
    return (
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${cfg.bg} ${cfg.text}`}>
            {cfg.label}
        </span>
    );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const map: Record<string, string> = {
        open:        'bg-red-500/15 text-red-400',
        'in-progress':'bg-yellow-500/15 text-yellow-400',
        resolved:    'bg-emerald-500/15 text-emerald-400',
        ignored:     'bg-slate-500/15 text-slate-400',
        'wont-fix':  'bg-slate-500/15 text-slate-400',
        draft:       'bg-slate-500/15 text-slate-400',
        'in-review': 'bg-yellow-500/15 text-yellow-400',
        approved:    'bg-blue-500/15 text-blue-400',
        assigned:    'bg-purple-500/15 text-purple-400',
        'in-progress-brief': 'bg-orange-500/15 text-orange-400',
        published:   'bg-emerald-500/15 text-emerald-400',
    };
    return (
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${map[status] ?? 'bg-slate-500/15 text-slate-400'}`}>
            {status.replace(/-/g, ' ')}
        </span>
    );
};

const EmptyState: React.FC<{ icon: string; title: string; desc: string }> = ({ icon, title, desc }) => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="material-symbols-outlined mb-3" style={{ fontSize: '40px', color: '#434655' }}>{icon}</span>
        <div className="text-base font-medium mb-1" style={{ color: '#dce2f6' }}>{title}</div>
        <div className="text-sm" style={{ color: '#c3c6d7' }}>{desc}</div>
    </div>
);

const LoadingSpinner: React.FC = () => (
    <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-2 border-t-blue-500 rounded-full animate-spin" style={{ borderColor: '#232a39', borderTopColor: '#2563eb' }} />
    </div>
);

const ProgressBar: React.FC<{ value: number; max?: number; color?: string }> = ({ value, max = 100, color = '#2563eb' }) => (
    <div className="h-1 rounded-full w-full" style={{ backgroundColor: '#232a39' }}>
        <div className="h-1 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }} />
    </div>
);

const SectionHeader: React.FC<{ title: string; count?: number; action?: React.ReactNode }> = ({ title, count, action }) => (
    <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
            <span className="text-base font-semibold" style={{ color: '#dce2f6' }}>{title}</span>
            {count !== undefined && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#232a39', color: '#c3c6d7' }}>
                    {count}
                </span>
            )}
        </div>
        {action}
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 — OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────

const OverviewTab: React.FC<{ brandId: string; scope?: SeoDataScope }> = ({ brandId, scope }) => {
    const [kpis, setKpis] = useState<SeoOverviewKPIs | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getSeoOverviewKPIs(brandId, scope).then(data => { setKpis(data); setLoading(false); });
    }, [brandId, scope]);

    if (loading) return <LoadingSpinner />;
    if (!kpis)   return <EmptyState icon="analytics" title="No data yet" desc="Connect Google Search Console to start pulling SEO data." />;

    const hasScData = kpis.totalClicks30d > 0 || kpis.totalImpressions30d > 0;
    const brandedPct = kpis.brandedVsNonBranded.brandedClicks + kpis.brandedVsNonBranded.nonBrandedClicks > 0
        ? Math.round((kpis.brandedVsNonBranded.brandedClicks / (kpis.brandedVsNonBranded.brandedClicks + kpis.brandedVsNonBranded.nonBrandedClicks)) * 100)
        : 0;

    return (
        <div className="space-y-6">
            {/* No SC data banner */}
            {!hasScData && (
                <div className="flex items-start gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: '#1e2d1a', border: '1px solid #2d4a1e' }}>
                    <span className="material-symbols-outlined mt-0.5" style={{ fontSize: '16px', color: '#4edea3' }}>info</span>
                    <div>
                        <p className="text-xs font-medium" style={{ color: '#4edea3' }}>Search Console غير مربوط</p>
                        <p className="text-xs mt-0.5" style={{ color: '#c3c6d7' }}>
                            بيانات الـ Clicks / Impressions / CTR / Position تحتاج ربط Google Search Console.
                            يمكنك الآن مزامنة الموقع من تبويب &quot;مزامنة&quot; لملء بيانات الصفحات والمشاكل.
                        </p>
                    </div>
                </div>
            )}
            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Clicks (30d)"       value={kpis.totalClicks30d.toLocaleString()}       icon="ads_click"     accentColor="#2563eb" />
                <KpiCard label="Impressions (30d)"  value={kpis.totalImpressions30d.toLocaleString()}  icon="visibility"    accentColor="#4cd7f6" />
                <KpiCard label="Avg CTR"            value={`${(kpis.avgCtr30d * 100).toFixed(2)}%`}    icon="percent"       accentColor="#4edea3" />
                <KpiCard label="Avg Position"       value={kpis.avgPosition30d.toFixed(1)}             icon="leaderboard"   accentColor="#a78bfa" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Indexed Pages"  value={kpis.indexedPages}       sub={`${kpis.nonIndexedPages} not indexed`} icon="check_circle"    accentColor="#4edea3" />
                <KpiCard label="Open Issues"    value={kpis.openIssues}         sub={`${kpis.criticalIssues} critical`}      icon="bug_report"      accentColor={kpis.criticalIssues > 0 ? '#f87171' : '#4edea3'} />
                <KpiCard label="Branded Clicks" value={`${brandedPct}%`}        sub={`${kpis.brandedVsNonBranded.brandedClicks.toLocaleString()} clicks`}    icon="brand_awareness" accentColor="#f59e0b" />
                <KpiCard label="Non-Branded"    value={`${100 - brandedPct}%`}  sub={`${kpis.brandedVsNonBranded.nonBrandedClicks.toLocaleString()} clicks`} icon="search"          accentColor="#2563eb" />
            </div>

            {/* Winners & Losers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Winners */}
                <div className="rounded-lg p-4" style={{ backgroundColor: '#151b2a' }}>
                    <SectionHeader title="🏆 Top Winners" count={kpis.topWinners.length} />
                    <div className="space-y-2">
                        {kpis.topWinners.length === 0
                            ? <div className="text-sm py-4 text-center" style={{ color: '#434655' }}>No data yet</div>
                            : kpis.topWinners.map((w, i) => (
                                <div key={i} className="flex items-center justify-between gap-3">
                                    <div className="text-xs truncate flex-1" style={{ color: '#dce2f6' }}>
                                        {w.url.replace(/^https?:\/\/[^/]+/, '') || '/'}
                                    </div>
                                    <span className="text-xs font-medium text-emerald-400">
                                        +{w.clicksDelta.toLocaleString()} clicks
                                    </span>
                                </div>
                            ))
                        }
                    </div>
                </div>

                {/* Losers */}
                <div className="rounded-lg p-4" style={{ backgroundColor: '#151b2a' }}>
                    <SectionHeader title="📉 Top Losers" count={kpis.topLosers.length} />
                    <div className="space-y-2">
                        {kpis.topLosers.length === 0
                            ? <div className="text-sm py-4 text-center" style={{ color: '#434655' }}>No data yet</div>
                            : kpis.topLosers.map((l, i) => (
                                <div key={i} className="flex items-center justify-between gap-3">
                                    <div className="text-xs truncate flex-1" style={{ color: '#dce2f6' }}>
                                        {l.url.replace(/^https?:\/\/[^/]+/, '') || '/'}
                                    </div>
                                    <span className="text-xs font-medium text-red-400">
                                        {l.clicksDelta.toLocaleString()} clicks
                                    </span>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>

            {/* Branded vs Non-Branded bar */}
            <div className="rounded-lg p-4" style={{ backgroundColor: '#151b2a' }}>
                <SectionHeader title="Brand vs Non-Brand Traffic" />
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs" style={{ color: '#c3c6d7' }}>Branded {brandedPct}%</span>
                    <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#19202e' }}>
                        <div className="h-full rounded-full" style={{ width: `${brandedPct}%`, backgroundColor: '#f59e0b' }} />
                    </div>
                    <span className="text-xs" style={{ color: '#c3c6d7' }}>Non-Brand {100 - brandedPct}%</span>
                </div>
                <p className="text-xs mt-2" style={{ color: '#434655' }}>
                    High branded % = strong brand recognition. Low non-branded % = growth opportunity.
                </p>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2 — PAGE AUDIT CENTER
// ─────────────────────────────────────────────────────────────────────────────

const PageAuditTab: React.FC<{ brandId: string; scope?: SeoDataScope }> = ({ brandId, scope }) => {
    const [pages, setPages]       = useState<SeoPage[]>([]);
    const [total, setTotal]       = useState(0);
    const [loading, setLoading]   = useState(true);
    const [search, setSearch]     = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [selected, setSelected] = useState<SeoPage | null>(null);
    const [page, setPage]         = useState(0);
    const PAGE_SIZE = 20;

    const load = useCallback(async () => {
        setLoading(true);
        const result = await getSeoPages(brandId, {
            search:   search || undefined,
            pageType: filterType !== 'all' ? filterType as SeoPage['pageType'] : undefined,
            websiteId: scope?.websiteId ?? undefined,
            limit:    PAGE_SIZE,
            offset:   page * PAGE_SIZE,
        });
        setPages(result.pages);
        setTotal(result.total);
        setLoading(false);
    }, [brandId, search, filterType, page, scope?.websiteId]);

    useEffect(() => { load(); }, [load]);

    const auditColor = (score: number | null) => {
        if (!score) return '#434655';
        if (score >= 80) return '#4edea3';
        if (score >= 60) return '#f59e0b';
        return '#f87171';
    };

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3">
                <input
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(0); }}
                    placeholder="Search URL..."
                    className="flex-1 rounded-md px-3 py-2 text-sm outline-none"
                    style={{ backgroundColor: '#19202e', color: '#dce2f6', border: 'none' }}
                />
                <select
                    value={filterType}
                    onChange={e => { setFilterType(e.target.value); setPage(0); }}
                    className="rounded-md px-3 py-2 text-sm outline-none"
                    style={{ backgroundColor: '#19202e', color: '#dce2f6', border: 'none' }}
                >
                    {['all','homepage','category','product','blog','landing','other'].map(t => (
                        <option key={t} value={t}>{t === 'all' ? 'All types' : t}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            {loading ? <LoadingSpinner /> : pages.length === 0 ? (
                <EmptyState icon="inventory_2" title="No pages found" desc="Add pages to the Page Inventory or run a site crawl." />
            ) : (
                <div>
                    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#151b2a' }}>
                        <table className="w-full text-xs">
                            <thead>
                                <tr style={{ backgroundColor: '#19202e', color: '#c3c6d7' }}>
                                    <th className="text-left px-4 py-3 font-medium">URL</th>
                                    <th className="text-left px-4 py-3 font-medium">Title</th>
                                    <th className="px-3 py-3 font-medium text-right">Score</th>
                                    <th className="px-3 py-3 font-medium text-right">Pos</th>
                                    <th className="px-3 py-3 font-medium text-right">Clicks</th>
                                    <th className="px-3 py-3 font-medium">Index</th>
                                    <th className="px-3 py-3 font-medium">Sitemap</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pages.map(p => {
                                    const computed = p.auditScore ?? computePageAuditScore(p).score;
                                    return (
                                        <tr
                                            key={p.id}
                                            onClick={() => setSelected(p)}
                                            className="cursor-pointer transition-colors"
                                            style={{ borderTop: '1px solid #19202e' }}
                                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#19202e')}
                                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                        >
                                            <td className="px-4 py-2.5 max-w-xs">
                                                <div className="truncate" style={{ color: '#b4c5ff' }}>
                                                    {p.url.replace(/^https?:\/\/[^/]+/, '') || '/'}
                                                </div>
                                                <div className="text-xs mt-0.5" style={{ color: '#434655' }}>{p.pageType}</div>
                                            </td>
                                            <td className="px-4 py-2.5 max-w-xs">
                                                <div className="truncate" style={{ color: p.title ? '#dce2f6' : '#f87171' }}>
                                                    {p.title ?? 'Missing title'}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <span className="font-medium" style={{ color: auditColor(computed) }}>
                                                    {computed}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-right" style={{ color: '#dce2f6' }}>
                                                {p.avgPosition30d?.toFixed(1) ?? '—'}
                                            </td>
                                            <td className="px-3 py-2.5 text-right" style={{ color: '#dce2f6' }}>
                                                {p.clicks30d.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className={`inline-block w-2 h-2 rounded-full ${p.isIndexable ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                            </td>
                                            <td className="px-3 py-2.5">
                                                {p.inSitemap === null  ? <span style={{ color: '#434655' }}>—</span>
                                                : p.inSitemap          ? <span className="text-emerald-400">✓</span>
                                                :                         <span className="text-red-400">✗</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-3">
                        <span className="text-xs" style={{ color: '#434655' }}>
                            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                        </span>
                        <div className="flex gap-2">
                            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                                className="text-xs px-3 py-1 rounded" style={{ backgroundColor: '#232a39', color: '#c3c6d7', opacity: page === 0 ? 0.4 : 1 }}>
                                ← Prev
                            </button>
                            <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total}
                                className="text-xs px-3 py-1 rounded" style={{ backgroundColor: '#232a39', color: '#c3c6d7', opacity: (page + 1) * PAGE_SIZE >= total ? 0.4 : 1 }}>
                                Next →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Page Detail Panel */}
            {selected && (
                <div className="fixed inset-y-0 right-0 w-96 shadow-2xl z-50 overflow-y-auto" style={{ backgroundColor: '#0c1321', borderLeft: '1px solid #232a39' }}>
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <span className="font-semibold text-sm" style={{ color: '#dce2f6' }}>Page Details</span>
                            <button onClick={() => setSelected(null)} style={{ color: '#c3c6d7' }}>
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>

                        <div className="text-xs break-all mb-4" style={{ color: '#b4c5ff' }}>{selected.url}</div>

                        {/* Audit Score */}
                        {(() => {
                            const { score, issues } = computePageAuditScore(selected);
                            return (
                                <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: '#151b2a' }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium" style={{ color: '#c3c6d7' }}>Audit Score</span>
                                        <span className="text-xl font-bold" style={{ color: auditColor(score) }}>{score}</span>
                                    </div>
                                    <ProgressBar value={score} color={auditColor(score)} />
                                    {issues.length > 0 && (
                                        <ul className="mt-3 space-y-1">
                                            {issues.map((iss, i) => (
                                                <li key={i} className="text-xs flex items-start gap-1">
                                                    <span className="text-red-400 mt-0.5">•</span>
                                                    <span style={{ color: '#c3c6d7' }}>{iss}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Fields */}
                        {[
                            { label: 'Title',       value: selected.title,           missing: !selected.title },
                            { label: 'Meta Desc',   value: selected.metaDescription, missing: !selected.metaDescription },
                            { label: 'H1',          value: selected.h1,              missing: !selected.h1 },
                            { label: 'Canonical',   value: selected.canonicalUrl,    missing: !selected.canonicalUrl },
                        ].map(field => (
                            <div key={field.label} className="mb-3">
                                <div className="text-xs mb-1 flex items-center gap-1" style={{ color: '#c3c6d7' }}>
                                    {field.label}
                                    {field.missing && <span className="text-red-400">⚠</span>}
                                </div>
                                <div className="text-xs rounded px-3 py-2 break-words" style={{ backgroundColor: '#151b2a', color: field.missing ? '#434655' : '#dce2f6' }}>
                                    {field.value ?? 'Not set'}
                                </div>
                            </div>
                        ))}

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-2 mt-4">
                            {[
                                { label: 'Clicks',      value: selected.clicks30d.toLocaleString() },
                                { label: 'Impr.',       value: selected.impressions30d.toLocaleString() },
                                { label: 'Position',    value: selected.avgPosition30d?.toFixed(1) ?? '—' },
                            ].map(s => (
                                <div key={s.label} className="rounded p-2 text-center" style={{ backgroundColor: '#151b2a' }}>
                                    <div className="text-xs" style={{ color: '#434655' }}>{s.label}</div>
                                    <div className="text-sm font-medium mt-0.5" style={{ color: '#dce2f6' }}>{s.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3 — KEYWORD OPS
// ─────────────────────────────────────────────────────────────────────────────

const KeywordOpsTab: React.FC<{ brandId: string; addNotification: SEOOpsPageV2Props['addNotification']; scope?: SeoDataScope }> = ({ brandId, addNotification, scope }) => {
    const [clusters, setClusters]       = useState<SeoKeywordCluster[]>([]);
    const [keywords, setKeywords]       = useState<SeoKeywordMapping[]>([]);
    const [gaps, setGaps]               = useState<Awaited<ReturnType<typeof detectKeywordGaps>>>([]);
    const [activeCluster, setActiveCluster] = useState<string | null>(null);
    const [view, setView]               = useState<'map' | 'gaps' | 'cannibal'>('map');
    const [cannibal, setCannibal]       = useState<Awaited<ReturnType<typeof getCannibalizationIssues>>>([]);
    const [loading, setLoading]         = useState(true);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            getKeywordClusters(brandId),
            getKeywordMap(brandId, { limit: 200 }),
        ]).then(([c, k]) => { setClusters(c); setKeywords(k); setLoading(false); });
    }, [brandId]);

    useEffect(() => {
        if (view === 'gaps') {
            detectKeywordGaps(brandId, 50, scope).then(setGaps);
        } else if (view === 'cannibal') {
            getCannibalizationIssues(brandId, scope).then(setCannibal);
        }
    }, [view, brandId, scope]);

    const filtered = activeCluster
        ? keywords.filter(k => k.clusterId === activeCluster)
        : keywords;

    const statusColor = (status: string) => {
        const map: Record<string, string> = { mapped: '#4edea3', candidate: '#c3c6d7', gap: '#f59e0b', cannibal: '#f87171', orphan: '#a78bfa', won: '#4edea3', lost: '#f87171' };
        return map[status] ?? '#c3c6d7';
    };

    const positionColor = (pos: number | null) => {
        if (!pos) return '#434655';
        if (pos <= 3)   return '#4edea3';
        if (pos <= 10)  return '#4cd7f6';
        if (pos <= 20)  return '#f59e0b';
        return '#f87171';
    };

    return (
        <div className="space-y-4">
            {/* View switcher */}
            <div className="flex gap-2">
                {(['map', 'gaps', 'cannibal'] as const).map(v => (
                    <button
                        key={v}
                        onClick={() => setView(v)}
                        className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
                        style={{
                            backgroundColor: view === v ? '#2563eb' : '#19202e',
                            color: view === v ? '#fff' : '#c3c6d7',
                        }}
                    >
                        {v === 'map' ? 'Keyword Map' : v === 'gaps' ? 'Gaps ✦' : 'Cannibalization'}
                    </button>
                ))}
            </div>

            {loading && view === 'map' ? <LoadingSpinner /> : null}

            {/* KEYWORD MAP */}
            {view === 'map' && !loading && (
                <div className="space-y-4">
                    {/* Cluster pills */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setActiveCluster(null)}
                            className="text-xs px-3 py-1 rounded-full transition-colors"
                            style={{ backgroundColor: !activeCluster ? '#2563eb' : '#19202e', color: !activeCluster ? '#fff' : '#c3c6d7' }}
                        >
                            All clusters ({keywords.length})
                        </button>
                        {clusters.map(c => (
                            <button
                                key={c.id}
                                onClick={() => setActiveCluster(c.id === activeCluster ? null : c.id)}
                                className="text-xs px-3 py-1 rounded-full transition-colors"
                                style={{ backgroundColor: activeCluster === c.id ? '#2563eb' : '#19202e', color: activeCluster === c.id ? '#fff' : '#c3c6d7' }}
                            >
                                {c.clusterName}
                            </button>
                        ))}
                    </div>

                    {filtered.length === 0
                        ? <EmptyState icon="key" title="No keywords mapped" desc="Add keywords to clusters and map them to target pages." />
                        : (
                            <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#151b2a' }}>
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr style={{ backgroundColor: '#19202e', color: '#c3c6d7' }}>
                                            <th className="text-left px-4 py-3 font-medium">Keyword</th>
                                            <th className="text-left px-4 py-3 font-medium">Intent</th>
                                            <th className="text-left px-4 py-3 font-medium">Target URL</th>
                                            <th className="px-3 py-3 font-medium text-right">Pos</th>
                                            <th className="px-3 py-3 font-medium text-right">Impr</th>
                                            <th className="px-3 py-3 font-medium text-right">CTR</th>
                                            <th className="px-3 py-3 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(k => (
                                            <tr key={k.id} style={{ borderTop: '1px solid #19202e' }}>
                                                <td className="px-4 py-2.5">
                                                    <div className="font-medium" style={{ color: '#dce2f6' }}>{k.keyword}</div>
                                                    {k.isBranded && <span className="text-xs" style={{ color: '#f59e0b' }}>branded</span>}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span style={{ color: INTENT_CONFIG[k.intent]?.color }}>
                                                        {INTENT_CONFIG[k.intent]?.label ?? k.intent}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 max-w-xs">
                                                    {k.targetUrl
                                                        ? <span className="truncate block" style={{ color: '#b4c5ff' }}>{k.targetUrl.replace(/^https?:\/\/[^/]+/, '')}</span>
                                                        : <span style={{ color: '#f87171' }}>Unmapped</span>
                                                    }
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-medium" style={{ color: positionColor(k.currentPosition) }}>
                                                    {k.currentPosition?.toFixed(1) ?? '—'}
                                                </td>
                                                <td className="px-3 py-2.5 text-right" style={{ color: '#dce2f6' }}>
                                                    {k.impressions30d.toLocaleString()}
                                                </td>
                                                <td className="px-3 py-2.5 text-right" style={{ color: '#c3c6d7' }}>
                                                    {(k.ctr30d * 100).toFixed(2)}%
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <span className="font-medium" style={{ color: statusColor(k.mappingStatus), fontSize: '11px' }}>
                                                        {k.mappingStatus}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    }
                </div>
            )}

            {/* GAPS */}
            {view === 'gaps' && (
                <div className="space-y-3">
                    <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: '#19202e', color: '#c3c6d7' }}>
                        💡 Queries with <strong>50+ impressions</strong> but no mapped target URL. These are your untapped traffic opportunities.
                    </div>
                    {gaps.length === 0 ? <LoadingSpinner /> : (
                        <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#151b2a' }}>
                            <table className="w-full text-xs">
                                <thead>
                                    <tr style={{ backgroundColor: '#19202e', color: '#c3c6d7' }}>
                                        <th className="text-left px-4 py-3 font-medium">Query</th>
                                        <th className="px-3 py-3 font-medium text-right">Impressions</th>
                                        <th className="px-3 py-3 font-medium text-right">Clicks</th>
                                        <th className="px-3 py-3 font-medium text-right">Avg Pos</th>
                                        <th className="px-3 py-3 font-medium text-right">CTR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gaps.slice(0, 50).map((g, i) => (
                                        <tr key={i} style={{ borderTop: '1px solid #19202e' }}>
                                            <td className="px-4 py-2.5" style={{ color: '#dce2f6' }}>{g.query}</td>
                                            <td className="px-3 py-2.5 text-right" style={{ color: '#4cd7f6' }}>{g.impressions.toLocaleString()}</td>
                                            <td className="px-3 py-2.5 text-right" style={{ color: '#dce2f6' }}>{g.clicks.toLocaleString()}</td>
                                            <td className="px-3 py-2.5 text-right" style={{ color: positionColor(g.avgPosition) }}>{g.avgPosition.toFixed(1)}</td>
                                            <td className="px-3 py-2.5 text-right" style={{ color: '#c3c6d7' }}>{(g.ctr * 100).toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* CANNIBALIZATION */}
            {view === 'cannibal' && (
                <div className="space-y-3">
                    <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: '#19202e', color: '#c3c6d7' }}>
                        ⚠️ Queries answered by <strong>2+ different pages</strong> — they compete against each other and split authority.
                    </div>
                    {cannibal.length === 0
                        ? <EmptyState icon="check_circle" title="No cannibalization detected" desc="All your queries are mapped to a single page." />
                        : cannibal.map((c, i) => (
                            <div key={i} className="rounded-lg p-4" style={{ backgroundColor: '#151b2a' }}>
                                <div className="flex items-start justify-between mb-2">
                                    <span className="font-medium text-sm" style={{ color: '#dce2f6' }}>{c.query}</span>
                                    <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#f87171/15', color: '#f87171' }}>
                                        {c.competingPages} pages
                                    </span>
                                </div>
                                <div className="flex gap-4 text-xs mb-3" style={{ color: '#c3c6d7' }}>
                                    <span>{c.totalImpressions.toLocaleString()} impressions</span>
                                    <span>{c.totalClicks.toLocaleString()} clicks</span>
                                    <span>Best pos: {c.bestPosition.toFixed(1)}</span>
                                </div>
                                <div className="space-y-1">
                                    {c.pages.map((url, j) => (
                                        <div key={j} className="text-xs truncate" style={{ color: '#b4c5ff' }}>
                                            → {url.replace(/^https?:\/\/[^/]+/, '')}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    }
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4 — OPPORTUNITIES ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const OpportunitiesTab: React.FC<{ brandId: string; scope?: SeoDataScope }> = ({ brandId, scope }) => {
    const [opps, setOpps]       = useState<SeoOpportunity[]>([]);
    const [rankGaps, setRankGaps] = useState<Awaited<ReturnType<typeof getRankingGapPages>>>([]);
    const [decayed, setDecayed] = useState<Awaited<ReturnType<typeof getDecayedPages>>>([]);
    const [orphans, setOrphans] = useState<SeoPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter]   = useState<SeoOpportunity['opportunityType'] | 'all'>('all');

    useEffect(() => {
        setLoading(true);
        Promise.all([
            getOpportunities(brandId, undefined, scope),
            getRankingGapPages(brandId, scope),
            getDecayedPages(brandId, scope),
            getOrphanPages(brandId, scope),
        ]).then(([o, rg, d, orp]) => {
            setOpps(o); setRankGaps(rg); setDecayed(d); setOrphans(orp);
            setLoading(false);
        });
    }, [brandId, scope]);

    const filteredOpps = filter === 'all' ? opps : opps.filter(o => o.opportunityType === filter);

    const typeCounts = {
        ranking_gap: opps.filter(o => o.opportunityType === 'ranking_gap').length,
        low_ctr:     opps.filter(o => o.opportunityType === 'low_ctr').length,
        high_rank_low_traffic: opps.filter(o => o.opportunityType === 'high_rank_low_traffic').length,
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Ranking Gaps (5–20)" value={typeCounts.ranking_gap} sub="Quick wins with optimization" icon="bolt"         accentColor="#f59e0b" />
                <KpiCard label="Low CTR Pages"        value={typeCounts.low_ctr}     sub="Fix title/meta for more clicks" icon="mouse_pointer" accentColor="#f87171" />
                <KpiCard label="Decayed Pages"        value={decayed.length}         sub=">30% drop in 30d"              icon="trending_down" accentColor="#a78bfa" />
                <KpiCard label="Orphan Pages"         value={orphans.length}         sub="0 internal links in"           icon="link_off"      accentColor="#4cd7f6" />
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-2">
                {(['all', 'ranking_gap', 'low_ctr', 'high_rank_low_traffic'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
                        style={{ backgroundColor: filter === f ? '#2563eb' : '#19202e', color: filter === f ? '#fff' : '#c3c6d7' }}
                    >
                        {f === 'all' ? `All (${opps.length})` : `${OPP_TYPE_CONFIG[f]?.label} (${typeCounts[f as keyof typeof typeCounts] ?? 0})`}
                    </button>
                ))}
            </div>

            {/* Opportunities table */}
            {filteredOpps.length === 0
                ? <EmptyState icon="stars" title="No opportunities yet" desc="Connect Search Console and sync data to detect opportunities." />
                : (
                    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#151b2a' }}>
                        <table className="w-full text-xs">
                            <thead>
                                <tr style={{ backgroundColor: '#19202e', color: '#c3c6d7' }}>
                                    <th className="text-left px-4 py-3 font-medium">Page</th>
                                    <th className="text-left px-4 py-3 font-medium">Type</th>
                                    <th className="px-3 py-3 font-medium text-right">Opp Score</th>
                                    <th className="px-3 py-3 font-medium text-right">Impr</th>
                                    <th className="px-3 py-3 font-medium text-right">CTR</th>
                                    <th className="px-3 py-3 font-medium text-right">Pos</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOpps.map((o, i) => {
                                    const typeCfg = OPP_TYPE_CONFIG[o.opportunityType];
                                    return (
                                        <tr key={i} style={{ borderTop: '1px solid #19202e' }}>
                                            <td className="px-4 py-2.5 max-w-xs">
                                                <div className="truncate" style={{ color: '#b4c5ff' }}>
                                                    {o.pageUrl.replace(/^https?:\/\/[^/]+/, '') || '/'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className="font-medium" style={{ color: typeCfg?.color, fontSize: '11px' }}>
                                                    {typeCfg?.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-semibold" style={{ color: '#4edea3' }}>
                                                {Math.round(o.opportunityScore).toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2.5 text-right" style={{ color: '#dce2f6' }}>
                                                {o.impressions30d.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2.5 text-right" style={{ color: '#c3c6d7' }}>
                                                {(o.ctr * 100).toFixed(2)}%
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-medium">
                                                <span style={{ color: o.avgPosition <= 10 ? '#4edea3' : o.avgPosition <= 20 ? '#f59e0b' : '#f87171' }}>
                                                    {o.avgPosition.toFixed(1)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            }

            {/* Decayed pages */}
            {decayed.length > 0 && (
                <div>
                    <SectionHeader title="📉 Decayed Pages" count={decayed.length} />
                    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#151b2a' }}>
                        <table className="w-full text-xs">
                            <thead>
                                <tr style={{ backgroundColor: '#19202e', color: '#c3c6d7' }}>
                                    <th className="text-left px-4 py-3 font-medium">URL</th>
                                    <th className="px-3 py-3 font-medium text-right">Recent (30d)</th>
                                    <th className="px-3 py-3 font-medium text-right">Older (60-90d)</th>
                                    <th className="px-3 py-3 font-medium text-right">Decay</th>
                                </tr>
                            </thead>
                            <tbody>
                                {decayed.slice(0, 20).map((d, i) => (
                                    <tr key={i} style={{ borderTop: '1px solid #19202e' }}>
                                        <td className="px-4 py-2.5 max-w-xs">
                                            <div className="truncate" style={{ color: '#b4c5ff' }}>
                                                {d.url.replace(/^https?:\/\/[^/]+/, '') || '/'}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-right" style={{ color: '#dce2f6' }}>{d.recentClicks}</td>
                                        <td className="px-3 py-2.5 text-right" style={{ color: '#c3c6d7' }}>{d.olderClicks}</td>
                                        <td className="px-3 py-2.5 text-right font-medium text-red-400">−{d.decayPct}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 5 — ISSUE TRACKER
// ─────────────────────────────────────────────────────────────────────────────

const IssueTrackerTab: React.FC<{ brandId: string; addNotification: SEOOpsPageV2Props['addNotification']; scope?: SeoDataScope }> = ({ brandId, addNotification, scope }) => {
    const [issues, setIssues]       = useState<SeoIssue[]>([]);
    const [loading, setLoading]     = useState(true);
    const [detecting, setDetecting] = useState(false);
    const [filterStatus, setFilterStatus] = useState<IssueStatus | 'all'>('open');
    const [filterType, setFilterType]     = useState<string>('all');

    const load = useCallback(async () => {
        setLoading(true);
        const data = await getSeoIssues(brandId, {
            status: filterStatus === 'all' ? ['open', 'in-progress', 'resolved'] : filterStatus,
            issueType: filterType !== 'all' ? filterType as SeoIssue['issueType'] : undefined,
            websiteId: scope?.websiteId ?? undefined,
            limit: 200,
        });
        setIssues(data);
        setLoading(false);
    }, [brandId, filterStatus, filterType, scope?.websiteId]);

    useEffect(() => { load(); }, [load]);

    const handleAutoDetect = async () => {
        setDetecting(true);
        const { detected, types } = await runAutoIssueDetection(brandId, scope);
        setDetecting(false);
        addNotification(NotificationType.Success, `Auto-detected ${detected} new issues (${Object.entries(types).map(([k, v]) => `${v} ${k}`).join(', ')})`);
        load();
    };

    const handleUpdateStatus = async (id: string, status: IssueStatus) => {
        await updateIssueStatus(id, status);
        setIssues(prev => prev.map(i => i.id === id ? { ...i, status } : i));
        addNotification(NotificationType.Success, `Issue marked as ${status}`);
    };

    const grouped: Record<string, SeoIssue[]> = {};
    for (const issue of issues) {
        const key = issue.issueType;
        grouped[key] = grouped[key] ? [...grouped[key], issue] : [issue];
    }

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-2">
                    {(['all', 'open', 'in-progress', 'resolved'] as const).map(s => (
                        <button key={s} onClick={() => setFilterStatus(s)}
                            className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
                            style={{ backgroundColor: filterStatus === s ? '#2563eb' : '#19202e', color: filterStatus === s ? '#fff' : '#c3c6d7' }}>
                            {s === 'all' ? 'All' : s}
                        </button>
                    ))}
                </div>
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="rounded-md px-3 py-1.5 text-xs outline-none"
                    style={{ backgroundColor: '#19202e', color: '#dce2f6', border: 'none' }}
                >
                    {['all','technical','on-page','content','internal-linking','schema','speed','indexation'].map(t => (
                        <option key={t} value={t}>{t === 'all' ? 'All types' : t}</option>
                    ))}
                </select>
                <button
                    onClick={handleAutoDetect}
                    disabled={detecting}
                    className="ml-auto text-xs px-4 py-1.5 rounded font-medium flex items-center gap-1.5 transition-colors"
                    style={{ backgroundColor: '#232a39', color: '#4edea3' }}
                >
                    {detecting
                        ? <span className="w-3 h-3 border border-t-emerald-400 rounded-full animate-spin" />
                        : <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>search</span>
                    }
                    Auto-Detect Issues
                </button>
            </div>

            {loading ? <LoadingSpinner /> : issues.length === 0 ? (
                <EmptyState icon="check_circle" title="No issues" desc="Run auto-detect or add issues manually." />
            ) : (
                <div className="space-y-4">
                    {Object.entries(grouped).map(([type, typeIssues]) => (
                        <div key={type}>
                            <div className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: '#434655' }}>
                                {type} ({typeIssues.length})
                            </div>
                            <div className="space-y-1">
                                {typeIssues.map(issue => (
                                    <div key={issue.id} className="rounded-lg px-4 py-3 flex items-start gap-3" style={{ backgroundColor: '#151b2a' }}>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <SeverityBadge severity={issue.severity} />
                                                <StatusBadge status={issue.status} />
                                                {issue.autoDetected && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#232a39', color: '#434655' }}>auto</span>
                                                )}
                                            </div>
                                            <div className="text-sm font-medium mb-0.5" style={{ color: '#dce2f6' }}>{issue.title}</div>
                                            {issue.description && (
                                                <div className="text-xs line-clamp-2" style={{ color: '#c3c6d7' }}>{issue.description}</div>
                                            )}
                                            {issue.affectedUrl && (
                                                <div className="text-xs mt-1 truncate" style={{ color: '#b4c5ff' }}>
                                                    {issue.affectedUrl.replace(/^https?:\/\/[^/]+/, '')}
                                                    {issue.affectedCount > 1 && ` +${issue.affectedCount - 1} more`}
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        {issue.status === 'open' && (
                                            <div className="flex gap-1 shrink-0">
                                                <button
                                                    onClick={() => handleUpdateStatus(issue.id, 'in-progress')}
                                                    className="text-xs px-2 py-1 rounded transition-colors"
                                                    style={{ backgroundColor: '#232a39', color: '#f59e0b' }}
                                                    title="Mark in progress"
                                                >
                                                    →
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateStatus(issue.id, 'resolved')}
                                                    className="text-xs px-2 py-1 rounded transition-colors"
                                                    style={{ backgroundColor: '#232a39', color: '#4edea3' }}
                                                    title="Mark resolved"
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateStatus(issue.id, 'ignored')}
                                                    className="text-xs px-2 py-1 rounded transition-colors"
                                                    style={{ backgroundColor: '#232a39', color: '#434655' }}
                                                    title="Ignore"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                        {issue.status === 'in-progress' && (
                                            <button
                                                onClick={() => handleUpdateStatus(issue.id, 'resolved')}
                                                className="text-xs px-3 py-1 rounded font-medium"
                                                style={{ backgroundColor: '#4edea3/15', color: '#4edea3' }}
                                            >
                                                Resolve
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 6 — CONTENT BRIEFS
// ─────────────────────────────────────────────────────────────────────────────

const WordPressExportPanel: React.FC<{
    brandId: string;
    credentials: WordPressCredentials | null;
    websiteLabel?: string | null;
    addNotification: SEOOpsPageV2Props['addNotification'];
}> = ({ brandId, credentials, websiteLabel, addNotification }) => {
    const [articles, setArticles] = useState<SeoArticle[]>([]);
    const [loading, setLoading] = useState(false);
    const [exportingId, setExportingId] = useState<string | null>(null);

    useEffect(() => {
        if (!credentials) {
            setArticles([]);
            return;
        }

        setLoading(true);
        getSeoArticles(brandId).then((rows) => {
            setArticles(rows);
            setLoading(false);
        });
    }, [brandId, credentials]);

    const exportableArticles = articles.filter((article) => article.status !== 'published' || !article.wpPostId);

    const handleExport = useCallback(async (article: SeoArticle) => {
        if (!credentials) {
            return;
        }

        setExportingId(article.id);
        const result = await exportToWordPress(article, credentials);
        if (!result.success) {
            addNotification(NotificationType.Error, result.error ?? 'WordPress export failed.');
            setExportingId(null);
            return;
        }

        await updateSeoArticle(article.id, { status: 'published', wpPostId: result.postId });
        setArticles((prev) => prev.map((row) => row.id === article.id ? { ...row, status: 'published', wpPostId: result.postId } : row));
        addNotification(NotificationType.Success, `Exported "${article.h1}" to WordPress.`);
        setExportingId(null);
    }, [addNotification, credentials]);

    return (
        <div className="rounded-lg p-4" style={{ backgroundColor: '#151b2a' }}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="text-sm font-semibold" style={{ color: '#dce2f6' }}>WordPress Export</div>
                    <div className="text-xs mt-1" style={{ color: '#c3c6d7' }}>
                        {credentials
                            ? `Connected to ${websiteLabel ?? credentials.siteUrl} as ${credentials.username}.`
                            : 'Connect WordPress in Integrations to reuse saved publishing credentials here.'}
                    </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: credentials ? '#1f3a2b' : '#232a39', color: credentials ? '#4edea3' : '#c3c6d7' }}>
                    {credentials ? 'Ready' : 'Not connected'}
                </span>
            </div>

            {!credentials ? null : loading ? (
                <div className="mt-4">
                    <LoadingSpinner />
                </div>
            ) : exportableArticles.length === 0 ? (
                <div className="mt-4 text-xs" style={{ color: '#434655' }}>
                    No draft or ready SEO articles are waiting for export.
                </div>
            ) : (
                <div className="mt-4 space-y-2">
                    {exportableArticles.slice(0, 6).map((article) => (
                        <div key={article.id} className="rounded-lg px-3 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: '#19202e' }}>
                            <div className="min-w-0">
                                <div className="text-sm font-medium truncate" style={{ color: '#dce2f6' }}>{article.h1}</div>
                                <div className="text-xs mt-1" style={{ color: '#c3c6d7' }}>
                                    {article.keyword} · {article.wordCount.toLocaleString()} words · score {article.seoScore}
                                </div>
                            </div>
                            <button
                                onClick={() => handleExport(article)}
                                disabled={exportingId === article.id}
                                className="text-xs px-3 py-1.5 rounded font-medium transition-colors shrink-0"
                                style={{ backgroundColor: '#2563eb', color: '#fff', opacity: exportingId === article.id ? 0.6 : 1 }}
                            >
                                {exportingId === article.id ? 'Exporting...' : 'Export'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ContentBriefsTab: React.FC<{
    brandId: string;
    addNotification: SEOOpsPageV2Props['addNotification'];
    wordPressCredentials: WordPressCredentials | null;
    wordPressWebsiteLabel?: string | null;
}> = ({ brandId, addNotification, wordPressCredentials, wordPressWebsiteLabel }) => {
    const [briefs, setBriefs] = useState<SeoContentBrief[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<SeoContentBrief | null>(null);
    const [filter, setFilter] = useState<BriefStatus | 'all'>('all');

    useEffect(() => {
        setLoading(true);
        getContentBriefs(brandId).then(b => { setBriefs(b); setLoading(false); });
    }, [brandId]);

    const filtered = filter === 'all' ? briefs : briefs.filter(b => b.status === filter);

    const priorityColor = (p: string) => ({
        critical: '#f87171', high: '#f59e0b', medium: '#4cd7f6', low: '#434655'
    }[p] ?? '#434655');

    return (
        <div className="space-y-4">
            <WordPressExportPanel
                brandId={brandId}
                credentials={wordPressCredentials}
                websiteLabel={wordPressWebsiteLabel}
                addNotification={addNotification}
            />

            {/* Status filter */}
            <div className="flex gap-2 flex-wrap">
                {(['all','draft','in-review','approved','assigned','in-progress','published'] as const).map(s => (
                    <button key={s} onClick={() => setFilter(s)}
                        className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
                        style={{ backgroundColor: filter === s ? '#2563eb' : '#19202e', color: filter === s ? '#fff' : '#c3c6d7' }}>
                        {s === 'all' ? `All (${briefs.length})` : s}
                    </button>
                ))}
            </div>

            {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
                <EmptyState icon="edit_note" title="No briefs yet" desc="Create content briefs from keyword opportunities." />
            ) : (
                <div className="space-y-2">
                    {filtered.map(b => (
                        <div
                            key={b.id}
                            onClick={() => setSelected(b)}
                            className="rounded-lg p-4 cursor-pointer transition-colors"
                            style={{ backgroundColor: '#151b2a' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#19202e')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#151b2a')}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <StatusBadge status={b.status} />
                                        <span className="text-xs font-medium" style={{ color: priorityColor(b.priority) }}>
                                            {b.priority}
                                        </span>
                                        <span className="text-xs" style={{ color: INTENT_CONFIG[b.searchIntent]?.color }}>
                                            {INTENT_CONFIG[b.searchIntent]?.label}
                                        </span>
                                    </div>
                                    <div className="font-medium text-sm mb-1" style={{ color: '#dce2f6' }}>{b.targetKeyword}</div>
                                    {b.clusterName && (
                                        <div className="text-xs" style={{ color: '#434655' }}>Cluster: {b.clusterName}</div>
                                    )}
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-xs" style={{ color: '#c3c6d7' }}>{b.wordCountTarget.toLocaleString()} words</div>
                                    {b.dueDate && <div className="text-xs mt-0.5" style={{ color: '#434655' }}>{b.dueDate}</div>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Brief detail panel */}
            {selected && (
                <div className="fixed inset-y-0 right-0 w-[480px] shadow-2xl z-50 overflow-y-auto" style={{ backgroundColor: '#0c1321', borderLeft: '1px solid #232a39' }}>
                    <div className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <span className="font-semibold" style={{ color: '#dce2f6' }}>Content Brief</span>
                            <button onClick={() => setSelected(null)} style={{ color: '#c3c6d7' }}>
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="text-xs mb-1" style={{ color: '#434655' }}>Target Keyword</div>
                                <div className="text-lg font-semibold" style={{ color: '#dce2f6' }}>{selected.targetKeyword}</div>
                            </div>

                            {selected.suggestedTitle && (
                                <div>
                                    <div className="text-xs mb-1" style={{ color: '#434655' }}>Suggested Title</div>
                                    <div className="text-sm rounded px-3 py-2" style={{ backgroundColor: '#151b2a', color: '#dce2f6' }}>{selected.suggestedTitle}</div>
                                </div>
                            )}

                            {selected.suggestedMeta && (
                                <div>
                                    <div className="text-xs mb-1" style={{ color: '#434655' }}>Meta Description</div>
                                    <div className="text-sm rounded px-3 py-2" style={{ backgroundColor: '#151b2a', color: '#c3c6d7' }}>{selected.suggestedMeta}</div>
                                </div>
                            )}

                            {selected.h2Suggestions.length > 0 && (
                                <div>
                                    <div className="text-xs mb-2" style={{ color: '#434655' }}>H2 Structure ({selected.h2Suggestions.length})</div>
                                    <div className="space-y-1">
                                        {selected.h2Suggestions.map((h, i) => (
                                            <div key={i} className="text-sm rounded px-3 py-2" style={{ backgroundColor: '#151b2a', color: '#dce2f6' }}>
                                                {i + 1}. {h.text}
                                                {h.keyword && <span className="ml-2 text-xs" style={{ color: '#2563eb' }}>[{h.keyword}]</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selected.faqSuggestions.length > 0 && (
                                <div>
                                    <div className="text-xs mb-2" style={{ color: '#434655' }}>FAQ ({selected.faqSuggestions.length})</div>
                                    <div className="space-y-2">
                                        {selected.faqSuggestions.map((f, i) => (
                                            <div key={i} className="rounded px-3 py-2" style={{ backgroundColor: '#151b2a' }}>
                                                <div className="text-xs font-medium mb-0.5" style={{ color: '#dce2f6' }}>Q: {f.question}</div>
                                                {f.answer_hint && <div className="text-xs" style={{ color: '#c3c6d7' }}>Hint: {f.answer_hint}</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selected.internalLinksSuggestions.length > 0 && (
                                <div>
                                    <div className="text-xs mb-2" style={{ color: '#434655' }}>Internal Links</div>
                                    <div className="space-y-1">
                                        {selected.internalLinksSuggestions.map((l, i) => (
                                            <div key={i} className="text-xs rounded px-3 py-1.5" style={{ backgroundColor: '#151b2a', color: '#b4c5ff' }}>
                                                "{l.anchor}" → {l.target_url}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 pt-2">
                                {(['in-review','approved','published'] as BriefStatus[]).map(s => (
                                    <button
                                        key={s}
                                        onClick={async () => {
                                            await updateBriefStatus(selected.id, s);
                                            setSelected({ ...selected, status: s });
                                            setBriefs(prev => prev.map(b => b.id === selected.id ? { ...b, status: s } : b));
                                            addNotification(NotificationType.Success, `Brief moved to ${s}`);
                                        }}
                                        className="text-xs px-3 py-1.5 rounded font-medium"
                                        style={{ backgroundColor: '#232a39', color: '#c3c6d7' }}
                                    >
                                        → {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 7 — REPORTING (Business Impact)
// ─────────────────────────────────────────────────────────────────────────────

const ReportingTab: React.FC<{ brandId: string; scope?: SeoDataScope }> = ({ brandId, scope }) => {
    const [data, setData]     = useState<SeoBusinessImpactRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getSeoBusinessImpact(brandId, scope).then(d => { setData(d); setLoading(false); });
    }, [brandId, scope]);

    const totalRevenue     = data.reduce((s, r) => s + r.revenue30d, 0);
    const totalConversions = data.reduce((s, r) => s + r.conversions30d, 0);
    const totalClicks      = data.reduce((s, r) => s + r.seoClicks30d, 0);
    const totalSessions    = data.reduce((s, r) => s + r.sessions30d, 0);

    if (loading) return <LoadingSpinner />;

    return (
        <div className="space-y-6">
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Revenue (30d)"       value={`$${totalRevenue.toLocaleString()}`}    icon="payments"      accentColor="#4edea3" />
                <KpiCard label="Conversions (30d)"   value={totalConversions.toLocaleString()}        icon="conversion_path" accentColor="#2563eb" />
                <KpiCard label="SEO Sessions (30d)"  value={totalSessions.toLocaleString()}           icon="group"         accentColor="#4cd7f6" />
                <KpiCard label="SEO Clicks (30d)"    value={totalClicks.toLocaleString()}             icon="ads_click"     accentColor="#a78bfa" />
            </div>

            {data.length === 0 ? (
                <EmptyState icon="bar_chart" title="No revenue data" desc="Connect GA4 and sync analytics data to see SEO's business impact." />
            ) : (
                <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#151b2a' }}>
                    <div className="px-4 py-3" style={{ backgroundColor: '#19202e' }}>
                        <span className="text-sm font-semibold" style={{ color: '#dce2f6' }}>SEO → Revenue by Page</span>
                    </div>
                    <table className="w-full text-xs">
                        <thead>
                            <tr style={{ backgroundColor: '#19202e', color: '#c3c6d7' }}>
                                <th className="text-left px-4 py-2 font-medium">Page</th>
                                <th className="px-3 py-2 font-medium text-right">SEO Clicks</th>
                                <th className="px-3 py-2 font-medium text-right">Sessions</th>
                                <th className="px-3 py-2 font-medium text-right">Revenue</th>
                                <th className="px-3 py-2 font-medium text-right">Rev/Session</th>
                                <th className="px-3 py-2 font-medium text-right">CVR</th>
                                <th className="px-3 py-2 font-medium text-right">Pos</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row, i) => {
                                const cvr = row.sessions30d > 0
                                    ? ((row.conversions30d / row.sessions30d) * 100).toFixed(2)
                                    : '0.00';
                                return (
                                    <tr key={i} style={{ borderTop: '1px solid #19202e' }}>
                                        <td className="px-4 py-2.5 max-w-xs">
                                            <div className="truncate" style={{ color: '#b4c5ff' }}>
                                                {row.pageUrl.replace(/^https?:\/\/[^/]+/, '') || '/'}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-right" style={{ color: '#dce2f6' }}>{row.seoClicks30d.toLocaleString()}</td>
                                        <td className="px-3 py-2.5 text-right" style={{ color: '#dce2f6' }}>{row.sessions30d.toLocaleString()}</td>
                                        <td className="px-3 py-2.5 text-right font-semibold" style={{ color: row.revenue30d > 0 ? '#4edea3' : '#434655' }}>
                                            ${row.revenue30d.toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2.5 text-right" style={{ color: '#c3c6d7' }}>
                                            ${row.revenuePerSession.toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right" style={{ color: '#c3c6d7' }}>{cvr}%</td>
                                        <td className="px-3 py-2.5 text-right" style={{ color: '#c3c6d7' }}>
                                            {row.avgPosition30d.toFixed(1)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 8 — SITE SYNC
// ─────────────────────────────────────────────────────────────────────────────

interface SiteSyncTabProps {
    brandId: string;
    scopedWebsiteUrl: string | null;
    addNotification: (type: NotificationType, message: string) => void;
}

const SiteSyncTab: React.FC<SiteSyncTabProps> = ({ brandId, scopedWebsiteUrl, addNotification }) => {
    const [url, setUrl]           = useState(scopedWebsiteUrl ?? '');
    const [maxPages, setMaxPages] = useState(50);
    const [running, setRunning]   = useState(false);
    const [progress, setProgress] = useState<SyncProgress | null>(null);
    const [result, setResult]     = useState<CrawlResult | null>(null);

    const run = async () => {
        if (!url.trim()) { addNotification(NotificationType.Error, 'أدخل رابط الموقع أولاً'); return; }
        setRunning(true); setResult(null);
        try {
            const res = await crawlWebsite(url.trim(), brandId, (p) => setProgress({ ...p }), maxPages);
            setResult(res);
            addNotification(NotificationType.Success, `مزامنة اكتملت: ${res.pagesAudited} صفحة، ${res.issuesFound} مشكلة`);
        } catch (e) {
            addNotification(NotificationType.Error, 'فشلت المزامنة: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setRunning(false);
        }
    };

    const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

    const STEPS = [
        { icon: 'robot_2',      label: '1. robots.txt', phases: ['sitemap', 'audit', 'save', 'issues', 'done'] },
        { icon: 'account_tree', label: '2. Sitemap',    phases: ['audit', 'save', 'issues', 'done'] },
        { icon: 'speed',        label: '3. PageSpeed',  phases: ['save', 'issues', 'done'] },
        { icon: 'save',         label: '4. حفظ',        phases: ['done'] },
    ];

    return (
        <div className="max-w-2xl mx-auto space-y-6 py-4">
            {/* Config panel */}
            <div className="rounded-lg p-5" style={{ backgroundColor: '#151b2a' }}>
                <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#2563eb' }}>travel_explore</span>
                    <span className="text-base font-semibold" style={{ color: '#dce2f6' }}>مزامنة الموقع</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#1e3a5f', color: '#4cd7f6' }}>جديد</span>
                </div>
                <p className="text-xs mb-5" style={{ color: '#c3c6d7' }}>
                    يجلب المحرك robots.txt → sitemap.xml → PageSpeed Insights لكل صفحة ويحفظ البيانات تلقائيًا في قاعدة البيانات.
                </p>

                <div className="flex gap-2 mb-4">
                    <input
                        type="url"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !running && void run()}
                        placeholder="https://example.com"
                        disabled={running}
                        className="flex-1 text-sm rounded px-3 py-2 outline-none"
                        style={{ backgroundColor: '#19202e', color: '#dce2f6', border: '1px solid #232a39' }}
                    />
                    <select
                        value={maxPages}
                        onChange={e => setMaxPages(Number(e.target.value))}
                        disabled={running}
                        className="text-xs rounded px-2 py-2"
                        style={{ backgroundColor: '#19202e', color: '#c3c6d7', border: '1px solid #232a39' }}
                    >
                        <option value={10}>10 صفحات</option>
                        <option value={25}>25 صفحة</option>
                        <option value={50}>50 صفحة</option>
                        <option value={100}>100 صفحة</option>
                    </select>
                    <button
                        onClick={() => void run()}
                        disabled={running || !url.trim()}
                        className="px-4 py-2 rounded text-xs font-semibold"
                        style={{ backgroundColor: running ? '#1e3a5f' : '#2563eb', color: '#fff', opacity: running || !url.trim() ? 0.6 : 1 }}
                    >
                        {running ? 'جارٍ...' : 'ابدأ المزامنة'}
                    </button>
                </div>

                {/* Algorithm steps indicator */}
                <div className="grid grid-cols-4 gap-2">
                    {STEPS.map(step => {
                        const done  = progress ? step.phases.includes(progress.phase) : false;
                        const color = done ? '#4edea3' : '#434655';
                        return (
                            <div key={step.label} className="rounded p-2 text-center" style={{ backgroundColor: '#19202e' }}>
                                <span className="material-symbols-outlined block mb-1" style={{ fontSize: '18px', color }}>{step.icon}</span>
                                <span className="text-xs" style={{ color }}>{step.label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Progress panel */}
            {(running || (progress && progress.phase !== 'done' && progress.phase !== 'error')) && (
                <div className="rounded-lg p-5" style={{ backgroundColor: '#151b2a' }}>
                    <div className="flex justify-between text-xs mb-2" style={{ color: '#c3c6d7' }}>
                        <span>{progress?.message ?? 'جارٍ التهيئة...'}</span>
                        <span>{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full mb-4" style={{ backgroundColor: '#19202e' }}>
                        <div
                            className="h-2 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%`, backgroundColor: '#2563eb' }}
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded p-2" style={{ backgroundColor: '#19202e' }}>
                            <div className="text-xl font-bold" style={{ color: '#4cd7f6' }}>{progress?.pagesDiscovered ?? 0}</div>
                            <div className="text-xs mt-0.5" style={{ color: '#434655' }}>اكتُشفت</div>
                        </div>
                        <div className="rounded p-2" style={{ backgroundColor: '#19202e' }}>
                            <div className="text-xl font-bold" style={{ color: '#4edea3' }}>{progress?.pagesAudited ?? 0}</div>
                            <div className="text-xs mt-0.5" style={{ color: '#434655' }}>فُحصت</div>
                        </div>
                        <div className="rounded p-2" style={{ backgroundColor: '#19202e' }}>
                            <div className="text-xl font-bold" style={{ color: '#f87171' }}>{progress?.issuesFound ?? 0}</div>
                            <div className="text-xs mt-0.5" style={{ color: '#434655' }}>مشكلة</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Result panel */}
            {result && (
                <div className="rounded-lg p-5" style={{ backgroundColor: '#151b2a' }}>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#4edea3' }}>check_circle</span>
                        <span className="text-sm font-semibold" style={{ color: '#dce2f6' }}>اكتملت المزامنة</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center mb-4">
                        <div className="rounded p-3" style={{ backgroundColor: '#19202e' }}>
                            <div className="text-2xl font-bold" style={{ color: '#4cd7f6' }}>{result.pagesAudited}</div>
                            <div className="text-xs mt-1" style={{ color: '#c3c6d7' }}>صفحة فُحصت</div>
                        </div>
                        <div className="rounded p-3" style={{ backgroundColor: '#19202e' }}>
                            <div className="text-2xl font-bold" style={{ color: '#f87171' }}>{result.issuesFound}</div>
                            <div className="text-xs mt-1" style={{ color: '#c3c6d7' }}>مشكلة مكتشفة</div>
                        </div>
                        <div className="rounded p-3" style={{ backgroundColor: '#19202e' }}>
                            <div className="text-2xl font-bold" style={{ color: '#a78bfa' }}>{result.pagesFailed}</div>
                            <div className="text-xs mt-1" style={{ color: '#c3c6d7' }}>فشل في الفحص</div>
                        </div>
                    </div>
                    <p className="text-xs" style={{ color: '#434655' }}>
                        انتقل إلى تبويب «Page Audit» أو «Issues» لمراجعة النتائج التفصيلية.
                    </p>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

const TABS: Array<{ id: ActiveTab; label: string; icon: string }> = [
    { id: 'overview',      label: 'Overview',      icon: 'dashboard'     },
    { id: 'pages',         label: 'Page Audit',    icon: 'inventory_2'   },
    { id: 'keywords',      label: 'Keyword Ops',   icon: 'key'           },
    { id: 'opportunities', label: 'Opportunities', icon: 'bolt'          },
    { id: 'issues',        label: 'Issues',        icon: 'bug_report'    },
    { id: 'briefs',        label: 'Briefs',        icon: 'edit_note'     },
    { id: 'reporting',     label: 'Reporting',     icon: 'bar_chart'     },
    { id: 'sync',          label: 'مزامنة',         icon: 'travel_explore' },
];

const SEOOpsPageV2: React.FC<SEOOpsPageV2Props> = ({
    brandId,
    brandProfile,
    addNotification,
    brandConnections,
    brandAssets,
    onNavigate,
}) => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
    const searchConsoleConnection = useMemo(
        () => getLatestActiveConnection(brandConnections, 'search_console'),
        [brandConnections],
    );
    const ga4Connection = useMemo(
        () => getLatestActiveConnection(brandConnections, 'ga4'),
        [brandConnections],
    );
    const wordPressConnection = useMemo(
        () => getLatestActiveConnection(brandConnections, 'wordpress'),
        [brandConnections],
    );

    const referencedSearchConsoleProperty = useMemo(
        () => getReferencedSearchConsoleProperty(searchConsoleConnection, brandAssets),
        [brandAssets, searchConsoleConnection],
    );
    const referencedAnalyticsProperty = useMemo(
        () => getReferencedAnalyticsProperty(ga4Connection, brandAssets),
        [brandAssets, ga4Connection],
    );
    const wordPressWebsite = useMemo(
        () => getReferencedWebsite(wordPressConnection, brandAssets, 'wordpress'),
        [brandAssets, wordPressConnection],
    );
    const searchConsoleWebsite = useMemo(
        () => getReferencedWebsite(searchConsoleConnection, brandAssets),
        [brandAssets, searchConsoleConnection],
    );
    const ga4Website = useMemo(
        () => getReferencedWebsite(ga4Connection, brandAssets),
        [brandAssets, ga4Connection],
    );
    const scopedWebsite = useMemo(
        () => wordPressWebsite
            ?? searchConsoleWebsite
            ?? ga4Website
            ?? brandAssets?.websites.find((website) => website.is_primary)
            ?? brandAssets?.websites[0]
            ?? null,
        [brandAssets, ga4Website, searchConsoleWebsite, wordPressWebsite],
    );
    const seoScope = useMemo<SeoDataScope>(() => ({
        searchConsoleConnectionId: searchConsoleConnection?.id ?? null,
        analyticsConnectionId: ga4Connection?.id ?? null,
        searchConsolePropertyId: referencedSearchConsoleProperty?.id ?? null,
        analyticsPropertyId: referencedAnalyticsProperty?.id ?? null,
        websiteId: scopedWebsite?.id ?? null,
        websiteUrl: scopedWebsite?.url ?? referencedSearchConsoleProperty?.site_url ?? null,
    }), [ga4Connection, referencedAnalyticsProperty, referencedSearchConsoleProperty, scopedWebsite, searchConsoleConnection]);
    const wordPressCredentials = useMemo(
        () => wordPressConnection ? getSavedWordPressCredentials(wordPressConnection) : null,
        [wordPressConnection],
    );
    const wordPressWebsiteLabel = wordPressWebsite?.url ?? scopedWebsite?.url ?? wordPressCredentials?.siteUrl ?? null;

    return (
        <div className="flex flex-col h-full" style={{ backgroundColor: '#0c1321', color: '#dce2f6' }}>
            {/* Header */}
            <div className="px-6 pt-5 pb-0" style={{ backgroundColor: '#0c1321' }}>
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h1 className="text-xl font-semibold" style={{ color: '#dce2f6' }}>SEO Ops</h1>
                        <p className="text-xs mt-0.5" style={{ color: '#434655' }}>
                            {brandProfile.brandName} · Detect → Prioritize → Assign → Fix → Validate → Measure
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#434655' }}>sync</span>
                        <span className="text-xs" style={{ color: '#434655' }}>Data from Search Console + GA4</span>
                    </div>
                </div>

                <div className="mb-4 grid gap-4 md:grid-cols-2">
                    <ProviderConnectionCallout
                        title="Search Console"
                        description="حالة مزود البحث العضوي المستخدم للانطباعات والظهور في SEO Ops."
                        connection={searchConsoleConnection}
                        brandAssets={brandAssets}
                        emptyTitle="Search Console غير مربوط بعد"
                        emptyDescription="اربط Search Console من مساحة التكاملات لكي تتوقف هذه الشاشة عن الاعتماد على حالة مفصولة."
                        primaryActionLabel="فتح مساحة التكاملات"
                        onPrimaryAction={() => onNavigate('integrations')}
                        secondaryActionLabel="تحديث SEO Ops"
                        onSecondaryAction={() => onNavigate('seo-ops')}
                    />
                    <ProviderConnectionCallout
                        title="GA4"
                        description="حالة المزود التحليلي المستخدم في ربط SEO بالأثر التجاري."
                        connection={ga4Connection}
                        brandAssets={brandAssets}
                        emptyTitle="GA4 غير مربوط بعد"
                        emptyDescription="اربط GA4 من مساحة التكاملات لكي تظهر الخاصية المحفوظة ويظهر الأثر التجاري في تقارير SEO."
                        primaryActionLabel="فتح مساحة التكاملات"
                        onPrimaryAction={() => onNavigate('integrations')}
                        secondaryActionLabel="فتح Analytics"
                        onSecondaryAction={() => onNavigate('analytics')}
                    />
                </div>

                {/* Tab bar */}
                <div className="flex gap-1 overflow-x-auto" style={{ borderBottom: '1px solid #19202e' }}>
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors relative"
                            style={{
                                color:           activeTab === tab.id ? '#b4c5ff' : '#c3c6d7',
                                backgroundColor: 'transparent',
                                borderBottom:    activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                                marginBottom:    '-1px',
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
                {activeTab === 'overview'      && <OverviewTab       brandId={brandId} scope={seoScope} />}
                {activeTab === 'pages'         && <PageAuditTab      brandId={brandId} scope={seoScope} />}
                {activeTab === 'keywords'      && <KeywordOpsTab     brandId={brandId} addNotification={addNotification} scope={seoScope} />}
                {activeTab === 'opportunities' && <OpportunitiesTab  brandId={brandId} scope={seoScope} />}
                {activeTab === 'issues'        && <IssueTrackerTab   brandId={brandId} addNotification={addNotification} scope={seoScope} />}
                {activeTab === 'briefs'        && <ContentBriefsTab  brandId={brandId} addNotification={addNotification} wordPressCredentials={wordPressCredentials} wordPressWebsiteLabel={wordPressWebsiteLabel} />}
                {activeTab === 'reporting'     && <ReportingTab      brandId={brandId} scope={seoScope} />}
                {activeTab === 'sync'          && <SiteSyncTab       brandId={brandId} scopedWebsiteUrl={seoScope.websiteUrl} addNotification={addNotification} />}
                {activeTab === 'sync'          && <SiteSyncTab       brandId={brandId} scopedWebsiteUrl={seoScope.websiteUrl} addNotification={addNotification} />}
            </div>
        </div>
    );
};

export default SEOOpsPageV2;
