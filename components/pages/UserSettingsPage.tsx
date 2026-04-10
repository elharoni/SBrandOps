import React, { useMemo, useState } from 'react';
import { NotificationType } from '../../types';
import { updatePassword } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';

interface UserSettingsPageProps {
    addNotification: (type: NotificationType, message: string) => void;
}

type ActiveTab = 'profile' | 'security' | 'notifications';
type NotificationPreference = {
    id: string;
    defaultValue: boolean;
    label: { ar: string; en: string };
    description: { ar: string; en: string };
};

const notificationPreferences: NotificationPreference[] = [
    {
        id: 'publishing',
        defaultValue: true,
        label: { ar: 'إشعارات النشر', en: 'Publishing alerts' },
        description: { ar: 'تنبيه عند نجاح النشر أو فشله على أي منصة.', en: 'Notify when publishing succeeds or fails on any channel.' },
    },
    {
        id: 'reports',
        defaultValue: true,
        label: { ar: 'التقارير الأسبوعية', en: 'Weekly reports' },
        description: { ar: 'ملخص أسبوعي للأداء العام والمحتوى والحملات.', en: 'Weekly summary of performance, content, and campaigns.' },
    },
    {
        id: 'inbox',
        defaultValue: false,
        label: { ar: 'إشعارات البريد الوارد', en: 'Inbox alerts' },
        description: { ar: 'تنبيه عند وجود رسائل أو تعليقات جديدة تحتاج متابعة.', en: 'Notify when new messages or comments require follow-up.' },
    },
    {
        id: 'ads',
        defaultValue: true,
        label: { ar: 'تنبيهات الإعلانات', en: 'Ads budget alerts' },
        description: { ar: 'تنبيه عند ارتفاع الصرف أو ظهور حالة past due.', en: 'Notify when spend spikes or billing becomes past due.' },
    },
];

export const UserSettingsPage: React.FC<UserSettingsPageProps> = ({ addNotification }) => {
    const { user } = useAuth();
    const { language } = useLanguage();
    const ar = language === 'ar';

    const [activeTab, setActiveTab] = useState<ActiveTab>('profile');
    const [profileForm, setProfileForm] = useState({
        fullName: user?.user_metadata?.full_name || '',
        email: user?.email || '',
    });
    const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
    const [showNewPass, setShowNewPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [preferences, setPreferences] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(notificationPreferences.map((item) => [item.id, item.defaultValue])),
    );

    const copy = useMemo(() => ({
        title: ar ? 'إعدادات الحساب' : 'Account settings',
        subtitle: ar ? 'حدّث بياناتك الشخصية، راجع الأمان، واضبط تنبيهاتك من مكان واحد.' : 'Update your profile, review security, and manage your notifications from one place.',
        memberSince: ar ? 'عضو منذ' : 'Member since',
        userFallback: ar ? 'المستخدم' : 'User',
        tabs: {
            profile: ar ? 'الملف الشخصي' : 'Profile',
            security: ar ? 'الأمان' : 'Security',
            notifications: ar ? 'الإشعارات' : 'Notifications',
        },
        profileTitle: ar ? 'المعلومات الشخصية' : 'Profile details',
        fullName: ar ? 'الاسم الكامل' : 'Full name',
        fullNamePlaceholder: ar ? 'اسمك الكامل' : 'Your full name',
        email: ar ? 'البريد الإلكتروني' : 'Email',
        emailNote: ar ? 'لتغيير البريد الإلكتروني تواصل مع الدعم أو استخدم تدفق تحديث البريد عند توفره.' : 'For email changes, contact support or use the dedicated email update flow when available.',
        saveChanges: ar ? 'حفظ التغييرات' : 'Save changes',
        saving: ar ? 'جارٍ الحفظ...' : 'Saving...',
        securityTitle: ar ? 'تغيير كلمة المرور' : 'Change password',
        newPassword: ar ? 'كلمة المرور الجديدة' : 'New password',
        confirmPassword: ar ? 'تأكيد كلمة المرور' : 'Confirm password',
        passwordHint: ar ? '8 أحرف على الأقل' : 'At least 8 characters',
        changePassword: ar ? 'تغيير كلمة المرور' : 'Update password',
        updatingPassword: ar ? 'جارٍ التحديث...' : 'Updating...',
        sessionsTitle: ar ? 'الجلسات النشطة' : 'Active sessions',
        sessionsDescription: ar ? 'هذه الجلسة نشطة الآن على الجهاز الحالي.' : 'This session is currently active on this device.',
        currentDevice: ar ? 'الجهاز الحالي' : 'Current device',
        activeNow: ar ? 'نشط الآن' : 'Active now',
        currentBadge: ar ? 'الحالي' : 'Current',
        notificationsTitle: ar ? 'تفضيلات الإشعارات' : 'Notification preferences',
        notificationsDescription: ar ? 'اختر التنبيهات التي تريد رؤيتها داخل النظام أو عبر البريد لاحقًا.' : 'Choose the alerts you want to receive in-app or by email later.',
        savePreferences: ar ? 'حفظ التفضيلات' : 'Save preferences',
        weak: ar ? 'ضعيف' : 'Weak',
        medium: ar ? 'متوسط' : 'Medium',
        strong: ar ? 'قوي' : 'Strong',
        profileSaved: ar ? 'تم تحديث الملف الشخصي.' : 'Profile updated successfully.',
        profileSaveError: ar ? 'تعذر حفظ بيانات الملف الشخصي.' : 'Failed to save profile changes.',
        passwordLengthError: ar ? 'يجب أن تكون كلمة المرور 8 أحرف على الأقل.' : 'Password must be at least 8 characters.',
        passwordMismatchError: ar ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.',
        passwordSaved: ar ? 'تم تغيير كلمة المرور بنجاح.' : 'Password updated successfully.',
        passwordSaveError: ar ? 'تعذر تغيير كلمة المرور.' : 'Failed to update password.',
        preferencesSaved: ar ? 'تم حفظ تفضيلات الإشعارات.' : 'Notification preferences saved.',
        showPassword: ar ? 'إظهار كلمة المرور' : 'Show password',
        hidePassword: ar ? 'إخفاء كلمة المرور' : 'Hide password',
    }), [ar]);

    const passwordStrength = useMemo(() => {
        const length = passwordForm.newPassword.length;
        if (length === 0) return null;
        if (length < 6) return { level: 1, label: copy.weak };
        if (length < 10) return { level: 3, label: copy.medium };
        return { level: 4, label: copy.strong };
    }, [copy, passwordForm.newPassword.length]);

    const handleSaveProfile = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSavingProfile(true);
        try {
            const { error } = await supabase.auth.updateUser({
                data: { full_name: profileForm.fullName.trim() },
            });
            if (error) throw error;
            addNotification(NotificationType.Success, copy.profileSaved);
        } catch (error: any) {
            addNotification(NotificationType.Error, error?.message || copy.profileSaveError);
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleChangePassword = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
            addNotification(NotificationType.Warning, copy.passwordLengthError);
            return;
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            addNotification(NotificationType.Warning, copy.passwordMismatchError);
            return;
        }

        setIsSavingPassword(true);
        try {
            await updatePassword(passwordForm.newPassword);
            addNotification(NotificationType.Success, copy.passwordSaved);
            setPasswordForm({ newPassword: '', confirmPassword: '' });
        } catch (error: any) {
            addNotification(NotificationType.Error, error?.message || copy.passwordSaveError);
        } finally {
            setIsSavingPassword(false);
        }
    };

    const memberSince = user?.created_at
        ? new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(user.created_at))
        : '—';

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div>
                <h1 className="text-3xl font-black text-light-text dark:text-dark-text">{copy.title}</h1>
                <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">{copy.subtitle}</p>
            </div>

            <div className="flex items-center gap-5 rounded-[1.75rem] border border-light-border bg-light-card p-6 dark:border-dark-border dark:bg-dark-card">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary text-2xl font-black text-white">
                    {(profileForm.fullName || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                    <p className="text-lg font-bold text-light-text dark:text-dark-text">{profileForm.fullName || copy.userFallback}</p>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{user?.email}</p>
                    <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">{copy.memberSince} {memberSince}</p>
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto border-b border-light-border dark:border-dark-border">
                {([
                    { id: 'profile', icon: 'fa-user', label: copy.tabs.profile },
                    { id: 'security', icon: 'fa-lock', label: copy.tabs.security },
                    { id: 'notifications', icon: 'fa-bell', label: copy.tabs.notifications },
                ] as { id: ActiveTab; icon: string; label: string }[]).map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === tab.id ? 'border-brand-primary text-brand-primary' : 'border-transparent text-light-text-secondary hover:text-light-text dark:text-dark-text-secondary dark:hover:text-dark-text'}`}
                    >
                        <i className={`fas ${tab.icon} text-xs`} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {activeTab === 'profile' && (
                <section className="rounded-[1.75rem] border border-light-border bg-light-card p-6 dark:border-dark-border dark:bg-dark-card">
                    <h2 className="text-lg font-bold text-light-text dark:text-dark-text">{copy.profileTitle}</h2>
                    <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-light-text dark:text-dark-text">{copy.fullName}</label>
                            <input
                                type="text"
                                value={profileForm.fullName}
                                onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))}
                                placeholder={copy.fullNamePlaceholder}
                                className="w-full rounded-xl border border-light-border bg-light-bg px-4 py-3 text-sm text-light-text outline-none transition focus:border-brand-primary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-light-text dark:text-dark-text">{copy.email}</label>
                            <input
                                type="email"
                                value={profileForm.email}
                                disabled
                                className="w-full cursor-not-allowed rounded-xl border border-light-border bg-light-bg px-4 py-3 text-sm text-light-text-secondary opacity-70 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-secondary"
                            />
                            <p className="mt-2 text-xs text-light-text-secondary dark:text-dark-text-secondary">{copy.emailNote}</p>
                        </div>
                        <div>
                            <button
                                type="submit"
                                disabled={isSavingProfile}
                                className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary/90 disabled:opacity-60"
                            >
                                <i className={`fas ${isSavingProfile ? 'fa-circle-notch fa-spin' : 'fa-save'} text-xs`} />
                                <span>{isSavingProfile ? copy.saving : copy.saveChanges}</span>
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {activeTab === 'security' && (
                <div className="space-y-5">
                    <section className="rounded-[1.75rem] border border-light-border bg-light-card p-6 dark:border-dark-border dark:bg-dark-card">
                        <h2 className="text-lg font-bold text-light-text dark:text-dark-text">{copy.securityTitle}</h2>
                        <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-light-text dark:text-dark-text">{copy.newPassword}</label>
                                <div className="relative">
                                    <input
                                        type={showNewPass ? 'text' : 'password'}
                                        value={passwordForm.newPassword}
                                        onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                                        minLength={8}
                                        placeholder={copy.passwordHint}
                                        dir="ltr"
                                        className="w-full rounded-xl border border-light-border bg-light-bg px-4 py-3 pe-11 text-sm text-light-text outline-none transition focus:border-brand-primary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPass((current) => !current)}
                                        aria-label={showNewPass ? copy.hidePassword : copy.showPassword}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary transition hover:text-brand-primary"
                                    >
                                        <i className={`fas ${showNewPass ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-light-text dark:text-dark-text">{copy.confirmPassword}</label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPass ? 'text' : 'password'}
                                        value={passwordForm.confirmPassword}
                                        onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                                        minLength={8}
                                        placeholder="••••••••"
                                        dir="ltr"
                                        className="w-full rounded-xl border border-light-border bg-light-bg px-4 py-3 pe-11 text-sm text-light-text outline-none transition focus:border-brand-primary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPass((current) => !current)}
                                        aria-label={showConfirmPass ? copy.hidePassword : copy.showPassword}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary transition hover:text-brand-primary"
                                    >
                                        <i className={`fas ${showConfirmPass ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
                                    </button>
                                </div>
                            </div>
                            {passwordStrength && (
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-1 gap-1">
                                        {[1, 2, 3, 4].map((index) => (
                                            <span
                                                key={index}
                                                className={`h-1 flex-1 rounded-full ${passwordStrength.level >= index ? index <= 2 ? 'bg-rose-400' : index === 3 ? 'bg-amber-400' : 'bg-emerald-500' : 'bg-light-border dark:bg-dark-border'}`}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{passwordStrength.label}</span>
                                </div>
                            )}
                            <div>
                                <button
                                    type="submit"
                                    disabled={isSavingPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                                    className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary/90 disabled:opacity-60"
                                >
                                    <i className={`fas ${isSavingPassword ? 'fa-circle-notch fa-spin' : 'fa-key'} text-xs`} />
                                    <span>{isSavingPassword ? copy.updatingPassword : copy.changePassword}</span>
                                </button>
                            </div>
                        </form>
                    </section>

                    <section className="rounded-[1.75rem] border border-light-border bg-light-card p-6 dark:border-dark-border dark:bg-dark-card">
                        <h2 className="text-lg font-bold text-light-text dark:text-dark-text">{copy.sessionsTitle}</h2>
                        <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">{copy.sessionsDescription}</p>
                        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-light-border bg-light-bg p-4 dark:border-dark-border dark:bg-dark-bg">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                                <i className="fas fa-desktop text-sm" />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-light-text dark:text-dark-text">{copy.currentDevice}</p>
                                <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">{copy.activeNow}</p>
                            </div>
                            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">{copy.currentBadge}</span>
                        </div>
                    </section>
                </div>
            )}

            {activeTab === 'notifications' && (
                <section className="rounded-[1.75rem] border border-light-border bg-light-card p-6 dark:border-dark-border dark:bg-dark-card">
                    <h2 className="text-lg font-bold text-light-text dark:text-dark-text">{copy.notificationsTitle}</h2>
                    <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">{copy.notificationsDescription}</p>
                    <div className="mt-5 space-y-4">
                        {notificationPreferences.map((item) => {
                            const enabled = preferences[item.id];
                            return (
                                <div key={item.id} className="flex items-center justify-between gap-4 border-b border-light-border/70 py-4 last:border-b-0 dark:border-dark-border/70">
                                    <div>
                                        <p className="font-semibold text-light-text dark:text-dark-text">{item.label[ar ? 'ar' : 'en']}</p>
                                        <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">{item.description[ar ? 'ar' : 'en']}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPreferences((current) => ({ ...current, [item.id]: !current[item.id] }))}
                                        aria-label={item.label[ar ? 'ar' : 'en']}
                                        className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-brand-primary' : 'bg-light-border dark:bg-dark-border'}`}
                                    >
                                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-5' : 'left-0.5'}`} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    <button
                        type="button"
                        onClick={() => addNotification(NotificationType.Success, copy.preferencesSaved)}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary/90"
                    >
                        <i className="fas fa-save text-xs" />
                        <span>{copy.savePreferences}</span>
                    </button>
                </section>
            )}
        </div>
    );
};
