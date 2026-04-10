import React, { useEffect, useMemo, useState } from 'react';
import { ActiveSession, ApiKey, NotificationType, PaymentRecord, SubscriptionPlan, User, UserRole } from '../../types';
import { manageBillingSubscription } from '../../services/billingManagementService';
import { useLanguage } from '../../context/LanguageContext';

interface SystemPageProps {
    brandId: string;
    users: User[];
    subscription: SubscriptionPlan;
    paymentHistory: PaymentRecord[];
    activeSessions: ActiveSession[];
    apiKeys: ApiKey[];
    onInviteUser: (email: string, role: UserRole) => Promise<void>;
    onUpdateUserRole: (userId: string, newRole: UserRole) => Promise<void>;
    onDeleteUser: (userId: string) => Promise<void>;
    onRevokeSession: (sessionId: string) => Promise<void>;
    onGenerateApiKey: (name: string) => Promise<string>;
    onDeleteApiKey: (keyId: string) => Promise<void>;
    onRefreshSystem: () => Promise<void>;
    addNotification: (type: NotificationType, message: string) => void;
}

type SystemTab = 'users' | 'billing' | 'security' | 'api';
type BillingAction = 'portal' | 'pause' | 'cancel' | 'resume' | 'change_billing_cycle';

const ROLE_OPTIONS = Object.values(UserRole);

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`whitespace-nowrap rounded-t-lg px-4 py-3 text-sm font-medium transition-colors ${
            active
                ? 'border-b-2 border-brand-pink bg-light-card text-light-text dark:bg-dark-card dark:text-dark-text'
                : 'text-light-text-secondary hover:text-light-text dark:text-dark-text-secondary dark:hover:text-dark-text'
        }`}
    >
        {children}
    </button>
);

const ModalShell: React.FC<{
    title: string;
    description?: string;
    onClose: () => void;
    children: React.ReactNode;
    footer: React.ReactNode;
}> = ({ title, description, onClose, children, footer }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-[1.75rem] border border-light-border bg-light-card p-6 shadow-2xl dark:border-dark-border dark:bg-dark-card">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text">{title}</h3>
                    {description && <p className="mt-2 text-sm leading-6 text-light-text-secondary dark:text-dark-text-secondary">{description}</p>}
                </div>
                <button onClick={onClose} className="rounded-xl p-2 text-light-text-secondary transition-colors hover:bg-light-bg hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-dark-bg dark:hover:text-dark-text" aria-label="Close dialog">
                    <i className="fas fa-times text-sm" />
                </button>
            </div>
            <div className="mt-5 space-y-4">{children}</div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>
        </div>
    </div>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="block text-sm font-semibold text-light-text dark:text-dark-text">{children}</label>
);

const UsersPanel: React.FC<Pick<SystemPageProps, 'users' | 'onInviteUser' | 'onUpdateUserRole' | 'onDeleteUser' | 'addNotification'>> = ({
    users,
    onInviteUser,
    onUpdateUserRole,
    onDeleteUser,
    addNotification,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<UserRole>(UserRole.Editor);
    const [roleTarget, setRoleTarget] = useState<User | null>(null);
    const [roleValue, setRoleValue] = useState<UserRole>(UserRole.Editor);
    const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

    const submitInvite = async () => {
        if (!inviteEmail.trim()) {
            addNotification(NotificationType.Warning, ar ? 'أدخل بريدًا إلكترونيًا صالحًا.' : 'Enter a valid email address.');
            return;
        }
        setIsSubmitting('invite-user');
        try {
            await onInviteUser(inviteEmail.trim(), inviteRole);
            addNotification(NotificationType.Success, ar ? 'تم إرسال الدعوة.' : 'Invitation sent.');
            setInviteOpen(false);
            setInviteEmail('');
            setInviteRole(UserRole.Editor);
        } catch (error) {
            addNotification(NotificationType.Error, error instanceof Error ? error.message : (ar ? 'تعذر إرسال الدعوة.' : 'Failed to send invitation.'));
        } finally {
            setIsSubmitting(null);
        }
    };

    const submitRoleUpdate = async () => {
        if (!roleTarget) return;
        setIsSubmitting(`update-${roleTarget.id}`);
        try {
            await onUpdateUserRole(roleTarget.id, roleValue);
            addNotification(NotificationType.Success, ar ? 'تم تحديث الدور.' : 'Role updated.');
            setRoleTarget(null);
        } catch (error) {
            addNotification(NotificationType.Error, error instanceof Error ? error.message : (ar ? 'تعذر تحديث الدور.' : 'Failed to update role.'));
        } finally {
            setIsSubmitting(null);
        }
    };

    const submitDelete = async () => {
        if (!deleteTarget) return;
        setIsSubmitting(`delete-${deleteTarget.id}`);
        try {
            await onDeleteUser(deleteTarget.id);
            addNotification(NotificationType.Success, ar ? 'تم حذف المستخدم.' : 'User removed.');
            setDeleteTarget(null);
        } catch (error) {
            addNotification(NotificationType.Error, error instanceof Error ? error.message : (ar ? 'تعذر حذف المستخدم.' : 'Failed to remove user.'));
        } finally {
            setIsSubmitting(null);
        }
    };

    return (
        <>
            <div className="rounded-lg border border-light-border bg-light-card p-6 dark:border-dark-border dark:bg-dark-card">
                <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">{ar ? 'أعضاء الفريق' : 'Team Members'}</h2>
                        <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            {ar ? 'أدر الدعوات والأدوار والوصول داخل مساحة العمل.' : 'Manage invitations, roles, and access inside the workspace.'}
                        </p>
                    </div>
                    <button
                        onClick={() => setInviteOpen(true)}
                        disabled={!!isSubmitting}
                        className="rounded-lg bg-brand-primary px-4 py-2 font-bold text-white disabled:opacity-50"
                    >
                        {isSubmitting === 'invite-user' ? (ar ? 'جارٍ الإرسال...' : 'Sending...') : (ar ? 'دعوة عضو' : 'Invite User')}
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        <thead className="bg-light-bg text-xs uppercase dark:bg-dark-bg">
                            <tr>
                                <th className="px-4 py-3">{ar ? 'المستخدم' : 'User'}</th>
                                <th className="px-4 py-3">{ar ? 'الدور' : 'Role'}</th>
                                <th className="px-4 py-3">{ar ? 'آخر نشاط' : 'Last Active'}</th>
                                <th className="px-4 py-3">{ar ? 'الإجراءات' : 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} className="border-b border-light-border dark:border-dark-border">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <img src={user.avatarUrl} className="h-8 w-8 rounded-full" alt={user.name} />
                                            <div>
                                                <p className="font-bold text-light-text dark:text-dark-text">{user.name}</p>
                                                <p className="text-xs">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">{user.role}</td>
                                    <td className="px-4 py-3">{user.lastActive.toLocaleDateString(ar ? 'ar-EG' : 'en-US')}</td>
                                    <td className="px-4 py-3">
                                        <button
                                            disabled={!!isSubmitting}
                                            onClick={() => {
                                                setRoleTarget(user);
                                                setRoleValue(user.role);
                                            }}
                                            className="text-xs font-bold text-brand-secondary hover:underline disabled:opacity-50"
                                        >
                                            {isSubmitting === `update-${user.id}` ? '...' : (ar ? 'إدارة' : 'Manage')}
                                        </button>
                                        <button
                                            disabled={!!isSubmitting}
                                            onClick={() => setDeleteTarget(user)}
                                            className="ms-3 text-xs font-bold text-red-500/80 hover:text-red-500 disabled:opacity-50"
                                        >
                                            {isSubmitting === `delete-${user.id}` ? '...' : (ar ? 'حذف' : 'Delete')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {inviteOpen && (
                <ModalShell
                    title={ar ? 'دعوة عضو جديد' : 'Invite a new team member'}
                    description={ar ? 'حدد البريد الإلكتروني والدور قبل إرسال الدعوة.' : 'Set the email and role before sending the invitation.'}
                    onClose={() => setInviteOpen(false)}
                    footer={
                        <>
                            <button onClick={() => setInviteOpen(false)} className="rounded-xl border border-light-border px-4 py-2 text-sm font-semibold text-light-text dark:border-dark-border dark:text-dark-text">{ar ? 'إلغاء' : 'Cancel'}</button>
                            <button onClick={submitInvite} disabled={isSubmitting === 'invite-user'} className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isSubmitting === 'invite-user' ? (ar ? 'جارٍ الإرسال...' : 'Sending...') : (ar ? 'إرسال الدعوة' : 'Send invitation')}</button>
                        </>
                    }
                >
                    <div>
                        <FieldLabel>{ar ? 'البريد الإلكتروني' : 'Email address'}</FieldLabel>
                        <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} type="email" className="mt-2 w-full rounded-xl border border-light-border bg-light-bg px-3 py-2 text-sm text-light-text dark:border-dark-border dark:bg-dark-bg dark:text-dark-text" placeholder="name@company.com" />
                    </div>
                    <div>
                        <FieldLabel>{ar ? 'الدور' : 'Role'}</FieldLabel>
                        <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as UserRole)} className="mt-2 w-full rounded-xl border border-light-border bg-light-bg px-3 py-2 text-sm text-light-text dark:border-dark-border dark:bg-dark-bg dark:text-dark-text">
                            {ROLE_OPTIONS.map(role => <option key={role} value={role}>{role}</option>)}
                        </select>
                    </div>
                </ModalShell>
            )}

            {roleTarget && (
                <ModalShell
                    title={ar ? `إدارة ${roleTarget.name}` : `Manage ${roleTarget.name}`}
                    description={ar ? 'اختر الدور المناسب لهذا العضو.' : 'Choose the right role for this member.'}
                    onClose={() => setRoleTarget(null)}
                    footer={
                        <>
                            <button onClick={() => setRoleTarget(null)} className="rounded-xl border border-light-border px-4 py-2 text-sm font-semibold text-light-text dark:border-dark-border dark:text-dark-text">{ar ? 'إلغاء' : 'Cancel'}</button>
                            <button onClick={submitRoleUpdate} disabled={isSubmitting === `update-${roleTarget.id}`} className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isSubmitting === `update-${roleTarget.id}` ? '...' : (ar ? 'حفظ الدور' : 'Save role')}</button>
                        </>
                    }
                >
                    <div>
                        <FieldLabel>{ar ? 'الدور' : 'Role'}</FieldLabel>
                        <select value={roleValue} onChange={(event) => setRoleValue(event.target.value as UserRole)} className="mt-2 w-full rounded-xl border border-light-border bg-light-bg px-3 py-2 text-sm text-light-text dark:border-dark-border dark:bg-dark-bg dark:text-dark-text">
                            {ROLE_OPTIONS.map(role => <option key={role} value={role}>{role}</option>)}
                        </select>
                    </div>
                </ModalShell>
            )}

            {deleteTarget && (
                <ModalShell
                    title={ar ? 'تأكيد حذف المستخدم' : 'Confirm user removal'}
                    description={ar ? `سيتم حذف ${deleteTarget.name} من الفريق.` : `${deleteTarget.name} will be removed from the workspace.`}
                    onClose={() => setDeleteTarget(null)}
                    footer={
                        <>
                            <button onClick={() => setDeleteTarget(null)} className="rounded-xl border border-light-border px-4 py-2 text-sm font-semibold text-light-text dark:border-dark-border dark:text-dark-text">{ar ? 'إلغاء' : 'Cancel'}</button>
                            <button onClick={submitDelete} disabled={isSubmitting === `delete-${deleteTarget.id}`} className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isSubmitting === `delete-${deleteTarget.id}` ? '...' : (ar ? 'حذف المستخدم' : 'Delete user')}</button>
                        </>
                    }
                >
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {ar ? 'سيتم سحب الوصول من هذا المستخدم فورًا.' : 'This user will immediately lose access.'}
                    </p>
                </ModalShell>
            )}
        </>
    );
};

const BillingPanel: React.FC<Pick<SystemPageProps, 'brandId' | 'subscription' | 'paymentHistory' | 'onRefreshSystem' | 'addNotification'>> = ({
    brandId,
    subscription,
    paymentHistory,
    onRefreshSystem,
    addNotification,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const [isManaging, setIsManaging] = useState<string | null>(null);
    const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'yearly'>(subscription.billingCycle || 'monthly');
    const [reasonAction, setReasonAction] = useState<'pause' | 'cancel' | null>(null);
    const [reason, setReason] = useState('');

    useEffect(() => {
        setSelectedCycle(subscription.billingCycle || 'monthly');
    }, [subscription.billingCycle]);

    const usagePercentage = (usage: number, limit: number) => (limit > 0 ? Math.min(100, (usage / limit) * 100) : 0);
    const usersPercentage = usagePercentage(subscription.usage.users, subscription.limits.users);
    const brandsPercentage = usagePercentage(subscription.usage.brands, subscription.limits.brands);
    const aiPercentage = usagePercentage(subscription.usage.aiTokens || 0, subscription.limits.aiTokens);
    const hasScheduledPause = subscription.scheduledChangeAction === 'pause' && subscription.status !== 'paused';
    const hasScheduledCancellation = subscription.scheduledChangeAction === 'cancel' || subscription.cancelAtPeriodEnd;

    const executeAction = async (action: BillingAction, options?: { billingCycle?: 'monthly' | 'yearly'; open?: 'portal' | 'payment'; reason?: string }) => {
        setIsManaging(action);
        try {
            const result = await manageBillingSubscription({
                brandId,
                action,
                billingCycle: options?.billingCycle,
                reason: options?.reason,
            });

            if (options?.open === 'portal' && result.portalUrl) {
                window.open(result.portalUrl, '_blank', 'noopener,noreferrer');
            }

            if (options?.open === 'payment') {
                const paymentUrl = result.updatePaymentMethodUrl || result.portalUrl;
                if (paymentUrl) {
                    window.open(paymentUrl, '_blank', 'noopener,noreferrer');
                } else {
                    addNotification(NotificationType.Info, ar ? 'لا توجد بوابة دفع متاحة حاليًا.' : 'No payment method portal is available yet.');
                }
            }

            await onRefreshSystem();
            addNotification(NotificationType.Success, result.message);
        } catch (error) {
            addNotification(NotificationType.Error, error instanceof Error ? error.message : (ar ? 'فشل إجراء الفوترة.' : 'Billing action failed.'));
        } finally {
            setIsManaging(null);
        }
    };

    const nextBillingLabel = new Date(subscription.nextBillingDate).toLocaleDateString(ar ? 'ar-EG' : 'en-US');
    const trialEndsLabel = subscription.trialEndsAt ? new Date(subscription.trialEndsAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US') : null;

    return (
        <>
            <div className="rounded-lg border border-light-border bg-light-card p-6 dark:border-dark-border dark:bg-dark-card">
                <h2 className="mb-4 text-xl font-bold text-light-text dark:text-dark-text">{ar ? 'الفوترة والاشتراك' : 'Billing & Subscription'}</h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="rounded-lg bg-light-bg p-4 dark:bg-dark-bg">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="font-semibold text-light-text dark:text-dark-text">
                                    {ar ? 'الخطة الحالية:' : 'Current plan:'} <span className="text-brand-pink">{subscription.name}</span>
                                </h3>
                                <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'الحالة:' : 'Status:'} <span className="font-bold text-light-text dark:text-dark-text">{subscription.status || 'trial'}</span></p>
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'دورة الفوترة:' : 'Billing cycle:'} <span className="font-bold text-light-text dark:text-dark-text">{subscription.billingCycle || 'monthly'}</span></p>
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'تاريخ الاستحقاق القادم:' : 'Next billing date:'} {nextBillingLabel}</p>
                                {trialEndsLabel && <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'نهاية التجربة:' : 'Trial ends:'} {trialEndsLabel}</p>}
                                {hasScheduledCancellation && <p className="mt-2 text-sm font-semibold text-amber-500">{ar ? 'هناك إلغاء مجدول بنهاية الفترة الحالية.' : 'This subscription is scheduled to cancel at period end.'}</p>}
                                {hasScheduledPause && <p className="mt-2 text-sm font-semibold text-amber-500">{ar ? 'هناك إيقاف مجدول بنهاية الفترة الحالية.' : 'This subscription is scheduled to pause at period end.'}</p>}
                                {subscription.pauseReason && <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'سبب الإيقاف:' : 'Pause reason:'} {subscription.pauseReason}</p>}
                            </div>
                            <div className="rounded-full bg-light-card px-3 py-1 text-xs font-bold text-light-text-secondary dark:bg-dark-card dark:text-dark-text-secondary">{subscription.currency} {subscription.price.toFixed(0)}</div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            <button onClick={() => executeAction('portal', { open: 'portal' })} disabled={!subscription.canManage || isManaging === 'portal'} className="rounded-lg border border-light-border px-4 py-2 text-sm font-bold text-light-text disabled:opacity-50 dark:border-dark-border dark:text-dark-text">{isManaging === 'portal' ? '...' : (ar ? 'إدارة الاشتراك' : 'Manage subscription')}</button>
                            <button onClick={() => executeAction('portal', { open: 'payment' })} disabled={!subscription.canManage || isManaging === 'portal'} className="rounded-lg border border-light-border px-4 py-2 text-sm font-bold text-light-text disabled:opacity-50 dark:border-dark-border dark:text-dark-text">{isManaging === 'portal' ? '...' : (ar ? 'تحديث وسيلة الدفع' : 'Update payment method')}</button>
                            <button onClick={() => setReasonAction('pause')} disabled={!subscription.canPause || !!isManaging} className="rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{isManaging === 'pause' ? '...' : (ar ? 'إيقاف بنهاية الفترة' : 'Pause at period end')}</button>
                            <button onClick={() => setReasonAction('cancel')} disabled={!subscription.canCancel || !!isManaging} className="rounded-lg bg-rose-500/90 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{isManaging === 'cancel' ? '...' : (ar ? 'إلغاء بنهاية الفترة' : 'Cancel at period end')}</button>
                            <button onClick={() => executeAction('resume')} disabled={!subscription.canResume || !!isManaging} className="rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{isManaging === 'resume' ? '...' : hasScheduledPause ? (ar ? 'إلغاء الإيقاف المجدول' : 'Remove scheduled pause') : hasScheduledCancellation ? (ar ? 'إلغاء الإلغاء المجدول' : 'Remove scheduled cancellation') : (ar ? 'استئناف الاشتراك' : 'Resume subscription')}</button>
                        </div>

                        <div className="mt-5 rounded-lg border border-light-border p-3 dark:border-dark-border">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-light-text dark:text-dark-text">{ar ? 'تغيير دورة الفوترة' : 'Change billing cycle'}</p>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'بدّل بين الفوترة الشهرية والسنوية.' : 'Switch between monthly and yearly billing.'}</p>
                                </div>
                                <div className="inline-flex items-center gap-2 rounded-lg bg-light-card p-1 dark:bg-dark-card">
                                    {(['monthly', 'yearly'] as const).map(cycle => (
                                        <button key={cycle} onClick={() => setSelectedCycle(cycle)} className={`rounded-md px-3 py-1 text-xs font-bold ${selectedCycle === cycle ? 'bg-brand-primary text-white' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{cycle === 'monthly' ? (ar ? 'شهري' : 'Monthly') : (ar ? 'سنوي' : 'Yearly')}</button>
                                    ))}
                                </div>
                            </div>
                            <button onClick={() => executeAction('change_billing_cycle', { billingCycle: selectedCycle })} disabled={!subscription.canChangeBillingCycle || selectedCycle === subscription.billingCycle || !!isManaging} className="mt-4 w-full rounded-lg bg-brand-pink py-2 font-bold text-white disabled:opacity-50">{isManaging === 'change_billing_cycle' ? (ar ? 'جارٍ التحديث...' : 'Updating...') : (ar ? 'تأكيد تغيير الدورة' : 'Apply billing cycle change')}</button>
                        </div>
                    </div>

                    <div className="space-y-3 rounded-lg bg-light-bg p-4 dark:bg-dark-bg">
                        <h3 className="font-semibold text-light-text dark:text-dark-text">{ar ? 'استهلاك الموارد' : 'Resource Usage'}</h3>
                        <div><div className="mb-1 flex justify-between text-xs font-bold"><span>{ar ? 'المستخدمون' : 'Users'}</span><span>{subscription.usage.users} / {subscription.limits.users}</span></div><div className="h-2 w-full rounded-full bg-light-card dark:bg-dark-card"><div className="h-2 rounded-full bg-brand-purple" style={{ width: `${usersPercentage}%` }} /></div></div>
                        <div><div className="mb-1 flex justify-between text-xs font-bold"><span>{ar ? 'البراندات' : 'Brands'}</span><span>{subscription.usage.brands} / {subscription.limits.brands}</span></div><div className="h-2 w-full rounded-full bg-light-card dark:bg-dark-card"><div className="h-2 rounded-full bg-brand-pink" style={{ width: `${brandsPercentage}%` }} /></div></div>
                        <div><div className="mb-1 flex justify-between text-xs font-bold"><span>{ar ? 'رصيد الذكاء الاصطناعي' : 'AI Tokens'}</span><span>{(subscription.usage.aiTokens || 0).toLocaleString()} / {subscription.limits.aiTokens.toLocaleString()}</span></div><div className="h-2 w-full rounded-full bg-light-card dark:bg-dark-card"><div className="h-2 rounded-full bg-brand-secondary" style={{ width: `${aiPercentage}%` }} /></div></div>
                    </div>
                </div>

                <div className="mt-6">
                    <h3 className="mb-3 font-bold text-light-text dark:text-dark-text">{ar ? 'سجل الفواتير' : 'Invoice History'}</h3>
                    {paymentHistory.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-light-border px-4 py-6 text-center text-sm text-light-text-secondary dark:border-dark-border dark:text-dark-text-secondary">{ar ? 'لا توجد فواتير بعد.' : 'No invoices yet.'}</div>
                    ) : (
                        <table className="w-full text-left text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            <thead className="bg-light-bg text-xs uppercase dark:bg-dark-bg"><tr><th className="px-4 py-3">{ar ? 'تاريخ الفاتورة' : 'Invoice Date'}</th><th className="px-4 py-3">{ar ? 'المبلغ' : 'Amount'}</th><th className="px-4 py-3">{ar ? 'الحالة' : 'Status'}</th><th className="px-4 py-3"></th></tr></thead>
                            <tbody>
                                {paymentHistory.map(record => (
                                    <tr key={record.id} className="border-b border-light-border dark:border-dark-border">
                                        <td className="px-4 py-3">{new Date(record.date).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}</td>
                                        <td className="px-4 py-3 font-bold text-light-text dark:text-dark-text">{record.currency || 'USD'} {record.amount.toFixed(2)}</td>
                                        <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${record.status === 'Paid' ? 'bg-green-500/20 text-green-400' : record.status === 'Refunded' ? 'bg-slate-400/20 text-slate-300' : record.status === 'Open' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'}`}>{record.status}</span></td>
                                        <td className="px-4 py-3">{record.invoiceUrl && record.invoiceUrl !== '#' ? <a href={record.invoiceUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-secondary hover:underline">{ar ? 'فتح' : 'Open'}</a> : <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">—</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {reasonAction && (
                <ModalShell
                    title={reasonAction === 'pause' ? (ar ? 'إيقاف الاشتراك' : 'Pause subscription') : (ar ? 'إلغاء الاشتراك' : 'Cancel subscription')}
                    description={ar ? 'يمكنك إضافة سبب اختياري يظهر في سجل التدقيق.' : 'You can add an optional reason for the audit trail.'}
                    onClose={() => { setReasonAction(null); setReason(''); }}
                    footer={<><button onClick={() => { setReasonAction(null); setReason(''); }} className="rounded-xl border border-light-border px-4 py-2 text-sm font-semibold text-light-text dark:border-dark-border dark:text-dark-text">{ar ? 'إلغاء' : 'Cancel'}</button><button onClick={() => { executeAction(reasonAction, { reason }); setReasonAction(null); setReason(''); }} className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white">{reasonAction === 'pause' ? (ar ? 'تأكيد الإيقاف' : 'Confirm pause') : (ar ? 'تأكيد الإلغاء' : 'Confirm cancel')}</button></>}
                >
                    <div>
                        <FieldLabel>{ar ? 'السبب' : 'Reason'}</FieldLabel>
                        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-light-border bg-light-bg px-3 py-2 text-sm text-light-text dark:border-dark-border dark:bg-dark-bg dark:text-dark-text" placeholder={ar ? 'سبب اختياري يظهر في سجل التدقيق' : 'Optional reason shown in the audit trail'} />
                    </div>
                </ModalShell>
            )}
        </>
    );
};
const SecurityPanel: React.FC<Pick<SystemPageProps, 'activeSessions' | 'onRevokeSession' | 'addNotification'>> = ({ activeSessions, onRevokeSession, addNotification }) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

    const handleRevoke = async (sessionId: string) => {
        setIsSubmitting(sessionId);
        try {
            await onRevokeSession(sessionId);
            addNotification(NotificationType.Success, ar ? 'تم إلغاء الجلسة.' : 'Session revoked.');
        } catch (error) {
            addNotification(NotificationType.Error, error instanceof Error ? error.message : (ar ? 'تعذر إلغاء الجلسة.' : 'Failed to revoke session.'));
        } finally {
            setIsSubmitting(null);
        }
    };

    return (
        <div className="rounded-lg border border-light-border bg-light-card p-6 dark:border-dark-border dark:bg-dark-card">
            <h2 className="mb-4 text-xl font-bold text-light-text dark:text-dark-text">{ar ? 'الأمان' : 'Security'}</h2>
            <div className="mb-6 rounded-lg bg-light-bg p-4 dark:bg-dark-bg">
                <h3 className="font-semibold text-light-text dark:text-dark-text">{ar ? 'المصادقة الثنائية' : 'Two-Factor Authentication'}</h3>
                <div className="mt-2 flex items-center justify-between gap-4">
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'الحالة الحالية:' : 'Current status:'} <span className="font-bold text-red-400">{ar ? 'غير مفعلة' : 'Not enabled'}</span></p>
                    <button className="rounded-lg bg-brand-secondary px-3 py-1 text-sm font-bold text-white">{ar ? 'تفعيل' : 'Enable'}</button>
                </div>
            </div>
            <div>
                <h3 className="mb-3 font-bold text-light-text dark:text-dark-text">{ar ? 'الجلسات النشطة' : 'Active Sessions'}</h3>
                <ul className="space-y-2">
                    {activeSessions.map(session => (
                        <li key={session.id} className="flex items-center justify-between gap-4 rounded-md bg-light-bg p-3 dark:bg-dark-bg">
                            <div>
                                <p className="font-bold text-light-text dark:text-dark-text">{session.device} {session.isCurrent && <span className="ms-2 text-xs text-green-400">{ar ? '(الجلسة الحالية)' : '(Current session)'}</span>}</p>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{session.location} - {session.ip} - {ar ? 'آخر وصول:' : 'Last access:'} {new Date(session.lastAccessed).toLocaleTimeString(ar ? 'ar-EG' : 'en-US')}</p>
                            </div>
                            {!session.isCurrent && <button onClick={() => handleRevoke(session.id)} disabled={isSubmitting === session.id} className="text-xs font-bold text-red-500/80 hover:text-red-500 disabled:opacity-50">{isSubmitting === session.id ? '...' : (ar ? 'إلغاء' : 'Revoke')}</button>}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

const ApiKeysPanel: React.FC<Pick<SystemPageProps, 'apiKeys' | 'onGenerateApiKey' | 'onDeleteApiKey' | 'addNotification'>> = ({
    apiKeys,
    onGenerateApiKey,
    onDeleteApiKey,
    addNotification,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const [newKeyName, setNewKeyName] = useState('');
    const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null);

    const handleGenerate = async () => {
        if (!newKeyName.trim()) return;
        setIsSubmitting('generate');
        try {
            const secret = await onGenerateApiKey(newKeyName.trim());
            setGeneratedSecret(secret);
            setNewKeyName('');
            addNotification(NotificationType.Success, ar ? 'تم إنشاء مفتاح API.' : 'API key generated.');
        } catch (error) {
            addNotification(NotificationType.Error, error instanceof Error ? error.message : (ar ? 'تعذر إنشاء المفتاح.' : 'Failed to create API key.'));
        } finally {
            setIsSubmitting(null);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setIsSubmitting(deleteTarget.id);
        try {
            await onDeleteApiKey(deleteTarget.id);
            addNotification(NotificationType.Success, ar ? 'تم حذف المفتاح.' : 'API key deleted.');
            setDeleteTarget(null);
        } catch (error) {
            addNotification(NotificationType.Error, error instanceof Error ? error.message : (ar ? 'تعذر حذف المفتاح.' : 'Failed to delete API key.'));
        } finally {
            setIsSubmitting(null);
        }
    };

    return (
        <>
            <div className="rounded-lg border border-light-border bg-light-card p-6 dark:border-dark-border dark:bg-dark-card">
                <h2 className="mb-4 text-xl font-bold text-light-text dark:text-dark-text">{ar ? 'مفاتيح API' : 'API Keys'}</h2>
                <div className="mb-6 space-y-3 rounded-lg bg-light-bg p-4 dark:bg-dark-bg">
                    <h3 className="font-semibold text-light-text dark:text-dark-text">{ar ? 'إنشاء مفتاح جديد' : 'Create New Key'}</h3>
                    <div className="flex gap-2">
                        <input type="text" value={newKeyName} onChange={event => setNewKeyName(event.target.value)} placeholder={ar ? 'اسم المفتاح' : 'Key name'} className="w-full rounded-md bg-light-card p-2 text-sm text-light-text dark:bg-dark-card dark:text-dark-text" />
                        <button onClick={handleGenerate} disabled={isSubmitting === 'generate'} className="flex-shrink-0 rounded-lg bg-brand-secondary px-4 py-2 font-bold text-white disabled:opacity-50">{isSubmitting === 'generate' ? '...' : (ar ? 'إنشاء' : 'Generate')}</button>
                    </div>
                    {generatedSecret && (
                        <div className="rounded-md border border-yellow-500 bg-yellow-500/10 p-3">
                            <p className="text-sm text-yellow-400 dark:text-yellow-300">{ar ? 'هذا هو العرض الوحيد للمفتاح الكامل. احفظه الآن.' : 'This is the only time the full secret will be shown. Save it now.'}</p>
                            <div className="mt-2 flex items-center justify-between rounded-md bg-light-card p-2 font-mono text-light-text dark:bg-dark-card dark:text-dark-text">
                                <code>{generatedSecret}</code>
                                <button onClick={() => { navigator.clipboard.writeText(generatedSecret); addNotification(NotificationType.Success, ar ? 'تم نسخ المفتاح.' : 'API key copied.'); }} className="text-xs" aria-label={ar ? 'نسخ المفتاح' : 'Copy key'}>
                                    <i className="fas fa-copy" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="mb-3 font-bold text-light-text dark:text-dark-text">{ar ? 'المفاتيح الحالية' : 'Existing Keys'}</h3>
                    <ul className="space-y-2">
                        {apiKeys.map(key => (
                            <li key={key.id} className="flex items-center justify-between rounded-md bg-light-bg p-3 dark:bg-dark-bg">
                                <div>
                                    <p className="font-bold text-light-text dark:text-dark-text">{key.name}</p>
                                    <p className="font-mono text-xs text-light-text-secondary dark:text-dark-text-secondary">{key.prefix} • {ar ? 'تاريخ الإنشاء:' : 'Created:'} {new Date(key.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}</p>
                                </div>
                                <button onClick={() => setDeleteTarget(key)} disabled={isSubmitting === key.id} className="text-xs font-bold text-red-500/80 hover:text-red-500 disabled:opacity-50">{isSubmitting === key.id ? '...' : (ar ? 'حذف' : 'Delete')}</button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {deleteTarget && (
                <ModalShell
                    title={ar ? 'تأكيد حذف المفتاح' : 'Confirm API key deletion'}
                    description={ar ? `سيتم حذف المفتاح ${deleteTarget.name}.` : `${deleteTarget.name} will be removed.`}
                    onClose={() => setDeleteTarget(null)}
                    footer={<><button onClick={() => setDeleteTarget(null)} className="rounded-xl border border-light-border px-4 py-2 text-sm font-semibold text-light-text dark:border-dark-border dark:text-dark-text">{ar ? 'إلغاء' : 'Cancel'}</button><button onClick={handleDelete} disabled={isSubmitting === deleteTarget.id} className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isSubmitting === deleteTarget.id ? '...' : (ar ? 'حذف المفتاح' : 'Delete key')}</button></>}
                >
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'لن يكون هذا المفتاح صالحًا بعد التأكيد.' : 'This key will stop working immediately after confirmation.'}</p>
                </ModalShell>
            )}
        </>
    );
};

export const SystemPage: React.FC<SystemPageProps> = props => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const [activeTab, setActiveTab] = useState<SystemTab>('users');

    const tabs = useMemo(() => ([
        { id: 'users' as const, label: ar ? 'المستخدمون' : 'Users' },
        { id: 'billing' as const, label: ar ? 'الفوترة' : 'Billing' },
        { id: 'security' as const, label: ar ? 'الأمان' : 'Security' },
        { id: 'api' as const, label: ar ? 'مفاتيح API' : 'API Keys' },
    ]), [ar]);

    const renderContent = () => {
        switch (activeTab) {
            case 'users':
                return <UsersPanel {...props} />;
            case 'billing':
                return <BillingPanel {...props} />;
            case 'security':
                return <SecurityPanel {...props} />;
            case 'api':
                return <ApiKeysPanel {...props} />;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">{ar ? 'النظام والإعدادات' : 'System & Settings'}</h1>
                <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'إدارة المستخدمين، الفوترة، الأمان، والتكاملات الحساسة.' : 'Manage users, billing, security, and sensitive integrations.'}</p>
            </div>

            <div className="border-b border-light-border dark:border-dark-border">
                <nav className="flex space-s-4">
                    {tabs.map(tab => <TabButton key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>{tab.label}</TabButton>)}
                </nav>
            </div>

            <div>{renderContent()}</div>
        </div>
    );
};
