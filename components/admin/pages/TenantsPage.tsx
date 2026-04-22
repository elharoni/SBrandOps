// components/admin/pages/TenantsPage.tsx
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Tenant, SubscriptionPlanAdmin, NotificationType } from '../../../types';
import { SkeletonLoader } from '../shared/ui/SkeletonLoader';
import {
    updateTenantStatus,
    updateTenantPlan,
    updateTenantDetails,
    createTenant,
    deleteTenant,
    resetTenantAIUsage,
    getBrandsForAdmin,
    getBrandMembers,
    removeBrandMember,
    updateBrandMemberRole,
    BrandAccount,
    BrandMember,
} from '../../../services/tenantService';

// ── Role definitions for workspace members ────────────────────────────────────

const WORKSPACE_ROLES: Array<{
    id: string;
    label: string;
    labelEn: string;
    icon: string;
    color: string;
    bg: string;
    border: string;
    description: string;
    canManageMembers: boolean;
    canEditContent: boolean;
    canViewAnalytics: boolean;
    canManageSettings: boolean;
}> = [
    {
        id: 'Owner',
        label: 'مالك',
        labelEn: 'Owner',
        icon: 'fa-crown',
        color: 'text-amber-500',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        description: 'تحكم كامل في المساحة — لا يمكن إزالته أو تغيير دوره',
        canManageMembers: true,
        canEditContent: true,
        canViewAnalytics: true,
        canManageSettings: true,
    },
    {
        id: 'Admin',
        label: 'مسؤول',
        labelEn: 'Admin',
        icon: 'fa-user-shield',
        color: 'text-purple-500',
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/30',
        description: 'إدارة الأعضاء + المحتوى + إعدادات المساحة',
        canManageMembers: true,
        canEditContent: true,
        canViewAnalytics: true,
        canManageSettings: true,
    },
    {
        id: 'Editor',
        label: 'محرر',
        labelEn: 'Editor',
        icon: 'fa-pen-to-square',
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        description: 'إنشاء وتعديل المحتوى والجدولة',
        canManageMembers: false,
        canEditContent: true,
        canViewAnalytics: true,
        canManageSettings: false,
    },
    {
        id: 'Viewer',
        label: 'مشاهد',
        labelEn: 'Viewer',
        icon: 'fa-eye',
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        description: 'عرض فقط بدون أي تعديلات',
        canManageMembers: false,
        canEditContent: false,
        canViewAnalytics: false,
        canManageSettings: false,
    },
    {
        id: 'Analyst',
        label: 'محلل',
        labelEn: 'Analyst',
        icon: 'fa-chart-line',
        color: 'text-cyan-500',
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-500/30',
        description: 'عرض التحليلات والتقارير فقط',
        canManageMembers: false,
        canEditContent: false,
        canViewAnalytics: true,
        canManageSettings: false,
    },
];

const ROLE_IDS = WORKSPACE_ROLES.map(r => r.id);

const VIEWER_ROLE = WORKSPACE_ROLES.find(r => r.id === 'Viewer')!;
function getRoleMeta(roleId: string) {
    return WORKSPACE_ROLES.find(r => r.id === roleId) ?? VIEWER_ROLE;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function UsageBar({ used, limit, label }: { used: number; limit?: number | null; label: string }) {
    const pct = limit && limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
    const hasLimit = limit && limit > 0;
    const color = pct > 90 ? 'bg-danger' : pct > 70 ? 'bg-warning' : 'bg-primary';
    return (
        <div className='min-w-[90px]'>
            <div className='flex justify-between text-[10px] mb-1'>
                <span className='text-light-text-secondary dark:text-dark-text-secondary'>{label}</span>
                <span className='font-bold text-light-text dark:text-dark-text'>
                    {used}{hasLimit ? `/${limit}` : ''}
                </span>
            </div>
            {hasLimit && (
                <div className='w-full bg-light-bg dark:bg-dark-bg h-1.5 rounded-full'>
                    <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
            )}
        </div>
    );
}

const StatusBadge: React.FC<{ status: Tenant['status'] }> = ({ status }) => {
    const cfg: Record<Tenant['status'], { cls: string; label: string }> = {
        active:    { cls: 'bg-success/20 text-success',         label: 'نشط' },
        trial:     { cls: 'bg-primary/10 text-primary',         label: 'تجريبي' },
        past_due:  { cls: 'bg-warning/20 text-warning',         label: 'متأخر' },
        suspended: { cls: 'bg-rose-500/10 text-rose-400',       label: 'موقوف' },
        cancelled: { cls: 'bg-gray-500/20 text-gray-400',       label: 'ملغى' },
        inactive:  { cls: 'bg-gray-500/20 text-gray-400',       label: 'غير نشط' },
    };
    const { cls, label } = cfg[status] || cfg.inactive;
    return <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${cls}`}>{label}</span>;
};

const PlanBadge: React.FC<{ plan: string; planName?: string }> = ({ plan, planName }) => (
    <span className='px-2 py-0.5 text-[10px] font-bold rounded-full bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary border border-light-border dark:border-dark-border'>
        {planName || plan}
    </span>
);

// ── Create Tenant Modal ───────────────────────────────────────────────────────

const CreateTenantModal: React.FC<{
    plans: SubscriptionPlanAdmin[];
    onClose: () => void;
    onCreate: (name: string, email: string, planId: string) => Promise<void>;
}> = ({ plans, onClose, onCreate }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [planId, setPlanId] = useState(plans[0]?.id || 'starter');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const selectedPlan = plans.find(p => p.id === planId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !email.trim()) { setError('يرجى ملء جميع الحقول'); return; }
        setLoading(true);
        setError('');
        try {
            await onCreate(name.trim(), email.trim(), planId);
            onClose();
        } catch (err: any) {
            setError(err.message || 'حدث خطأ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
            <div className='bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border w-full max-w-lg shadow-2xl'>
                <div className='flex justify-between items-center px-6 py-4 border-b border-light-border dark:border-dark-border'>
                    <div>
                        <h2 className='text-lg font-bold text-light-text dark:text-dark-text'>إنشاء حساب جديد</h2>
                        <p className='text-xs text-light-text-secondary dark:text-dark-text-secondary'>اختر العضوية المناسبة لتحديد الحدود تلقائياً</p>
                    </div>
                    <button onClick={onClose} className='w-8 h-8 flex items-center justify-center rounded-lg text-light-text-secondary hover:text-danger hover:bg-danger/10 transition-colors'>
                        <i className='fas fa-times' />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className='p-6 space-y-4'>
                    <div>
                        <label className='block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mb-1.5'>اسم الحساب</label>
                        <input type='text' value={name} onChange={e => setName(e.target.value)}
                            placeholder='مثال: شركة الأفق للتسويق'
                            className='w-full p-2.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text focus:outline-none focus:border-primary' />
                    </div>
                    <div>
                        <label className='block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mb-1.5'>البريد الإلكتروني للفوترة</label>
                        <input type='email' value={email} onChange={e => setEmail(e.target.value)}
                            placeholder='billing@company.com'
                            className='w-full p-2.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text focus:outline-none focus:border-primary' />
                    </div>
                    <div>
                        <label className='block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mb-1.5'>العضوية / الخطة</label>
                        <div className='space-y-2'>
                            {plans.map(p => (
                                <button key={p.id} type='button' onClick={() => setPlanId(p.id)}
                                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-right transition-all
                                        ${planId === p.id
                                            ? 'border-primary bg-primary/10 ring-1 ring-primary'
                                            : 'border-light-border dark:border-dark-border hover:bg-light-bg dark:hover:bg-dark-bg'
                                        }`}
                                >
                                    <div>
                                        <p className={`font-bold text-sm ${planId === p.id ? 'text-primary' : 'text-light-text dark:text-dark-text'}`}>
                                            {p.name}
                                        </p>
                                        <p className='text-[10px] text-light-text-secondary dark:text-dark-text-secondary'>
                                            {p.brandLimit ?? '∞'} براند · {p.userLimit ?? '∞'} مستخدم
                                        </p>
                                    </div>
                                    <span className={`text-sm font-black ${planId === p.id ? 'text-primary' : 'text-light-text dark:text-dark-text'}`}>
                                        ${p.monthlyPrice}<span className='text-xs font-normal'>/شهر</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Plan limits preview */}
                    {selectedPlan && (
                        <div className='flex items-center gap-4 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 text-xs'>
                            <span className='text-primary font-semibold'>الحدود:</span>
                            <span className='text-light-text-secondary dark:text-dark-text-secondary'>
                                <i className='fas fa-layer-group me-1' />{selectedPlan.brandLimit ?? '∞'} براند
                            </span>
                            <span className='text-light-text-secondary dark:text-dark-text-secondary'>
                                <i className='fas fa-users me-1' />{selectedPlan.userLimit ?? '∞'} مستخدم
                            </span>
                            <span className='text-light-text-secondary dark:text-dark-text-secondary'>
                                <i className='fas fa-brain me-1' />{selectedPlan.aiTokenLimit ? `${Math.round(selectedPlan.aiTokenLimit / 1000)}k` : '∞'} AI
                            </span>
                        </div>
                    )}
                    {error && <p className='text-sm text-danger bg-danger/10 rounded-xl px-3 py-2'>{error}</p>}
                    <div className='flex gap-3 pt-1'>
                        <button type='button' onClick={onClose}
                            className='flex-1 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-sm font-semibold text-light-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition-colors'>
                            إلغاء
                        </button>
                        <button type='submit' disabled={loading}
                            className='flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2'>
                            {loading && <i className='fas fa-spinner fa-spin' />}
                            {loading ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Manage Tenant Drawer ──────────────────────────────────────────────────────

type DrawerTab = 'usage' | 'plan' | 'custom' | 'settings';

const ManageDrawer: React.FC<{
    tenant: Tenant;
    plans: SubscriptionPlanAdmin[];
    onClose: () => void;
    onStatusChange: (id: string, status: 'active' | 'suspended' | 'cancelled') => Promise<void>;
    onPlanChange: (id: string, planId: string) => Promise<void>;
    onResetAI: (id: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onUpdate: (id: string, updates: Parameters<typeof updateTenantDetails>[1]) => Promise<void>;
}> = ({ tenant, plans, onClose, onStatusChange, onPlanChange, onResetAI, onDelete, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [drawerTab, setDrawerTab] = useState<DrawerTab>('usage');

    // Settings tab state
    const [editName, setEditName] = useState(tenant.name);
    const [editEmail, setEditEmail] = useState(tenant.billingEmail || '');
    const [editTrial, setEditTrial] = useState(tenant.trialEndsAt ? tenant.trialEndsAt.slice(0, 10) : '');
    const [editNotes, setEditNotes] = useState(tenant.notes || '');
    const [settingsDirty, setSettingsDirty] = useState(false);

    // Custom limits tab state
    const [overrideBrands, setOverrideBrands] = useState<string>(tenant.customBrandLimit != null ? String(tenant.customBrandLimit) : '');
    const [overrideUsers, setOverrideUsers] = useState<string>(tenant.customUserLimit != null ? String(tenant.customUserLimit) : '');
    const [overrideAI, setOverrideAI] = useState<string>(tenant.customAiTokenLimit != null ? String(Math.round(tenant.customAiTokenLimit / 1000)) : '');
    const [limitsDirty, setLimitsDirty] = useState(false);

    const currentPlan = plans.find(p => p.id === tenant.plan);

    const act = async (fn: () => Promise<void>, closeAfter = true) => {
        setLoading(true);
        try {
            await fn();
            if (closeAfter) onClose();
        } catch (e: any) {
            alert(e.message || 'حدث خطأ');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = () => act(async () => {
        await onUpdate(tenant.id, {
            name: editName.trim(),
            billingEmail: editEmail.trim(),
            trialEndsAt: editTrial || null,
            notes: editNotes.trim() || null,
        });
        setSettingsDirty(false);
    }, false);

    const handleSaveLimits = () => act(async () => {
        await onUpdate(tenant.id, {
            customBrandLimit:   overrideBrands  ? parseInt(overrideBrands)  : null,
            customUserLimit:    overrideUsers   ? parseInt(overrideUsers)   : null,
            customAiTokenLimit: overrideAI      ? parseInt(overrideAI) * 1000 : null,
        });
        setLimitsDirty(false);
    }, false);

    const DRAWER_TABS: Array<{ id: DrawerTab; label: string; icon: string }> = [
        { id: 'usage',    label: 'الاستخدام', icon: 'fa-chart-bar' },
        { id: 'plan',     label: 'العضوية',   icon: 'fa-id-card' },
        { id: 'custom',   label: 'تخصيص',     icon: 'fa-sliders' },
        { id: 'settings', label: 'الإعدادات', icon: 'fa-cog' },
    ];

    const effectiveBrandLimit = tenant.customBrandLimit ?? tenant.brandLimit;
    const effectiveUserLimit  = tenant.customUserLimit  ?? tenant.userLimit;
    const effectiveAiLimit    = tenant.customAiTokenLimit ?? tenant.aiTokenLimit;

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm'>
            <div className='bg-light-card dark:bg-dark-card w-full max-w-sm h-full flex flex-col border-s border-light-border dark:border-dark-border shadow-2xl'>

                {/* Header */}
                <div className='flex justify-between items-center px-5 py-4 border-b border-light-border dark:border-dark-border'>
                    <div className='flex items-center gap-3'>
                        <div className='w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary text-sm'>
                            {tenant.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className='font-bold text-sm text-light-text dark:text-dark-text leading-tight'>{tenant.name}</h2>
                            <p className='text-[11px] text-light-text-secondary dark:text-dark-text-secondary'>{tenant.billingEmail}</p>
                        </div>
                    </div>
                    <div className='flex items-center gap-2'>
                        <StatusBadge status={tenant.status} />
                        <button onClick={onClose} aria-label="إغلاق" className='text-light-text-secondary hover:text-danger ms-1'><i className='fas fa-times' /></button>
                    </div>
                </div>

                {/* Tabs */}
                <div className='flex border-b border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg'>
                    {DRAWER_TABS.map(t => (
                        <button key={t.id} onClick={() => setDrawerTab(t.id)}
                            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors border-b-2
                                ${drawerTab === t.id
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                                }`}
                        >
                            <i className={`fas ${t.icon} text-xs`} />
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className='flex-1 overflow-y-auto p-5 space-y-4'>

                    {/* ── Tab: الاستخدام ── */}
                    {drawerTab === 'usage' && (
                        <>
                            <div className='bg-light-bg dark:bg-dark-bg rounded-xl p-4 space-y-3'>
                                <p className='text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest'>الاستخدام الحالي</p>
                                <UsageBar used={tenant.brandsCount}  limit={effectiveBrandLimit} label='البراندات' />
                                <UsageBar used={tenant.usersCount}   limit={effectiveUserLimit}  label='المستخدمون' />
                                <UsageBar
                                    used={Math.round(tenant.aiTokenUsage / 1000)}
                                    limit={effectiveAiLimit ? Math.round(effectiveAiLimit / 1000) : null}
                                    label='AI (ألف توكن)'
                                />
                            </div>

                            <div className='bg-light-bg dark:bg-dark-bg rounded-xl p-4 space-y-2'>
                                <p className='text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest'>معلومات الاشتراك</p>
                                {[
                                    { label: 'العضوية',   value: <PlanBadge plan={tenant.plan} planName={tenant.planName} /> },
                                    { label: 'الحالة',    value: <StatusBadge status={tenant.status} /> },
                                    { label: 'تاريخ الإنشاء', value: tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString('ar-EG') : '—' },
                                    { label: 'انتهاء التجربة', value: tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toLocaleDateString('ar-EG') : '—' },
                                ].map(row => (
                                    <div key={row.label} className='flex items-center justify-between text-sm'>
                                        <span className='text-light-text-secondary dark:text-dark-text-secondary text-xs'>{row.label}</span>
                                        <span className='text-light-text dark:text-dark-text text-xs font-medium'>{row.value}</span>
                                    </div>
                                ))}
                                {tenant.notes && (
                                    <div className='pt-2 border-t border-light-border dark:border-dark-border'>
                                        <p className='text-[10px] text-light-text-secondary dark:text-dark-text-secondary mb-1'>ملاحظات</p>
                                        <p className='text-xs text-light-text dark:text-dark-text leading-relaxed'>{tenant.notes}</p>
                                    </div>
                                )}
                            </div>

                            {/* Quick limits summary */}
                            <div className='grid grid-cols-3 gap-2'>
                                {[
                                    { label: 'براند', used: tenant.brandsCount, limit: effectiveBrandLimit, icon: 'fa-layer-group', color: 'text-blue-500', bg: 'bg-blue-500/10' },
                                    { label: 'مستخدم', used: tenant.usersCount, limit: effectiveUserLimit, icon: 'fa-users', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                                    { label: 'ألف توكن', used: Math.round(tenant.aiTokenUsage/1000), limit: effectiveAiLimit ? Math.round(effectiveAiLimit/1000) : null, icon: 'fa-bolt', color: 'text-amber-500', bg: 'bg-amber-500/10' },
                                ].map(card => (
                                    <div key={card.label} className={`rounded-xl p-3 text-center ${card.bg}`}>
                                        <i className={`fas ${card.icon} ${card.color} text-sm mb-1`} />
                                        <p className={`text-sm font-bold ${card.color}`}>{card.used}</p>
                                        <p className='text-[9px] text-light-text-secondary dark:text-dark-text-secondary'>
                                            {card.limit != null ? `/ ${card.limit}` : '/ ∞'}
                                        </p>
                                        <p className='text-[9px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5'>{card.label}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ── Tab: العضوية ── */}
                    {drawerTab === 'plan' && (
                        <>
                            <p className='text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest'>اختر خطة الاشتراك</p>
                            <div className='space-y-2'>
                                {plans.map(p => {
                                    const isActive = tenant.plan === p.id;
                                    return (
                                        <button key={p.id} disabled={loading || isActive}
                                            onClick={() => act(() => onPlanChange(tenant.id, p.id), false)}
                                            className={`w-full text-right px-4 py-3 rounded-xl border transition-all
                                                ${isActive
                                                    ? 'border-primary bg-primary/10 ring-1 ring-primary/40 cursor-default'
                                                    : 'border-light-border dark:border-dark-border hover:border-primary/40 hover:bg-light-bg dark:hover:bg-dark-bg'
                                                }`}
                                        >
                                            <div className='flex items-start justify-between gap-2'>
                                                <div className='flex-1'>
                                                    <div className='flex items-center gap-2'>
                                                        <span className={`font-bold text-sm ${isActive ? 'text-primary' : 'text-light-text dark:text-dark-text'}`}>{p.name}</span>
                                                        {isActive && <span className='text-[9px] bg-primary text-white px-1.5 py-0.5 rounded-full font-bold'>الحالية</span>}
                                                        {p.badge && !isActive && <span className='text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-bold'>{p.badge}</span>}
                                                    </div>
                                                    {p.tagline && <p className='text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5'>{p.tagline}</p>}
                                                    <div className='flex flex-wrap gap-2 mt-2'>
                                                        {[
                                                            { icon: 'fa-layer-group', val: p.brandLimit ?? '∞', label: 'براند' },
                                                            { icon: 'fa-users',       val: p.userLimit  ?? '∞', label: 'مستخدم' },
                                                            { icon: 'fa-bolt',        val: p.aiTokenLimit ? `${Math.round(p.aiTokenLimit/1000)}k` : '∞', label: 'AI' },
                                                        ].map(item => (
                                                            <span key={item.label} className='inline-flex items-center gap-1 text-[10px] text-light-text-secondary dark:text-dark-text-secondary bg-light-bg dark:bg-dark-bg px-2 py-0.5 rounded-full'>
                                                                <i className={`fas ${item.icon} text-[9px]`} /> {item.val} {item.label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className='text-right shrink-0'>
                                                    {p.monthlyPrice === 0
                                                        ? <span className='text-sm font-black text-success'>مجاني</span>
                                                        : <><span className='text-sm font-black text-light-text dark:text-dark-text'>${p.monthlyPrice}</span><span className='text-[10px] text-light-text-secondary dark:text-dark-text-secondary'>/شهر</span></>
                                                    }
                                                    {isActive && <i className='fas fa-check-circle block text-primary mt-1 text-sm' />}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* ── Tab: تخصيص الحدود ── */}
                    {drawerTab === 'custom' && (
                        <>
                            <div className='bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex gap-2'>
                                <i className='fas fa-sliders text-amber-500 mt-0.5' />
                                <div>
                                    <p className='text-xs font-bold text-amber-600 dark:text-amber-400'>حدود مخصصة لهذا الحساب</p>
                                    <p className='text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5 leading-tight'>
                                        تتجاوز حدود الخطة ({currentPlan?.name}). اتركها فارغة للرجوع لحدود الخطة.
                                    </p>
                                </div>
                            </div>

                            <div className='space-y-3'>
                                {/* Brand limit */}
                                <div>
                                    <label className='block text-xs font-bold text-light-text dark:text-dark-text mb-1.5'>
                                        <i className='fas fa-layer-group text-blue-500 me-1.5' />
                                        حد البراندات
                                        <span className='text-light-text-secondary dark:text-dark-text-secondary font-normal ms-1'>
                                            (افتراضي الخطة: {currentPlan?.brandLimit ?? '∞'})
                                        </span>
                                    </label>
                                    <div className='relative'>
                                        <input
                                            type='number' min='0' value={overrideBrands}
                                            onChange={e => { setOverrideBrands(e.target.value); setLimitsDirty(true); }}
                                            placeholder={`اتركها فارغة (الخطة: ${currentPlan?.brandLimit ?? '∞'})`}
                                            className='w-full px-3 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-sm text-light-text dark:text-dark-text placeholder:text-light-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/40'
                                        />
                                        {overrideBrands && (
                                            <button onClick={() => { setOverrideBrands(''); setLimitsDirty(true); }}
                                                className='absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary hover:text-danger text-xs'>
                                                <i className='fas fa-times-circle' />
                                            </button>
                                        )}
                                    </div>
                                    <p className='text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1'>
                                        مستخدم حالياً: {tenant.brandsCount} براند
                                    </p>
                                </div>

                                {/* User limit */}
                                <div>
                                    <label className='block text-xs font-bold text-light-text dark:text-dark-text mb-1.5'>
                                        <i className='fas fa-users text-emerald-500 me-1.5' />
                                        حد المستخدمين
                                        <span className='text-light-text-secondary dark:text-dark-text-secondary font-normal ms-1'>
                                            (افتراضي الخطة: {currentPlan?.userLimit ?? '∞'})
                                        </span>
                                    </label>
                                    <div className='relative'>
                                        <input
                                            type='number' min='0' value={overrideUsers}
                                            onChange={e => { setOverrideUsers(e.target.value); setLimitsDirty(true); }}
                                            placeholder={`اتركها فارغة (الخطة: ${currentPlan?.userLimit ?? '∞'})`}
                                            className='w-full px-3 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-sm text-light-text dark:text-dark-text placeholder:text-light-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/40'
                                        />
                                        {overrideUsers && (
                                            <button onClick={() => { setOverrideUsers(''); setLimitsDirty(true); }}
                                                className='absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary hover:text-danger text-xs'>
                                                <i className='fas fa-times-circle' />
                                            </button>
                                        )}
                                    </div>
                                    <p className='text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1'>
                                        مستخدم حالياً: {tenant.usersCount} مستخدم
                                    </p>
                                </div>

                                {/* AI token limit */}
                                <div>
                                    <label className='block text-xs font-bold text-light-text dark:text-dark-text mb-1.5'>
                                        <i className='fas fa-bolt text-amber-500 me-1.5' />
                                        حد الـ AI (بالألف توكن)
                                        <span className='text-light-text-secondary dark:text-dark-text-secondary font-normal ms-1'>
                                            (افتراضي الخطة: {currentPlan?.aiTokenLimit ? Math.round(currentPlan.aiTokenLimit/1000) + 'k' : '∞'})
                                        </span>
                                    </label>
                                    <div className='relative'>
                                        <input
                                            type='number' min='0' value={overrideAI}
                                            onChange={e => { setOverrideAI(e.target.value); setLimitsDirty(true); }}
                                            placeholder={`اتركها فارغة (الخطة: ${currentPlan?.aiTokenLimit ? Math.round(currentPlan.aiTokenLimit/1000)+'k' : '∞'})`}
                                            className='w-full px-3 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-sm text-light-text dark:text-dark-text placeholder:text-light-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/40'
                                        />
                                        {overrideAI && (
                                            <button onClick={() => { setOverrideAI(''); setLimitsDirty(true); }}
                                                className='absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary hover:text-danger text-xs'>
                                                <i className='fas fa-times-circle' />
                                            </button>
                                        )}
                                    </div>
                                    <p className='text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1'>
                                        مستخدم حالياً: {Math.round(tenant.aiTokenUsage/1000)}k توكن
                                    </p>
                                </div>
                            </div>

                            {/* Preview effective limits */}
                            <div className='bg-light-bg dark:bg-dark-bg rounded-xl p-3'>
                                <p className='text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase mb-2'>الحدود الفعلية بعد التخصيص</p>
                                <div className='grid grid-cols-3 gap-2 text-center'>
                                    {[
                                        { label: 'براند', val: overrideBrands || (currentPlan?.brandLimit ?? '∞'), color: 'text-blue-500' },
                                        { label: 'مستخدم', val: overrideUsers || (currentPlan?.userLimit ?? '∞'), color: 'text-emerald-500' },
                                        { label: 'AI (k)', val: overrideAI || (currentPlan?.aiTokenLimit ? Math.round(currentPlan.aiTokenLimit/1000) : '∞'), color: 'text-amber-500' },
                                    ].map(item => (
                                        <div key={item.label}>
                                            <p className={`text-sm font-black ${item.color}`}>{item.val}</p>
                                            <p className='text-[9px] text-light-text-secondary dark:text-dark-text-secondary'>{item.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {limitsDirty && (
                                <button disabled={loading} onClick={handleSaveLimits}
                                    className='w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors'>
                                    <i className='fas fa-save' /> حفظ الحدود المخصصة
                                </button>
                            )}
                        </>
                    )}

                    {/* ── Tab: الإعدادات ── */}
                    {drawerTab === 'settings' && (
                        <>
                            {/* Edit account info */}
                            <div className='space-y-3'>
                                <p className='text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest'>معلومات الحساب</p>

                                <div>
                                    <label className='block text-xs font-semibold text-light-text dark:text-dark-text mb-1'>اسم الحساب</label>
                                    <input value={editName}
                                        onChange={e => { setEditName(e.target.value); setSettingsDirty(true); }}
                                        className='w-full px-3 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-sm text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary/40'
                                    />
                                </div>

                                <div>
                                    <label className='block text-xs font-semibold text-light-text dark:text-dark-text mb-1'>البريد الإلكتروني للفوترة</label>
                                    <input type='email' value={editEmail}
                                        onChange={e => { setEditEmail(e.target.value); setSettingsDirty(true); }}
                                        className='w-full px-3 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-sm text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary/40'
                                    />
                                </div>

                                <div>
                                    <label className='block text-xs font-semibold text-light-text dark:text-dark-text mb-1'>
                                        تاريخ انتهاء التجربة
                                        <span className='text-light-text-secondary dark:text-dark-text-secondary font-normal ms-1'>(اختياري)</span>
                                    </label>
                                    <input type='date' value={editTrial}
                                        onChange={e => { setEditTrial(e.target.value); setSettingsDirty(true); }}
                                        className='w-full px-3 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-sm text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary/40'
                                    />
                                </div>

                                <div>
                                    <label className='block text-xs font-semibold text-light-text dark:text-dark-text mb-1'>ملاحظات داخلية</label>
                                    <textarea value={editNotes} rows={3}
                                        onChange={e => { setEditNotes(e.target.value); setSettingsDirty(true); }}
                                        placeholder='ملاحظات للفريق (لا تظهر للمستخدم)...'
                                        className='w-full px-3 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-sm text-light-text dark:text-dark-text resize-none focus:outline-none focus:ring-2 focus:ring-primary/40'
                                    />
                                </div>

                                {settingsDirty && (
                                    <button disabled={loading} onClick={handleSaveSettings}
                                        className='w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors'>
                                        <i className='fas fa-save' /> حفظ المعلومات
                                    </button>
                                )}
                            </div>

                            <div className='border-t border-light-border dark:border-dark-border pt-4 space-y-2'>
                                <p className='text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest'>إجراءات الحساب</p>

                                {tenant.status !== 'active' && (
                                    <button disabled={loading} onClick={() => act(() => onStatusChange(tenant.id, 'active'), false)}
                                        className='w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-success hover:bg-success/10 transition-colors border border-success/20'>
                                        <i className='fas fa-check-circle w-4' /> تفعيل الحساب
                                    </button>
                                )}
                                {tenant.status !== 'suspended' && (
                                    <button disabled={loading} onClick={() => act(() => onStatusChange(tenant.id, 'suspended'), false)}
                                        className='w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-warning hover:bg-warning/10 transition-colors border border-warning/20'>
                                        <i className='fas fa-pause-circle w-4' /> تعليق الحساب
                                    </button>
                                )}
                                {tenant.status !== 'cancelled' && (
                                    <button disabled={loading} onClick={() => act(() => onStatusChange(tenant.id, 'cancelled'), false)}
                                        className='w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-danger/70 hover:bg-danger/10 transition-colors border border-danger/10'>
                                        <i className='fas fa-ban w-4' /> إلغاء الاشتراك
                                    </button>
                                )}
                                <button disabled={loading} onClick={() => act(() => onResetAI(tenant.id), false)}
                                    className='w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-blue-400 hover:bg-blue-500/10 transition-colors border border-blue-500/20'>
                                    <i className='fas fa-redo w-4' /> إعادة تعيين AI
                                </button>
                            </div>
                        </>
                    )}

                </div>

                {/* Footer — Delete */}
                <div className='p-4 border-t border-light-border dark:border-dark-border'>
                    <button disabled={loading}
                        onClick={() => {
                            if (confirm(`حذف "${tenant.name}" نهائياً؟ لا يمكن التراجع.`)) act(() => onDelete(tenant.id));
                        }}
                        className='w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-danger border border-danger/30 hover:bg-danger/10 transition-colors'>
                        <i className='fas fa-trash-alt' /> حذف الحساب نهائياً
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Workspace Role Guide ──────────────────────────────────────────────────────

const WorkspaceRoleGuide: React.FC = () => {
    const [open, setOpen] = useState(false);
    const PERM_ICONS = [
        { key: 'canManageMembers',  label: 'إدارة الأعضاء',   icon: 'fa-users-cog' },
        { key: 'canEditContent',    label: 'تعديل المحتوى',   icon: 'fa-pen-to-square' },
        { key: 'canViewAnalytics',  label: 'عرض التحليلات',   icon: 'fa-chart-line' },
        { key: 'canManageSettings', label: 'إعدادات المساحة', icon: 'fa-cog' },
    ] as const;

    return (
        <div className='border-b border-light-border dark:border-dark-border'>
            <button
                onClick={() => setOpen(o => !o)}
                className='w-full flex items-center justify-between px-5 py-3 hover:bg-light-bg dark:hover:bg-dark-bg transition-colors'
            >
                <span className='flex items-center gap-2 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary'>
                    <i className='fas fa-sitemap text-[10px]' />
                    دليل الأدوار والصلاحيات
                </span>
                <i className={`fas fa-chevron-${open ? 'up' : 'down'} text-[10px] text-light-text-secondary dark:text-dark-text-secondary`} />
            </button>

            {open && (
                <div className='px-5 pb-4 space-y-2'>
                    {WORKSPACE_ROLES.map(role => (
                        <div key={role.id} className={`flex items-start gap-3 p-2.5 rounded-xl border ${role.bg} ${role.border}`}>
                            <div className={`w-7 h-7 rounded-lg ${role.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                <i className={`fas ${role.icon} ${role.color} text-xs`} />
                            </div>
                            <div className='flex-1 min-w-0'>
                                <p className={`font-bold text-xs ${role.color}`}>{role.label}</p>
                                <p className='text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5 leading-tight'>
                                    {role.description}
                                </p>
                                <div className='flex flex-wrap gap-1 mt-1.5'>
                                    {PERM_ICONS.map(p => (
                                        <span
                                            key={p.key}
                                            className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold
                                                ${(role as any)[p.key]
                                                    ? `${role.bg} ${role.color}`
                                                    : 'bg-light-bg dark:bg-dark-bg text-light-text-secondary/40 dark:text-dark-text-secondary/40'
                                                }`}
                                        >
                                            <i className={`fas ${p.icon} text-[8px]`} />
                                            {p.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Brand Members Drawer ──────────────────────────────────────────────────────

const BrandMembersDrawer: React.FC<{
    brand: BrandAccount;
    onClose: () => void;
    notify: (type: NotificationType, msg: string) => void;
}> = ({ brand, onClose, notify }) => {
    const [members, setMembers] = useState<BrandMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        setLoading(true);
        getBrandMembers(brand.id).then(data => {
            setMembers(data);
            setLoading(false);
        });
    }, [brand.id]);

    const handleRemove = async (memberId: string) => {
        if (!confirm('هل أنت متأكد من إزالة هذا العضو؟')) return;
        await removeBrandMember(memberId);
        setMembers(prev => prev.filter(m => m.id !== memberId));
        notify(NotificationType.Success, 'تم إزالة العضو');
    };

    const handleRoleChange = async (memberId: string, role: string) => {
        await updateBrandMemberRole(memberId, role);
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m));
        notify(NotificationType.Success, 'تم تحديث الدور');
    };

    const filtered = members.filter(m =>
        !search ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase())
    );

    // Role distribution counts
    const roleCounts = useMemo(() => {
        const c: Record<string, number> = {};
        members.forEach(m => { c[m.role] = (c[m.role] || 0) + 1; });
        return c;
    }, [members]);

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm'>
            <div className='bg-light-card dark:bg-dark-card w-full max-w-md h-full flex flex-col border-s border-light-border dark:border-dark-border shadow-2xl'>

                {/* Header */}
                <div className='flex justify-between items-center px-5 py-4 border-b border-light-border dark:border-dark-border'>
                    <div>
                        <div className='flex items-center gap-2'>
                            <div className='w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center'>
                                <span className='text-primary font-black text-xs'>{brand.name[0]?.toUpperCase()}</span>
                            </div>
                            <h2 className='font-bold text-light-text dark:text-dark-text'>{brand.name}</h2>
                        </div>
                        <p className='text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5'>
                            {members.length} عضو في مساحة العمل
                        </p>
                    </div>
                    <button onClick={onClose} className='text-light-text-secondary hover:text-danger transition-colors'>
                        <i className='fas fa-times' />
                    </button>
                </div>

                {/* Role distribution summary */}
                {!loading && members.length > 0 && (
                    <div className='px-5 py-3 border-b border-light-border dark:border-dark-border'>
                        <div className='flex flex-wrap gap-1.5'>
                            {WORKSPACE_ROLES.filter(r => roleCounts[r.id]).map(r => (
                                <span key={r.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${r.bg} ${r.color}`}>
                                    <i className={`fas ${r.icon} text-[9px]`} />
                                    {roleCounts[r.id]} {r.label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Role Guide (collapsible) */}
                <WorkspaceRoleGuide />

                {/* Search */}
                <div className='px-5 py-3 border-b border-light-border dark:border-dark-border'>
                    <input
                        type='text'
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder='ابحث بالاسم أو البريد...'
                        className='w-full px-3 py-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-sm text-light-text dark:text-dark-text focus:outline-none focus:border-primary'
                    />
                </div>

                {/* Members list */}
                <div className='flex-1 overflow-y-auto'>
                    {loading ? (
                        <div className='p-5 space-y-3 animate-pulse'>
                            {[1, 2, 3].map(i => <SkeletonLoader key={i} className='h-14' />)}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className='p-8 text-center'>
                            <i className='fas fa-users text-3xl text-light-text-secondary dark:text-dark-text-secondary mb-2' />
                            <p className='text-sm text-light-text-secondary dark:text-dark-text-secondary'>لا يوجد أعضاء مطابقون</p>
                        </div>
                    ) : (
                        <div className='divide-y divide-light-border dark:divide-dark-border'>
                            {filtered.map(member => {
                                const roleMeta = getRoleMeta(member.role);
                                return (
                                    <div key={member.id} className='flex items-center gap-3 px-5 py-3.5 hover:bg-light-bg dark:hover:bg-dark-bg transition-colors'>
                                        <div className={`w-9 h-9 rounded-full ${roleMeta.bg} flex items-center justify-center flex-shrink-0 ring-1 ${roleMeta.border}`}>
                                            <span className={`${roleMeta.color} font-bold text-sm`}>
                                                {member.name[0]?.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className='flex-1 min-w-0'>
                                            <p className='font-semibold text-sm text-light-text dark:text-dark-text truncate flex items-center gap-1.5'>
                                                {member.name}
                                                {member.isOwner && (
                                                    <span className='text-[9px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-full font-bold'>
                                                        <i className='fas fa-crown me-0.5 text-[8px]' />مالك
                                                    </span>
                                                )}
                                            </p>
                                            <p className='text-xs text-light-text-secondary dark:text-dark-text-secondary truncate'>{member.email}</p>
                                        </div>
                                        <div className='flex items-center gap-2 flex-shrink-0'>
                                            {!member.isOwner ? (
                                                <select
                                                    value={member.role}
                                                    onChange={e => handleRoleChange(member.id, e.target.value)}
                                                    className={`text-xs ${roleMeta.bg} ${roleMeta.color} border ${roleMeta.border} rounded-lg px-2 py-1 font-semibold focus:outline-none`}
                                                >
                                                    {ROLE_IDS.filter(r => r !== 'Owner').map(r => (
                                                        <option key={r} value={r}>{getRoleMeta(r).label}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${roleMeta.bg} ${roleMeta.color}`}>
                                                    {roleMeta.label}
                                                </span>
                                            )}
                                            {!member.isOwner && (
                                                <button
                                                    onClick={() => handleRemove(member.id)}
                                                    className='w-7 h-7 flex items-center justify-center rounded-lg text-danger hover:bg-danger/10 transition-colors'
                                                    title='إزالة العضو'
                                                >
                                                    <i className='fas fa-user-minus text-xs' />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className='px-5 py-3 border-t border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg'>
                    <p className='text-[10px] text-light-text-secondary dark:text-dark-text-secondary text-center font-mono'>
                        Brand ID: {brand.id.slice(0, 8)}...
                    </p>
                </div>
            </div>
        </div>
    );
};

// ── Tenant Row (accounts tab) ─────────────────────────────────────────────────

const TenantRow: React.FC<{
    tenant: Tenant;
    onManage: (t: Tenant) => void;
}> = ({ tenant, onManage }) => {
    const pctBrands = tenant.brandLimit && tenant.brandLimit > 0
        ? Math.min((tenant.brandsCount / tenant.brandLimit) * 100, 100) : 0;
    const pctUsers = tenant.userLimit && tenant.userLimit > 0
        ? Math.min((tenant.usersCount / tenant.userLimit) * 100, 100) : 0;
    const pctAI = tenant.aiTokenLimit > 0
        ? Math.min((tenant.aiTokenUsage / tenant.aiTokenLimit) * 100, 100) : 0;

    const barColor = (pct: number) => pct > 90 ? 'bg-danger' : pct > 70 ? 'bg-warning' : 'bg-primary';

    return (
        <div className='flex items-center gap-4 px-5 py-4 hover:bg-light-bg dark:hover:bg-dark-bg transition-colors'>
            {/* Avatar */}
            <div className='w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0'>
                <span className='text-primary font-black'>{tenant.name[0]?.toUpperCase()}</span>
            </div>

            {/* Name + status */}
            <div className='w-44 flex-shrink-0'>
                <p className='font-bold text-sm text-light-text dark:text-dark-text truncate'>{tenant.name}</p>
                <div className='flex items-center gap-1.5 mt-0.5'>
                    <StatusBadge status={tenant.status} />
                    <PlanBadge plan={tenant.plan} planName={tenant.planName} />
                </div>
            </div>

            {/* Usage bars */}
            <div className='flex-1 grid grid-cols-3 gap-4'>
                {/* Brands */}
                <div>
                    <div className='flex justify-between text-[10px] mb-1'>
                        <span className='text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1'>
                            <i className='fas fa-layer-group' />براندات
                        </span>
                        <span className='font-bold text-light-text dark:text-dark-text'>
                            {tenant.brandsCount}{tenant.brandLimit ? `/${tenant.brandLimit}` : ''}
                        </span>
                    </div>
                    <div className='w-full bg-light-bg dark:bg-dark-bg h-1.5 rounded-full'>
                        <div className={`${barColor(pctBrands)} h-1.5 rounded-full`} style={{ width: `${pctBrands}%` }} />
                    </div>
                </div>
                {/* Users */}
                <div>
                    <div className='flex justify-between text-[10px] mb-1'>
                        <span className='text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1'>
                            <i className='fas fa-users' />مستخدمون
                        </span>
                        <span className='font-bold text-light-text dark:text-dark-text'>
                            {tenant.usersCount}{tenant.userLimit ? `/${tenant.userLimit}` : ''}
                        </span>
                    </div>
                    <div className='w-full bg-light-bg dark:bg-dark-bg h-1.5 rounded-full'>
                        <div className={`${barColor(pctUsers)} h-1.5 rounded-full`} style={{ width: `${pctUsers}%` }} />
                    </div>
                </div>
                {/* AI */}
                <div>
                    <div className='flex justify-between text-[10px] mb-1'>
                        <span className='text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1'>
                            <i className='fas fa-brain' />AI
                        </span>
                        <span className='font-bold text-light-text dark:text-dark-text'>
                            {Math.round(pctAI)}%
                        </span>
                    </div>
                    <div className='w-full bg-light-bg dark:bg-dark-bg h-1.5 rounded-full'>
                        <div className={`${barColor(pctAI)} h-1.5 rounded-full`} style={{ width: `${pctAI}%` }} />
                    </div>
                </div>
            </div>

            {/* Action */}
            <button
                onClick={() => onManage(tenant)}
                className='flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors'
            >
                <i className='fas fa-cog text-[10px]' />
                إدارة
            </button>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const PageSkeleton: React.FC = () => (
    <div className='space-y-6 animate-pulse'>
        <div className='flex justify-between items-center'>
            <SkeletonLoader className='h-10 w-64' />
            <SkeletonLoader className='h-10 w-36' />
        </div>
        <div className='grid grid-cols-4 gap-4'>
            {[1,2,3,4].map(i => <SkeletonLoader key={i} className='h-20' />)}
        </div>
        <SkeletonLoader className='h-96' />
    </div>
);

interface TenantsPageProps {
    tenants: Tenant[];
    isLoading: boolean;
    plans?: SubscriptionPlanAdmin[];
    addNotification?: (type: NotificationType, message: string) => void;
    onRefresh?: () => void;
}

type TabId = 'accounts' | 'workspaces' | 'billing';

export const TenantsPage: React.FC<TenantsPageProps> = ({
    tenants: initialTenants, isLoading, plans = [], addNotification, onRefresh
}) => {
    const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
    const [tab, setTab] = useState<TabId>('accounts');
    const [showCreate, setShowCreate] = useState(false);
    const [manageTenant, setManageTenant] = useState<Tenant | null>(null);

    // Workspaces
    const [brands, setBrands] = useState<BrandAccount[]>([]);
    const [brandsLoading, setBrandsLoading] = useState(true);
    const [selectedBrand, setSelectedBrand] = useState<BrandAccount | null>(null);

    // Search / filter
    const [accountSearch, setAccountSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    useEffect(() => { setTenants(initialTenants); }, [initialTenants]);

    useEffect(() => {
        setBrandsLoading(true);
        getBrandsForAdmin().then(data => { setBrands(data); setBrandsLoading(false); });
    }, []);

    const notify = useCallback((type: NotificationType, msg: string) => {
        addNotification?.(type, msg);
    }, [addNotification]);

    // ── Tenant handlers ──
    const handleCreate = async (name: string, email: string, planId: string) => {
        const newTenant = await createTenant(name, email, planId);
        setTenants(prev => [newTenant, ...prev]);
        notify(NotificationType.Success, `تم إنشاء حساب "${name}" بنجاح`);
    };

    const handleStatusChange = async (id: string, status: 'active' | 'suspended' | 'cancelled') => {
        await updateTenantStatus(id, status);
        setTenants(prev => prev.map(t => t.id === id ? { ...t, status } : t));
        notify(NotificationType.Success, 'تم تحديث حالة الحساب');
    };

    const handlePlanChange = async (id: string, planId: string) => {
        await updateTenantPlan(id, planId);
        const plan = plans.find(p => p.id === planId);
        setTenants(prev => prev.map(t => t.id === id
            ? { ...t, plan: plan?.id || planId, planName: plan?.name, userLimit: plan?.userLimit, brandLimit: plan?.brandLimit }
            : t
        ));
        notify(NotificationType.Success, 'تم تغيير العضوية بنجاح');
    };

    const handleResetAI = async (id: string) => {
        await resetTenantAIUsage(id);
        setTenants(prev => prev.map(t => t.id === id ? { ...t, aiTokenUsage: 0 } : t));
        notify(NotificationType.Success, 'تم إعادة تعيين AI');
    };

    const handleDelete = async (id: string) => {
        await deleteTenant(id);
        setTenants(prev => prev.filter(t => t.id !== id));
        notify(NotificationType.Success, 'تم حذف الحساب');
        onRefresh?.();
    };

    const handleUpdate = async (
        id: string,
        updates: Parameters<typeof updateTenantDetails>[1]
    ) => {
        await updateTenantDetails(id, updates);
        setTenants(prev => prev.map(t => {
            if (t.id !== id) return t;
            return {
                ...t,
                ...(updates.name              !== undefined && { name: updates.name }),
                ...(updates.billingEmail      !== undefined && { billingEmail: updates.billingEmail }),
                ...(updates.trialEndsAt       !== undefined && { trialEndsAt: updates.trialEndsAt }),
                ...(updates.notes             !== undefined && { notes: updates.notes }),
                ...(updates.customBrandLimit  !== undefined && { customBrandLimit: updates.customBrandLimit }),
                ...(updates.customUserLimit   !== undefined && { customUserLimit: updates.customUserLimit }),
                ...(updates.customAiTokenLimit !== undefined && { customAiTokenLimit: updates.customAiTokenLimit, aiTokenLimit: updates.customAiTokenLimit ?? t.aiTokenLimit }),
            };
        }));
        notify(NotificationType.Success, 'تم حفظ التغييرات بنجاح');
    };

    // ── Stats ──
    const stats = useMemo(() => ({
        total: tenants.length,
        active: tenants.filter(t => t.status === 'active').length,
        trial: tenants.filter(t => t.status === 'trial').length,
        suspended: tenants.filter(t => t.status === 'suspended').length,
    }), [tenants]);

    // ── Filtered tenants ──
    const filteredTenants = useMemo(() => tenants.filter(t => {
        const matchStatus = statusFilter === 'all' || t.status === statusFilter;
        const matchSearch = !accountSearch ||
            t.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
            t.billingEmail?.toLowerCase().includes(accountSearch.toLowerCase()) ||
            t.plan.toLowerCase().includes(accountSearch.toLowerCase());
        return matchStatus && matchSearch;
    }), [tenants, statusFilter, accountSearch]);

    if (isLoading && tenants.length === 0 && brandsLoading) return <PageSkeleton />;

    const TABS: Array<{ id: TabId; label: string; icon: string; count: number }> = [
        { id: 'accounts',   label: 'الحسابات',       icon: 'fa-building',    count: tenants.length },
        { id: 'workspaces', label: 'مساحات العمل',   icon: 'fa-layer-group', count: brands.length },
        { id: 'billing',    label: 'حسابات الفوترة', icon: 'fa-credit-card', count: tenants.length },
    ];

    return (
        <div className='space-y-6'>

            {/* ── Header ── */}
            <div className='flex items-center justify-between'>
                <div>
                    <h1 className='text-3xl font-bold text-light-text dark:text-dark-text'>إدارة الحسابات والعضويات</h1>
                    <p className='text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1'>
                        {tenants.length} حساب · {brands.length} مساحة عمل · {plans.length} خطة اشتراك
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className='flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25'
                >
                    <i className='fas fa-plus' />
                    إنشاء حساب
                </button>
            </div>

            {/* ── Stats Bar ── */}
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                {[
                    { label: 'إجمالي الحسابات', value: stats.total,     icon: 'fa-building',      color: 'text-primary',   bg: 'bg-primary/10' },
                    { label: 'نشطة',            value: stats.active,    icon: 'fa-check-circle',  color: 'text-success',   bg: 'bg-success/10' },
                    { label: 'تجريبية',          value: stats.trial,     icon: 'fa-clock',         color: 'text-blue-400',  bg: 'bg-blue-500/10' },
                    { label: 'موقوفة',           value: stats.suspended, icon: 'fa-pause-circle',  color: 'text-warning',   bg: 'bg-warning/10' },
                ].map(s => (
                    <div key={s.label} className={`flex items-center gap-3 p-4 rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card`}>
                        <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                            <i className={`fas ${s.icon} ${s.color} text-sm`} />
                        </div>
                        <div>
                            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                            <p className='text-xs text-light-text-secondary dark:text-dark-text-secondary'>{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Membership Logic Banner ── */}
            <div className='bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border p-4'>
                <div className='flex items-center gap-2 mb-3'>
                    <i className='fas fa-sitemap text-primary text-sm' />
                    <p className='text-sm font-bold text-light-text dark:text-dark-text'>هيكلية العضويات</p>
                </div>
                <div className='flex items-center gap-2 overflow-x-auto pb-1'>
                    {[
                        { icon: 'fa-id-card', label: 'خطة الاشتراك', sub: 'تحدد الحدود', color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
                        { icon: 'fa-building', label: 'الحساب', sub: 'صاحب الاشتراك', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
                        { icon: 'fa-layer-group', label: 'مساحات العمل', sub: 'حتى حد الخطة', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
                        { icon: 'fa-users', label: 'أعضاء الفريق', sub: 'بأدوار محددة', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
                    ].map((step, i, arr) => (
                        <React.Fragment key={step.label}>
                            <div className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl ${step.bg} border ${step.border}`}>
                                <i className={`fas ${step.icon} ${step.color} text-base`} />
                                <span className={`text-[11px] font-bold ${step.color} whitespace-nowrap`}>{step.label}</span>
                                <span className='text-[9px] text-light-text-secondary dark:text-dark-text-secondary whitespace-nowrap'>{step.sub}</span>
                            </div>
                            {i < arr.length - 1 && (
                                <i className='fas fa-chevron-left flex-shrink-0 text-light-text-secondary dark:text-dark-text-secondary text-xs opacity-40' />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className='border-b border-light-border dark:border-dark-border'>
                <nav className='flex gap-1'>
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold transition-colors border-b-2
                                ${tab === t.id
                                    ? 'border-primary text-light-text dark:text-dark-text'
                                    : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                                }`}
                        >
                            <i className={`fas ${t.icon} text-xs`} />
                            {t.label}
                            <span className='bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary text-xs px-1.5 py-0.5 rounded-full'>{t.count}</span>
                        </button>
                    ))}
                </nav>
            </div>

            {/* ── ACCOUNTS TAB ── */}
            {tab === 'accounts' && (
                <div className='space-y-4'>
                    {/* Filters */}
                    <div className='flex items-center gap-3'>
                        <div className='relative flex-1'>
                            <i className='fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary text-sm' />
                            <input
                                type='text'
                                value={accountSearch}
                                onChange={e => setAccountSearch(e.target.value)}
                                placeholder='ابحث بالاسم أو البريد أو الخطة...'
                                className='w-full pe-10 ps-4 py-2.5 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl text-sm text-light-text dark:text-dark-text focus:outline-none focus:border-primary'
                            />
                        </div>
                        <div className='flex items-center gap-1 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl p-1'>
                            {['all', 'active', 'trial', 'suspended', 'cancelled'].map(s => (
                                <button key={s} onClick={() => setStatusFilter(s)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap
                                        ${statusFilter === s ? 'bg-primary text-white' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                                >
                                    {{ all: 'الكل', active: 'نشط', trial: 'تجريبي', suspended: 'موقوف', cancelled: 'ملغى' }[s]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tenant rows */}
                    {filteredTenants.length === 0 ? (
                        <div className='bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border p-12 text-center'>
                            <i className='fas fa-building text-4xl text-light-text-secondary dark:text-dark-text-secondary mb-3' />
                            <p className='font-bold text-light-text dark:text-dark-text'>لا توجد حسابات</p>
                            <p className='text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1'>
                                {tenants.length === 0
                                    ? 'لا توجد حسابات بعد — يمكنك إنشاء أول حساب الآن'
                                    : 'لا توجد حسابات مطابقة للمرشح المحدد'
                                }
                            </p>
                        </div>
                    ) : (
                        <div className='bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border overflow-hidden'>
                            <div className='divide-y divide-light-border dark:divide-dark-border'>
                                {filteredTenants.map(tenant => (
                                    <TenantRow key={tenant.id} tenant={tenant} onManage={setManageTenant} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── WORKSPACES TAB ── */}
            {tab === 'workspaces' && (
                <div>
                    {brandsLoading ? (
                        <div className='space-y-3 animate-pulse'>
                            {[1,2,3,4].map(i => <SkeletonLoader key={i} className='h-16' />)}
                        </div>
                    ) : brands.length === 0 ? (
                        <div className='bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border p-12 text-center'>
                            <i className='fas fa-layer-group text-4xl text-light-text-secondary dark:text-dark-text-secondary mb-3' />
                            <p className='font-bold text-light-text dark:text-dark-text'>لا توجد مساحات عمل</p>
                            <p className='text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1'>
                                المستخدمون لم يُنشئوا براندات بعد
                            </p>
                        </div>
                    ) : (
                        <div className='bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border overflow-hidden'>
                            <div className='divide-y divide-light-border dark:divide-dark-border'>
                                {brands.map(brand => (
                                    <div key={brand.id}
                                        className='flex items-center gap-4 px-5 py-3.5 hover:bg-light-bg dark:hover:bg-dark-bg transition-colors cursor-pointer'
                                        onClick={() => setSelectedBrand(brand)}
                                    >
                                        <div className='w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0'>
                                            <span className='text-primary font-black text-sm'>{brand.name[0]?.toUpperCase()}</span>
                                        </div>
                                        <div className='flex-1 min-w-0'>
                                            <p className='font-bold text-sm text-light-text dark:text-dark-text truncate'>{brand.name}</p>
                                            <p className='text-xs text-light-text-secondary dark:text-dark-text-secondary'>
                                                <i className='fas fa-users text-[10px] me-1' />
                                                {brand.membersCount} عضو · أُنشئ {new Date(brand.createdAt).toLocaleDateString('ar-EG')}
                                            </p>
                                        </div>
                                        <div className='flex items-center gap-2'>
                                            <span className='text-xs bg-success/15 text-success px-2 py-0.5 rounded-full font-medium'>نشط</span>
                                            <button
                                                onClick={e => { e.stopPropagation(); setSelectedBrand(brand); }}
                                                className='flex items-center gap-1.5 text-xs text-primary hover:underline font-bold px-2 py-1 rounded-lg hover:bg-primary/10'
                                            >
                                                <i className='fas fa-users text-[10px]' />
                                                الأعضاء
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── BILLING TAB ── */}
            {tab === 'billing' && (
                <div className='bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border overflow-hidden'>
                    {tenants.length === 0 ? (
                        <div className='p-12 text-center'>
                            <i className='fas fa-credit-card text-4xl text-light-text-secondary dark:text-dark-text-secondary mb-3' />
                            <p className='font-bold text-light-text dark:text-dark-text'>لا توجد حسابات فوترة</p>
                        </div>
                    ) : (
                        <div>
                            <div className='flex items-center justify-between px-5 py-3 border-b border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg'>
                                <p className='text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest'>
                                    حسابات الفوترة ({tenants.length})
                                </p>
                            </div>
                            <div className='divide-y divide-light-border dark:divide-dark-border'>
                                {tenants.map(t => (
                                    <div key={t.id} className='flex items-center gap-4 px-5 py-4 hover:bg-light-bg dark:hover:bg-dark-bg transition-colors'>
                                        <div className='w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0'>
                                            <span className='text-primary font-black text-sm'>{t.name[0]?.toUpperCase()}</span>
                                        </div>
                                        <div className='flex-1 min-w-0'>
                                            <p className='font-bold text-sm text-light-text dark:text-dark-text'>{t.name}</p>
                                            <p className='text-xs text-light-text-secondary dark:text-dark-text-secondary'>{t.billingEmail}</p>
                                        </div>
                                        <div className='flex items-center gap-2'>
                                            <PlanBadge plan={t.plan} planName={t.planName} />
                                            <StatusBadge status={t.status} />
                                        </div>
                                        <button onClick={() => setManageTenant(t)}
                                            className='flex items-center gap-1.5 text-xs text-primary font-bold px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors'>
                                            <i className='fas fa-cog text-[10px]' />إدارة
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Modals ── */}
            {showCreate && (
                <CreateTenantModal
                    plans={plans}
                    onClose={() => setShowCreate(false)}
                    onCreate={handleCreate}
                />
            )}

            {manageTenant && (
                <ManageDrawer
                    tenant={manageTenant}
                    plans={plans}
                    onClose={() => setManageTenant(null)}
                    onStatusChange={handleStatusChange}
                    onPlanChange={handlePlanChange}
                    onResetAI={handleResetAI}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                />
            )}

            {selectedBrand && (
                <BrandMembersDrawer
                    brand={selectedBrand}
                    onClose={() => setSelectedBrand(null)}
                    notify={notify}
                />
            )}
        </div>
    );
};
