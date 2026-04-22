import React, { useMemo, useState } from 'react';
import { NotificationType, User, UserRole } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { usePlanLimits } from '../../hooks/usePlanLimits';
import { QuotaWarning, QuotaLimitModal } from '../shared/PaywallGate';

interface TeamManagementPageProps {
    users: User[];
    onInviteUser: (email: string, role: UserRole) => Promise<void>;
    onUpdateUserRole: (userId: string, newRole: UserRole) => Promise<void>;
    onDeleteUser: (userId: string) => Promise<void>;
    addNotification: (type: NotificationType, message: string) => void;
}

const roleOrder: UserRole[] = [UserRole.Owner, UserRole.Admin, UserRole.Editor, UserRole.Analyst, UserRole.Client];

const roleLabels: Record<UserRole, { ar: string; en: string }> = {
    [UserRole.Owner]: { ar: 'المالك', en: 'Owner' },
    [UserRole.Admin]: { ar: 'مدير', en: 'Admin' },
    [UserRole.Editor]: { ar: 'محرر', en: 'Editor' },
    [UserRole.Analyst]: { ar: 'محلل', en: 'Analyst' },
    [UserRole.Client]: { ar: 'عميل', en: 'Client' },
};

const ModalShell: React.FC<{
    title: string;
    description?: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
}> = ({ title, description, onClose, children, footer }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md overflow-hidden rounded-[1.5rem] border border-light-border bg-light-card shadow-2xl dark:border-dark-border dark:bg-dark-card">
            <div className="flex items-start justify-between gap-4 border-b border-light-border px-6 py-5 dark:border-dark-border">
                <div>
                    <h2 className="text-xl font-bold text-light-text dark:text-dark-text">{title}</h2>
                    {description && <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">{description}</p>}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close modal"
                    className="rounded-xl p-2 text-light-text-secondary transition hover:bg-light-bg hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-dark-bg dark:hover:text-dark-text"
                >
                    <i className="fas fa-times" />
                </button>
            </div>
            <div className="px-6 py-5">{children}</div>
            {footer && <div className="flex items-center justify-end gap-3 border-t border-light-border px-6 py-4 dark:border-dark-border">{footer}</div>}
        </div>
    </div>
);

const EmptyState: React.FC<{ title: string; description: string; action: React.ReactNode }> = ({ title, description, action }) => (
    <div className="rounded-[1.75rem] border border-dashed border-light-border bg-light-card px-6 py-12 text-center dark:border-dark-border dark:bg-dark-card">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
            <i className="fas fa-users text-lg" />
        </div>
        <h2 className="mt-5 text-xl font-bold text-light-text dark:text-dark-text">{title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-light-text-secondary dark:text-dark-text-secondary">{description}</p>
        <div className="mt-6">{action}</div>
    </div>
);

export const TeamManagementPage: React.FC<TeamManagementPageProps> = ({
    users,
    onInviteUser,
    onUpdateUserRole,
    onDeleteUser,
    addNotification,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    const { canAddUser, limits } = usePlanLimits();
    const atSeatLimit = !canAddUser(users.length);

    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [showQuotaModal, setShowQuotaModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<UserRole>(UserRole.Editor);
    const [isInviting, setIsInviting] = useState(false);
    const [pendingRoleUserId, setPendingRoleUserId] = useState<string | null>(null);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleOpenInvite = () => {
        if (atSeatLimit) {
            setShowQuotaModal(true);
        } else {
            setInviteModalOpen(true);
        }
    };

    const copy = useMemo(() => ({
        title: ar ? 'إدارة الفريق' : 'Team management',
        subtitle: ar ? 'أدر أعضاء الفريق وصلاحياتهم والوصول إلى هذا البراند من مكان واحد.' : 'Manage teammates, permissions, and brand access from one surface.',
        invite: ar ? 'دعوة عضو' : 'Invite member',
        emptyTitle: ar ? 'لا يوجد أعضاء بعد' : 'No team members yet',
        emptyDescription: ar ? 'ابدأ بدعوة أعضاء الفريق حتى يتمكنوا من الوصول إلى البراند والعمل على المحتوى والتحليلات وسير العمل.' : 'Invite teammates to start working on content, analytics, and workflows for this brand.',
        email: ar ? 'البريد الإلكتروني' : 'Email address',
        role: ar ? 'الدور' : 'Role',
        cancel: ar ? 'إلغاء' : 'Cancel',
        sendInvite: ar ? 'إرسال الدعوة' : 'Send invite',
        sendingInvite: ar ? 'جارٍ إرسال الدعوة...' : 'Sending invite...',
        inviteTitle: ar ? 'دعوة عضو جديد' : 'Invite a new teammate',
        inviteDescription: ar ? 'أرسل دعوة وحدد الدور المناسب قبل دخول العضو إلى مساحة العمل.' : 'Send an invite and assign the right role before the teammate joins the workspace.',
        tableUser: ar ? 'المستخدم' : 'User',
        tableRole: ar ? 'الدور' : 'Role',
        tableLastActive: ar ? 'آخر نشاط' : 'Last active',
        tableActions: ar ? 'الإجراءات' : 'Actions',
        ownerLocked: ar ? 'صلاحيات المالك ثابتة' : 'Owner permissions are fixed',
        remove: ar ? 'إزالة' : 'Remove',
        noRemoveOwner: ar ? 'لا يمكن حذف المالك' : 'Owner cannot be removed',
        deleteTitle: ar ? 'تأكيد إزالة العضو' : 'Confirm member removal',
        deleteDescription: userToDelete
            ? ar
                ? `سيتم إلغاء وصول ${userToDelete.name} إلى هذا البراند فورًا.`
                : `${userToDelete.name} will lose access to this brand immediately.`
            : '',
        confirmDelete: ar ? 'تأكيد الإزالة' : 'Confirm removal',
        deleting: ar ? 'جارٍ الإزالة...' : 'Removing...',
        currentOwner: ar ? 'المالك الحالي' : 'Current owner',
        inviteSuccess: (email: string) => ar ? `تم إرسال الدعوة إلى ${email}.` : `Invitation sent to ${email}.`,
        inviteError: ar ? 'تعذر إرسال الدعوة.' : 'Failed to send invitation.',
        roleSuccess: ar ? 'تم تحديث دور المستخدم.' : 'User role updated.',
        roleError: ar ? 'تعذر تحديث دور المستخدم.' : 'Failed to update user role.',
        deleteSuccess: (name: string) => ar ? `تمت إزالة ${name} من الفريق.` : `${name} has been removed from the team.`,
        deleteError: ar ? 'تعذر إزالة العضو.' : 'Failed to remove member.',
        invalidEmail: ar ? 'أدخل بريدًا إلكترونيًا صالحًا.' : 'Enter a valid email address.',
    }), [ar, userToDelete]);

    const formatDate = (value: Date | string) => new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(new Date(value));

    const handleInvite = async (event: React.FormEvent) => {
        event.preventDefault();
        const normalizedEmail = inviteEmail.trim();
        if (!normalizedEmail) {
            addNotification(NotificationType.Warning, copy.invalidEmail);
            return;
        }

        setIsInviting(true);
        try {
            await onInviteUser(normalizedEmail, inviteRole);
            addNotification(NotificationType.Success, copy.inviteSuccess(normalizedEmail));
            setInviteEmail('');
            setInviteRole(UserRole.Editor);
            setInviteModalOpen(false);
        } catch {
            addNotification(NotificationType.Error, copy.inviteError);
        } finally {
            setIsInviting(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: UserRole) => {
        setPendingRoleUserId(userId);
        try {
            await onUpdateUserRole(userId, newRole);
            addNotification(NotificationType.Success, copy.roleSuccess);
        } catch {
            addNotification(NotificationType.Error, copy.roleError);
        } finally {
            setPendingRoleUserId(null);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!userToDelete) return;
        setIsDeleting(true);
        try {
            await onDeleteUser(userToDelete.id);
            addNotification(NotificationType.Success, copy.deleteSuccess(userToDelete.name));
            setUserToDelete(null);
        } catch {
            addNotification(NotificationType.Error, copy.deleteError);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-3xl font-black text-light-text dark:text-dark-text">{copy.title}</h1>
                    <p className="mt-2 max-w-3xl text-sm text-light-text-secondary dark:text-dark-text-secondary">{copy.subtitle}</p>
                </div>
                <button
                    onClick={handleOpenInvite}
                    className="inline-flex items-center gap-2 rounded-2xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary/90"
                >
                    <i className={`fas ${atSeatLimit ? 'fa-lock' : 'fa-user-plus'} text-xs`} />
                    <span>{copy.invite}</span>
                </button>
            </div>

            <QuotaWarning
                currentCount={users.length}
                maxCount={limits.maxUsers}
                entityName={ar ? 'عضو' : 'member'}
            />

            {users.length === 0 ? (
                <EmptyState
                    title={copy.emptyTitle}
                    description={copy.emptyDescription}
                    action={(
                        <button
                            onClick={handleOpenInvite}
                            className="inline-flex items-center gap-2 rounded-2xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary/90"
                        >
                            <i className="fas fa-user-plus text-xs" />
                            <span>{copy.invite}</span>
                        </button>
                    )}
                />
            ) : (
                <div className="overflow-hidden rounded-[1.75rem] border border-light-border bg-light-card dark:border-dark-border dark:bg-dark-card">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-light-bg dark:bg-dark-bg">
                                <tr>
                                    <th className="px-6 py-4 text-start font-semibold text-light-text-secondary dark:text-dark-text-secondary">{copy.tableUser}</th>
                                    <th className="px-6 py-4 text-start font-semibold text-light-text-secondary dark:text-dark-text-secondary">{copy.tableRole}</th>
                                    <th className="px-6 py-4 text-start font-semibold text-light-text-secondary dark:text-dark-text-secondary">{copy.tableLastActive}</th>
                                    <th className="px-6 py-4 text-start font-semibold text-light-text-secondary dark:text-dark-text-secondary">{copy.tableActions}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => {
                                    const isOwner = user.role === UserRole.Owner;
                                    const roleLabel = roleLabels[user.role][ar ? 'ar' : 'en'];

                                    return (
                                        <tr key={user.id} className="border-t border-light-border/70 dark:border-dark-border/70">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <img src={user.avatarUrl} alt={user.name} className="h-11 w-11 rounded-2xl object-cover" />
                                                    <div>
                                                        <p className="font-semibold text-light-text dark:text-dark-text">{user.name}</p>
                                                        <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {isOwner ? (
                                                    <div>
                                                        <span className="inline-flex rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">{roleLabel}</span>
                                                        <p className="mt-2 text-xs text-light-text-secondary dark:text-dark-text-secondary">{copy.currentOwner}</p>
                                                    </div>
                                                ) : (
                                                    <select
                                                        value={user.role}
                                                        onChange={(event) => handleRoleChange(user.id, event.target.value as UserRole)}
                                                        disabled={pendingRoleUserId === user.id}
                                                        className="rounded-xl border border-light-border bg-light-bg px-3 py-2 text-sm text-light-text outline-none transition focus:border-brand-primary disabled:opacity-60 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                                                    >
                                                        {roleOrder.map((role) => (
                                                            <option key={role} value={role}>{roleLabels[role][ar ? 'ar' : 'en']}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-light-text-secondary dark:text-dark-text-secondary">{formatDate(user.lastActive)}</td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => setUserToDelete(user)}
                                                    disabled={isOwner}
                                                    className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-900/20"
                                                    title={isOwner ? copy.ownerLocked : copy.remove}
                                                >
                                                    {copy.remove}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showQuotaModal && limits.maxUsers !== null && (
                <QuotaLimitModal
                    entityName={ar ? 'أعضاء فريق' : 'team members'}
                    currentCount={users.length}
                    maxCount={limits.maxUsers}
                    onClose={() => setShowQuotaModal(false)}
                />
            )}

            {inviteModalOpen && (
                <ModalShell
                    title={copy.inviteTitle}
                    description={copy.inviteDescription}
                    onClose={() => !isInviting && setInviteModalOpen(false)}
                    footer={(
                        <>
                            <button
                                type="button"
                                onClick={() => setInviteModalOpen(false)}
                                className="rounded-xl border border-light-border px-4 py-2.5 text-sm font-semibold text-light-text dark:border-dark-border dark:text-dark-text"
                            >
                                {copy.cancel}
                            </button>
                            <button
                                type="submit"
                                form="team-invite-form"
                                disabled={isInviting}
                                className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {isInviting ? copy.sendingInvite : copy.sendInvite}
                            </button>
                        </>
                    )}
                >
                    <form id="team-invite-form" onSubmit={handleInvite} className="space-y-4">
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-light-text dark:text-dark-text">{copy.email}</label>
                            <input
                                type="email"
                                value={inviteEmail}
                                onChange={(event) => setInviteEmail(event.target.value)}
                                placeholder={ar ? 'name@company.com' : 'name@company.com'}
                                autoFocus
                                disabled={isInviting}
                                className="w-full rounded-xl border border-light-border bg-light-bg px-4 py-3 text-sm text-light-text outline-none transition focus:border-brand-primary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-light-text dark:text-dark-text">{copy.role}</label>
                            <select
                                value={inviteRole}
                                onChange={(event) => setInviteRole(event.target.value as UserRole)}
                                disabled={isInviting}
                                className="w-full rounded-xl border border-light-border bg-light-bg px-4 py-3 text-sm text-light-text outline-none transition focus:border-brand-primary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                            >
                                {roleOrder.filter((role) => role !== UserRole.Owner).map((role) => (
                                    <option key={role} value={role}>{roleLabels[role][ar ? 'ar' : 'en']}</option>
                                ))}
                            </select>
                        </div>
                    </form>
                </ModalShell>
            )}

            {userToDelete && (
                <ModalShell
                    title={copy.deleteTitle}
                    description={copy.deleteDescription}
                    onClose={() => !isDeleting && setUserToDelete(null)}
                    footer={(
                        <>
                            <button
                                type="button"
                                onClick={() => setUserToDelete(null)}
                                className="rounded-xl border border-light-border px-4 py-2.5 text-sm font-semibold text-light-text dark:border-dark-border dark:text-dark-text"
                            >
                                {copy.cancel}
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteConfirm}
                                disabled={isDeleting}
                                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {isDeleting ? copy.deleting : copy.confirmDelete}
                            </button>
                        </>
                    )}
                >
                    <div className="rounded-2xl bg-light-bg px-4 py-4 text-sm text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary">
                        {ar ? 'تأكد من أن هذا العضو لا يحتاج الوصول الحالي قبل إكمال الحذف.' : 'Make sure this teammate no longer needs access before removing them.'}
                    </div>
                </ModalShell>
            )}
        </div>
    );
};
