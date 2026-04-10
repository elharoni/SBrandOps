// components/admin/pages/AdminSettingsPage.tsx
import React, { useState, useEffect } from 'react';
import { AdminPermission, AdminUserRole, GeneralSettings, SecuritySettings } from '../../../types';
import { SkeletonLoader } from '../shared/ui/SkeletonLoader';

interface AdminSettingsPageProps {
    permissions: AdminPermission[];
    generalSettings: GeneralSettings | null;
    securitySettings: SecuritySettings | null;
    isLoading: boolean;
}

type AdminSettingsTab = 'general' | 'roles' | 'security';

// --- Reusable UI Components for Settings ---
const SettingsSection: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => (
    <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg border border-light-border dark:border-dark-border">
        <h3 className="font-bold text-light-text dark:text-dark-text">{title}</h3>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">{description}</p>
        <div className="space-y-4">{children}</div>
    </div>
);

const ToggleSwitch: React.FC<{ label: string; description: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; }> = ({ label, description, checked, onChange, disabled }) => (
    <div className="flex justify-between items-center p-3 rounded-md hover:bg-light-card dark:hover:bg-dark-card/50">
        <div>
            <p className={`font-semibold text-light-text dark:text-dark-text ${disabled ? 'opacity-50' : ''}`}>{label}</p>
            <p className={`text-xs text-light-text-secondary dark:text-dark-text-secondary ${disabled ? 'opacity-50' : ''}`}>{description}</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
        </label>
    </div>
);

const SettingInput: React.FC<{ label: string; description?: string; type: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; name: string; }> = ({ label, description, type, value, onChange, name }) => (
     <div className="p-3">
        <label className="font-semibold text-light-text dark:text-dark-text">{label}</label>
        {description && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-2">{description}</p>}
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            className="w-full mt-1 p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md"
        />
    </div>
);


// --- Panels for each Tab ---

const GeneralPanel: React.FC<{ settings: GeneralSettings }> = ({ settings }) => {
    const [formState, setFormState] = useState(settings);

    useEffect(() => {
        setFormState(settings);
    }, [settings]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleToggleChange = (name: keyof GeneralSettings, value: boolean) => {
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="space-y-6">
            <SettingsSection title="إعدادات التطبيق" description="التكوينات الأساسية للتطبيق.">
                <SettingInput label="اسم التطبيق" name="appName" type="text" value={formState.appName} onChange={handleInputChange} />
                <ToggleSwitch 
                    label="وضع الصيانة"
                    description="عند التفعيل، لن يتمكن المستخدمون غير المسؤولين من الوصول إلى التطبيق."
                    checked={formState.maintenanceMode}
                    onChange={(checked) => handleToggleChange('maintenanceMode', checked)}
                />
            </SettingsSection>
             <SettingsSection title="التكوينات الإقليمية" description="إعدادات اللغة والتواصل الافتراضية.">
                 <SettingInput label="البريد الإلكتروني للدعم" name="supportEmail" type="email" value={formState.supportEmail} onChange={handleInputChange} />
             </SettingsSection>
             <div className="text-end">
                <button className="bg-primary text-white font-bold py-2 px-6 rounded-lg hover:bg-primary/90">
                    حفظ التغييرات
                </button>
            </div>
        </div>
    );
};


const SecurityPanel: React.FC<{ settings: SecuritySettings }> = ({ settings }) => {
    const [formState, setFormState] = useState(settings);

    useEffect(() => {
        setFormState(settings);
    }, [settings]);
    
    const handleToggleChange = (name: keyof SecuritySettings, value: boolean) => {
        setFormState(prev => ({ ...prev, [name]: value }));
    };
     const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: Number(value) }));
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
             <div className="text-end">
                <button className="bg-primary text-white font-bold py-2 px-6 rounded-lg hover:bg-primary/90">
                    حفظ التغييرات
                </button>
            </div>
        </div>
    )
};


const ROLES_PERMISSIONS_MAPPING_INITIAL: Record<AdminUserRole, string[]> = {
    [AdminUserRole.SUPER_ADMIN]: ['tenants:manage', 'users:manage', 'billing:manage', 'ai:monitor', 'queues:manage', 'settings:manage'],
    [AdminUserRole.ADMIN]: ['tenants:manage', 'users:manage', 'billing:manage', 'ai:monitor'],
    [AdminUserRole.MODERATOR]: ['tenants:manage'],
    [AdminUserRole.SUPPORT]: ['tenants:manage', 'queues:manage'],
};

const RolesPanel: React.FC<{ permissions: AdminPermission[] }> = ({ permissions }) => {
    const [rolePermissions, setRolePermissions] = useState(ROLES_PERMISSIONS_MAPPING_INITIAL);

    const handlePermissionChange = (role: AdminUserRole, permId: string, isChecked: boolean) => {
        setRolePermissions(prev => {
            const currentPerms = prev[role] || [];
            const newPerms = isChecked
                ? [...currentPerms, permId]
                : currentPerms.filter(p => p !== permId);
            return { ...prev, [role]: newPerms };
        });
    };

    return (
        <SettingsSection title="الأدوار والصلاحيات" description="حدد ما يمكن لكل دور الوصول إليه وإدارته داخل لوحة الإدارة.">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm text-left">
                    <thead className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase">
                        <tr>
                            <th className="py-3 px-4">الصلاحية</th>
                            {Object.values(AdminUserRole).map(role => (
                                <th key={role} className="py-3 px-4 text-center">{role}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="text-light-text dark:text-dark-text">
                        {permissions.map(perm => (
                            <tr key={perm.id} className="border-t border-light-border dark:border-dark-border">
                                <td className="py-3 px-4">
                                    <p className="font-semibold">{perm.label}</p>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{perm.description}</p>
                                </td>
                                {Object.values(AdminUserRole).map(role => (
                                    <td key={`${perm.id}-${role}`} className="py-3 px-4 text-center">
                                        <input
                                            type="checkbox"
                                            checked={rolePermissions[role]?.includes(perm.id)}
                                            onChange={(e) => handlePermissionChange(role, perm.id, e.target.checked)}
                                            disabled={role === AdminUserRole.SUPER_ADMIN}
                                            className="w-5 h-5 bg-light-card dark:bg-dark-card border-light-border dark:border-dark-border rounded text-primary focus:ring-primary disabled:opacity-50"
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-6 text-end">
                <button className="bg-primary text-white font-bold py-2 px-6 rounded-lg hover:bg-primary/90">
                    حفظ التغييرات
                </button>
            </div>
        </SettingsSection>
    );
};

export const AdminSettingsPage: React.FC<AdminSettingsPageProps> = ({ permissions, generalSettings, securitySettings, isLoading }) => {
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

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">إعدادات النظام</h1>
            <div className="border-b border-light-border dark:border-dark-border">
                <nav className="flex space-s-4">
                    <button onClick={() => setActiveTab('general')} className={`py-3 px-4 text-sm font-semibold ${activeTab === 'general' ? 'text-light-text dark:text-dark-text border-b-2 border-primary' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}>عام</button>
                    <button onClick={() => setActiveTab('roles')} className={`py-3 px-4 text-sm font-semibold ${activeTab === 'roles' ? 'text-light-text dark:text-dark-text border-b-2 border-primary' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}>الأدوار والصلاحيات</button>
                    <button onClick={() => setActiveTab('security')} className={`py-3 px-4 text-sm font-semibold ${activeTab === 'security' ? 'text-light-text dark:text-dark-text border-b-2 border-primary' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}>الأمان</button>
                </nav>
            </div>

            <div className="bg-light-card dark:bg-dark-card p-6 rounded-lg border border-light-border dark:border-dark-border">
                {activeTab === 'general' && <GeneralPanel settings={generalSettings} />}
                {activeTab === 'roles' && <RolesPanel permissions={permissions} />}
                {activeTab === 'security' && <SecurityPanel settings={securitySettings} />}
            </div>
        </div>
    );
};