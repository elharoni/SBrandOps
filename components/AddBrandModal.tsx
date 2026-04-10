import React, { useState } from 'react';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { QuotaWarning } from './shared/PaywallGate';

interface AddBrandModalProps {
    onClose: () => void;
    onCreate: (name: string) => void;
    /** Current number of brands the user already has */
    currentBrandCount?: number;
}

export const AddBrandModal: React.FC<AddBrandModalProps> = ({ onClose, onCreate, currentBrandCount = 0 }) => {
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { canAddBrand, limits } = usePlanLimits();

    const allowed = canAddBrand(currentBrandCount);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !allowed) return;
        setIsLoading(true);
        await onCreate(name.trim());
        // No need to set loading to false as the component will unmount
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="p-5 border-b border-light-border dark:border-dark-border flex justify-between items-center">
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">إضافة براند جديد</h2>
                        <button type="button" onClick={onClose} className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text text-2xl">&times;</button>
                    </div>
                    <div className="p-6 space-y-4">
                        {/* Quota warning if near or at limit */}
                        <QuotaWarning
                            currentCount={currentBrandCount}
                            maxCount={limits.maxBrands}
                            entityName="براند"
                        />
                        {allowed ? (
                            <div>
                                <label htmlFor="brandName" className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                    اسم البراند
                                </label>
                                <input
                                    id="brandName"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="مثال: Confort-Tex"
                                    className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md focus:ring-brand-primary focus:border-brand-primary text-light-text dark:text-dark-text"
                                    required
                                    autoFocus
                                />
                            </div>
                        ) : (
                            <p className="text-on-surface-variant text-sm text-center py-2">
                                وصلت للحد الأقصى في باقتك الحالية. قم بالترقية لإضافة المزيد من البراندات.
                            </p>
                        )}
                    </div>
                    <div className="p-4 bg-light-bg/50 dark:bg-dark-bg/50 border-t border-light-border dark:border-dark-border flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="text-light-text-secondary dark:text-dark-text-secondary font-bold py-2 px-4 rounded-lg hover:bg-light-bg dark:hover:bg-dark-bg hover:text-light-text dark:hover:text-dark-text">
                            إلغاء
                        </button>
                        {allowed ? (
                            <button
                                type="submit"
                                disabled={isLoading || !name.trim()}
                                className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-500 hover:bg-brand-secondary"
                            >
                                {isLoading ? 'جاري الإنشاء...' : 'إنشاء'}
                            </button>
                        ) : (
                            <a
                                href="/pricing"
                                className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg hover:bg-brand-secondary text-center"
                            >
                                ترقية الباقة
                            </a>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};