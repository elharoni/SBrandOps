import React, { useState } from 'react';
import { Brand } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface BrandsManagePageProps {
    brands: Brand[];
    activeBrand: Brand | null;
    onAddBrand: () => void;
    onSwitchBrand: (brandId: string) => void;
    onDeleteBrand: (brandId: string) => Promise<void>;
    onRenameBrand: (brandId: string, newName: string) => Promise<void>;
}

export const BrandsManagePage: React.FC<BrandsManagePageProps> = ({
    brands,
    activeBrand,
    onAddBrand,
    onSwitchBrand,
    onDeleteBrand,
    onRenameBrand,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);

    const startEdit = (brand: Brand) => {
        setEditingId(brand.id);
        setEditName(brand.name);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName('');
    };

    const handleSaveRename = async (brandId: string) => {
        if (!editName.trim()) return;
        setSavingId(brandId);
        try {
            await onRenameBrand(brandId, editName.trim());
            setEditingId(null);
        } finally {
            setSavingId(null);
        }
    };

    const handleDelete = async (brandId: string) => {
        setDeletingId(brandId);
        try {
            await onDeleteBrand(brandId);
        } finally {
            setDeletingId(null);
            setConfirmDeleteId(null);
        }
    };

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="section-kicker">{ar ? 'الإعدادات' : 'Settings'}</p>
                    <h1 className="mt-1 text-2xl font-bold text-light-text dark:text-dark-text">
                        {ar ? 'إدارة البراندات' : 'Manage Brands'}
                    </h1>
                    <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {ar
                            ? 'أضف براندات جديدة أو عدّل أسماء البراندات الحالية أو احذفها.'
                            : 'Add new brands, rename or delete existing ones.'}
                    </p>
                </div>
                <button
                    onClick={onAddBrand}
                    className="flex items-center gap-2 rounded-2xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-primary-glow transition-transform hover:-translate-y-0.5"
                >
                    <i className="fas fa-plus text-xs" />
                    <span>{ar ? 'براند جديد' : 'New Brand'}</span>
                </button>
            </div>

            {/* Brands list */}
            <div className="surface-panel overflow-hidden rounded-2xl">
                {brands.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
                            <i className="fas fa-building text-xl" />
                        </div>
                        <p className="text-sm font-semibold text-light-text dark:text-dark-text">
                            {ar ? 'لا يوجد براندات بعد' : 'No brands yet'}
                        </p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {ar ? 'أنشئ أول براند للبدء' : 'Create your first brand to get started'}
                        </p>
                        <button
                            onClick={onAddBrand}
                            className="mt-2 rounded-2xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
                        >
                            {ar ? 'إضافة براند' : 'Add Brand'}
                        </button>
                    </div>
                ) : (
                    <ul className="divide-y divide-light-border/60 dark:divide-dark-border/60">
                        {brands.map((brand) => {
                            const isActive = activeBrand?.id === brand.id;
                            const isEditing = editingId === brand.id;
                            const isConfirmingDelete = confirmDeleteId === brand.id;

                            return (
                                <li key={brand.id} className="flex items-center gap-4 px-5 py-4">
                                    {/* Logo */}
                                    <img
                                        src={brand.logoUrl}
                                        alt={brand.name}
                                        className="h-11 w-11 shrink-0 rounded-xl object-cover shadow-sm"
                                    />

                                    {/* Name / edit input */}
                                    <div className="min-w-0 flex-1">
                                        {isEditing ? (
                                            <input
                                                autoFocus
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveRename(brand.id);
                                                    if (e.key === 'Escape') cancelEdit();
                                                }}
                                                className="w-full rounded-xl border border-brand-primary bg-light-bg px-3 py-1.5 text-sm font-semibold text-light-text focus:outline-none dark:bg-dark-bg dark:text-dark-text"
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <p className="truncate text-sm font-semibold text-light-text dark:text-dark-text">
                                                    {brand.name}
                                                </p>
                                                {isActive && (
                                                    <span className="shrink-0 rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-primary">
                                                        {ar ? 'نشط' : 'Active'}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex shrink-0 items-center gap-2">
                                        {isConfirmingDelete ? (
                                            <>
                                                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                    {ar ? 'تأكيد الحذف؟' : 'Confirm delete?'}
                                                </span>
                                                <button
                                                    onClick={() => handleDelete(brand.id)}
                                                    disabled={deletingId === brand.id}
                                                    className="rounded-xl bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                                                >
                                                    {deletingId === brand.id
                                                        ? (ar ? 'جاري...' : 'Deleting…')
                                                        : (ar ? 'نعم، احذف' : 'Yes, delete')}
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(null)}
                                                    className="rounded-xl border border-light-border px-3 py-1.5 text-xs font-semibold text-light-text-secondary hover:bg-light-card dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-card"
                                                >
                                                    {ar ? 'إلغاء' : 'Cancel'}
                                                </button>
                                            </>
                                        ) : isEditing ? (
                                            <>
                                                <button
                                                    onClick={() => handleSaveRename(brand.id)}
                                                    disabled={savingId === brand.id || !editName.trim()}
                                                    className="rounded-xl bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                                >
                                                    {savingId === brand.id ? (ar ? 'حفظ...' : 'Saving…') : (ar ? 'حفظ' : 'Save')}
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="rounded-xl border border-light-border px-3 py-1.5 text-xs font-semibold text-light-text-secondary hover:bg-light-card dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-card"
                                                >
                                                    {ar ? 'إلغاء' : 'Cancel'}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                {!isActive && (
                                                    <button
                                                        onClick={() => onSwitchBrand(brand.id)}
                                                        className="rounded-xl border border-light-border px-3 py-1.5 text-xs font-medium text-light-text-secondary transition-colors hover:bg-light-card hover:text-light-text dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-card dark:hover:text-dark-text"
                                                        title={ar ? 'تفعيل هذا البراند' : 'Switch to this brand'}
                                                    >
                                                        {ar ? 'تفعيل' : 'Switch'}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => startEdit(brand)}
                                                    className="flex h-8 w-8 items-center justify-center rounded-xl text-light-text-secondary transition-colors hover:bg-light-card hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-dark-card dark:hover:text-dark-text"
                                                    title={ar ? 'تعديل الاسم' : 'Rename'}
                                                >
                                                    <i className="fas fa-pen text-xs" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(brand.id)}
                                                    className="flex h-8 w-8 items-center justify-center rounded-xl text-light-text-secondary transition-colors hover:bg-red-50 hover:text-red-500 dark:text-dark-text-secondary dark:hover:bg-red-900/20 dark:hover:text-red-400"
                                                    title={ar ? 'حذف البراند' : 'Delete brand'}
                                                >
                                                    <i className="fas fa-trash text-xs" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* Info note */}
            <p className="text-center text-xs text-light-text-secondary dark:text-dark-text-secondary">
                {ar
                    ? 'حذف البراند سيزيل جميع بياناته بشكل نهائي.'
                    : 'Deleting a brand permanently removes all its data.'}
            </p>
        </div>
    );
};
