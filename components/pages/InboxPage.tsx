// components/pages/InboxPage.tsx — Unified Social Inbox v2
// Full rebuild: smart views, status/priority, CRM actions, order creation, keyword tags

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    InboxConversation, NotificationType, PLATFORM_ASSETS,
    BrandHubProfile, ConversationIntent, ConversationSentiment,
    ConversationStatus, ConversationPriority, SocialPlatform, SkillType,
    InboxItemType, ReplyMode, OpportunityStage,
} from '../../types';
import {
    getConversations, getConversation, replyToConversation, markConversationRead,
    updateConversationStatus, updateConversationPriority,
    addConversationTag, removeConversationTag, persistConversationAnalysis,
    getConversationNotes, addConversationNote,
    createCrmLeadFromConversation, createOrderFromInboxConversation,
    getSocialMessagesAsConversations, markSocialMessageRead,
    ConversationNote,
} from '../../services/inboxService';
import { analyzeConversation } from '../../services/geminiService';
import { syncInboxFromSocial, sendInboxReply, SyncResponse } from '../../services/inboxSyncService';
import { supabase } from '../../services/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';
import { useBrandStore } from '../../stores/brandStore';
import { PageScaffold, PageSection } from '../shared/PageScaffold';
import { EvaluationButtons } from '../shared/EvaluationButtons';
import {
    getBrandAgentConfig, shouldAutoReply, logAgentAction,
    BrandAgentConfig, DEFAULT_BRAND_AGENT_CONFIG, AgentReplyDecision,
} from '../../services/brandAgentService';
import { BrandAgentPanel } from '../shared/BrandAgentPanel';
import { ShiftModeManager } from '../shared/ShiftModeManager';
import { getConversationContext } from '../../services/crmInboxService';
import type { CrmConversationContext } from '../../services/crmInboxService';

// ── Types & Constants ─────────────────────────────────────────────────────────

interface InboxPageProps {
    addNotification: (type: NotificationType, message: string) => void;
    brandId: string;
    brandProfile: BrandHubProfile;
    conversations: InboxConversation[]; // initial fallback — page fetches its own data
    onAddTask: (title: string, description: string) => void;
    onNavigate?: (page: string) => void;
}

type SmartViewKey =
    | 'all' | 'unread' | 'needs-reply'
    | 'hot-leads' | 'price-inquiry' | 'order-intent' | 'complaints'
    | 'ad-comments' | 'follow-up-today' | 'lost-opportunities'
    | 'resolved' | 'spam' | 'archived';

type InboxTab = 'inbox' | 'templates' | 'keywords';
type ActionPanelTab = 'ai' | 'crm' | 'notes';

interface SavedReplyTemplate { id: string; title: string; body: string; category: string }

const DEFAULT_TEMPLATES: SavedReplyTemplate[] = [
    { id: 't1', title: 'ترحيب عام',          category: 'عام',     body: 'أهلاً وسهلاً! نشكرك على تواصلك معنا. كيف يمكننا مساعدتك؟' },
    { id: 't2', title: 'شكر على الاستفسار',   category: 'عام',     body: 'شكراً لاستفسارك! سيتم الرد عليك خلال 24 ساعة.' },
    { id: 't3', title: 'رد على شكوى',         category: 'دعم',     body: 'نعتذر منك على هذا الإزعاج. سنقوم بمتابعة موضوعك فوراً وإيجاد حل مناسب.' },
    { id: 't4', title: 'تأكيد استلام الطلب',  category: 'مبيعات', body: 'تم استلام طلبك بنجاح! سيصلك التأكيد عبر البريد الإلكتروني خلال لحظات.' },
    { id: 't5', title: 'عرض خاص',             category: 'مبيعات', body: 'لدينا عرض حصري لك! استخدم الكود SPECIAL20 للحصول على خصم 20% على طلبك.' },
    { id: 't6', title: 'طلب تقييم',           category: 'متابعة', body: 'نأمل أن تكون تجربتك معنا ممتازة! هل يمكنك تقييم خدمتنا لمساعدتنا في التحسين؟' },
];

const INTENT_CONFIG: Record<ConversationIntent, { color: string; icon: string }> = {
    [ConversationIntent.PurchaseInquiry]: { color: 'text-green-400', icon: 'fa-shopping-cart' },
    [ConversationIntent.GeneralQuestion]: { color: 'text-blue-400', icon: 'fa-question-circle' },
    [ConversationIntent.Complaint]:       { color: 'text-red-400',   icon: 'fa-exclamation-triangle' },
    [ConversationIntent.Feedback]:        { color: 'text-yellow-400', icon: 'fa-star' },
    [ConversationIntent.Spam]:            { color: 'text-gray-500',  icon: 'fa-ban' },
    [ConversationIntent.Unknown]:         { color: 'text-gray-400',  icon: 'fa-question' },
};

const INTENT_ARABIC: Record<ConversationIntent, string> = {
    [ConversationIntent.PurchaseInquiry]: '🛒 استفسار شراء',
    [ConversationIntent.GeneralQuestion]: '❓ سؤال عام',
    [ConversationIntent.Complaint]:       '⚠️ شكوى',
    [ConversationIntent.Feedback]:        '⭐ ملاحظة',
    [ConversationIntent.Spam]:            '🚫 سبام',
    [ConversationIntent.Unknown]:         '💬 عام',
};

const SENTIMENT_CONFIG: Record<ConversationSentiment, { label: string; color: string; icon: string }> = {
    positive: { label: 'إيجابي',  color: 'text-green-500',  icon: 'fa-face-smile' },
    neutral:  { label: 'محايد',   color: 'text-slate-500',  icon: 'fa-face-meh' },
    negative: { label: 'سلبي',    color: 'text-red-500',    icon: 'fa-face-frown' },
};

const STATUS_CONFIG: Record<ConversationStatus, { label: string; color: string; bg: string; icon: string }> = {
    open:     { label: 'مفتوح',    color: 'text-blue-600',  bg: 'bg-blue-50 dark:bg-blue-900/30',   icon: 'fa-circle-dot' },
    pending:  { label: 'معلق',     color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/30', icon: 'fa-clock' },
    resolved: { label: 'محلول',    color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/30', icon: 'fa-circle-check' },
    spam:     { label: 'سبام',     color: 'text-gray-500',  bg: 'bg-gray-50 dark:bg-gray-900/30',   icon: 'fa-ban' },
    archived: { label: 'أرشيف',    color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/30', icon: 'fa-box-archive' },
};

const PRIORITY_CONFIG: Record<ConversationPriority, { label: string; dot: string }> = {
    urgent: { label: 'عاجل',    dot: 'bg-red-500' },
    high:   { label: 'مرتفع',   dot: 'bg-orange-400' },
    medium: { label: 'متوسط',   dot: 'bg-blue-400' },
    low:    { label: 'منخفض',   dot: 'bg-gray-400' },
};

// Lead score → visual band
function leadScoreConfig(score: number): { label: string; color: string; bg: string } {
    if (score >= 80) return { label: 'عالي جدا', color: 'text-green-700 dark:text-green-300', bg: 'bg-green-100 dark:bg-green-900/40' };
    if (score >= 60) return { label: 'مرتفع',   color: 'text-blue-700 dark:text-blue-300',   bg: 'bg-blue-100 dark:bg-blue-900/40'   };
    if (score >= 40) return { label: 'متوسط',   color: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-100 dark:bg-yellow-900/40' };
    return                  { label: 'منخفض',   color: 'text-gray-500 dark:text-gray-400',   bg: 'bg-gray-100 dark:bg-gray-800'       };
}

const ITEM_TYPE_CONFIG: Record<InboxItemType, { label: string; icon: string; color: string }> = {
    dm:                 { label: 'رسالة خاصة',     icon: 'fa-envelope',          color: 'text-blue-500'    },
    facebook_comment:   { label: 'تعليق Facebook', icon: 'fa-comment',           color: 'text-blue-600'    },
    instagram_comment:  { label: 'تعليق Instagram', icon: 'fa-comment-dots',     color: 'text-pink-500'    },
    ad_comment:         { label: 'تعليق إعلان',    icon: 'fa-bullhorn',          color: 'text-orange-500'  },
    mention:            { label: 'إشارة',           icon: 'fa-at',               color: 'text-purple-500'  },
    story_reply:        { label: 'رد Story',        icon: 'fa-film',             color: 'text-rose-500'    },
};

// These configs are reserved for future CRM opportunity & next-action panels
// const OPPORTUNITY_STAGES = ...
// const NEXT_ACTION_CONFIG = ...

const TAG_COLORS: Record<string, string> = {
    'hot-lead':      'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    'price-inquiry': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    'order-intent':  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    'complaint':     'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    'support':       'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    'delivery':      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
    'default':       'bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary',
};

function tagColor(tag: string) {
    return TAG_COLORS[tag] ?? TAG_COLORS['default'];
}

// ── Smart Views Sidebar ───────────────────────────────────────────────────────

const SmartViewsSidebar: React.FC<{
    conversations: InboxConversation[];
    activeView: SmartViewKey;
    activePlatform: 'all' | SocialPlatform;
    onViewChange: (v: SmartViewKey) => void;
    onPlatformChange: (p: 'all' | SocialPlatform) => void;
    onSync: () => void;
    syncing: boolean;
}> = ({ conversations, activeView, activePlatform, onViewChange, onPlatformChange, onSync, syncing }) => {

    const counts = useMemo(() => {
        const now = new Date();
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        const all = conversations.filter(c => c.status !== 'archived' && c.status !== 'spam');
        return {
            all:          all.length,
            unread:       conversations.filter(c => !c.isRead).length,
            'needs-reply':  conversations.filter(c =>
                c.status !== 'archived' && c.status !== 'spam' &&
                c.messages.at(-1)?.sender === 'user' && !c.isRead
            ).length,
            'hot-leads':  conversations.filter(c =>
                c.intent === ConversationIntent.PurchaseInquiry || c.tags?.includes('hot-lead')
            ).length,
            'price-inquiry': conversations.filter(c =>
                c.tags?.includes('price-inquiry')
            ).length,
            'order-intent': conversations.filter(c =>
                c.tags?.includes('order-intent')
            ).length,
            complaints:   conversations.filter(c =>
                c.intent === ConversationIntent.Complaint || c.tags?.includes('complaint')
            ).length,
            'ad-comments': conversations.filter(c =>
                c.itemType === 'ad_comment' || c.adCampaignId
            ).length,
            'follow-up-today': conversations.filter(c =>
                (c.followups ?? []).some(f => f.status === 'pending' && new Date(f.dueAt) <= todayEnd)
            ).length,
            'lost-opportunities': conversations.filter(c =>
                (c.leadScore ?? 0) >= 60 &&
                !c.tags?.includes('order-created') &&
                c.status !== 'resolved' &&
                c.messages.at(-1)?.sender === 'user'
            ).length,
            resolved:     conversations.filter(c => c.status === 'resolved').length,
            spam:         conversations.filter(c => c.status === 'spam').length,
            archived:     conversations.filter(c => c.status === 'archived').length,
        };
    }, [conversations]);

    const platformCounts = useMemo(() => {
        const map: Record<string, number> = {};
        conversations.forEach(c => {
            if (c.status !== 'archived') map[c.platform] = (map[c.platform] || 0) + 1;
        });
        return map;
    }, [conversations]);

    const views: { key: SmartViewKey; label: string; icon: string; urgent?: boolean; group?: string }[] = [
        { key: 'all',                 label: 'الكل',               icon: 'fa-inbox',                 group: 'inbox' },
        { key: 'unread',              label: 'غير مقروء',          icon: 'fa-envelope',              group: 'inbox', urgent: counts.unread > 0 },
        { key: 'needs-reply',         label: 'يحتاج رد',           icon: 'fa-reply',                 group: 'inbox', urgent: counts['needs-reply'] > 0 },
        { key: 'hot-leads',           label: 'ليدز حارة',          icon: 'fa-fire',                  group: 'sales' },
        { key: 'price-inquiry',       label: 'استفسار سعر',        icon: 'fa-tag',                   group: 'sales' },
        { key: 'order-intent',        label: 'طلبات شراء',         icon: 'fa-cart-shopping',         group: 'sales' },
        { key: 'ad-comments',         label: 'تعليقات إعلانات',    icon: 'fa-bullhorn',              group: 'sales', urgent: counts['ad-comments'] > 0 },
        { key: 'lost-opportunities',  label: 'فرص ضائعة',          icon: 'fa-circle-exclamation',    group: 'sales', urgent: counts['lost-opportunities'] > 0 },
        { key: 'follow-up-today',     label: 'متابعة اليوم',       icon: 'fa-clock-rotate-left',     group: 'sales', urgent: counts['follow-up-today'] > 0 },
        { key: 'complaints',          label: 'شكاوى',              icon: 'fa-triangle-exclamation',  group: 'support' },
        { key: 'resolved',            label: 'محلولة',             icon: 'fa-circle-check',          group: 'support' },
        { key: 'spam',                label: 'سبام',               icon: 'fa-ban',                   group: 'support' },
        { key: 'archived',            label: 'الأرشيف',            icon: 'fa-box-archive',           group: 'support' },
    ];

    return (
        <div className="w-52 bg-light-card dark:bg-dark-card border-e border-light-border dark:border-dark-border flex-shrink-0 flex flex-col">
            <div className="p-4 border-b border-light-border dark:border-dark-border">
                <h1 className="text-base font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                    <i className="fas fa-inbox text-brand-primary text-sm" />
                    الصندوق الموحد
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
                {/* Smart views grouped */}
                {(['inbox', 'sales', 'support'] as const).map(group => {
                    const groupViews = views.filter(v => v.group === group);
                    const groupLabels = { inbox: 'الصندوق', sales: 'المبيعات', support: 'الدعم' };
                    return (
                        <div key={group} className="px-2 mb-2">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary px-3 py-1.5 opacity-60">
                                {groupLabels[group]}
                            </p>
                            <div className="space-y-0.5">
                                {groupViews.map(v => {
                                    const count = counts[v.key as keyof typeof counts] ?? 0;
                                    const isActive = activeView === v.key && activePlatform === 'all';
                                    return (
                                        <button
                                            key={v.key}
                                            onClick={() => { onViewChange(v.key); onPlatformChange('all'); }}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-right text-sm transition-colors
                                                ${isActive
                                                    ? 'bg-brand-primary/10 text-brand-primary font-semibold'
                                                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg hover:text-light-text dark:hover:text-dark-text'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <i className={`fas ${v.icon} w-4 text-center text-xs ${isActive ? '' : 'opacity-70'}`} />
                                                <span className="text-xs">{v.label}</span>
                                                {v.urgent && !isActive && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-pink animate-pulse" />
                                                )}
                                            </div>
                                            {count > 0 && (
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center
                                                    ${isActive ? 'bg-brand-primary text-white' : 'bg-light-bg dark:bg-dark-bg'}`}>
                                                    {count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {/* Platform filter */}
                {Object.keys(platformCounts).length > 0 && (
                    <div className="mt-4 px-2">
                        <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest px-3 mb-1">المنصات</p>
                        {(['all', ...Object.values(SocialPlatform)] as ('all' | SocialPlatform)[])
                            .filter(p => p === 'all' || platformCounts[p])
                            .map(p => {
                                const cnt = p === 'all'
                                    ? Object.values(platformCounts).reduce((a, b) => a + b, 0)
                                    : (platformCounts[p] || 0);
                                const isActive = activePlatform === p;
                                return (
                                    <button
                                        key={p}
                                        onClick={() => { onPlatformChange(p); if (p !== 'all') onViewChange('all'); }}
                                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-right text-xs transition-colors
                                            ${isActive
                                                ? 'bg-brand-primary/10 text-brand-primary font-semibold'
                                                : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {p === 'all'
                                                ? <i className="fas fa-layer-group w-4 text-center opacity-70" />
                                                : <i className={`${PLATFORM_ASSETS[p].icon} w-4 text-center`}
                                                     style={{ color: PLATFORM_ASSETS[p].hexColor }} />
                                            }
                                            <span>{p === 'all' ? 'كل المنصات' : p}</span>
                                        </div>
                                        {cnt > 0 && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-brand-primary text-white' : 'bg-light-bg dark:bg-dark-bg'}`}>
                                                {cnt}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                    </div>
                )}
            </div>

            {/* Sync button footer */}
            <div className="p-3 border-t border-light-border dark:border-dark-border flex-shrink-0">
                <button
                    onClick={onSync}
                    disabled={syncing}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary hover:bg-brand-primary/5 disabled:opacity-50 transition-colors"
                >
                    <i className={`fas ${syncing ? 'fa-spinner animate-spin' : 'fa-rotate-right'} text-xs`} />
                    {syncing ? 'جاري المزامنة...' : 'مزامنة الرسائل'}
                </button>
            </div>
        </div>
    );
};

// ── Conversation Card ─────────────────────────────────────────────────────────

const ConversationCard: React.FC<{
    conv: InboxConversation;
    isActive: boolean;
    onClick: () => void;
}> = ({ conv, isActive, onClick }) => {
    const { language } = useLanguage();
    const asset = PLATFORM_ASSETS[conv.platform];
    const lastMsg = conv.messages.at(-1);
    const isUnread = !conv.isRead;
    const status = conv.status ?? 'open';
    const priority = conv.priority ?? 'medium';
    const tags = conv.tags ?? [];
    const priorityCfg = PRIORITY_CONFIG[priority];
    const statusCfg = STATUS_CONFIG[status];

    const needsReply = lastMsg?.sender === 'user' && isUnread;
    const leadScore = conv.leadScore ?? 0;
    const scoreCfg = leadScoreConfig(leadScore);
    const itemType = conv.itemType;
    const isAdComment = itemType === 'ad_comment';

    return (
        <button
            onClick={onClick}
            className={`w-full text-right p-3 border-b border-light-border dark:border-dark-border flex items-start gap-3 transition-colors
                ${isActive
                    ? 'bg-brand-primary/10 border-s-2 border-s-brand-primary'
                    : isUnread
                        ? 'bg-brand-pink/5 hover:bg-brand-pink/10'
                        : 'hover:bg-light-bg dark:hover:bg-dark-bg'
                }`}
        >
            {/* Avatar with platform badge */}
            <div className="relative flex-shrink-0">
                <img src={conv.user.avatarUrl} alt={conv.user.name} className="w-9 h-9 rounded-full" />
                <span className="absolute -bottom-0.5 -end-0.5 w-4 h-4 rounded-full bg-white dark:bg-dark-card shadow flex items-center justify-center">
                    <i className={`${asset.icon} text-[9px]`} style={{ color: asset.hexColor }} />
                </span>
            </div>

            <div className="flex-1 overflow-hidden min-w-0">
                {/* Row 1: name + time + priority dot */}
                <div className="flex items-center gap-1 mb-0.5">
                    <span className={`flex-1 text-xs truncate ${isUnread ? 'font-bold text-light-text dark:text-dark-text' : 'font-medium text-light-text dark:text-dark-text'}`}>
                        {conv.user.name}
                    </span>
                    {/* Lead Score badge — show only for medium+ */}
                    {leadScore >= 40 && (
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded-md flex-shrink-0 ${scoreCfg.bg} ${scoreCfg.color}`}
                            title={`Lead Score: ${leadScore}`}>
                            {leadScore}
                        </span>
                    )}
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityCfg.dot}`} title={priorityCfg.label} />
                    <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0">
                        {new Date(conv.lastMessageTimestamp).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>

                {/* Row 2: last message */}
                <p className={`text-[11px] truncate ${isUnread ? 'text-light-text dark:text-dark-text' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                    {lastMsg?.sender === 'agent' && <span className="text-brand-primary opacity-70 me-1">أنت:</span>}
                    {lastMsg?.text ?? '—'}
                </p>

                {/* Row 3: badges */}
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {/* Ad comment badge */}
                    {isAdComment && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 flex items-center gap-0.5">
                            <i className="fas fa-bullhorn text-[7px]" /> إعلان
                        </span>
                    )}
                    {status !== 'open' && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                            {statusCfg.label}
                        </span>
                    )}
                    {needsReply && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brand-pink/10 text-brand-pink">
                            ⚡ رد
                        </span>
                    )}
                    {tags.slice(0, 2).map(tag => (
                        <span key={tag} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${tagColor(tag)}`}>
                            {tag}
                        </span>
                    ))}
                    {tags.length > 2 && (
                        <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary">+{tags.length - 2}</span>
                    )}
                </div>
            </div>

            {isUnread && (
                <span className="w-2 h-2 bg-brand-pink rounded-full self-start mt-1 flex-shrink-0 shadow-sm shadow-brand-pink/50" />
            )}
        </button>
    );
};

// ── Conversation List Panel ───────────────────────────────────────────────────

const ConversationListPanel: React.FC<{
    conversations: InboxConversation[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    isLoading: boolean;
}> = ({ conversations, selectedId, onSelect, searchQuery, onSearchChange, isLoading }) => {
    return (
        <div className="w-72 border-e border-light-border dark:border-dark-border flex flex-col flex-shrink-0">
            {/* Search */}
            <div className="p-3 border-b border-light-border dark:border-dark-border">
                <div className="relative">
                    <i className="fas fa-search absolute start-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary text-xs pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => onSearchChange(e.target.value)}
                        placeholder="بحث في المحادثات..."
                        className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl ps-8 pe-3 py-2 text-xs focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-light-text dark:text-dark-text"
                    />
                    {searchQuery && (
                        <button onClick={() => onSearchChange('')}
                            className="absolute end-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text">
                            <i className="fas fa-times text-xs" />
                        </button>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="space-y-0">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="p-3 border-b border-light-border dark:border-dark-border flex gap-3">
                                <div className="w-9 h-9 rounded-full bg-light-bg dark:bg-dark-bg animate-pulse flex-shrink-0" />
                                <div className="flex-1 space-y-2 pt-1">
                                    <div className="h-2.5 bg-light-bg dark:bg-dark-bg rounded animate-pulse w-3/4" />
                                    <div className="h-2 bg-light-bg dark:bg-dark-bg rounded animate-pulse w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-light-bg dark:bg-dark-bg flex items-center justify-center">
                            <i className="fas fa-inbox text-xl text-light-text-secondary dark:text-dark-text-secondary opacity-40" />
                        </div>
                        <p className="text-sm font-medium text-light-text dark:text-dark-text">لا توجد محادثات</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                            لا توجد محادثات تطابق هذا الفلتر
                        </p>
                    </div>
                ) : (
                    conversations.map(conv => (
                        <ConversationCard
                            key={conv.id}
                            conv={conv}
                            isActive={selectedId === conv.id}
                            onClick={() => onSelect(conv.id)}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

// ── Order Creation Drawer ─────────────────────────────────────────────────────

interface OrderItem { productName: string; quantity: number; unitPrice: number }

const OrderDrawer: React.FC<{
    conversation: InboxConversation;
    brandId: string;
    onSuccess: (orderId: string) => void;
    onClose: () => void;
    addNotification: (type: NotificationType, msg: string) => void;
}> = ({ conversation, brandId, onSuccess, onClose, addNotification }) => {
    const [customerName, setCustomerName] = useState(conversation.user.name);
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [notes, setNotes] = useState('');
    const [shippingFee, setShippingFee] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [items, setItems] = useState<OrderItem[]>([{ productName: '', quantity: 1, unitPrice: 0 }]);
    const [submitting, setSubmitting] = useState(false);

    const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const total = subtotal + shippingFee - discount;

    const addItem = () => setItems(prev => [...prev, { productName: '', quantity: 1, unitPrice: 0 }]);
    const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
    const updateItem = (idx: number, field: keyof OrderItem, value: string | number) =>
        setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));

    const handleSubmit = async () => {
        if (!customerName.trim() || items.some(it => !it.productName.trim())) {
            addNotification(NotificationType.Warning, 'يرجى تعبئة اسم العميل واسم المنتج');
            return;
        }
        setSubmitting(true);
        try {
            const result = await createOrderFromInboxConversation(brandId, conversation.id, {
                customerName: customerName.trim(),
                customerPhone: customerPhone || undefined,
                customerEmail: customerEmail || undefined,
                shippingAddress: address || undefined,
                city: city || undefined,
                items: items.filter(it => it.productName.trim()),
                shippingFee,
                discount,
                paymentMethod,
                notes: notes || undefined,
                existingCustomerId: conversation.crmCustomerId ?? undefined,
            });
            if (result) {
                addNotification(NotificationType.Success, `✅ تم إنشاء الطلب بنجاح`);
                onSuccess(result.orderId);
            } else {
                addNotification(NotificationType.Error, 'فشل إنشاء الطلب، يرجى المحاولة مرة أخرى');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="w-full max-w-xl bg-light-card dark:bg-dark-card h-full overflow-y-auto flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-light-border dark:border-dark-border flex-shrink-0">
                    <div>
                        <h2 className="font-bold text-light-text dark:text-dark-text">إنشاء طلب جديد</h2>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                            من محادثة: {conversation.user.name} · {conversation.platform}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text p-2 rounded-xl hover:bg-light-bg dark:hover:bg-dark-bg transition-colors">
                        <i className="fas fa-times" />
                    </button>
                </div>

                <div className="flex-1 p-5 space-y-5 overflow-y-auto">
                    {/* Customer section */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">بيانات العميل</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">الاسم *</label>
                                <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                                    className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-light-text dark:text-dark-text" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">الهاتف</label>
                                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="05xxxxxxxx"
                                    className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-light-text dark:text-dark-text" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">البريد الإلكتروني</label>
                                <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="email@example.com"
                                    className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-light-text dark:text-dark-text" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">المدينة</label>
                                <input value={city} onChange={e => setCity(e.target.value)} placeholder="الرياض"
                                    className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-light-text dark:text-dark-text" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">العنوان</label>
                                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="حي..."
                                    className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-light-text dark:text-dark-text" />
                            </div>
                        </div>
                    </div>

                    {/* Items section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">المنتجات *</h3>
                            <button onClick={addItem} className="text-xs text-brand-primary hover:underline flex items-center gap-1">
                                <i className="fas fa-plus text-[10px]" /> إضافة منتج
                            </button>
                        </div>
                        <div className="space-y-2">
                            {/* Column headers */}
                            <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary px-1">
                                <span className="col-span-6">المنتج</span>
                                <span className="col-span-2 text-center">الكمية</span>
                                <span className="col-span-3 text-center">السعر</span>
                                <span className="col-span-1" />
                            </div>
                            {items.map((item, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                    <input
                                        value={item.productName}
                                        onChange={e => updateItem(idx, 'productName', e.target.value)}
                                        placeholder="اسم المنتج"
                                        className="col-span-6 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary text-light-text dark:text-dark-text"
                                    />
                                    <input
                                        type="number" min="1"
                                        value={item.quantity}
                                        onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                        className="col-span-2 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-brand-primary text-light-text dark:text-dark-text"
                                    />
                                    <input
                                        type="number" min="0"
                                        value={item.unitPrice || ''}
                                        onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                        placeholder="0"
                                        className="col-span-3 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-brand-primary text-light-text dark:text-dark-text"
                                    />
                                    <button
                                        onClick={() => removeItem(idx)}
                                        disabled={items.length === 1}
                                        className="col-span-1 flex justify-center text-red-400 hover:text-red-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <i className="fas fa-times text-xs" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Shipping / discount / payment */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">رسوم الشحن</label>
                            <input type="number" min="0" value={shippingFee || ''}
                                onChange={e => setShippingFee(parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-light-text dark:text-dark-text" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">الخصم</label>
                            <input type="number" min="0" value={discount || ''}
                                onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-light-text dark:text-dark-text" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">طريقة الدفع</label>
                            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                                className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-light-text dark:text-dark-text">
                                <option value="cash">نقدي</option>
                                <option value="card">بطاقة بنكية</option>
                                <option value="bank_transfer">تحويل بنكي</option>
                                <option value="cod">الدفع عند الاستلام</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">ملاحظات</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="ملاحظات إضافية..."
                                className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-light-text dark:text-dark-text resize-none" />
                        </div>
                    </div>

                    {/* Order summary */}
                    <div className="bg-light-bg dark:bg-dark-bg rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between text-light-text-secondary dark:text-dark-text-secondary">
                            <span>المجموع الفرعي</span>
                            <span>{subtotal.toFixed(2)} ر.س</span>
                        </div>
                        {shippingFee > 0 && (
                            <div className="flex justify-between text-light-text-secondary dark:text-dark-text-secondary">
                                <span>الشحن</span>
                                <span>+{shippingFee.toFixed(2)} ر.س</span>
                            </div>
                        )}
                        {discount > 0 && (
                            <div className="flex justify-between text-green-600 dark:text-green-400">
                                <span>الخصم</span>
                                <span>-{discount.toFixed(2)} ر.س</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-light-text dark:text-dark-text border-t border-light-border dark:border-dark-border pt-2">
                            <span>الإجمالي</span>
                            <span>{total.toFixed(2)} ر.س</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-light-border dark:border-dark-border flex gap-3 flex-shrink-0">
                    <button onClick={handleSubmit} disabled={submitting}
                        className="flex-1 bg-brand-primary text-white font-bold py-3 rounded-xl hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                        {submitting && <i className="fas fa-spinner fa-spin text-xs" />}
                        <i className="fas fa-cart-shopping text-xs" />
                        {submitting ? 'جارٍ الإنشاء...' : 'إنشاء الطلب'}
                    </button>
                    <button onClick={onClose} className="px-5 py-3 border border-light-border dark:border-dark-border rounded-xl text-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition-colors">
                        إلغاء
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Create Lead Panel ─────────────────────────────────────────────────────────

const CreateLeadPanel: React.FC<{
    conversation: InboxConversation;
    brandId: string;
    onSuccess: (customerId: string) => void;
    onClose: () => void;
    addNotification: (type: NotificationType, msg: string) => void;
}> = ({ conversation, brandId, onSuccess, onClose, addNotification }) => {
    const [firstName, setFirstName] = useState(conversation.user.name.split(' ')[0] || '');
    const [lastName, setLastName] = useState(conversation.user.name.split(' ').slice(1).join(' ') || '');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!firstName.trim()) { addNotification(NotificationType.Warning, 'يرجى إدخال الاسم'); return; }
        setSubmitting(true);
        try {
            const result = await createCrmLeadFromConversation(brandId, conversation.id, {
                firstName: firstName.trim(),
                lastName: lastName.trim() || undefined,
                phone: phone.trim() || undefined,
                email: email.trim() || undefined,
                platform: conversation.platform,
                accountName: conversation.accountName ?? undefined,
                notes: notes.trim() || undefined,
            });
            if (result) {
                addNotification(NotificationType.Success, `✅ تم إنشاء الليد: ${firstName}`);
                onSuccess(result.customerId);
            } else {
                addNotification(NotificationType.Error, 'فشل إنشاء الليد');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bg-light-bg dark:bg-dark-bg rounded-xl p-4 space-y-3 border border-light-border dark:border-dark-border">
            <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-light-text dark:text-dark-text flex items-center gap-1.5">
                    <i className="fas fa-user-plus text-green-500" /> إنشاء ليد CRM
                </p>
                <button onClick={onClose} className="text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text">
                    <i className="fas fa-times" />
                </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="الاسم الأول *"
                    className="col-span-1 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary text-light-text dark:text-dark-text" />
                <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="اسم العائلة"
                    className="col-span-1 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary text-light-text dark:text-dark-text" />
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="الهاتف"
                    className="col-span-1 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary text-light-text dark:text-dark-text" />
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="البريد الإلكتروني"
                    className="col-span-1 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary text-light-text dark:text-dark-text" />
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات..." rows={2}
                    className="col-span-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary text-light-text dark:text-dark-text resize-none" />
            </div>
            <button onClick={handleSubmit} disabled={submitting}
                className="w-full bg-green-600 text-white font-bold py-2 rounded-xl text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                {submitting && <i className="fas fa-spinner fa-spin" />}
                {submitting ? 'جارٍ الإنشاء...' : 'حفظ الليد في CRM'}
            </button>
        </div>
    );
};

// ── Action Panel ──────────────────────────────────────────────────────────────

const ActionPanel: React.FC<{
    conversation: InboxConversation;
    brandId: string;
    brandProfile: BrandHubProfile;
    onApplyReply: (text: string) => void;
    onAddTask: (title: string, desc: string) => void;
    addNotification: (type: NotificationType, msg: string) => void;
    onStatusChange: (s: ConversationStatus) => void;
    onLeadCreated: (customerId: string) => void;
    onOrderDrawerOpen: () => void;
    onTagsChanged: () => void;
}> = ({ conversation, brandId, brandProfile, onApplyReply, onAddTask, addNotification, onStatusChange, onLeadCreated, onOrderDrawerOpen, onTagsChanged }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const rawTab = searchParams.get('inboxTab');
    const activeTab: ActionPanelTab = (rawTab && ['ai', 'crm', 'notes'].includes(rawTab))
        ? (rawTab as ActionPanelTab)
        : 'ai';
    const setActiveTab = (tab: ActionPanelTab) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('inboxTab', tab);
        setSearchParams(newParams, { replace: true });
    };
    const [showLeadForm, setShowLeadForm] = useState(false);
    const [notes, setNotes] = useState<ConversationNote[]>([]);
    const [noteText, setNoteText] = useState('');
    const [addingNote, setAddingNote] = useState(false);
    const [analysis, setAnalysis] = useState<{
        summary: string; intent: ConversationIntent; sentiment: ConversationSentiment; suggestedReplies: string[];
    } | null>(null);
    const [analysisLoading, setAnalysisLoading] = useState(true);
    const [brandReply, setBrandReply] = useState<{ text: string; executionId: string } | null>(null);
    const [generatingBrandReply, setGeneratingBrandReply] = useState(false);

    // Fetch analysis when conversation changes
    useEffect(() => {
        let cancelled = false;
        setAnalysis(null);
        setAnalysisLoading(true);
        setBrandReply(null);

        analyzeConversation(conversation, brandProfile)
            .then(result => {
                if (cancelled) return;
                setAnalysis(result);
                persistConversationAnalysis(brandId, conversation.id, {
                    summary: result.summary,
                    intent: result.intent,
                    sentiment: result.sentiment,
                }).catch(() => null);
            })
            .catch(() => null)
            .finally(() => { if (!cancelled) setAnalysisLoading(false); });

        return () => { cancelled = true; };
    }, [brandId, conversation, brandProfile]);

    // Fetch notes when tab changes
    useEffect(() => {
        if (activeTab !== 'notes') return;
        getConversationNotes(brandId, conversation.id).then(setNotes).catch(() => null);
    }, [activeTab, brandId, conversation.id]);

    const handleAddNote = async () => {
        if (!noteText.trim()) return;
        setAddingNote(true);
        const note = await addConversationNote(brandId, conversation.id, noteText.trim());
        if (note) {
            setNotes(prev => [...prev, note]);
            setNoteText('');
        }
        setAddingNote(false);
    };

    const handleGenerateBrandReply = async () => {
        setGeneratingBrandReply(true);
        setBrandReply(null);
        try {
            const { processMarketingRequest } = await import('../../services/platformBrainService');
            const messages = conversation.messages.map(m => ({ sender: m.sender as 'customer' | 'agent', text: m.text }));
            const response = await processMarketingRequest(
                { brandId, requestText: conversation.messages.at(-1)?.text ?? '', forcedSkill: SkillType.ConversationReply, context: { messages } },
                brandProfile,
            );
            const reply = response.output.reply as string | undefined;
            if (reply) setBrandReply({ text: reply, executionId: response.executionId });
        } catch {
            addNotification(NotificationType.Error, 'فشل توليد رد البراند');
        } finally {
            setGeneratingBrandReply(false);
        }
    };

    const handleAddTag = async (tag: string) => {
        await addConversationTag(brandId, conversation.id, tag).catch(() => null);
        onTagsChanged();
    };

    const handleRemoveTag = async (tag: string) => {
        await removeConversationTag(brandId, conversation.id, tag).catch(() => null);
        onTagsChanged();
    };

    const QUICK_TAGS = ['hot-lead', 'price-inquiry', 'order-intent', 'complaint', 'support', 'delivery'];
    const currentTags = conversation.tags ?? [];

    return (
        <div className="w-72 border-s border-light-border dark:border-dark-border flex flex-col flex-shrink-0 bg-light-bg/50 dark:bg-dark-bg/50">
            {/* Tab bar */}
            <div className="flex border-b border-light-border dark:border-dark-border flex-shrink-0">
                {([
                    { key: 'ai',    icon: 'fa-brain',       label: 'ذكاء' },
                    { key: 'crm',   icon: 'fa-users',       label: 'CRM' },
                    { key: 'notes', icon: 'fa-sticky-note', label: 'ملاحظات' },
                ] as { key: ActionPanelTab; icon: string; label: string }[]).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold border-b-2 transition-colors
                            ${activeTab === tab.key
                                ? 'border-brand-primary text-brand-primary'
                                : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                            }`}
                    >
                        <i className={`fas ${tab.icon} text-[10px]`} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* ── AI Tab ── */}
                {activeTab === 'ai' && (
                    <>
                        {/* Brand Context Indicator (P3-05) */}
                        {(() => {
                            const platformNames: Partial<Record<SocialPlatform, string>> = {
                                [SocialPlatform.Facebook]: 'Facebook',
                                [SocialPlatform.Instagram]: 'Instagram',
                                [SocialPlatform.X]: 'X / Twitter',
                                [SocialPlatform.LinkedIn]: 'LinkedIn',
                                [SocialPlatform.TikTok]: 'TikTok',
                            };
                            const platformIcons: Partial<Record<SocialPlatform, string>> = {
                                [SocialPlatform.Facebook]: 'fa-facebook',
                                [SocialPlatform.Instagram]: 'fa-instagram',
                                [SocialPlatform.X]: 'fa-x-twitter',
                                [SocialPlatform.LinkedIn]: 'fa-linkedin',
                                [SocialPlatform.TikTok]: 'fa-tiktok',
                            };
                            const platName = platformNames[conversation.platform] ?? conversation.platform;
                            const platIcon = platformIcons[conversation.platform] ?? 'fa-comment';
                            return (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-brand-primary/20 bg-brand-primary/5">
                                    <i className="fas fa-brain text-brand-secondary text-[10px]" />
                                    <p className="text-[11px] font-semibold text-brand-secondary flex-1 leading-tight">
                                        يرد بصوت: <span className="text-white">{brandProfile.brandName || '—'}</span>
                                        <span className="text-brand-secondary/60 mx-1">←</span>
                                        <i className={`fab ${platIcon} text-[9px]`} /> {platName}
                                    </p>
                                </div>
                            );
                        })()}
                        {analysisLoading ? (
                            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-light-bg dark:bg-dark-bg rounded-xl animate-pulse" />)}</div>
                        ) : analysis ? (
                            <>
                                {/* Intent */}
                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg">
                                    <i className={`fas ${INTENT_CONFIG[analysis.intent].icon} ${INTENT_CONFIG[analysis.intent].color} flex-shrink-0 text-sm`} />
                                    <div>
                                        <p className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mb-0.5">النية</p>
                                        <p className={`text-xs font-bold ${INTENT_CONFIG[analysis.intent].color}`}>{INTENT_ARABIC[analysis.intent]}</p>
                                    </div>
                                </div>

                                {/* Sentiment */}
                                {analysis.sentiment && (
                                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg">
                                        <i className={`fas ${SENTIMENT_CONFIG[analysis.sentiment].icon} ${SENTIMENT_CONFIG[analysis.sentiment].color} flex-shrink-0 text-sm`} />
                                        <div>
                                            <p className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mb-0.5">المشاعر</p>
                                            <p className={`text-xs font-bold ${SENTIMENT_CONFIG[analysis.sentiment].color}`}>{SENTIMENT_CONFIG[analysis.sentiment].label}</p>
                                        </div>
                                    </div>
                                )}

                                {/* AI Summary */}
                                {analysis.summary && (
                                    <div>
                                        <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">ملخص AI</p>
                                        <p className="text-xs p-2.5 bg-light-bg dark:bg-dark-bg rounded-xl text-light-text-secondary dark:text-dark-text-secondary leading-relaxed border border-light-border dark:border-dark-border">
                                            {analysis.summary}
                                        </p>
                                    </div>
                                )}

                                {/* Suggested Replies */}
                                {analysis.suggestedReplies?.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-2">ردود مقترحة</p>
                                        <div className="space-y-1.5">
                                            {analysis.suggestedReplies.map((reply, i) => (
                                                <button key={i} onClick={() => onApplyReply(reply)}
                                                    className="w-full text-right text-xs p-2.5 bg-light-bg dark:bg-dark-bg rounded-xl hover:bg-brand-primary/10 hover:border-brand-primary border border-light-border dark:border-dark-border text-light-text dark:text-dark-text transition-colors leading-relaxed">
                                                    <i className="fas fa-reply text-brand-primary me-1.5 opacity-60 text-[10px]" />
                                                    {reply}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Brand Voice Reply */}
                                <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-brand-secondary flex items-center gap-1.5">
                                            <i className="fas fa-brain text-xs" /> رد بصوت البراند
                                        </p>
                                        <button onClick={handleGenerateBrandReply} disabled={generatingBrandReply}
                                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold bg-brand-primary/15 hover:bg-brand-primary/30 text-brand-secondary rounded-lg transition-colors disabled:opacity-40">
                                            <i className={`fas ${generatingBrandReply ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} text-[9px]`} />
                                            {generatingBrandReply ? 'جارٍ...' : 'توليد'}
                                        </button>
                                    </div>
                                    {brandReply && (
                                        <div className="space-y-2">
                                            <p className="text-xs leading-relaxed text-light-text dark:text-dark-text bg-light-bg dark:bg-dark-bg rounded-lg p-2.5 border border-light-border dark:border-dark-border">
                                                {brandReply.text}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => onApplyReply(brandReply.text)}
                                                    className="flex-1 text-xs py-1.5 bg-brand-primary/15 hover:bg-brand-primary/30 text-brand-secondary rounded-lg font-semibold transition-colors">
                                                    <i className="fas fa-reply me-1 text-[10px]" /> تطبيق
                                                </button>
                                                <EvaluationButtons executionId={brandReply.executionId} brandId={brandId}
                                                    skillType={SkillType.ConversationReply} output={brandReply.text}
                                                    onUsed={() => onApplyReply(brandReply.text)} compact />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Create Task */}
                                <button onClick={() => onAddTask(
                                    `متابعة محادثة مع ${conversation.user.name}`,
                                    `منصة: ${conversation.platform}\nالنية: ${INTENT_ARABIC[analysis.intent]}\nملخص: ${analysis.summary}`
                                )}
                                    className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-text dark:text-dark-text font-semibold py-2 rounded-xl hover:border-brand-primary hover:text-brand-primary transition-colors text-xs flex items-center justify-center gap-2">
                                    <i className="fas fa-plus-circle text-brand-primary opacity-70" />
                                    إضافة مهمة متابعة
                                </button>
                            </>
                        ) : (
                            <p className="text-center text-xs text-light-text-secondary dark:text-dark-text-secondary py-8">
                                <i className="fas fa-triangle-exclamation text-yellow-500 me-1.5" />
                                تعذّر تحليل المحادثة
                            </p>
                        )}
                    </>
                )}

                {/* ── CRM Tab ── */}
                {activeTab === 'crm' && (
                    <div className="space-y-3">
                        {/* Quick Status Actions */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">إجراءات سريعة</p>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    { s: 'resolved' as ConversationStatus, label: 'محلول', icon: 'fa-circle-check', cls: 'border-green-500/30 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' },
                                    { s: 'pending'  as ConversationStatus, label: 'معلق',  icon: 'fa-clock',        cls: 'border-yellow-500/30 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20' },
                                    { s: 'archived' as ConversationStatus, label: 'أرشيف', icon: 'fa-box-archive',  cls: 'border-purple-500/30 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20' },
                                    { s: 'spam'     as ConversationStatus, label: 'سبام',  icon: 'fa-ban',          cls: 'border-gray-400/30 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900/20' },
                                ] as { s: ConversationStatus; label: string; icon: string; cls: string }[]).map(item => (
                                    <button key={item.s} onClick={() => onStatusChange(item.s)}
                                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${item.cls} ${conversation.status === item.s ? 'ring-1 ring-current' : ''}`}>
                                        <i className={`fas ${item.icon} text-[10px]`} />
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tags */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">تصنيفات</p>
                            <div className="flex flex-wrap gap-1.5">
                                {currentTags.map(tag => (
                                    <span key={tag} className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${tagColor(tag)}`}>
                                        {tag}
                                        <button onClick={() => handleRemoveTag(tag)} className="hover:opacity-70 transition-opacity ms-0.5">
                                            <i className="fas fa-times text-[8px]" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {QUICK_TAGS.filter(t => !currentTags.includes(t)).map(tag => (
                                    <button key={tag} onClick={() => handleAddTag(tag)}
                                        className={`text-[10px] px-2 py-0.5 rounded-full border border-dashed border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-brand-primary hover:text-brand-primary transition-colors`}>
                                        + {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* CRM Lead / Customer */}
                        {conversation.crmCustomerId ? (
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 space-y-1">
                                <p className="text-xs font-bold text-green-700 dark:text-green-300 flex items-center gap-1.5">
                                    <i className="fas fa-circle-check text-[10px]" /> مرتبط بعميل CRM
                                </p>
                                <p className="text-[10px] text-green-600 dark:text-green-400 font-mono truncate">
                                    ID: {conversation.crmCustomerId.slice(0, 16)}...
                                </p>
                            </div>
                        ) : (
                            <>
                                {showLeadForm ? (
                                    <CreateLeadPanel
                                        conversation={conversation}
                                        brandId={brandId}
                                        onSuccess={cid => { onLeadCreated(cid); setShowLeadForm(false); }}
                                        onClose={() => setShowLeadForm(false)}
                                        addNotification={addNotification}
                                    />
                                ) : (
                                    <button onClick={() => setShowLeadForm(true)}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-colors">
                                        <i className="fas fa-user-plus text-[10px]" />
                                        إنشاء ليد في CRM
                                    </button>
                                )}
                            </>
                        )}

                        {/* Create Order */}
                        <button onClick={onOrderDrawerOpen}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl text-xs font-bold transition-colors">
                            <i className="fas fa-cart-shopping text-[10px]" />
                            إنشاء طلب من المحادثة
                        </button>
                    </div>
                )}

                {/* ── Notes Tab ── */}
                {activeTab === 'notes' && (
                    <div className="space-y-3">
                        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">ملاحظات داخلية — غير مرئية للعميل</p>

                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {notes.length === 0 ? (
                                <p className="text-xs text-center text-light-text-secondary dark:text-dark-text-secondary py-4 italic">لا توجد ملاحظات بعد</p>
                            ) : notes.map(note => (
                                <div key={note.id} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 text-xs">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-semibold text-yellow-700 dark:text-yellow-300">{note.author}</span>
                                        <span className="text-yellow-600 dark:text-yellow-400 text-[10px]">
                                            {note.createdAt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-yellow-800 dark:text-yellow-200 leading-relaxed">{note.text}</p>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <textarea
                                value={noteText}
                                onChange={e => setNoteText(e.target.value)}
                                rows={3}
                                placeholder="اكتب ملاحظة داخلية..."
                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-3 py-2.5 text-xs text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
                            />
                            <button onClick={handleAddNote} disabled={!noteText.trim() || addingNote}
                                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 rounded-xl text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                {addingNote && <i className="fas fa-spinner fa-spin text-[10px]" />}
                                حفظ الملاحظة
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Platform char limits ──────────────────────────────────────────────────────

const PLATFORM_CHAR_LIMITS: Partial<Record<SocialPlatform, number>> = {
    [SocialPlatform.X]:         280,
    [SocialPlatform.Facebook]:  2000,
    [SocialPlatform.Instagram]: 2200,
    [SocialPlatform.LinkedIn]:  3000,
};

// ── Chat Window ───────────────────────────────────────────────────────────────

const ChatWindow: React.FC<{
    conversation: InboxConversation;
    isReadOnly: boolean;
    onReply: (text: string, mode?: ReplyMode) => void;
    replyText: string;
    onReplyTextChange: (t: string) => void;
    templates: SavedReplyTemplate[];
    onStatusChange: (s: ConversationStatus) => void;
    onPriorityChange: (p: ConversationPriority) => void;
}> = ({ conversation, isReadOnly, onReply, replyText, onReplyTextChange, templates, onStatusChange, onPriorityChange }) => {
    const { language } = useLanguage();
    const [showTemplates, setShowTemplates] = useState(false);
    const [showStatusMenu, setShowStatusMenu] = useState(false);
    const [showPriorityMenu, setShowPriorityMenu] = useState(false);
    const [replyMode, setReplyMode] = useState<ReplyMode>('dm');
    const [sending, setSending] = useState(false);

    // Determine available reply modes based on item type
    const itemType = conversation.itemType ?? (conversation.type === 'Message' ? 'dm' : 'facebook_comment');
    const isComment = itemType !== 'dm' && itemType !== 'story_reply';
    const availableModes: ReplyMode[] = isComment
        ? ['public_comment_reply', 'private_comment_reply']
        : ['dm'];

    // Auto-set correct default mode when conversation changes
    React.useEffect(() => {
        setReplyMode(isComment ? 'public_comment_reply' : 'dm');
    }, [conversation.id, isComment]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const asset = PLATFORM_ASSETS[conversation.platform];
    const status = conversation.status ?? 'open';
    const priority = conversation.priority ?? 'medium';
    const statusCfg = STATUS_CONFIG[status];
    const priorityCfg = PRIORITY_CONFIG[priority];
    const charLimit = PLATFORM_CHAR_LIMITS[conversation.platform];
    const charCount = replyText.length;
    const overLimit = charLimit ? charCount > charLimit : false;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversation.messages]);

    const handleSend = async () => {
        if (!replyText.trim() || sending || overLimit) return;
        setSending(true);
        onReply(replyText, replyMode);
        onReplyTextChange('');
        setShowTemplates(false);
        setTimeout(() => setSending(false), 1200);
    };

    return (
        <div className="flex flex-col h-full bg-light-card dark:bg-dark-card">
            {/* Header */}
            <div className="px-4 py-3 border-b border-light-border dark:border-dark-border flex items-center gap-3 flex-shrink-0">
                <div className="relative flex-shrink-0">
                    <img src={conversation.user.avatarUrl} alt={conversation.user.name} className="w-9 h-9 rounded-full" />
                    <span className="absolute -bottom-0.5 -end-0.5 w-4 h-4 rounded-full bg-white dark:bg-dark-card shadow flex items-center justify-center">
                        <i className={`${asset.icon} text-[9px]`} style={{ color: asset.hexColor }} />
                    </span>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-light-text dark:text-dark-text truncate">{conversation.user.name}</p>
                        {/* Item type badge */}
                        {ITEM_TYPE_CONFIG[itemType] && (
                            <span className={`flex-shrink-0 flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border ${ITEM_TYPE_CONFIG[itemType].color}`}>
                                <i className={`fas ${ITEM_TYPE_CONFIG[itemType].icon} text-[8px]`} />
                                {ITEM_TYPE_CONFIG[itemType].label}
                            </span>
                        )}
                        {/* Ad campaign indicator */}
                        {conversation.adCampaignId && (
                            <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                                <i className="fas fa-bullhorn text-[8px] me-0.5" /> إعلان
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">
                        @{conversation.user.handle} · {conversation.platform}
                        {conversation.accountName && <span className="ms-1 opacity-70"> · {conversation.accountName}</span>}
                    </p>
                </div>

                {/* Status selector */}
                <div className="relative">
                    <button onClick={() => { setShowStatusMenu(v => !v); setShowPriorityMenu(false); }}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${statusCfg.bg} ${statusCfg.color} border-current/20`}>
                        <i className={`fas ${statusCfg.icon} text-[10px]`} />
                        {statusCfg.label}
                        <i className="fas fa-chevron-down text-[8px] opacity-60" />
                    </button>
                    {showStatusMenu && (
                        <div className="absolute top-full end-0 mt-1 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl shadow-xl z-20 min-w-[130px] overflow-hidden">
                            {(Object.entries(STATUS_CONFIG) as [ConversationStatus, typeof STATUS_CONFIG[ConversationStatus]][]).map(([s, cfg]) => (
                                <button key={s} onClick={() => { onStatusChange(s); setShowStatusMenu(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-light-bg dark:hover:bg-dark-bg transition-colors ${cfg.color} ${conversation.status === s ? 'font-bold' : ''}`}>
                                    <i className={`fas ${cfg.icon} text-[10px]`} />
                                    {cfg.label}
                                    {conversation.status === s && <i className="fas fa-check text-[10px] ms-auto" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Priority selector */}
                <div className="relative">
                    <button onClick={() => { setShowPriorityMenu(v => !v); setShowStatusMenu(false); }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-light-border dark:border-dark-border text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition-colors">
                        <span className={`w-2 h-2 rounded-full ${priorityCfg.dot}`} />
                        {priorityCfg.label}
                        <i className="fas fa-chevron-down text-[8px] opacity-60" />
                    </button>
                    {showPriorityMenu && (
                        <div className="absolute top-full end-0 mt-1 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl shadow-xl z-20 min-w-[120px] overflow-hidden">
                            {(Object.entries(PRIORITY_CONFIG) as [ConversationPriority, typeof PRIORITY_CONFIG[ConversationPriority]][]).map(([p, cfg]) => (
                                <button key={p} onClick={() => { onPriorityChange(p); setShowPriorityMenu(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-light-bg dark:hover:bg-dark-bg transition-colors text-light-text dark:text-dark-text ${conversation.priority === p ? 'font-bold' : ''}`}>
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                                    {cfg.label}
                                    {conversation.priority === p && <i className="fas fa-check text-[10px] ms-auto text-brand-primary" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-light-bg/30 dark:bg-dark-bg/30">
                {conversation.messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic">لا توجد رسائل في هذه المحادثة بعد</p>
                    </div>
                ) : (
                    conversation.messages.map(msg => {
                        const ds = msg.deliveryStatus;
                        return (
                            <div key={msg.id} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-xs md:max-w-sm p-3 rounded-2xl shadow-sm transition-opacity ${
                                    msg.sender === 'agent'
                                        ? `bg-brand-primary text-white rounded-br-sm ${ds === 'sending' ? 'opacity-60' : ''}`
                                        : 'bg-light-card dark:bg-dark-card text-light-text dark:text-dark-text rounded-bl-sm border border-light-border dark:border-dark-border'
                                }`}>
                                    <p className="text-sm leading-relaxed">{msg.text}</p>
                                    <div className="flex items-center justify-end gap-1 mt-1.5">
                                        <p className="text-[10px] opacity-60">
                                            {new Date(msg.timestamp).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        {msg.sender === 'agent' && (
                                            <span className="text-[10px]">
                                                {ds === 'sending' && <i className="fas fa-clock opacity-50" title="جارٍ الإرسال..." />}
                                                {ds === 'sent'    && <i className="fas fa-check-double opacity-80" title="تم الإرسال" />}
                                                {ds === 'failed'  && <i className="fas fa-triangle-exclamation text-yellow-300" title="فشل الإرسال" />}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* sm:: conversations: show info banner but allow reply */}
            {isReadOnly && (
                <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800 flex-shrink-0">
                    <i className="fas fa-info-circle text-blue-500 text-xs flex-shrink-0" />
                    <p className="text-[10px] text-blue-700 dark:text-blue-300 leading-relaxed flex-1">
                        محادثة مجلوبة مباشرة من {conversation.platform} — الرد يُرسل عبر Graph API.
                    </p>
                </div>
            )}

            {/* Templates Picker */}
            {!isReadOnly && showTemplates && (
                <div className="border-t border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg p-3 flex-shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">ردود سريعة</span>
                        <button onClick={() => setShowTemplates(false)} className="text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text">
                            <i className="fas fa-times" />
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                        {templates.map(tmpl => (
                            <button key={tmpl.id} onClick={() => { onReplyTextChange(tmpl.body); setShowTemplates(false); }}
                                className="text-xs px-3 py-1.5 rounded-xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border hover:border-brand-primary hover:text-brand-primary text-light-text dark:text-dark-text transition-colors font-medium">
                                ⚡ {tmpl.title}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Reply composer — always shown (sm:: conversations reply via Graph API too) */}
            <div className="p-4 border-t border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg flex-shrink-0">
                    {/* Reply mode selector — only for comments */}
                    {isComment && (
                        <div className="flex items-center gap-1.5 mb-3">
                            <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-semibold">نوع الرد:</span>
                            {availableModes.map(mode => {
                                const modeLabels: Record<ReplyMode, { label: string; icon: string }> = {
                                    dm:                    { label: 'رسالة خاصة',   icon: 'fa-envelope'       },
                                    public_comment_reply:  { label: 'رد علني',       icon: 'fa-comment'        },
                                    private_comment_reply: { label: 'رد خاص',        icon: 'fa-lock'           },
                                    ad_comment_reply:      { label: 'رد إعلان',      icon: 'fa-bullhorn'       },
                                };
                                const cfg = modeLabels[mode];
                                return (
                                    <button key={mode} onClick={() => setReplyMode(mode)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors
                                            ${replyMode === mode
                                                ? 'bg-brand-primary text-white border-brand-primary'
                                                : 'bg-light-card dark:bg-dark-card border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-brand-primary hover:text-brand-primary'
                                            }`}>
                                        <i className={`fas ${cfg.icon} text-[8px]`} />
                                        {cfg.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <div className="flex items-end gap-2">
                        <button onClick={() => setShowTemplates(v => !v)} title="ردود سريعة"
                            className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border transition-colors
                                ${showTemplates ? 'bg-brand-primary border-brand-primary text-white' : 'bg-light-card dark:bg-dark-card border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-brand-primary hover:text-brand-primary'}`}>
                            <i className="fas fa-bolt text-xs" />
                        </button>
                        <div className="flex-1 relative">
                            <textarea
                                value={replyText}
                                onChange={e => onReplyTextChange(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                placeholder="اكتب رداً... (Enter للإرسال، Shift+Enter لسطر جديد)"
                                rows={2}
                                disabled={sending}
                                className={`w-full bg-light-card dark:bg-dark-card border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-light-text dark:text-dark-text resize-none transition-shadow disabled:opacity-60
                                    ${overLimit ? 'border-red-400 focus:ring-red-400' : 'border-light-border dark:border-dark-border'}`}
                            />
                            {charLimit && charCount > 0 && (
                                <span className={`absolute bottom-2 end-2.5 text-[10px] font-mono pointer-events-none
                                    ${overLimit ? 'text-red-500 font-bold' : charCount > charLimit * 0.85 ? 'text-yellow-500' : 'text-light-text-secondary dark:text-dark-text-secondary opacity-50'}`}>
                                    {charCount}/{charLimit}
                                </span>
                            )}
                        </div>
                        <button onClick={handleSend} disabled={!replyText.trim() || sending || overLimit}
                            className="flex-shrink-0 h-9 bg-brand-pink text-white font-bold py-2 px-4 rounded-xl hover:bg-brand-pink/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 text-sm">
                            {sending
                                ? <><i className="fas fa-spinner fa-spin text-xs" /> جارٍ...</>
                                : <><i className="fas fa-paper-plane text-xs" /> إرسال</>
                            }
                        </button>
                    </div>
                    {overLimit && (
                        <p className="text-[11px] text-red-500 mt-1.5 text-end">
                            تجاوزت الحد المسموح ({charLimit} حرف) بـ {charCount - charLimit!} حرف
                        </p>
                    )}
                </div>
        </div>
    );
};

// ── Templates Tab ─────────────────────────────────────────────────────────────

const TemplatesTab: React.FC<{
    templates: SavedReplyTemplate[];
    onUpdate: (templates: SavedReplyTemplate[]) => void;
    addNotification: (type: NotificationType, msg: string) => void;
}> = ({ templates, onUpdate, addNotification }) => {
    const [editing, setEditing] = useState<SavedReplyTemplate | null>(null);

    const categories = [...new Set(templates.map(t => t.category))];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">قوالب جاهزة للرد السريع من داخل الصندوق</p>
                <button onClick={() => setEditing({ id: crypto.randomUUID(), title: '', body: '', category: 'عام' })}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary/90 transition">
                    <i className="fas fa-plus text-xs" /> قالب جديد
                </button>
            </div>

            {categories.map(cat => (
                <div key={cat} className="space-y-2">
                    <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wide">{cat}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {templates.filter(t => t.category === cat).map(tmpl => (
                            <div key={tmpl.id} className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-4 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-sm text-light-text dark:text-dark-text truncate">{tmpl.title}</span>
                                    <div className="flex gap-1 flex-shrink-0">
                                        <button onClick={() => setEditing(tmpl)} className="text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary px-1.5 py-1 rounded-lg hover:bg-light-bg dark:hover:bg-dark-bg transition-colors">
                                            <i className="fas fa-pen text-[10px]" />
                                        </button>
                                        <button onClick={() => { onUpdate(templates.filter(t => t.id !== tmpl.id)); addNotification(NotificationType.Info, 'تم حذف القالب'); }}
                                            className="text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 px-1.5 py-1 rounded-lg hover:bg-light-bg dark:hover:bg-dark-bg transition-colors">
                                            <i className="fas fa-trash text-[10px]" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary line-clamp-3 leading-relaxed">{tmpl.body}</p>
                                <button onClick={() => { navigator.clipboard.writeText(tmpl.body).catch(() => null); addNotification(NotificationType.Success, 'تم النسخ!'); }}
                                    className="text-xs text-brand-primary hover:underline flex items-center gap-1">
                                    <i className="fas fa-copy text-[10px]" /> نسخ
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* Edit modal */}
            {editing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <h3 className="font-bold text-light-text dark:text-dark-text">
                            {templates.find(t => t.id === editing.id) ? 'تحرير القالب' : 'قالب جديد'}
                        </h3>
                        <input value={editing.title} onChange={e => setEditing(p => p ? { ...p, title: e.target.value } : p)}
                            placeholder="اسم القالب *" className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-light-text dark:text-dark-text" />
                        <input value={editing.category} onChange={e => setEditing(p => p ? { ...p, category: e.target.value } : p)}
                            placeholder="الفئة" className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-light-text dark:text-dark-text" />
                        <textarea value={editing.body} onChange={e => setEditing(p => p ? { ...p, body: e.target.value } : p)}
                            rows={4} placeholder="نص القالب *" className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-light-text dark:text-dark-text resize-none" />
                        <div className="flex gap-3">
                            <button onClick={() => {
                                if (!editing.title.trim() || !editing.body.trim()) return;
                                const exists = templates.find(t => t.id === editing.id);
                                onUpdate(exists ? templates.map(t => t.id === editing.id ? editing : t) : [...templates, editing]);
                                addNotification(NotificationType.Success, 'تم حفظ القالب');
                                setEditing(null);
                            }} className="flex-1 px-4 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary/90 transition">حفظ</button>
                            <button onClick={() => setEditing(null)} className="px-4 py-2.5 border border-light-border dark:border-dark-border rounded-xl text-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Sync Banner ───────────────────────────────────────────────────────────────

const SyncBanner: React.FC<{
    onSync: () => void;
    syncing: boolean;
    syncResult: SyncResponse | null;
    onGoToIntegrations: () => void;
}> = ({ onSync, syncing, syncResult, onGoToIntegrations }) => {
    const hasTokenError = syncResult?.results.some(
        r => r.errorCode === 'token_expired' || r.errorCode === 'permission_denied' || r.errorCode === 'no_token',
    ) ?? false;

    const hasInstagramResult = syncResult?.results.some(r => r.platform.toLowerCase() === 'instagram') ?? false;
    const instagramHasNoConversations = syncResult?.results.some(
        r => r.platform.toLowerCase() === 'instagram' && !r.error && r.conversationsSynced === 0,
    ) ?? false;

    return (
        <div className="flex flex-col items-center justify-center gap-6 py-20 px-6 text-center max-w-xl mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-primary/20 to-brand-pink/20 flex items-center justify-center">
                <i className="fas fa-inbox text-3xl text-brand-primary opacity-60" />
            </div>
            <div>
                <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-1">الصندوق الموحد فارغ</h3>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                    اضغط على الزر أدناه لجلب محادثاتك السابقة من Facebook وInstagram عبر Graph API الرسمي.
                </p>
            </div>

            <button
                onClick={onSync}
                disabled={syncing}
                className="flex items-center gap-3 px-6 py-3 bg-brand-primary text-white rounded-2xl font-semibold text-sm hover:bg-brand-primary/90 disabled:opacity-60 transition-all shadow-lg shadow-brand-primary/25"
            >
                {syncing
                    ? <><i className="fas fa-spinner animate-spin" />جاري جلب الرسائل...</>
                    : <><i className="fas fa-cloud-arrow-down" />جلب الرسائل من Facebook / Instagram</>
                }
            </button>

            {syncResult && (
                <div className="w-full space-y-3">
                    {syncResult.results.map((r, i) => (
                        <div key={i} className={`flex items-start gap-3 p-4 rounded-2xl text-right ${r.error ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'}`}>
                            <i className={`fas mt-0.5 ${r.error ? 'fa-circle-exclamation text-red-500' : 'fa-circle-check text-green-500'}`} />
                            <div className="flex-1 min-w-0 text-right">
                                <p className={`text-sm font-semibold ${r.error ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                                    {r.platform} — {r.accountName}
                                </p>
                                {r.error ? (
                                    <div className="mt-1 space-y-2">
                                        <p className="text-xs text-red-600 dark:text-red-400">
                                            {r.errorCode === 'no_token' && 'لا يوجد توكن — تحقق من ربط الحساب'}
                                            {r.errorCode === 'permission_denied' && 'صلاحية pages_messaging مفقودة — أعد ربط الحساب'}
                                            {r.errorCode === 'token_expired' && 'انتهت صلاحية التوكن — يجب إعادة ربط الحساب'}
                                            {r.errorCode === 'api_error' && `خطأ API: ${r.error}`}
                                            {!['no_token', 'permission_denied', 'token_expired', 'api_error'].includes(r.errorCode || '') && r.error}
                                        </p>
                                        {(r.errorCode === 'token_expired' || r.errorCode === 'permission_denied' || r.errorCode === 'no_token') && (
                                            <button
                                                onClick={onGoToIntegrations}
                                                className="flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:underline"
                                            >
                                                <i className="fas fa-plug text-[10px]" />
                                                اذهب إلى الإعدادات وأعد الربط
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="mt-0.5">
                                        <p className="text-xs text-green-600 dark:text-green-400">
                                            {r.conversationsSynced} محادثة · {r.messagesSynced} رسالة
                                        </p>
                                        {r.conversationsSynced === 0 && (r as any).debug && (
                                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 leading-relaxed">
                                                ⚠️ {(r as any).debug}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Instagram Advanced Access notice */}
                    {hasInstagramResult && instagramHasNoConversations && (
                        <div className="flex items-start gap-3 p-4 rounded-2xl text-right bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                            <i className="fab fa-instagram mt-0.5 text-purple-500 text-sm" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">Instagram DMs — تحتاج Advanced Access</p>
                                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 leading-relaxed">
                                    رسائل Instagram المباشرة تستلزم <strong>instagram_manage_messages</strong> التي تتطلب مراجعة Meta App Review.
                                    يمكنك جلب تعليقات الـ posts عبر Facebook فقط في الوقت الحالي.
                                </p>
                                <p className="text-xs text-purple-500 dark:text-purple-400 mt-1.5">
                                    للتقديم: Meta for Developers → تطبيقك → App Review → طلب instagram_manage_messages
                                </p>
                            </div>
                        </div>
                    )}

                    {syncResult.results.length === 0 && (
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            لا توجد حسابات Facebook/Instagram متصلة بهذا البراند.{' '}
                            <button onClick={onGoToIntegrations} className="text-brand-primary hover:underline font-semibold">
                                اربط حسابك الآن
                            </button>
                        </p>
                    )}
                </div>
            )}

            {hasTokenError && (
                <div className="w-full p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center gap-3 text-right">
                    <i className="fas fa-triangle-exclamation text-amber-500" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">انتهت صلاحية الربط</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                            أعد ربط حسابك لاستئناف جلب الرسائل تلقائياً.
                        </p>
                    </div>
                    <button
                        onClick={onGoToIntegrations}
                        className="flex-shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition-colors"
                    >
                        إعادة الربط
                    </button>
                </div>
            )}

            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                <i className="fas fa-shield-halved me-1 opacity-60" />
                يتم جلب الرسائل بأمان عبر Graph API الرسمي لـ Meta
            </p>
        </div>
    );
};

// ── Main InboxPage ────────────────────────────────────────────────────────────

export const InboxPage: React.FC<InboxPageProps> = ({ addNotification, brandId, brandProfile, onAddTask, onNavigate }) => {
    // ── State ──────────────────────────────────────────────────────────────────
    const { activeBrand } = useBrandStore();
    const effectiveBrandId = brandId || activeBrand?.id || '';

    const [conversations, setConversations] = useState<InboxConversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<SmartViewKey>('all');
    const [activePlatform, setActivePlatform] = useState<'all' | SocialPlatform>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [replyText, setReplyText] = useState('');
    const [inboxTab, setInboxTab] = useState<InboxTab>('inbox');
    const [showOrderDrawer, setShowOrderDrawer] = useState(false);
    const [templates, setTemplates] = useState<SavedReplyTemplate[]>(DEFAULT_TEMPLATES);
    const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);
    // ── Brand Agent state ──────────────────────────────────────────────────────
    const [agentConfig, setAgentConfig] = useState<BrandAgentConfig>({ ...DEFAULT_BRAND_AGENT_CONFIG, brandId: effectiveBrandId });
    const [crmContext, setCrmContext] = useState<CrmConversationContext | null>(null);
    const [agentDecision, setAgentDecision] = useState<AgentReplyDecision>('suggest_only');

    // sessionStorage key — hides SyncBanner after a successful sync so it doesn't reappear on every reload
    const syncDoneKey = `sbrandops_inbox_synced_${effectiveBrandId}`;
    const [syncDismissed, setSyncDismissed] = useState<boolean>(() => {
        try { return !!sessionStorage.getItem(syncDoneKey); } catch { return false; }
    });

    // ── Load conversations ─────────────────────────────────────────────────────
    const loadConversations = useCallback(async () => {
        if (!effectiveBrandId) return;
        setLoading(true);
        try {
            // Fetch both sources in parallel; social_messages may be empty if inbox-aggregator hasn't run
            const [legacyConvs, socialMsgs] = await Promise.all([
                getConversations(effectiveBrandId),
                getSocialMessagesAsConversations(effectiveBrandId),
            ]);

            // Merge: deduplicate by id (legacy ids are UUIDs; social ids are "sm::provider::thread")
            const legacyIds = new Set(legacyConvs.map(c => c.id));
            const uniqueSocial = socialMsgs.filter(c => !legacyIds.has(c.id));
            const merged = [...legacyConvs, ...uniqueSocial].sort(
                (a, b) => b.lastMessageTimestamp.getTime() - a.lastMessageTimestamp.getTime(),
            );

            setConversations(merged);
            if (merged.length > 0 && !selectedId) setSelectedId(merged[0].id);
        } catch (e) {
            console.error('loadConversations:', e);
        } finally {
            setLoading(false);
        }
    }, [effectiveBrandId]);

    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    // ── Load Brand Agent config ────────────────────────────────────────────────
    useEffect(() => {
        if (!effectiveBrandId) return;
        getBrandAgentConfig(effectiveBrandId)
            .then(cfg => setAgentConfig(cfg))
            .catch(() => null);
    }, [effectiveBrandId]);

    // ── Load CRM context when conversation changes ─────────────────────────────
    useEffect(() => {
        setCrmContext(null);
        if (!selectedId || selectedId.startsWith('sm::')) return;
        getConversationContext(effectiveBrandId, selectedId)
            .then(ctx => setCrmContext(ctx))
            .catch(() => null);
    }, [selectedId, effectiveBrandId]);

    // ── Compute auto-reply decision when conversation or config changes ─────────
    useEffect(() => {
        const conv = conversations.find(c => c.id === selectedId) ?? null;
        if (!conv) return;
        setAgentDecision(shouldAutoReply(conv, agentConfig));
    }, [conversations, selectedId, agentConfig]);

    // ── Supabase Realtime ──────────────────────────────────────────────────────
    // Listens for new/updated rows in inbox_conversations and inbox_messages,
    // then re-fetches the affected conversation so the UI updates without a full reload.
    useEffect(() => {
        if (!effectiveBrandId) return;

        const channel = supabase
            .channel(`inbox_realtime_${effectiveBrandId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'inbox_conversations',
                    filter: `brand_id=eq.${effectiveBrandId}`,
                },
                () => { loadConversations(); },
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'inbox_messages',
                    filter: `brand_id=eq.${effectiveBrandId}`,
                },
                async (payload) => {
                    const convId = payload.new?.conversation_id as string | undefined;
                    if (!convId) return;
                    // Re-fetch only the affected conversation
                    const updated = await getConversation(effectiveBrandId, convId);
                    if (updated) {
                        setConversations(prev => {
                            const exists = prev.some(c => c.id === convId);
                            const next = exists
                                ? prev.map(c => c.id === convId ? updated : c)
                                : [updated, ...prev];
                            return next.sort((a, b) => b.lastMessageTimestamp.getTime() - a.lastMessageTimestamp.getTime());
                        });
                    }
                },
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [effectiveBrandId, loadConversations]);

    // ── Filtered conversations ─────────────────────────────────────────────────
    const filteredConversations = useMemo(() => {
        let list = conversations;

        switch (activeView) {
            case 'unread':       list = list.filter(c => !c.isRead); break;
            case 'needs-reply':  list = list.filter(c => c.messages.at(-1)?.sender === 'user' && !c.isRead); break;
            case 'hot-leads':    list = list.filter(c => c.intent === ConversationIntent.PurchaseInquiry || c.tags?.includes('hot-lead')); break;
            case 'price-inquiry': list = list.filter(c => c.tags?.includes('price-inquiry')); break;
            case 'order-intent': list = list.filter(c => c.tags?.includes('order-intent')); break;
            case 'complaints':   list = list.filter(c => c.intent === ConversationIntent.Complaint || c.tags?.includes('complaint')); break;
            case 'resolved':     list = list.filter(c => c.status === 'resolved'); break;
            case 'spam':         list = list.filter(c => c.status === 'spam'); break;
            case 'archived':     list = list.filter(c => c.status === 'archived'); break;
            default:             list = list.filter(c => c.status !== 'archived' && c.status !== 'spam'); break;
        }

        if (activePlatform !== 'all') {
            list = list.filter(c => c.platform === activePlatform);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(c =>
                c.user.name.toLowerCase().includes(q) ||
                c.user.handle.toLowerCase().includes(q) ||
                (c.messages.at(-1)?.text ?? '').toLowerCase().includes(q)
            );
        }

        return [...list].sort((a, b) => {
            if (!a.isRead && b.isRead) return -1;
            if (a.isRead && !b.isRead) return 1;
            return new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime();
        });
    }, [conversations, activeView, activePlatform, searchQuery]);

    const selectedConversation = useMemo(
        () => conversations.find(c => c.id === selectedId) ?? null,
        [conversations, selectedId],
    );

    const unreadCount = useMemo(() => conversations.filter(c => !c.isRead).length, [conversations]);

    // ── Handlers ───────────────────────────────────────────────────────────────

    const handleSelect = useCallback(async (id: string) => {
        setSelectedId(id);
        setMobileView('chat');
        // Optimistic read
        setConversations(prev => prev.map(c => c.id === id ? { ...c, isRead: true } : c));
        // social_messages ids have format "sm::provider::thread_id"
        if (id.startsWith('sm::')) {
            const [, provider, threadId] = id.split('::');
            await markSocialMessageRead(effectiveBrandId, threadId, provider).catch(() => null);
        } else {
            await markConversationRead(effectiveBrandId, id).catch(() => null);
        }
    }, [effectiveBrandId]);

    // social_messages conversations (id starts with "sm::") are read-only — replies go through the platform directly
    const isSocialMsgConversation = selectedId?.startsWith('sm::') ?? false;

    const handleReply = useCallback(async (text: string) => {
        if (!selectedId || isSocialMsgConversation) return;

        // Optimistic: add the message immediately with a "sending" status
        const tempId = `temp_${Date.now()}`;
        const optimisticMsg = {
            id: tempId,
            sender: 'agent' as const,
            text,
            timestamp: new Date(),
            deliveryStatus: 'sending' as 'sending' | 'sent' | 'failed',
        };
        setConversations(prev => prev.map(c =>
            c.id === selectedId
                ? { ...c, messages: [...c.messages, optimisticMsg] }
                : c
        ));

        try {
            // 1. Try to send via platform (Graph API)
            const platformResult = await sendInboxReply(effectiveBrandId, selectedId, text);

            // 2. Always persist to DB
            const updated = await replyToConversation(selectedId, text, effectiveBrandId);

            // Replace optimistic message with real DB message, mark sent/failed
            setConversations(prev => prev.map(c => {
                if (c.id !== selectedId) return c;
                const realMsgs = updated.messages;
                // Mark the last agent message (the one just sent) with delivery status
                const lastIdx = [...realMsgs].reverse().findIndex(m => m.sender === 'agent');
                if (lastIdx >= 0) {
                    const realIdx = realMsgs.length - 1 - lastIdx;
                    realMsgs[realIdx] = {
                        ...realMsgs[realIdx],
                        deliveryStatus: platformResult.success ? 'sent' : 'failed',
                    };
                }
                return { ...updated, messages: realMsgs };
            }));

            if (!platformResult.success) {
                const isAuthErr = platformResult.error === 'token_expired' || platformResult.error === 'permission_denied';
                addNotification(
                    NotificationType.Warning,
                    isAuthErr
                        ? 'تم حفظ الرد، لكن فشل الإرسال إلى المنصة — أعد ربط الحساب'
                        : `تم حفظ الرد، لكن فشل الإرسال: ${platformResult.message || ''}`,
                );
            } else {
                addNotification(NotificationType.Success, '✅ تم إرسال الرد بنجاح');
            }
        } catch {
            // Mark optimistic message as failed
            setConversations(prev => prev.map(c =>
                c.id === selectedId
                    ? { ...c, messages: c.messages.map(m => m.id === tempId ? { ...m, deliveryStatus: 'failed' as const } : m) }
                    : c
            ));
            addNotification(NotificationType.Error, 'فشل إرسال الرد');
        }
    }, [selectedId, isSocialMsgConversation, effectiveBrandId, addNotification]);

    const handleStatusChange = useCallback(async (status: ConversationStatus) => {
        if (!selectedId || isSocialMsgConversation) return;
        setConversations(prev => prev.map(c => c.id === selectedId ? { ...c, status } : c));
        await updateConversationStatus(effectiveBrandId, selectedId, status).catch(() => null);
    }, [selectedId, isSocialMsgConversation, effectiveBrandId]);

    const handlePriorityChange = useCallback(async (priority: ConversationPriority) => {
        if (!selectedId || isSocialMsgConversation) return;
        setConversations(prev => prev.map(c => c.id === selectedId ? { ...c, priority } : c));
        await updateConversationPriority(effectiveBrandId, selectedId, priority).catch(() => null);
    }, [selectedId, isSocialMsgConversation, effectiveBrandId]);

    const handleTagsChanged = useCallback(() => {
        if (!selectedId || isSocialMsgConversation) return;
        getConversations(effectiveBrandId).then(data => {
            const updated = data.find(c => c.id === selectedId);
            if (updated) setConversations(prev => prev.map(c => c.id === selectedId ? updated : c));
        }).catch(() => null);
    }, [selectedId, isSocialMsgConversation, effectiveBrandId]);

    const handleLeadCreated = useCallback((customerId: string) => {
        if (!selectedId) return;
        setConversations(prev => prev.map(c => c.id === selectedId ? { ...c, crmCustomerId: customerId } : c));
    }, [selectedId]);

    const handleGoToIntegrations = useCallback(() => {
        if (onNavigate) {
            onNavigate('integrations');
        } else {
            window.location.href = '/app/integrations';
        }
    }, [onNavigate]);

    const handleSync = useCallback(async () => {
        if (!effectiveBrandId) return;
        setSyncing(true);
        setSyncResult(null);
        try {
            const result = await syncInboxFromSocial(effectiveBrandId);
            setSyncResult(result);
            if (result.totalConversations > 0) {
                await loadConversations();
                // Hide SyncBanner for this session once we have actual conversations
                try { sessionStorage.setItem(syncDoneKey, '1'); } catch { /* ignore */ }
                setSyncDismissed(true);
            }
            addNotification(
                result.success ? NotificationType.Success : NotificationType.Error,
                result.message,
            );
        } catch (err: any) {
            addNotification(NotificationType.Error, err.message || 'فشل الاتصال بخدمة المزامنة');
        } finally {
            setSyncing(false);
        }
    }, [effectiveBrandId, loadConversations, addNotification, syncDoneKey]);

    const handleOrderCreated = useCallback((orderId: string) => {
        setShowOrderDrawer(false);
        addNotification(NotificationType.Success, `✅ تم إنشاء الطلب بنجاح`);
        if (selectedId) {
            setConversations(prev => prev.map(c =>
                c.id === selectedId
                    ? { ...c, status: 'resolved', tags: [...(c.tags ?? []), 'order-created'].filter((v, i, a) => a.indexOf(v) === i) }
                    : c
            ));
        }
    }, [selectedId, addNotification]);

    // ── Stats ──────────────────────────────────────────────────────────────────
    const hotLeadsCount = useMemo(
        () => conversations.filter(c => c.intent === ConversationIntent.PurchaseInquiry || c.tags?.includes('hot-lead')).length,
        [conversations],
    );

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <PageScaffold
            kicker="Unified Inbox"
            title="الصندوق الموحد"
            description="إدارة كل رسائل وتعليقات المنصات من مكان واحد — ردّ، صنّف، وأنشئ ليدات وطلبات مباشرة."
            stats={[
                { label: 'غير مقروء',      value: unreadCount.toString(),        tone: unreadCount > 0 ? 'text-brand-pink' : undefined, icon: 'fa-envelope-open' },
                { label: 'إجمالي المحادثات', value: conversations.length.toString(), icon: 'fa-comments' },
                { label: 'ليدز حارة',       value: hotLeadsCount.toString(),       tone: hotLeadsCount > 0 ? 'text-red-500' : undefined, icon: 'fa-fire' },
            ]}
        >
            <PageSection className="pt-0">
                {/* Tab switcher */}
                <div className="flex gap-1 border-b border-light-border dark:border-dark-border mb-4">
                    {([
                        { id: 'inbox',     icon: 'fa-inbox',       label: unreadCount > 0 ? `الصندوق (${unreadCount})` : 'الصندوق' },
                        { id: 'templates', icon: 'fa-comment-dots', label: 'قوالب الردود' },
                        { id: 'keywords',  icon: 'fa-tags',         label: 'الكلمات المفتاحية' },
                    ] as { id: InboxTab; icon: string; label: string }[]).map(tab => (
                        <button key={tab.id} onClick={() => setInboxTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${inboxTab === tab.id ? 'border-brand-primary text-brand-primary' : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}>
                            <i className={`fas ${tab.icon} text-xs`} />{tab.label}
                        </button>
                    ))}
                </div>

                {/* ── INBOX VIEW ── */}
                {inboxTab === 'inbox' && (
                    <>
                        {/* Sync banner — shown when inbox is empty AND not already synced this session */}
                        {!loading && conversations.length === 0 && !syncDismissed && (
                            <SyncBanner
                                onSync={handleSync}
                                syncing={syncing}
                                syncResult={syncResult}
                                onGoToIntegrations={handleGoToIntegrations}
                            />
                        )}

                        {/* Desktop (4-panel layout) */}
                        <div className={`hidden lg:flex h-[calc(100vh-200px)] bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border overflow-hidden${!loading && conversations.length === 0 ? ' !hidden' : ''}`}>
                            <SmartViewsSidebar
                                conversations={conversations}
                                activeView={activeView}
                                activePlatform={activePlatform}
                                onViewChange={setActiveView}
                                onPlatformChange={setActivePlatform}
                                onSync={handleSync}
                                syncing={syncing}
                            />
                            <ConversationListPanel
                                conversations={filteredConversations}
                                selectedId={selectedId}
                                onSelect={handleSelect}
                                searchQuery={searchQuery}
                                onSearchChange={setSearchQuery}
                                isLoading={loading}
                            />
                            {/* Chat + Shift banner */}
                            <div className="flex flex-col flex-grow border-e border-light-border dark:border-dark-border overflow-hidden">
                                {/* Shift mode banner */}
                                <ShiftModeManager
                                    config={agentConfig}
                                    onConfigChange={setAgentConfig}
                                    addNotification={addNotification}
                                />
                                {selectedConversation ? (
                                    <div className="flex-1 overflow-hidden">
                                        <ChatWindow
                                            conversation={selectedConversation}
                                            isReadOnly={isSocialMsgConversation}
                                            onReply={handleReply}
                                            replyText={replyText}
                                            onReplyTextChange={setReplyText}
                                            templates={templates}
                                            onStatusChange={handleStatusChange}
                                            onPriorityChange={handlePriorityChange}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
                                        <div className="w-16 h-16 rounded-2xl bg-light-bg dark:bg-dark-bg flex items-center justify-center">
                                            <i className="fas fa-comment-dots text-3xl text-light-text-secondary dark:text-dark-text-secondary opacity-30" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-light-text dark:text-dark-text">اختر محادثة للرد</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 leading-relaxed">
                                                اضغط على أي محادثة من القائمة لعرضها والرد عليها
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* Brand Agent Panel (right sidebar) */}
                            {selectedConversation && (
                                <div className="w-72 flex-shrink-0 overflow-hidden">
                                    <BrandAgentPanel
                                        conversation={selectedConversation}
                                        brandProfile={brandProfile}
                                        config={agentConfig}
                                        crmContext={crmContext}
                                        decision={agentDecision}
                                        onUseReply={setReplyText}
                                        onSendReply={async (text) => {
                                            await handleReply(text);
                                            await logAgentAction(effectiveBrandId, selectedConversation.id,
                                                agentDecision === 'auto_send' ? 'auto_replied' : 'suggested',
                                                text, agentDecision);
                                        }}
                                        onEscalate={() => {
                                            handleStatusChange('pending');
                                            addNotification(NotificationType.Warning, '⚠️ تم تأشير المحادثة للتصعيد');
                                            logAgentAction(effectiveBrandId, selectedConversation.id, 'escalated', undefined, 'escalate');
                                        }}
                                        addNotification={addNotification}
                                    />
                                </div>
                            )}
                            {/* Old ActionPanel preserved alongside (CRM + Notes tabs) */}
                            {selectedConversation && (
                                <ActionPanel
                                    conversation={selectedConversation}
                                    brandId={effectiveBrandId}
                                    brandProfile={brandProfile}
                                    onApplyReply={setReplyText}
                                    onAddTask={onAddTask}
                                    addNotification={addNotification}
                                    onStatusChange={handleStatusChange}
                                    onLeadCreated={handleLeadCreated}
                                    onOrderDrawerOpen={() => setShowOrderDrawer(true)}
                                    onTagsChanged={handleTagsChanged}
                                />
                            )}
                        </div>

                        {/* Mobile layout */}
                        <div className={`lg:hidden${!loading && conversations.length === 0 ? ' hidden' : ''}`}>
                            {/* Mobile platform filter chips */}
                            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar">
                                {(['all', ...Object.values(SocialPlatform)] as ('all' | SocialPlatform)[])
                                    .filter(p => p === 'all' || conversations.some(c => c.platform === p))
                                    .map(p => {
                                        const isActive = activePlatform === p;
                                        const cnt = p === 'all' ? conversations.length : conversations.filter(c => c.platform === p).length;
                                        return (
                                            <button key={p} onClick={() => { setActivePlatform(p); if (p !== 'all') setActiveView('all'); }}
                                                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${isActive ? 'bg-brand-primary text-white' : 'bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary border border-light-border dark:border-dark-border'}`}>
                                                {p !== 'all' && <i className={`${PLATFORM_ASSETS[p as SocialPlatform].icon} text-[10px]`} />}
                                                {p === 'all' ? 'الكل' : p}
                                                <span className={`rounded-full px-1.5 text-[9px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-light-border dark:bg-dark-border'}`}>{cnt}</span>
                                            </button>
                                        );
                                    })}
                            </div>

                            {mobileView === 'list' ? (
                                <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card overflow-hidden">
                                    {/* Search */}
                                    <div className="p-3 border-b border-light-border dark:border-dark-border">
                                        <div className="relative">
                                            <i className="fas fa-search absolute start-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary text-xs pointer-events-none" />
                                            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="بحث..."
                                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl ps-8 py-2 text-xs focus:ring-2 focus:ring-brand-primary text-light-text dark:text-dark-text" />
                                        </div>
                                    </div>
                                    {filteredConversations.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                                            <i className="fas fa-inbox text-3xl text-light-text-secondary dark:text-dark-text-secondary opacity-30" />
                                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">لا توجد محادثات</p>
                                        </div>
                                    ) : (
                                        filteredConversations.map(conv => (
                                            <ConversationCard key={conv.id} conv={conv} isActive={false} onClick={() => handleSelect(conv.id)} />
                                        ))
                                    )}
                                </div>
                            ) : selectedConversation ? (
                                <div className="flex flex-col rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
                                    <div className="flex items-center gap-3 border-b border-light-border dark:border-dark-border px-3 py-2.5 bg-light-bg dark:bg-dark-bg flex-shrink-0">
                                        <button onClick={() => setMobileView('list')} className="flex h-8 w-8 items-center justify-center rounded-xl bg-light-card dark:bg-dark-card text-light-text dark:text-dark-text">
                                            <i className="fas fa-arrow-right" />
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-light-text dark:text-dark-text truncate">{selectedConversation.user.name}</p>
                                            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{selectedConversation.platform}</p>
                                        </div>
                                        <button onClick={() => handleStatusChange('resolved')}
                                            className="flex h-8 px-3 items-center gap-1.5 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-semibold">
                                            <i className="fas fa-check text-[10px]" /> محلول
                                        </button>
                                    </div>
                                    <ChatWindow
                                        conversation={selectedConversation}
                                        isReadOnly={isSocialMsgConversation}
                                        onReply={handleReply}
                                        replyText={replyText}
                                        onReplyTextChange={setReplyText}
                                        templates={templates}
                                        onStatusChange={handleStatusChange}
                                        onPriorityChange={handlePriorityChange}
                                    />
                                </div>
                            ) : null}
                        </div>
                    </>
                )}

                {/* ── TEMPLATES VIEW ── */}
                {inboxTab === 'templates' && (
                    <TemplatesTab templates={templates} onUpdate={setTemplates} addNotification={addNotification} />
                )}

                {/* ── KEYWORDS VIEW ── */}
                {inboxTab === 'keywords' && (
                    <div className="space-y-4">
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            الكلمات المفتاحية تُستخدم لتصنيف المحادثات تلقائياً وإضافة تاغات وأولويات عند استقبال رسائل جديدة.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {([
                                { cat: 'price',     label: 'استفسار سعر',     icon: 'fa-tag',                  kws: ['سعر', 'كام', 'بكام', 'تكلفة', 'price', 'cost', 'how much'], tag: 'price-inquiry', priority: 'high' },
                                { cat: 'sales',     label: 'نية شراء',         icon: 'fa-fire',                 kws: ['اشتري', 'عايز اطلب', 'متاح', 'buy', 'purchase', 'order now'], tag: 'hot-lead', priority: 'urgent' },
                                { cat: 'order',     label: 'طلب شراء',          icon: 'fa-cart-shopping',        kws: ['طلب', 'اوردر', 'order', 'checkout'], tag: 'order-intent', priority: 'high' },
                                { cat: 'complaint', label: 'شكاوى',             icon: 'fa-triangle-exclamation', kws: ['مشكلة', 'شكوى', 'عطل', 'complaint', 'issue', 'problem'], tag: 'complaint', priority: 'high' },
                                { cat: 'support',   label: 'دعم تقني',          icon: 'fa-headset',              kws: ['مش شغال', 'مساعدة', 'support', 'help', 'not working'], tag: 'support', priority: 'high' },
                                { cat: 'delivery',  label: 'توصيل وشحن',        icon: 'fa-truck',                kws: ['توصيل', 'شحن', 'العنوان', 'delivery', 'shipping', 'address'], tag: 'delivery', priority: 'medium' },
                            ]).map(group => (
                                <div key={group.cat} className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${tagColor(group.tag)}`}>
                                            <i className={`fas ${group.icon} text-xs`} />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-light-text dark:text-dark-text">{group.label}</p>
                                            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                                                تاغ: <span className={`px-1.5 py-0.5 rounded-full ${tagColor(group.tag)}`}>{group.tag}</span>
                                                {' · '}أولوية: {group.priority}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {group.kws.map(kw => (
                                            <span key={kw} className="text-[10px] px-2 py-1 rounded-xl bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-text dark:text-dark-text font-mono">
                                                {kw}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                                        مُحمَّل من قاعدة البيانات · يمكن إضافة كلمات مخصصة عبر جدول <code>inbox_keyword_rules</code>
                                    </p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 p-4 bg-brand-primary/5 border border-brand-primary/20 rounded-2xl">
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                                <i className="fas fa-info-circle text-brand-primary me-1.5" />
                                قواعد الكلمات المفتاحية يتم تطبيقها تلقائياً على كل رسالة جديدة تصل. يمكن إضافة قواعد مخصصة من جدول <strong>inbox_keyword_rules</strong> في قاعدة البيانات أو عبر واجهة الإدارة (قيد التطوير).
                            </p>
                        </div>
                    </div>
                )}
            </PageSection>

            {/* Order Drawer */}
            {showOrderDrawer && selectedConversation && (
                <OrderDrawer
                    conversation={selectedConversation}
                    brandId={effectiveBrandId}
                    onSuccess={handleOrderCreated}
                    onClose={() => setShowOrderDrawer(false)}
                    addNotification={addNotification}
                />
            )}
        </PageScaffold>
    );
};
