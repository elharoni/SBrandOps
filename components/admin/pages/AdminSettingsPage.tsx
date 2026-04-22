// components/admin/pages/AdminSettingsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { AdminPermission, AdminUserRole, GeneralSettings, SecuritySettings, NotificationType } from '../../../types';
import { SkeletonLoader } from '../shared/ui/SkeletonLoader';
import {
    updateGeneralSettings,
    updateSecuritySettings,
    getRolePermissions,
    saveRolePermissions,
} from '../../../services/adminService';
import {
    ADMIN_ROLE_META,
    ADMIN_ROLE_PERMISSIONS,
    PERMISSION_META,
    ALL_ADMIN_ROLES,
} from '../../../constants/adminRoles';

interface AdminSettingsPageProps {
    permissions: AdminPermission[];
    generalSettings: GeneralSettings | null;
    securitySettings: SecuritySettings | null;
    isLoading: boolean;
    addNotification?: (type: NotificationType, message: string) => void;
}

type AdminSettingsTab = 'general' | 'customization' | 'roles' | 'security';

// ── Reusable UI ───────────────────────────────────────────────────────────────

const SettingsSection: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => (
    <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg border border-light-border dark:border-dark-border">
        <h3 className="font-bold text-light-text dark:text-dark-text">{title}</h3>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">{description}</p>
        <div className="space-y-4">{children}</div>
    </div>
);

const ToggleSwitch: React.FC<{
    label: string; description: string; checked: boolean;
    onChange: (checked: boolean) => void; disabled?: boolean;
}> = ({ label, description, checked, onChange, disabled }) => (
    <div className="flex justify-between items-center p-3 rounded-md hover:bg-light-card dark:hover:bg-dark-card/50">
        <div>
            <p className={`font-semibold text-light-text dark:text-dark-text ${disabled ? 'opacity-50' : ''}`}>{label}</p>
            <p className={`text-xs text-light-text-secondary dark:text-dark-text-secondary ${disabled ? 'opacity-50' : ''}`}>{description}</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
    </div>
);

const SettingInput: React.FC<{
    label: string; description?: string; type: string;
    value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    name: string; placeholder?: string;
}> = ({ label, description, type, value, onChange, name, placeholder }) => (
    <div className="p-3">
        <label className="font-semibold text-light-text dark:text-dark-text">{label}</label>
        {description && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-2">{description}</p>}
        <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder}
            className="w-full mt-1 p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text placeholder:text-light-text-secondary/50" />
    </div>
);

const SaveButton: React.FC<{ loading: boolean; onClick: () => void }> = ({ loading, onClick }) => (
    <div className="text-end">
        <button onClick={onClick} disabled={loading}
            className="bg-primary text-white font-bold py-2 px-6 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2 ms-auto">
            {loading && <i className="fas fa-spinner fa-spin"></i>}
            {loading ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
        </button>
    </div>
);

// ── General Panel ─────────────────────────────────────────────────────────────

const GeneralPanel: React.FC<{ settings: GeneralSettings; addNotification?: AdminSettingsPageProps['addNotification'] }> = ({ settings, addNotification }) => {
    const [formState, setFormState] = useState(settings);
    const [loading, setLoading] = useState(false);

    useEffect(() => { setFormState(settings); }, [settings]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await updateGeneralSettings(formState);
            addNotification?.(NotificationType.Success, 'تم حفظ الإعدادات العامة');
        } catch {
            addNotification?.(NotificationType.Error, 'فشل حفظ الإعدادات');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <SettingsSection title="إعدادات التطبيق" description="التكوينات الأساسية للتطبيق.">
                <SettingInput label="اسم التطبيق" name="appName" type="text" value={formState.appName} onChange={handleInputChange} />
                <SettingInput label="البريد الإلكتروني للدعم" name="supportEmail" type="email" value={formState.supportEmail} onChange={handleInputChange} placeholder="support@example.com" />
                <SettingInput label="موقع الدعم (اختياري)" name="supportWebsite" type="url" value={formState.supportWebsite} onChange={handleInputChange} placeholder="https://help.example.com" />
                <ToggleSwitch
                    label="وضع الصيانة"
                    description="عند التفعيل، لن يتمكن المستخدمون غير المسؤولين من الوصول إلى التطبيق وسيرون رسالة الصيانة."
                    checked={formState.maintenanceMode}
                    onChange={(checked) => setFormState(prev => ({ ...prev, maintenanceMode: checked }))}
                />
            </SettingsSection>
            <SaveButton loading={loading} onClick={handleSave} />
        </div>
    );
};

// ── Customization Panel ───────────────────────────────────────────────────────

const ANNOUNCEMENT_TYPES = [
    { value: 'info',    label: 'معلومة', color: 'bg-blue-500/20 text-blue-400' },
    { value: 'warning', label: 'تحذير',  color: 'bg-amber-500/20 text-amber-400' },
    { value: 'success', label: 'نجاح',   color: 'bg-green-500/20 text-green-400' },
    { value: 'danger',  label: 'خطر',    color: 'bg-red-500/20 text-red-400' },
] as const;

const CustomizationPanel: React.FC<{ settings: GeneralSettings; addNotification?: AdminSettingsPageProps['addNotification'] }> = ({ settings, addNotification }) => {
    const [formState, setFormState] = useState(settings);
    const [loading, setLoading] = useState(false);

    useEffect(() => { setFormState(settings); }, [settings]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await updateGeneralSettings(formState);
            addNotification?.(NotificationType.Success, 'تم حفظ إعدادات التخصيص');
        } catch {
            addNotification?.(NotificationType.Error, 'فشل حفظ التخصيص');
        } finally {
            setLoading(false);
        }
    };

    const announcementBannerPreviewColor: Record<GeneralSettings['announcementType'], string> = {
        info:    'bg-blue-500/15 border-blue-500/30 text-blue-300',
        warning: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
        success: 'bg-green-500/15 border-green-500/30 text-green-300',
        danger:  'bg-red-500/15 border-red-500/30 text-red-300',
    };

    return (
        <div className="space-y-6">
            {/* Branding */}
            <SettingsSection title="هوية التطبيق" description="تخصيص شعار وهوية التطبيق.">
                <div className="p-3 space-y-3">
                    <label className="font-semibold text-light-text dark:text-dark-text">رابط الشعار (Logo URL)</label>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">رابط الصورة المستخدمة كشعار للتطبيق (PNG, SVG موصى به)</p>
                    <input
                        type="url" name="logoUrl" value={formState.logoUrl}
                        onChange={handleInputChange}
                        placeholder="https://example.com/logo.png"
                        className="w-full p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text placeholder:text-light-text-secondary/50"
                    />
                    {formState.logoUrl && (
                        <div className="flex items-center gap-3 mt-2 p-3 bg-light-card dark:bg-dark-card rounded-lg border border-light-border dark:border-dark-border">
                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">معاينة:</span>
                            <img
                                src={formState.logoUrl}
                                alt="Logo Preview"
                                className="h-8 object-contain rounded"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        </div>
                    )}
                </div>
            </SettingsSection>

            {/* Announcement Banner */}
            <SettingsSection title="شريط الإعلانات" description="أظهر رسالة إعلانية لجميع المستخدمين في الجزء العلوي من التطبيق.">
                <ToggleSwitch
                    label="تفعيل شريط الإعلانات"
                    description="يظهر الشريط لجميع المستخدمين المسجلين."
                    checked={formState.announcementEnabled}
                    onChange={(checked) => setFormState(prev => ({ ...prev, announcementEnabled: checked }))}
                />
                <div className="p-3 space-y-3">
                    <label className="font-semibold text-light-text dark:text-dark-text">نص الإعلان</label>
                    <textarea
                        name="announcementText"
                        value={formState.announcementText}
                        onChange={handleInputChange as any}
                        rows={2}
                        placeholder="مثال: سيكون النظام في وضع الصيانة غداً من 2-4 صباحاً."
                        className="w-full p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text resize-none placeholder:text-light-text-secondary/50 text-sm"
                    />
                </div>
                <div className="p-3 space-y-2">
                    <label className="font-semibold text-light-text dark:text-dark-text">نوع الإعلان</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                        {ANNOUNCEMENT_TYPES.map(t => (
                            <button
                                key={t.value}
                                type="button"
                                onClick={() => setFormState(prev => ({ ...prev, announcementType: t.value }))}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${formState.announcementType === t.value ? 'border-primary scale-105' : 'border-transparent opacity-70 hover:opacity-100'} ${t.color}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
                {/* Preview */}
                {formState.announcementEnabled && formState.announcementText && (
                    <div className="p-3">
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-2">معاينة:</p>
                        <div className={`px-4 py-2.5 rounded-lg border text-sm font-medium ${announcementBannerPreviewColor[formState.announcementType]}`}>
                            <i className="fas fa-bullhorn me-2 text-xs opacity-70"></i>
                            {formState.announcementText}
                        </div>
                    </div>
                )}
            </SettingsSection>

            <SaveButton loading={loading} onClick={handleSave} />
        </div>
    );
};

// ── Security Panel ────────────────────────────────────────────────────────────

const SecurityPanel: React.FC<{ settings: SecuritySettings; addNotification?: AdminSettingsPageProps['addNotification'] }> = ({ settings, addNotification }) => {
    const [formState, setFormState] = useState(settings);
    const [loading, setLoading] = useState(false);

    useEffect(() => { setFormState(settings); }, [settings]);

    const handleToggleChange = (name: keyof SecuritySettings, value: boolean) => {
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: Number(value) }));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await updateSecuritySettings(formState);
            addNotification?.(NotificationType.Success, 'تم حفظ إعدادات الأمان');
        } catch {
            addNotification?.(NotificationType.Error, 'فشل حفظ إعدادات الأمان');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <SettingsSection title="سياسات كلمة المرور" description="فرض متطلبات أمان لكلمات مرور المستخدمين.">
                <SettingInput label="الحد الأدنى لطول كلمة المرور" name="passwordMinLength" type="number" value={formState.passwordMinLength} onChange={handleInputChange} />
                <ToggleSwitch label="تتطلب حرفًا كبيرًا" description="يجب أن تحتوي كلمات المرور على حرف كبير واحد على الأقل (A-Z)." checked={formState.passwordRequiresUppercase} onChange={(c) => handleToggleChange('passwordRequiresUppercase', c)} />
                <ToggleSwitch label="تتطلب رقمًا" description="يجب أن تحتوي كلمات المرور على رقم واحد على الأقل (0-9)." checked={formState.passwordRequiresNumber} onChange={(c) => handleToggleChange('passwordRequiresNumber', c)} />
                <ToggleSwitch label="تتطلب رمزًا" description="يجب أن تحتوي كلمات المرور على رمز واحد على الأقل (!@#$%)." checked={formState.passwordRequiresSymbol} onChange={(c) => handleToggleChange('passwordRequiresSymbol', c)} />
            </SettingsSection>
            <SettingsSection title="سياسات الجلسة والمصادقة" description="إعدادات الأمان المتعلقة بجلسات المستخدم والمصادقة.">
                <SettingInput label="مهلة انتهاء الجلسة (بالدقائق)" description="المدة التي يمكن للمستخدم أن يظل خاملاً قبل تسجيل الخروج تلقائيًا." name="sessionTimeout" type="number" value={formState.sessionTimeout} onChange={handleInputChange} />
                <ToggleSwitch label="فرض المصادقة الثنائية (2FA) للمسؤولين" description="يتطلب من جميع المستخدمين ذوي الأدوار الإدارية إعداد المصادقة الثنائية." checked={formState.require2FAForAdmins} onChange={(c) => handleToggleChange('require2FAForAdmins', c)} />
            </SettingsSection>
            <SaveButton loading={loading} onClick={handleSave} />
        </div>
    );
};

// ── Roles Panel ───────────────────────────────────────────────────────────────

const DEFAULT_ROLE_PERMISSIONS = ADMIN_ROLE_PERMISSIONS;
const ROLE_META_SETTINGS = ADMIN_ROLE_META;
const PERM_ICONS: Record<string, string> = Object.fromEntries(
    Object.entries(PERMISSION_META).map(([k, v]) => [k, v.icon])
);
const ALL_ROLES_SETTINGS = ALL_ADMIN_ROLES;

const RolesPanel: React.FC<{ permissions: AdminPermission[]; addNotification?: AdminSettingsPageProps['addNotification'] }> = ({ permissions, addNotification }) => {
    const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>(DEFAULT_ROLE_PERMISSIONS);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [isDirty, setIsDirty] = useState(false);

    const load = useCallback(async () => {
        setFetching(true);
        const saved = await getRolePermissions();
        if (Object.keys(saved).length > 0) {
            setRolePermissions(saved);
        }
        setFetching(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const handlePermissionChange = (role: AdminUserRole, permId: string, isChecked: boolean) => {
        if (role === AdminUserRole.SUPER_ADMIN) return;
        setRolePermissions(prev => {
            const currentPerms = prev[role] || [];
            const newPerms = isChecked
                ? [...currentPerms, permId]
                : currentPerms.filter(p => p !== permId);
            return { ...prev, [role]: newPerms };
        });
        setIsDirty(true);
    };

    const handleReset = () => {
        setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
        setIsDirty(true);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await saveRolePermissions(rolePermissions);
            addNotification?.(NotificationType.Success, 'تم حفظ الأدوار والصلاحيات');
            setIsDirty(false);
        } catch {
            addNotification?.(NotificationType.Error, 'فشل حفظ الصلاحيات');
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="grid grid-cols-4 gap-3">
                    {[1,2,3,4].map(i => <SkeletonLoader key={i} className="h-24" />)}
                </div>
                <SkeletonLoader className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Info Banner */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-700 dark:text-blue-300">
                <i className="fas fa-circle-info mt-0.5 flex-shrink-0" />
                <div>
                    <p className="font-bold">كيف تعمل الأدوار والصلاحيات؟</p>
                    <p className="mt-0.5 opacity-80 text-xs">
                        كل دور يحصل على مجموعة محددة من الصلاحيات. <strong>المدير العام</strong> دائماً يملك كل الصلاحيات ولا يمكن تعديله.
                        الصلاحيات المخصصة هنا تُحفظ في قاعدة البيانات وتُطبّق على جميع الأعضاء الحاملين لهذا الدور.
                    </p>
                </div>
            </div>

            {/* Role Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {ALL_ROLES_SETTINGS.map(role => {
                    const meta = ROLE_META_SETTINGS[role];
                    const count = (rolePermissions[role] || []).length;
                    const total = permissions.length;
                    return (
                        <div key={role} className={`p-3 rounded-xl border ${meta.bg} ${meta.border} text-right`}>
                            <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center mb-2`}>
                                <i className={`fas ${meta.icon} ${meta.color} text-sm`} />
                            </div>
                            <p className={`font-bold text-sm ${meta.color}`}>{meta.label}</p>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                {count} من {total} صلاحية
                            </p>
                            {/* Progress bar */}
                            <div className="w-full bg-white/20 dark:bg-black/20 h-1 rounded-full mt-2">
                                <div
                                    className={`h-1 rounded-full ${meta.bg.replace('/10', '')} opacity-70`}
                                    style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Permissions Matrix */}
            <div className="bg-light-bg dark:bg-dark-bg rounded-xl border border-light-border dark:border-dark-border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-light-border dark:border-dark-border">
                    <div>
                        <p className="font-bold text-light-text dark:text-dark-text text-sm">مصفوفة الصلاحيات</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            انقر على الخلايا لمنح أو سحب الصلاحية من الدور
                        </p>
                    </div>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary border border-light-border dark:border-dark-border hover:bg-light-card dark:hover:bg-dark-card transition-colors"
                    >
                        <i className="fas fa-rotate-right text-[10px]" />
                        إعادة للافتراضي
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                        {/* Role Headers */}
                        <thead>
                            <tr className="border-b border-light-border dark:border-dark-border">
                                <th className="text-right px-4 py-3 w-52">
                                    <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">
                                        الصلاحية
                                    </span>
                                </th>
                                {ALL_ROLES_SETTINGS.map(role => {
                                    const meta = ROLE_META_SETTINGS[role];
                                    return (
                                        <th key={role} className="px-4 py-3 text-center">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <div className={`w-8 h-8 rounded-xl ${meta.bg} flex items-center justify-center`}>
                                                    <i className={`fas ${meta.icon} ${meta.color} text-sm`} />
                                                </div>
                                                <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
                                                {role === AdminUserRole.SUPER_ADMIN && (
                                                    <span className="text-[9px] text-rose-400 bg-rose-500/10 px-1.5 rounded-full">مقفل</span>
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>

                        <tbody>
                            {permissions.map((perm, pi) => (
                                <tr
                                    key={perm.id}
                                    className={`border-b border-light-border/50 dark:border-dark-border/50 hover:bg-light-card/50 dark:hover:bg-dark-card/50 transition-colors ${pi % 2 === 0 ? '' : 'bg-light-bg/50 dark:bg-dark-bg/30'}`}
                                >
                                    {/* Permission Label */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-light-card dark:bg-dark-card flex items-center justify-center flex-shrink-0">
                                                <i className={`fas ${PERM_ICONS[perm.id] || 'fa-key'} text-light-text-secondary dark:text-dark-text-secondary text-xs`} />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm text-light-text dark:text-dark-text">{perm.label}</p>
                                                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary leading-tight">{perm.description}</p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Role cells */}
                                    {ALL_ROLES_SETTINGS.map(role => {
                                        const meta = ROLE_META_SETTINGS[role];
                                        const isLocked = role === AdminUserRole.SUPER_ADMIN;
                                        const hasIt = !!(rolePermissions[role]?.includes(perm.id));
                                        return (
                                            <td key={`${perm.id}-${role}`} className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handlePermissionChange(role, perm.id, !hasIt)}
                                                    disabled={isLocked}
                                                    title={isLocked ? 'المدير العام دائماً يملك كل الصلاحيات' : hasIt ? 'انقر لسحب الصلاحية' : 'انقر لمنح الصلاحية'}
                                                    className={`w-9 h-9 rounded-xl flex items-center justify-center mx-auto transition-all border-2 focus:outline-none
                                                        ${isLocked
                                                            ? `${meta.bg} ${meta.border} cursor-not-allowed`
                                                            : hasIt
                                                                ? `${meta.bg} ${meta.border} hover:opacity-80`
                                                                : 'bg-transparent border-light-border dark:border-dark-border hover:border-light-text-secondary/50 dark:hover:border-dark-text-secondary/50'
                                                        }`}
                                                >
                                                    <i className={`fas text-sm
                                                        ${isLocked
                                                            ? `fa-lock ${meta.color}`
                                                            : hasIt
                                                                ? `fa-check ${meta.color}`
                                                                : 'fa-minus text-light-text-secondary/30 dark:text-dark-text-secondary/30'
                                                        }`}
                                                    />
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Save Row */}
            <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isDirty ? 'bg-warning/10 border-warning/30' : 'bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border'}`}>
                <div className="flex items-center gap-2 text-sm">
                    <i className={`fas ${isDirty ? 'fa-circle-exclamation text-warning' : 'fa-circle-check text-success'} text-sm`} />
                    <span className={isDirty ? 'text-warning font-semibold' : 'text-light-text-secondary dark:text-dark-text-secondary'}>
                        {isDirty ? 'يوجد تغييرات غير محفوظة' : 'جميع التغييرات محفوظة'}
                    </span>
                </div>
                <button
                    onClick={handleSave}
                    disabled={loading || !isDirty}
                    className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                    {loading && <i className="fas fa-spinner fa-spin" />}
                    {loading ? 'جارٍ الحفظ...' : 'حفظ المصفوفة'}
                </button>
            </div>
        </div>
    );
};

// ── Main Export ───────────────────────────────────────────────────────────────

export const AdminSettingsPage: React.FC<AdminSettingsPageProps> = ({
    permissions, generalSettings, securitySettings, isLoading, addNotification
}) => {
    const [activeTab, setActiveTab] = useState<AdminSettingsTab>('general');

    if (isLoading || !generalSettings || !securitySettings) {
        return (
            <div className="space-y-6 animate-pulse">
                <SkeletonLoader className="h-12 w-64" />
                <SkeletonLoader className="h-12 w-full" />
                <SkeletonLoader className="h-96 w-full" />
            </div>
        );
    }

    const tabs: { id: AdminSettingsTab; label: string; icon: string }[] = [
        { id: 'general',       label: 'عام',                   icon: 'fa-sliders-h' },
        { id: 'customization', label: 'التخصيص',               icon: 'fa-paint-brush' },
        { id: 'roles',         label: 'الأدوار والصلاحيات',    icon: 'fa-user-shield' },
        { id: 'security',      label: 'الأمان',                 icon: 'fa-lock' },
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">إعدادات النظام</h1>
            <div className="border-b border-light-border dark:border-dark-border">
                <nav className="flex gap-1 overflow-x-auto">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === tab.id ? 'text-light-text dark:text-dark-text border-b-2 border-primary' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}>
                            <i className={`fas ${tab.icon} text-xs`}></i>
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="bg-light-card dark:bg-dark-card p-6 rounded-lg border border-light-border dark:border-dark-border">
                {activeTab === 'general'       && <GeneralPanel       settings={generalSettings}   addNotification={addNotification} />}
                {activeTab === 'customization' && <CustomizationPanel settings={generalSettings}   addNotification={addNotification} />}
                {activeTab === 'roles'         && <RolesPanel         permissions={permissions}    addNotification={addNotification} />}
                {activeTab === 'security'      && <SecurityPanel      settings={securitySettings}  addNotification={addNotification} />}
            </div>
        </div>
    );
};
