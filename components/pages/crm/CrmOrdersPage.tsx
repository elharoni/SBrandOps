import React, { useCallback, useEffect, useState } from 'react';
import {
    CrmOrder,
    CrmOrderFilters,
    CrmOrderStatus,
    CrmPaymentStatus,
    CrmShippingStatus,
} from '../../../types';
import { getOrders, createNote, createTask } from '../../../services/crmService';
import { CrmTaskType, CrmTaskPriority } from '../../../types';
import { useWindowedRows } from '../../../hooks/useWindowedRows';

const ORDER_STATUS_COLOR: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    processing: 'bg-blue-100 text-blue-700',
    pending: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-red-100 text-red-700',
    refunded: 'bg-orange-100 text-orange-700',
    failed: 'bg-red-100 text-red-700',
    'on-hold': 'bg-gray-100 text-gray-700',
};

const PAYMENT_STATUS_COLOR: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    refunded: 'bg-orange-100 text-orange-700',
    failed: 'bg-red-100 text-red-700',
    partially_refunded: 'bg-amber-100 text-amber-700',
};

const SHIPPING_STATUS_COLOR: Record<string, string> = {
    delivered: 'bg-green-100 text-green-700',
    shipped: 'bg-blue-100 text-blue-700',
    processing: 'bg-indigo-100 text-indigo-700',
    pending: 'bg-yellow-100 text-yellow-700',
    returned: 'bg-orange-100 text-orange-700',
};

const ORDER_STATUS_LABEL: Record<string, string> = {
    completed: 'مكتمل',
    processing: 'قيد التنفيذ',
    pending: 'معلق',
    cancelled: 'ملغي',
    refunded: 'مسترد',
    failed: 'فشل',
    'on-hold': 'متوقف',
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
    paid: 'مدفوع',
    pending: 'معلق',
    refunded: 'مسترد',
    failed: 'فشل',
    partially_refunded: 'مسترد جزئيًا',
};

const SHIPPING_STATUS_LABEL: Record<string, string> = {
    delivered: 'تم التسليم',
    shipped: 'تم الشحن',
    processing: 'قيد التجهيز',
    pending: 'معلق',
    returned: 'مرتجع',
};

const StatusBadge: React.FC<{ value: string; type: 'order' | 'payment' | 'shipping' }> = ({ value, type }) => {
    const colorMap = type === 'order' ? ORDER_STATUS_COLOR : type === 'payment' ? PAYMENT_STATUS_COLOR : SHIPPING_STATUS_COLOR;
    const labelMap = type === 'order' ? ORDER_STATUS_LABEL : type === 'payment' ? PAYMENT_STATUS_LABEL : SHIPPING_STATUS_LABEL;

    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[value] ?? 'bg-gray-100 text-gray-600'}`}>
            {labelMap[value] ?? value}
        </span>
    );
};

interface CrmOrdersPageProps {
    brandId: string;
    onAddNote?: (orderId: string) => void;
    onCreateTask?: (orderId: string) => void;
}

type QuickActionType = 'note' | 'task';
interface QuickAction { type: QuickActionType; orderId: string; customerId?: string }

export const CrmOrdersPage: React.FC<CrmOrdersPageProps> = ({ brandId }) => {
    const [orders, setOrders] = useState<CrmOrder[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<CrmOrderFilters>({ page: 1, pageSize: 50 });
    const [expanded, setExpanded] = useState<string | null>(null);
    const [quickAction, setQuickAction] = useState<QuickAction | null>(null);
    const [quickText, setQuickText] = useState('');
    const [quickDue, setQuickDue] = useState('');
    const [quickSaving, setQuickSaving] = useState(false);

    const {
        containerRef,
        onScroll,
        visibleRows,
        topSpacerHeight,
        bottomSpacerHeight,
        isWindowed,
    } = useWindowedRows(orders, { rowHeight: 56, enabled: !loading && expanded === null && orders.length > 30 });

    const load = useCallback(async () => {
        setLoading(true);
        const result = await getOrders(brandId, filters);
        setOrders(result.data);
        setTotal(result.total);
        setLoading(false);
    }, [brandId, filters]);

    useEffect(() => {
        void load();
    }, [load]);

    const openQuickAction = (type: QuickActionType, orderId: string, customerId?: string) => {
        setQuickAction({ type, orderId, customerId });
        setQuickText('');
        setQuickDue('');
    };

    const cancelQuick = () => { setQuickAction(null); setQuickText(''); setQuickDue(''); };

    const submitQuick = async () => {
        if (!quickAction || !quickText.trim()) return;
        setQuickSaving(true);
        if (quickAction.type === 'note' && quickAction.customerId) {
            await createNote(brandId, quickAction.customerId, quickText.trim());
        } else if (quickAction.type === 'task') {
            await createTask(brandId, {
                orderId:    quickAction.orderId,
                customerId: quickAction.customerId,
                title:      quickText.trim(),
                dueDate:    quickDue || undefined,
                taskType:   CrmTaskType.FollowUp,
                priority:   CrmTaskPriority.Medium,
            });
        }
        setQuickSaving(false);
        cancelQuick();
    };

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(value);

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;
    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">الطلبات</h1>
                    <p className="text-sm text-gray-500">{total.toLocaleString('ar')} طلب</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <select
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white"
                        onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value ? [e.target.value as CrmOrderStatus] : undefined, page: 1 }))}
                    >
                        <option value="">حالة الطلب</option>
                        {Object.values(CrmOrderStatus).map((status) => (
                            <option key={status} value={status}>
                                {ORDER_STATUS_LABEL[status] ?? status}
                            </option>
                        ))}
                    </select>

                    <select
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white"
                        onChange={(e) => setFilters((current) => ({ ...current, paymentStatus: e.target.value ? [e.target.value as CrmPaymentStatus] : undefined, page: 1 }))}
                    >
                        <option value="">حالة الدفع</option>
                        {Object.values(CrmPaymentStatus).map((status) => (
                            <option key={status} value={status}>
                                {PAYMENT_STATUS_LABEL[status] ?? status}
                            </option>
                        ))}
                    </select>

                    <input
                        type="date"
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white"
                        onChange={(e) => setFilters((current) => ({ ...current, dateAfter: e.target.value || undefined, page: 1 }))}
                    />
                    <input
                        type="date"
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white"
                        onChange={(e) => setFilters((current) => ({ ...current, dateBefore: e.target.value || undefined, page: 1 }))}
                    />

                    <select
                        value={pageSize}
                        onChange={(e) => setFilters((current) => ({ ...current, pageSize: Number(e.target.value), page: 1 }))}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white"
                    >
                        {[25, 50, 100].map((size) => (
                            <option key={size} value={size}>
                                {size} / صفحة
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div ref={containerRef} onScroll={onScroll} className="max-h-[720px] overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-right font-medium text-gray-600">رقم الطلب</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-600">المتجر</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-600">الحالة</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-600">الدفع</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-600">الشحن</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-600">الإجمالي</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-600">التاريخ</th>
                                <th className="px-3 py-3" />
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                Array.from({ length: 8 }).map((_, index) => (
                                    <tr key={index} className="animate-pulse">
                                        {Array.from({ length: 8 }).map((__, cellIndex) => (
                                            <td key={cellIndex} className="px-4 py-3">
                                                <div className="h-4 rounded bg-gray-200" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center text-gray-400">
                                        لا توجد طلبات
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {isWindowed && topSpacerHeight > 0 && (
                                        <tr aria-hidden="true">
                                            <td colSpan={8} className="p-0" style={{ height: `${topSpacerHeight}px` }} />
                                        </tr>
                                    )}

                                    {(isWindowed ? visibleRows : orders).map((order) => (
                                        <React.Fragment key={order.id}>
                                            <tr className="transition-colors hover:bg-gray-50">
                                                <td className="px-4 py-3 font-medium text-gray-900">#{order.externalId}</td>
                                                <td className="px-4 py-3 text-xs text-gray-500 capitalize">{order.storeSource}</td>
                                                <td className="px-4 py-3"><StatusBadge value={order.status} type="order" /></td>
                                                <td className="px-4 py-3"><StatusBadge value={order.paymentStatus} type="payment" /></td>
                                                <td className="px-4 py-3"><StatusBadge value={order.shippingStatus} type="shipping" /></td>
                                                <td className="px-4 py-3 font-bold text-gray-900">{formatCurrency(order.total)}</td>
                                                <td className="px-4 py-3 text-xs text-gray-500">
                                                    {order.orderDate
                                                        ? new Date(order.orderDate).toLocaleDateString('ar-SA', { day: '2-digit', month: 'short', year: 'numeric' })
                                                        : '—'}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <button
                                                        onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                                                        className="rounded p-1.5 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                                                    >
                                                        <i className={`fas fa-chevron-${expanded === order.id ? 'up' : 'down'} text-xs`} />
                                                    </button>
                                                </td>
                                            </tr>

                                            {expanded === order.id && (
                                                <tr className="bg-gray-50">
                                                    <td colSpan={8} className="px-4 py-3">
                                                        <div className="grid gap-4 text-sm md:grid-cols-3">
                                                            <div>
                                                                <p className="mb-1 text-xs font-medium text-gray-500">تفاصيل الدفع</p>
                                                                <p className="text-gray-700">{order.paymentMethod ?? '—'}</p>
                                                                {order.couponCodes && order.couponCodes.length > 0 && (
                                                                    <p className="mt-0.5 text-xs text-green-600">كوبون: {order.couponCodes.join(', ')}</p>
                                                                )}
                                                            </div>

                                                            <div>
                                                                <p className="mb-1 text-xs font-medium text-gray-500">الإجماليات</p>
                                                                <div className="space-y-0.5 text-xs text-gray-600">
                                                                    <div className="flex justify-between"><span>المجموع الفرعي</span><span>{formatCurrency(order.subtotal)}</span></div>
                                                                    {order.discountTotal > 0 && <div className="flex justify-between text-green-600"><span>خصم</span><span>-{formatCurrency(order.discountTotal)}</span></div>}
                                                                    {order.shippingTotal > 0 && <div className="flex justify-between"><span>شحن</span><span>{formatCurrency(order.shippingTotal)}</span></div>}
                                                                    <div className="flex justify-between font-bold text-gray-900"><span>الإجمالي</span><span>{formatCurrency(order.total)}</span></div>
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <p className="mb-1 text-xs font-medium text-gray-500">إجراءات</p>
                                                                {quickAction?.orderId === order.id ? (
                                                                    <div className="space-y-1.5">
                                                                        <p className="text-xs font-semibold text-indigo-700">
                                                                            {quickAction.type === 'note' ? '+ ملاحظة' : '+ مهمة'}
                                                                        </p>
                                                                        <input
                                                                            autoFocus
                                                                            value={quickText}
                                                                            onChange={e => setQuickText(e.target.value)}
                                                                            placeholder={quickAction.type === 'note' ? 'نص الملاحظة...' : 'عنوان المهمة...'}
                                                                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none focus:border-indigo-400"
                                                                        />
                                                                        {quickAction.type === 'task' && (
                                                                            <input
                                                                                type="date"
                                                                                value={quickDue}
                                                                                onChange={e => setQuickDue(e.target.value)}
                                                                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none focus:border-indigo-400"
                                                                            />
                                                                        )}
                                                                        <div className="flex gap-1.5">
                                                                            <button
                                                                                onClick={() => void submitQuick()}
                                                                                disabled={quickSaving || !quickText.trim()}
                                                                                className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                                                            >
                                                                                {quickSaving ? '...' : 'حفظ'}
                                                                            </button>
                                                                            <button onClick={cancelQuick} className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                                                                إلغاء
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-col gap-1">
                                                                        <button
                                                                            onClick={() => openQuickAction('note', order.id, order.customerId)}
                                                                            disabled={!order.customerId}
                                                                            className="text-left text-xs text-indigo-600 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                                                                            title={!order.customerId ? 'لا يوجد عميل مرتبط' : undefined}
                                                                        >
                                                                            + إضافة ملاحظة
                                                                        </button>
                                                                        <button
                                                                            onClick={() => openQuickAction('task', order.id, order.customerId)}
                                                                            className="text-left text-xs text-indigo-600 hover:underline"
                                                                        >
                                                                            + إنشاء مهمة
                                                                        </button>
                                                                        {order.trackingNumber && (
                                                                            <p className="text-xs text-gray-500">رقم التتبع: {order.trackingNumber}</p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}

                                    {isWindowed && bottomSpacerHeight > 0 && (
                                        <tr aria-hidden="true">
                                            <td colSpan={8} className="p-0" style={{ height: `${bottomSpacerHeight}px` }} />
                                        </tr>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-3">
                        <span className="text-xs text-gray-500">
                            {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} من {total.toLocaleString('ar')}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                disabled={page <= 1}
                                onClick={() => setFilters((current) => ({ ...current, page: (current.page ?? 1) - 1 }))}
                                className="rounded border border-gray-200 px-2 py-1 text-xs hover:bg-white disabled:opacity-40"
                            >
                                <i className="fas fa-chevron-right" />
                            </button>
                            <span className="text-xs text-gray-600">{page} / {totalPages}</span>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setFilters((current) => ({ ...current, page: (current.page ?? 1) + 1 }))}
                                className="rounded border border-gray-200 px-2 py-1 text-xs hover:bg-white disabled:opacity-40"
                            >
                                <i className="fas fa-chevron-left" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
