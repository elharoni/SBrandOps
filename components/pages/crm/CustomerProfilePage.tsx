import React, { useState, useEffect, useCallback } from 'react';
import {
    CrmCustomer, CrmOrder, CrmNote, CrmActivity, CrmTask, CrmCustomerTag,
    CrmLifecycleStage, CrmActivityEventType, CrmTaskPriority, CrmTaskStatus, CrmTaskType,
    CrmOrderStatus, CrmPaymentStatus,
} from '../../../types';
import {
    getCustomerById, getOrdersByCustomer, getNotes, getActivities, getTasks,
    createNote, updateNote, deleteNote, createTask, updateTask, deleteTask,
    getCustomerTags, updateCustomer, logActivity, LIFECYCLE_STAGE_CONFIG,
} from '../../../services/crmService';
import { CustomerMessagesTab } from './CustomerMessagesTab';

// ── Helpers ────────────────────────────────────────────────────────────────────

const LifecycleBadge: React.FC<{ stage: CrmLifecycleStage; onClick?: () => void }> = ({ stage, onClick }) => {
    const cfg = LIFECYCLE_STAGE_CONFIG[stage];
    return (
        <button
            onClick={onClick}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color} ${onClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
        >
            {cfg.labelAr}
            {onClick && <i className="fas fa-chevron-down text-xs ml-0.5" />}
        </button>
    );
};

const OrderStatusBadge: React.FC<{ status: CrmOrderStatus }> = ({ status }) => {
    const map: Record<string, { label: string; cls: string }> = {
        [CrmOrderStatus.Completed]:  { label: 'مكتمل',  cls: 'bg-green-100 text-green-700' },
        [CrmOrderStatus.Processing]: { label: 'قيد التنفيذ', cls: 'bg-blue-100 text-blue-700' },
        [CrmOrderStatus.Pending]:    { label: 'معلق',   cls: 'bg-yellow-100 text-yellow-700' },
        [CrmOrderStatus.Cancelled]:  { label: 'ملغي',   cls: 'bg-red-100 text-red-700' },
        [CrmOrderStatus.Refunded]:   { label: 'مسترد',  cls: 'bg-orange-100 text-orange-700' },
        [CrmOrderStatus.Failed]:     { label: 'فشل',    cls: 'bg-red-100 text-red-700' },
        [CrmOrderStatus.OnHold]:     { label: 'متوقف',  cls: 'bg-gray-100 text-gray-700' },
    };
    const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
};

const ActivityIcon: React.FC<{ type: CrmActivityEventType }> = ({ type }) => {
    const icons: Partial<Record<CrmActivityEventType, { icon: string; bg: string; color: string }>> = {
        [CrmActivityEventType.CustomerCreated]:  { icon: 'fa-user-plus',    bg: 'bg-blue-100',   color: 'text-blue-600' },
        [CrmActivityEventType.OrderPlaced]:      { icon: 'fa-shopping-bag', bg: 'bg-green-100',  color: 'text-green-600' },
        [CrmActivityEventType.OrderPaid]:        { icon: 'fa-check-circle', bg: 'bg-emerald-100',color: 'text-emerald-600' },
        [CrmActivityEventType.OrderCancelled]:   { icon: 'fa-times-circle', bg: 'bg-red-100',    color: 'text-red-600' },
        [CrmActivityEventType.Refunded]:         { icon: 'fa-undo',         bg: 'bg-orange-100', color: 'text-orange-600' },
        [CrmActivityEventType.NoteAdded]:        { icon: 'fa-sticky-note',  bg: 'bg-yellow-100', color: 'text-yellow-600' },
        [CrmActivityEventType.TagChanged]:       { icon: 'fa-tag',          bg: 'bg-purple-100', color: 'text-purple-600' },
        [CrmActivityEventType.LifecycleChanged]: { icon: 'fa-exchange-alt', bg: 'bg-indigo-100', color: 'text-indigo-600' },
        [CrmActivityEventType.MessageSent]:      { icon: 'fa-comment',      bg: 'bg-teal-100',   color: 'text-teal-600' },
        [CrmActivityEventType.TaskCreated]:      { icon: 'fa-tasks',        bg: 'bg-gray-100',   color: 'text-gray-600' },
        [CrmActivityEventType.TaskCompleted]:    { icon: 'fa-check',        bg: 'bg-green-100',  color: 'text-green-600' },
    };
    const cfg = icons[type] ?? { icon: 'fa-circle', bg: 'bg-gray-100', color: 'text-gray-600' };
    return (
        <div className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
            <i className={`fas ${cfg.icon} text-xs ${cfg.color}`} />
        </div>
    );
};

// ── Sections ──────────────────────────────────────────────────────────────────

const OverviewSection: React.FC<{ customer: CrmCustomer; tags: CrmCustomerTag[] }> = ({ customer, tags }) => {
    const formatCurrency = (n: number) =>
        new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);

    const kpis = [
        { label: 'إجمالي الطلبات', value: customer.totalOrders.toString(), icon: 'fa-shopping-bag', color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'إجمالي الإنفاق', value: formatCurrency(customer.totalSpent), icon: 'fa-dollar-sign', color: 'text-green-600', bg: 'bg-green-50' },
        { label: 'متوسط الطلب', value: formatCurrency(customer.averageOrderValue), icon: 'fa-chart-bar', color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'LTV', value: formatCurrency(customer.ltv), icon: 'fa-star', color: 'text-amber-600', bg: 'bg-amber-50' },
    ];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {kpis.map(k => (
                    <div key={k.label} className={`${k.bg} rounded-xl p-4`}>
                        <div className="flex items-center gap-2 mb-1">
                            <i className={`fas ${k.icon} text-xs ${k.color}`} />
                            <span className="text-xs text-gray-500">{k.label}</span>
                        </div>
                        <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700">معلومات الاتصال</h4>
                    {customer.email && (
                        <div className="flex items-center gap-2 text-sm">
                            <i className="fas fa-envelope text-gray-400 w-4" />
                            <span className="text-gray-700">{customer.email}</span>
                        </div>
                    )}
                    {customer.phone && (
                        <div className="flex items-center gap-2 text-sm">
                            <i className="fas fa-phone text-gray-400 w-4" />
                            <span className="text-gray-700">{customer.phone}</span>
                        </div>
                    )}
                    {customer.acquisitionSource && (
                        <div className="flex items-center gap-2 text-sm">
                            <i className="fas fa-chart-pie text-gray-400 w-4" />
                            <span className="text-gray-500">مصدر: </span>
                            <span className="text-gray-700">{customer.acquisitionChannel ?? customer.acquisitionSource}</span>
                        </div>
                    )}
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700">التواريخ</h4>
                    {customer.firstOrderDate && (
                        <div className="flex items-center gap-2 text-sm">
                            <i className="fas fa-calendar-plus text-gray-400 w-4" />
                            <span className="text-gray-500">أول طلب: </span>
                            <span className="text-gray-700">{new Date(customer.firstOrderDate).toLocaleDateString('ar-SA')}</span>
                        </div>
                    )}
                    {customer.lastOrderDate && (
                        <div className="flex items-center gap-2 text-sm">
                            <i className="fas fa-calendar text-gray-400 w-4" />
                            <span className="text-gray-500">آخر طلب: </span>
                            <span className="text-gray-700">{new Date(customer.lastOrderDate).toLocaleDateString('ar-SA')}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                        <i className="fas fa-user-clock text-gray-400 w-4" />
                        <span className="text-gray-500">عضو منذ: </span>
                        <span className="text-gray-700">{new Date(customer.createdAt).toLocaleDateString('ar-SA')}</span>
                    </div>
                </div>
            </div>

            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {tags.map(tag => (
                        <span key={tag.id}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ background: `${tag.color}20`, color: tag.color, border: `1px solid ${tag.color}40` }}
                        >
                            {tag.name}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

const OrdersSection: React.FC<{ orders: CrmOrder[] }> = ({ orders }) => {
    const formatCurrency = (n: number) =>
        new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);

    if (orders.length === 0)
        return <p className="text-center text-gray-400 py-8">لا توجد طلبات</p>;

    return (
        <div className="space-y-2">
            {orders.map(order => (
                <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-gray-900">#{order.externalId}</span>
                                <OrderStatusBadge status={order.status} />
                                <span className="text-xs text-gray-400">{order.storeSource}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {order.orderDate ? new Date(order.orderDate).toLocaleDateString('ar-SA', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}
                                {order.paymentMethod && ` · ${order.paymentMethod}`}
                            </p>
                        </div>
                        <p className="font-bold text-gray-900 text-sm">{formatCurrency(order.total)}</p>
                    </div>
                    {order.items && order.items.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {order.items.map(item => (
                                <div key={item.id} className="flex items-center gap-2 text-xs text-gray-500">
                                    {item.imageUrl && <img src={item.imageUrl} alt={item.productName} className="w-6 h-6 rounded object-cover" />}
                                    <span>{item.productName}</span>
                                    <span className="text-gray-400">×{item.quantity}</span>
                                    <span className="ml-auto font-medium text-gray-700">{formatCurrency(item.total)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const TimelineSection: React.FC<{ activities: CrmActivity[] }> = ({ activities }) => {
    if (activities.length === 0)
        return <p className="text-center text-gray-400 py-8">لا يوجد نشاط</p>;

    return (
        <div className="space-y-1">
            {activities.map((act, i) => (
                <div key={act.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                        <ActivityIcon type={act.eventType} />
                        {i < activities.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
                    </div>
                    <div className="pb-4 pt-1 flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{act.title}</p>
                        {act.description && <p className="text-xs text-gray-500 mt-0.5">{act.description}</p>}
                        <p className="text-xs text-gray-400 mt-1">
                            {new Date(act.occurredAt).toLocaleDateString('ar-SA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
};

const NotesSection: React.FC<{
    notes: CrmNote[];
    brandId: string;
    customerId: string;
    onRefresh: () => void;
}> = ({ notes, brandId, customerId, onRefresh }) => {
    const [newNote, setNewNote] = useState('');
    const [saving, setSaving]   = useState(false);

    const handleCreate = async () => {
        if (!newNote.trim()) return;
        setSaving(true);
        await createNote(brandId, customerId, newNote.trim());
        setNewNote('');
        setSaving(false);
        onRefresh();
    };

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <textarea
                    rows={2}
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="أضف ملاحظة داخلية..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                    onClick={handleCreate}
                    disabled={saving || !newNote.trim()}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 self-start"
                >
                    {saving ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-plus" />}
                </button>
            </div>
            {notes.length === 0
                ? <p className="text-center text-gray-400 py-6 text-sm">لا توجد ملاحظات</p>
                : notes.map(note => (
                    <div key={note.id} className={`bg-white border rounded-xl p-3 ${note.isPinned ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}>
                        <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-gray-700 flex-1">{note.content}</p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => { void updateNote(brandId, note.id, note.content, !note.isPinned).then(onRefresh); }}
                                    className={`p-1 rounded text-xs ${note.isPinned ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'}`}>
                                    <i className="fas fa-thumbtack" />
                                </button>
                                <button onClick={() => { void deleteNote(brandId, note.id).then(onRefresh); }}
                                    className="p-1 rounded text-xs text-gray-400 hover:text-red-500">
                                    <i className="fas fa-trash" />
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5">
                            {new Date(note.createdAt).toLocaleDateString('ar-SA', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                    </div>
                ))
            }
        </div>
    );
};

const TasksSection: React.FC<{
    tasks: CrmTask[];
    brandId: string;
    customerId: string;
    onRefresh: () => void;
}> = ({ tasks, brandId, customerId, onRefresh }) => {
    const [showNew, setShowNew]     = useState(false);
    const [title, setTitle]         = useState('');
    const [priority, setPriority]   = useState<CrmTaskPriority>(CrmTaskPriority.Medium);
    const [dueDate, setDueDate]     = useState('');
    const [taskType, setTaskType]   = useState<CrmTaskType>(CrmTaskType.FollowUp);

    const priorityMap: Record<CrmTaskPriority, { label: string; cls: string }> = {
        [CrmTaskPriority.Low]:    { label: 'منخفض',  cls: 'text-gray-500 bg-gray-100' },
        [CrmTaskPriority.Medium]: { label: 'متوسط',  cls: 'text-blue-600 bg-blue-50' },
        [CrmTaskPriority.High]:   { label: 'عالي',   cls: 'text-orange-600 bg-orange-50' },
        [CrmTaskPriority.Urgent]: { label: 'عاجل',   cls: 'text-red-600 bg-red-50' },
    };

    const handleCreate = async () => {
        if (!title.trim()) return;
        await createTask(brandId, { customerId, title, priority, dueDate: dueDate || undefined, taskType });
        setTitle(''); setDueDate(''); setShowNew(false);
        onRefresh();
    };

    const openTasks  = tasks.filter(t => t.status !== CrmTaskStatus.Done && t.status !== CrmTaskStatus.Cancelled);
    const doneTasks  = tasks.filter(t => t.status === CrmTaskStatus.Done || t.status === CrmTaskStatus.Cancelled);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">المهام ({openTasks.length} مفتوحة)</span>
                <button onClick={() => setShowNew(!showNew)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                    <i className="fas fa-plus" /> مهمة جديدة
                </button>
            </div>

            {showNew && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2">
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                        placeholder="عنوان المهمة..."
                        className="w-full border border-indigo-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-2">
                        <select value={priority} onChange={e => setPriority(e.target.value as CrmTaskPriority)}
                            className="flex-1 border rounded px-2 py-1 text-xs text-gray-700">
                            {Object.values(CrmTaskPriority).map(p => (
                                <option key={p} value={p}>{priorityMap[p].label}</option>
                            ))}
                        </select>
                        <select value={taskType} onChange={e => setTaskType(e.target.value as CrmTaskType)}
                            className="flex-1 border rounded px-2 py-1 text-xs text-gray-700">
                            {Object.values(CrmTaskType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                            className="flex-1 border rounded px-2 py-1 text-xs text-gray-700"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleCreate} disabled={!title.trim()}
                            className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                            حفظ
                        </button>
                        <button onClick={() => setShowNew(false)} className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800">
                            إلغاء
                        </button>
                    </div>
                </div>
            )}

            {openTasks.length === 0 && !showNew && (
                <p className="text-center text-gray-400 py-4 text-sm">لا توجد مهام مفتوحة</p>
            )}

            {[...openTasks, ...doneTasks].map(task => {
                const isDone = task.status === CrmTaskStatus.Done;
                return (
                    <div key={task.id} className={`flex items-start gap-3 p-3 rounded-xl border ${isDone ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-200'}`}>
                        <button
                            onClick={() => { void updateTask(brandId, task.id, { status: isDone ? CrmTaskStatus.Open : CrmTaskStatus.Done }).then(onRefresh); }}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${isDone ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-indigo-500'}`}
                        >
                            {isDone && <i className="fas fa-check text-xs" />}
                        </button>
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${priorityMap[task.priority].cls}`}>
                                    {priorityMap[task.priority].label}
                                </span>
                                {task.dueDate && (
                                    <span className={`text-xs ${new Date(task.dueDate) < new Date() && !isDone ? 'text-red-500' : 'text-gray-400'}`}>
                                        <i className="fas fa-calendar-alt mr-0.5" />
                                        {new Date(task.dueDate).toLocaleDateString('ar-SA')}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button onClick={() => { void deleteTask(brandId, task.id).then(onRefresh); }}
                            className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0">
                            <i className="fas fa-trash text-xs" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────

type Tab = 'overview' | 'orders' | 'timeline' | 'notes' | 'tasks' | 'messages';

interface CustomerProfilePageProps {
    brandId: string;
    customerId: string;
    onBack: () => void;
}

export const CustomerProfilePage: React.FC<CustomerProfilePageProps> = ({ brandId, customerId, onBack }) => {
    const [customer, setCustomer]     = useState<CrmCustomer | null>(null);
    const [orders, setOrders]         = useState<CrmOrder[]>([]);
    const [notes, setNotes]           = useState<CrmNote[]>([]);
    const [activities, setActivities] = useState<CrmActivity[]>([]);
    const [tasks, setTasks]           = useState<CrmTask[]>([]);
    const [tags, setTags]             = useState<CrmCustomerTag[]>([]);
    const [activeTab, setActiveTab]   = useState<Tab>('overview');
    const [loading, setLoading]       = useState(true);
    const [showLifecycleMenu, setShowLifecycleMenu] = useState(false);

    const loadAll = useCallback(async () => {
        setLoading(true);
        const [cust, ord, noteList, acts, taskList, tagList] = await Promise.all([
            getCustomerById(brandId, customerId),
            getOrdersByCustomer(brandId, customerId),
            getNotes(brandId, customerId),
            getActivities(brandId, customerId),
            getTasks(brandId, customerId),
            getCustomerTags(customerId),
        ]);
        setCustomer(cust);
        setOrders(ord);
        setNotes(noteList);
        setActivities(acts);
        setTasks(taskList);
        setTags(tagList);
        setLoading(false);
    }, [brandId, customerId]);

    useEffect(() => { void loadAll(); }, [loadAll]);

    const handleLifecycleChange = async (stage: CrmLifecycleStage) => {
        if (!customer) return;
        await updateCustomer(brandId, customerId, { lifecycleStage: stage });
        await logActivity(brandId, customerId, CrmActivityEventType.LifecycleChanged,
            `تم تغيير المرحلة إلى ${LIFECYCLE_STAGE_CONFIG[stage].labelAr}`,
            undefined,
            { oldStage: customer.lifecycleStage, newStage: stage }
        );
        setShowLifecycleMenu(false);
        void loadAll();
    };

    const tabs: { id: Tab; label: string; icon: string; count?: number }[] = [
        { id: 'overview',  label: 'نظرة عامة', icon: 'fa-user' },
        { id: 'orders',    label: 'الطلبات',   icon: 'fa-shopping-bag', count: orders.length },
        { id: 'timeline',  label: 'السجل',     icon: 'fa-history', count: activities.length },
        { id: 'notes',     label: 'الملاحظات', icon: 'fa-sticky-note', count: notes.length },
        { id: 'tasks',     label: 'المهام',    icon: 'fa-tasks', count: tasks.filter(t => t.status !== CrmTaskStatus.Done).length },
        { id: 'messages',  label: 'الرسائل',   icon: 'fa-comments' },
    ];

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-48" />
                <div className="h-32 bg-gray-200 rounded-xl" />
                <div className="h-64 bg-gray-200 rounded-xl" />
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="text-center py-16">
                <i className="fas fa-user-slash text-3xl text-gray-300 mb-3 block" />
                <p className="text-gray-500">لم يتم العثور على العميل</p>
                <button onClick={onBack} className="mt-4 text-indigo-600 hover:underline text-sm">
                    <i className="fas fa-arrow-right mr-1" /> العودة
                </button>
            </div>
        );
    }

    const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email || 'عميل مجهول';
    const initials = fullName.slice(0, 2).toUpperCase();

    return (
        <div className="space-y-4">
            {/* Back */}
            <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
                <i className="fas fa-arrow-right" />
                <span>العملاء</span>
            </button>

            {/* Profile header */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start gap-4">
                    {customer.avatarUrl ? (
                        <img src={customer.avatarUrl} alt={fullName} className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                        <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg font-bold flex-shrink-0">
                            {initials}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2">
                            <h2 className="text-xl font-bold text-gray-900">{fullName}</h2>
                            <div className="relative">
                                <LifecycleBadge stage={customer.lifecycleStage} onClick={() => setShowLifecycleMenu(v => !v)} />
                                {showLifecycleMenu && (
                                    <div className="absolute top-full mt-1 right-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-36">
                                        {Object.values(CrmLifecycleStage).map(s => (
                                            <button key={s} onClick={() => void handleLifecycleChange(s)}
                                                className={`w-full text-right px-3 py-1.5 text-xs hover:bg-gray-50 ${s === customer.lifecycleStage ? 'font-semibold text-indigo-700' : 'text-gray-700'}`}>
                                                {LIFECYCLE_STAGE_CONFIG[s].labelAr}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
                            {customer.email && <span><i className="fas fa-envelope text-xs mr-1" />{customer.email}</span>}
                            {customer.phone && <span><i className="fas fa-phone text-xs mr-1" />{customer.phone}</span>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 pb-px">
                {tabs.map(tab => (
                    <button key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                            activeTab === tab.id
                                ? 'border-indigo-600 text-indigo-700'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <i className={`fas ${tab.icon} text-xs`} />
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div>
                {activeTab === 'overview'  && <OverviewSection customer={customer} tags={tags} />}
                {activeTab === 'orders'    && <OrdersSection orders={orders} />}
                {activeTab === 'timeline'  && <TimelineSection activities={activities} />}
                {activeTab === 'notes'     && <NotesSection notes={notes} brandId={brandId} customerId={customerId} onRefresh={loadAll} />}
                {activeTab === 'tasks'     && <TasksSection tasks={tasks} brandId={brandId} customerId={customerId} onRefresh={loadAll} />}
                {activeTab === 'messages'  && <CustomerMessagesTab brandId={brandId} customerId={customerId} />}
            </div>
        </div>
    );
};
