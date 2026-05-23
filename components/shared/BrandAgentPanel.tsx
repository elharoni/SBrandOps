// components/shared/BrandAgentPanel.tsx
// ─────────────────────────────────────────────────────────────────────────────
// لوحة الوكيل الذكي — تظهر على يمين كل محادثة
// تعرض: ردود مقترحة + ملخص + سياق CRM + أزرار إجراء
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import {
    InboxConversation, BrandHubProfile, NotificationType,
} from '../../types';
import {
    BrandAgentConfig, BrandAgentSuggestions, BrandAgentReply,
    generateBrandReplySuggestions, AgentReplyDecision,
} from '../../services/brandAgentService';
import type { CrmConversationContext } from '../../services/crmInboxService';

// ── Types ──────────────────────────────────────────────────────────────────────

interface BrandAgentPanelProps {
    conversation: InboxConversation;
    brandProfile: BrandHubProfile;
    config: BrandAgentConfig;
    crmContext?: CrmConversationContext | null;
    decision: AgentReplyDecision;
    onUseReply: (text: string) => void;
    onSendReply: (text: string) => Promise<void>;
    onEscalate: () => void;
    addNotification: (type: NotificationType, msg: string) => void;
}

const STYLE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
    warm:   { label: 'دافئ',        icon: 'fa-heart',        color: 'text-rose-500',    bg: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' },
    direct: { label: 'مباشر',       icon: 'fa-bolt',         color: 'text-blue-500',    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
    sales:  { label: 'إقناعي',      icon: 'fa-chart-line',   color: 'text-violet-500',  bg: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800' },
};

const CRM_ACTION_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
    lead:   { label: 'أنشئ ليد',    icon: 'fa-user-plus',   color: 'text-green-600' },
    order:  { label: 'أنشئ طلب',    icon: 'fa-shopping-bag', color: 'text-blue-600' },
    ticket: { label: 'أنشئ تذكرة',  icon: 'fa-ticket',      color: 'text-orange-600' },
    none:   { label: '',             icon: '',                color: '' },
};

// ── Skeleton Loader ────────────────────────────────────────────────────────────

const AgentSkeleton: React.FC = () => (
    <div className="space-y-3 animate-pulse p-4">
        <div className="h-3 bg-light-bg dark:bg-dark-bg rounded-full w-3/4" />
        <div className="space-y-2">
            {[1, 2, 3].map(i => (
                <div key={i} className="rounded-xl border border-light-border dark:border-dark-border p-3 space-y-2">
                    <div className="flex gap-2">
                        <div className="w-5 h-5 rounded-full bg-light-bg dark:bg-dark-bg" />
                        <div className="h-3 bg-light-bg dark:bg-dark-bg rounded w-16" />
                    </div>
                    <div className="space-y-1.5">
                        <div className="h-2.5 bg-light-bg dark:bg-dark-bg rounded w-full" />
                        <div className="h-2.5 bg-light-bg dark:bg-dark-bg rounded w-5/6" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// ── CRM Context Card (inline) ─────────────────────────────────────────────────

const InlineCrmCard: React.FC<{ ctx: CrmConversationContext }> = ({ ctx }) => {
    const { customer, bulletPoints, isVip, isAtRisk } = ctx;
    const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'العميل';

    return (
        <div className="mx-4 mb-3 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg p-3">
            <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${isVip ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                           : 'bg-brand-primary/10 text-brand-primary'}`}>
                    {isVip ? '⭐' : fullName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-light-text dark:text-dark-text truncate">{fullName}</p>
                    {isAtRisk && (
                        <span className="text-[10px] text-orange-500 font-medium">⚠️ عميل في خطر</span>
                    )}
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary">CRM</span>
            </div>
            {bulletPoints.slice(0, 3).map((bp, i) => (
                <p key={i} className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">{bp}</p>
            ))}
        </div>
    );
};

// ── Reply Card ─────────────────────────────────────────────────────────────────

const ReplyCard: React.FC<{
    reply: BrandAgentReply;
    onUse: () => void;
    onSend: () => void;
    isSending: boolean;
}> = ({ reply, onUse, onSend, isSending }) => {
    const [expanded, setExpanded] = useState(false);
    const cfg = STYLE_CONFIG[reply.style] || STYLE_CONFIG.direct;
    const isLong = reply.text.length > 120;

    return (
        <div className={`rounded-xl border p-3 transition-all hover:shadow-sm cursor-pointer group ${cfg.bg}`}
             onClick={() => isLong && setExpanded(e => !e)}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                    <i className={`fas ${cfg.icon} ${cfg.color} text-xs`} />
                    <span className={`text-[11px] font-bold ${cfg.color}`}>{cfg.label}</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                        {reply.confidence}%
                    </span>
                    <div className="w-12 h-1 bg-light-border dark:bg-dark-border rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${
                                reply.confidence >= 80 ? 'bg-green-400' :
                                reply.confidence >= 60 ? 'bg-yellow-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${reply.confidence}%` }}
                        />
                    </div>
                </div>
            </div>

            <p className={`text-xs text-light-text dark:text-dark-text leading-relaxed ${!expanded && isLong ? 'line-clamp-3' : ''}`}>
                {reply.text}
            </p>
            {isLong && (
                <button className="text-[10px] text-brand-primary mt-1 hover:underline" onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}>
                    {expanded ? 'أقل ↑' : 'أكثر ↓'}
                </button>
            )}

            <div className="flex gap-1.5 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={e => { e.stopPropagation(); onUse(); }}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold bg-white dark:bg-dark-card border border-light-border dark:border-dark-border text-light-text dark:text-dark-text hover:border-brand-primary/50 transition"
                >
                    <i className="fas fa-pen text-[9px]" />
                    تحرير
                </button>
                <button
                    onClick={e => { e.stopPropagation(); onSend(); }}
                    disabled={isSending}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-60 transition"
                >
                    {isSending
                        ? <><i className="fas fa-spinner fa-spin text-[9px]" /> جاري...</>
                        : <><i className="fas fa-paper-plane text-[9px]" /> إرسال</>
                    }
                </button>
            </div>
        </div>
    );
};

// ── Main Panel ─────────────────────────────────────────────────────────────────

export const BrandAgentPanel: React.FC<BrandAgentPanelProps> = ({
    conversation, brandProfile, config, crmContext, decision,
    onUseReply, onSendReply, onEscalate, addNotification,
}) => {
    const [suggestions, setSuggestions] = useState<BrandAgentSuggestions | null>(null);
    const [loading, setLoading] = useState(false);
    const [sendingIdx, setSendingIdx] = useState<number | null>(null);
    const [generated, setGenerated] = useState(false);

    const generate = useCallback(async () => {
        if (loading) return;
        setLoading(true);
        try {
            const result = await generateBrandReplySuggestions(
                conversation, brandProfile, config, crmContext,
            );
            setSuggestions(result);
            setGenerated(true);
        } catch (err) {
            addNotification(NotificationType.Error, 'فشل توليد الردود — تحقق من إعدادات AI');
        } finally {
            setLoading(false);
        }
    }, [conversation, brandProfile, config, crmContext, loading, addNotification]);

    const handleSend = async (text: string, idx: number) => {
        setSendingIdx(idx);
        try {
            await onSendReply(text);
        } finally {
            setSendingIdx(null);
        }
    };

    const isComment = conversation.itemType
        ? ['facebook_comment', 'instagram_comment', 'ad_comment', 'mention', 'story_reply'].includes(conversation.itemType)
        : false;

    const decisionBadge = {
        auto_send:    { label: 'رد تلقائي مفعّل',   color: 'text-green-600 bg-green-50 dark:bg-green-900/20',  icon: 'fa-robot' },
        suggest_only: { label: 'وضع الاقتراح',        color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',    icon: 'fa-magic-wand-sparkles' },
        escalate:     { label: 'يحتاج تصعيد',         color: 'text-red-600 bg-red-50 dark:bg-red-900/20',       icon: 'fa-triangle-exclamation' },
    }[decision];

    const crmCfg = suggestions?.crmAction ? CRM_ACTION_CONFIG[suggestions.crmAction] : null;

    return (
        <div className="flex flex-col h-full border-s border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card">
            {/* Header */}
            <div className="p-3 border-b border-light-border dark:border-dark-border flex-shrink-0">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-robot text-white text-xs" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-light-text dark:text-dark-text">وكيل البراند</p>
                        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                            {brandProfile.brandName}
                        </p>
                    </div>
                </div>

                {/* Decision badge */}
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold ${decisionBadge.color}`}>
                    <i className={`fas ${decisionBadge.icon} text-[10px]`} />
                    {decisionBadge.label}
                    {config.shiftMode === 'human' && (
                        <span className="ms-auto text-[10px] opacity-70">
                            👤 {config.shiftModeratorName}
                        </span>
                    )}
                </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
                {/* CRM Context */}
                {crmContext && (
                    <div className="pt-3">
                        <InlineCrmCard ctx={crmContext} />
                    </div>
                )}

                {/* AI Summary (after generation) */}
                {suggestions?.summary && (
                    <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border">
                        <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
                            <i className="fas fa-brain me-1 text-violet-400" />
                            ملخص المحادثة
                        </p>
                        <p className="text-xs text-light-text dark:text-dark-text leading-relaxed">{suggestions.summary}</p>
                        {suggestions.detectedIntent && (
                            <p className="text-[10px] text-brand-primary mt-1">
                                <i className="fas fa-tag me-1" />
                                {suggestions.detectedIntent}
                            </p>
                        )}
                    </div>
                )}

                {/* Generate Button / Loading / Suggestions */}
                {!generated && !loading && (
                    <div className="p-4">
                        <button
                            onClick={generate}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-bold hover:opacity-90 transition shadow-sm shadow-violet-500/20"
                        >
                            <i className="fas fa-wand-magic-sparkles text-sm" />
                            توليد ردود ذكية
                        </button>
                        <p className="text-center text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-2">
                            بنبرة {brandProfile.brandName} · {isComment ? 'تعليق' : 'رسالة خاصة'}
                        </p>
                    </div>
                )}

                {loading && <AgentSkeleton />}

                {generated && suggestions && !loading && (
                    <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">
                                اختر ردّك
                            </p>
                            <button
                                onClick={generate}
                                className="text-[10px] text-brand-primary hover:underline flex items-center gap-0.5"
                            >
                                <i className="fas fa-rotate-right text-[9px]" /> تجديد
                            </button>
                        </div>

                        {suggestions.replies.map((reply, i) => (
                            <ReplyCard
                                key={i}
                                reply={reply}
                                onUse={() => onUseReply(reply.text)}
                                onSend={() => handleSend(reply.text, i)}
                                isSending={sendingIdx === i}
                            />
                        ))}

                        {/* CRM Action suggestion */}
                        {crmCfg && suggestions.crmAction !== 'none' && (
                            <div className="mt-2 px-3 py-2 rounded-xl border border-dashed border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg">
                                <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                    <i className="fas fa-lightbulb me-1 text-amber-400" />
                                    إجراء CRM مقترح
                                </p>
                                <div className={`flex items-center gap-1.5 text-xs font-semibold ${crmCfg.color}`}>
                                    <i className={`fas ${crmCfg.icon} text-xs`} />
                                    {crmCfg.label}
                                </div>
                            </div>
                        )}

                        {/* Suggested next action */}
                        {suggestions.suggestedAction && (
                            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary px-1">
                                <i className="fas fa-arrow-right me-1" />
                                {suggestions.suggestedAction}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Footer actions */}
            <div className="p-3 border-t border-light-border dark:border-dark-border flex-shrink-0 space-y-2">
                {decision === 'escalate' && (
                    <button
                        onClick={onEscalate}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition"
                    >
                        <i className="fas fa-triangle-exclamation" />
                        تصعيد فوري للمودريتور
                    </button>
                )}
                <div className="flex gap-2">
                    {!generated && (
                        <button
                            onClick={generate}
                            disabled={loading}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold border border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 disabled:opacity-50 transition"
                        >
                            <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} text-[10px]`} />
                            {loading ? 'جاري...' : 'رد ذكي'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
