/**
 * Messages Tab inside CustomerProfilePage.
 * Shows all inbox conversations linked to this CRM customer.
 * Allows converting a conversation to a CRM task.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { CrmTaskPriority } from '../../../types';
import {
    CrmConversationContext,
    getConversationsByCustomer,
    buildReplyContext,
    convertConversationToTask,
    manualLinkConversation,
    LinkedConversation,
} from '../../../services/crmInboxService';
import { LIFECYCLE_STAGE_CONFIG } from '../../../services/crmService';

// ── Platform icons ────────────────────────────────────────────────────────────
const PLATFORM_ICONS: Record<string, { icon: string; color: string }> = {
    Facebook:  { icon: 'fab fa-facebook',  color: 'text-blue-600' },
    Instagram: { icon: 'fab fa-instagram', color: 'text-pink-600' },
    X:         { icon: 'fab fa-twitter',   color: 'text-gray-800' },
    WhatsApp:  { icon: 'fab fa-whatsapp',  color: 'text-green-500' },
    Email:     { icon: 'fas fa-envelope',  color: 'text-indigo-600' },
    Telegram:  { icon: 'fab fa-telegram',  color: 'text-sky-500' },
};

// ── AI Context Panel ──────────────────────────────────────────────────────────

const AiContextPanel: React.FC<{ context: CrmConversationContext }> = ({ context }) => {
    const stageCfg = LIFECYCLE_STAGE_CONFIG[context.customer.lifecycleStage];
    return (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
                <i className="fas fa-robot text-indigo-500" />
                <span className="text-sm font-semibold text-indigo-800">سياق الرد الذكي</span>
            </div>

            {/* Customer quick badge */}
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {[context.customer.firstName, context.customer.lastName].filter(Boolean).join('').slice(0, 2).toUpperCase() || '??'}
                </div>
                <div>
                    <p className="text-xs font-medium text-gray-800">
                        {[context.customer.firstName, context.customer.lastName].filter(Boolean).join(' ') || 'عميل'}
                    </p>
                    <span className={`text-xs ${stageCfg.color} font-medium`}>{stageCfg.labelAr}</span>
                </div>
                {context.isVip && (
                    <span className="mr-auto bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        ⭐ VIP
                    </span>
                )}
            </div>

            {/* Bullet points */}
            <ul className="space-y-1">
                {context.bulletPoints.map((bp, i) => (
                    <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                        <span className="mt-0.5 flex-shrink-0">•</span>
                        <span>{bp}</span>
                    </li>
                ))}
            </ul>

            {/* Recent orders mini-list */}
            {context.recentOrders.length > 0 && (
                <div className="pt-2 border-t border-indigo-100">
                    <p className="text-xs font-medium text-indigo-700 mb-1">آخر الطلبات</p>
                    <div className="space-y-0.5">
                        {context.recentOrders.slice(0, 3).map(order => (
                            <div key={order.id} className="flex items-center justify-between text-xs">
                                <span className="text-gray-600">#{order.externalId}</span>
                                <span className={`font-medium ${
                                    order.status === 'completed' ? 'text-green-600' :
                                    order.status === 'refunded'  ? 'text-orange-600' :
                                    'text-blue-600'
                                }`}>{order.status === 'completed' ? 'مكتمل' : order.status === 'refunded' ? 'مسترد' : 'قيد التنفيذ'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Suggested reply tone */}
            <div className="pt-2 border-t border-indigo-100">
                <p className="text-xs font-medium text-indigo-700 mb-1">توصية الرد</p>
                <p className="text-xs text-gray-600 italic">
                    {context.isVip
                        ? '💎 عامل هذا العميل بأولوية قصوى — استخدم نبرة شخصية ومميزة.'
                        : context.isAtRisk
                            ? '⚠️ هذا العميل في خطر الانسحاب — قدم عرضًا أو خصمًا للاحتفاظ به.'
                            : context.refundsCount > 0
                                ? '🔄 لديه مرتجعات سابقة — كن استباقيًا وطمئنه على جودة الخدمة.'
                                : context.openOrdersCount > 0
                                    ? '📦 لديه طلب قيد التنفيذ — تأكد من تزويده بآخر تحديثات الشحن.'
                                    : '😊 عميل عادي — رد بلطف وسرعة.'}
                </p>
            </div>
        </div>
    );
};

// ── Convert to Task Modal ─────────────────────────────────────────────────────

interface ConvertToTaskModalProps {
    conversationId: string;
    brandId: string;
    onSuccess: () => void;
    onClose: () => void;
}

const ConvertToTaskModal: React.FC<ConvertToTaskModalProps> = ({
    conversationId, brandId, onSuccess, onClose
}) => {
    const [title, setTitle]       = useState('');
    const [priority, setPriority] = useState<CrmTaskPriority>(CrmTaskPriority.Medium);
    const [dueDate, setDueDate]   = useState('');
    const [saving, setSaving]     = useState(false);

    const priorityOpts: { value: CrmTaskPriority; label: string }[] = [
        { value: CrmTaskPriority.Low,    label: 'منخفض' },
        { value: CrmTaskPriority.Medium, label: 'متوسط' },
        { value: CrmTaskPriority.High,   label: 'عالي' },
        { value: CrmTaskPriority.Urgent, label: 'عاجل' },
    ];

    const handleSave = async () => {
        if (!title.trim()) return;
        setSaving(true);
        await convertConversationToTask(brandId, conversationId, title, priority, dueDate || undefined);
        setSaving(false);
        onSuccess();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">تحويل إلى مهمة</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <i className="fas fa-times" />
                    </button>
                </div>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="عنوان المهمة *"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex gap-2">
                    <select value={priority} onChange={e => setPriority(e.target.value as CrmTaskPriority)}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700">
                        {priorityOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
                    />
                </div>
                <div className="flex gap-2 pt-1">
                    <button onClick={handleSave} disabled={saving || !title.trim()}
                        className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1">
                        {saving ? <i className="fas fa-circle-notch fa-spin" /> : null}
                        إنشاء مهمة
                    </button>
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                        إلغاء
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Conversation Card ──────────────────────────────────────────────────────────

const ConversationCard: React.FC<{
    conv: LinkedConversation;
    onConvertTask: (id: string) => void;
    onViewContext: (id: string) => void;
    isLoadingContext: boolean;
}> = ({ conv, onConvertTask, onViewContext, isLoadingContext }) => {
    const platCfg = PLATFORM_ICONS[conv.platform] ?? { icon: 'fas fa-comment', color: 'text-gray-500' };
    const matchBadge: Record<string, string> = {
        email:    'bg-blue-50 text-blue-600',
        phone:    'bg-green-50 text-green-600',
        order_id: 'bg-amber-50 text-amber-600',
        manual:   'bg-gray-100 text-gray-500',
    };

    return (
        <div className={`bg-white border rounded-xl p-3 ${!conv.isRead ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-200'}`}>
            <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${conv.userAvatarUrl ? '' : 'bg-gray-100'}`}>
                    {conv.userAvatarUrl
                        ? <img src={conv.userAvatarUrl} alt={conv.userName} className="w-9 h-9 rounded-full object-cover" />
                        : <i className={`${platCfg.icon} ${platCfg.color} text-base`} />
                    }
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800">{conv.userName}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${matchBadge[conv.matchedBy] ?? 'bg-gray-100 text-gray-500'}`}>
                            {conv.matchedBy === 'email' ? 'إيميل' : conv.matchedBy === 'phone' ? 'جوال' : conv.matchedBy === 'order_id' ? 'طلب' : 'يدوي'}
                        </span>
                        {!conv.isRead && (
                            <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                        )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                        <i className={`${platCfg.icon} ${platCfg.color} text-xs`} />
                        <span>{conv.platform}</span>
                        {conv.lastMessageAt && (
                            <>
                                <span>·</span>
                                <span>{new Date(conv.lastMessageAt).toLocaleDateString('ar-SA')}</span>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={() => onViewContext(conv.conversationId)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="عرض السياق الذكي"
                    >
                        {isLoadingContext
                            ? <i className="fas fa-circle-notch fa-spin text-xs" />
                            : <i className="fas fa-robot text-xs" />
                        }
                    </button>
                    <button
                        onClick={() => onConvertTask(conv.conversationId)}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="تحويل إلى مهمة"
                    >
                        <i className="fas fa-tasks text-xs" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Main Messages Tab ─────────────────────────────────────────────────────────

interface CustomerMessagesTabProps {
    brandId: string;
    customerId: string;
}

export const CustomerMessagesTab: React.FC<CustomerMessagesTabProps> = ({
    brandId, customerId,
}) => {
    const [conversations, setConversations] = useState<LinkedConversation[]>([]);
    const [loading, setLoading]             = useState(true);
    const [aiContext, setAiContext]          = useState<CrmConversationContext | null>(null);
    const [loadingContextId, setLoadingContextId] = useState<string | null>(null);
    const [convertTaskId, setConvertTaskId] = useState<string | null>(null);
    const [linkConvId, setLinkConvId]       = useState('');
    const [linking, setLinking]             = useState(false);
    const [successMsg, setSuccessMsg]       = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        const convs = await getConversationsByCustomer(brandId, customerId);
        setConversations(convs);
        setLoading(false);
    }, [brandId, customerId]);

    useEffect(() => { void load(); }, [load]);

    const handleViewContext = async (conversationId: string) => {
        if (aiContext && loadingContextId === conversationId) {
            setAiContext(null);
            setLoadingContextId(null);
            return;
        }
        setLoadingContextId(conversationId);
        const ctx = await buildReplyContext(brandId, conversationId);
        setAiContext(ctx);
        setLoadingContextId(null);
    };

    const handleManualLink = async () => {
        if (!linkConvId.trim()) return;
        setLinking(true);
        await manualLinkConversation(brandId, linkConvId.trim(), customerId);
        setLinkConvId('');
        setLinking(false);
        setSuccessMsg('تم ربط المحادثة بنجاح');
        setTimeout(() => setSuccessMsg(''), 3000);
        void load();
    };

    return (
        <div className="space-y-4">
            {/* Stats bar */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <i className="fas fa-comments text-indigo-500" />
                    <span><strong>{conversations.length}</strong> محادثة مرتبطة</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-gray-400">
                    <i className="fas fa-circle text-xs text-indigo-400" />
                    <span>{conversations.filter(c => !c.isRead).length} غير مقروءة</span>
                </div>
            </div>

            {/* Manual link input */}
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={linkConvId}
                    onChange={e => setLinkConvId(e.target.value)}
                    placeholder="ID المحادثة لربطها يدويًا..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button onClick={handleManualLink} disabled={linking || !linkConvId.trim()}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    ربط
                </button>
            </div>
            {successMsg && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                    <i className="fas fa-check-circle" /> {successMsg}
                </p>
            )}

            {/* AI context panel */}
            {aiContext && (
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-indigo-700">السياق الذكي للرد</span>
                        <button onClick={() => setAiContext(null)} className="text-xs text-gray-400 hover:text-gray-600">
                            <i className="fas fa-times" />
                        </button>
                    </div>
                    <AiContextPanel context={aiContext} />
                </div>
            )}

            {/* Conversations list */}
            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : conversations.length === 0 ? (
                <div className="text-center py-10">
                    <i className="fas fa-comments text-3xl text-gray-200 mb-3 block" />
                    <p className="text-sm text-gray-500">لا توجد محادثات مرتبطة بهذا العميل</p>
                    <p className="text-xs text-gray-400 mt-1">
                        يتم الربط تلقائيًا عبر الإيميل أو رقم الجوال أو رقم الطلب
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {conversations.map(conv => (
                        <ConversationCard
                            key={conv.conversationId}
                            conv={conv}
                            onConvertTask={id => setConvertTaskId(id)}
                            onViewContext={handleViewContext}
                            isLoadingContext={loadingContextId === conv.conversationId}
                        />
                    ))}
                </div>
            )}

            {/* Convert to task modal */}
            {convertTaskId && (
                <ConvertToTaskModal
                    conversationId={convertTaskId}
                    brandId={brandId}
                    onSuccess={() => setSuccessMsg('تم إنشاء المهمة بنجاح')}
                    onClose={() => setConvertTaskId(null)}
                />
            )}
        </div>
    );
};
