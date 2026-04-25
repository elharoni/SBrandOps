import React, { useState } from 'react';
import { CrmLifecycleStage } from '../../../types';
import { LIFECYCLE_STAGE_CONFIG, createCustomer } from '../../../services/crmService';
import { useModalClose } from '../../../hooks/useModalClose';

interface AddCustomerModalProps {
    brandId: string;
    onClose: () => void;
    onCustomerAdded: () => void;
    addNotification?: (type: any, msg: string) => void;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ brandId, onClose, onCustomerAdded, addNotification }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    useModalClose(onClose);
    const [stage, setStage] = useState<CrmLifecycleStage>(CrmLifecycleStage.Lead);
    const [source, setSource] = useState('Manual');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const newCustomer = await createCustomer(brandId, {
            firstName,
            lastName,
            email,
            phone,
            lifecycleStage: stage,
            acquisitionSource: source,
        });

        setLoading(false);

        if (newCustomer) {
            if (addNotification) addNotification('success', 'تمت إضافة العميل بنجاح');
            onCustomerAdded();
            onClose();
        } else {
            if (addNotification) addNotification('error', 'حدث خطأ أثناء الإضافة');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
            
            <div className="relative w-full max-w-lg bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
                <div className="flex items-center justify-between p-6 border-b border-light-border/50 dark:border-dark-border/50 bg-light-bg/50 dark:bg-dark-bg/50">
                    <h3 className="text-xl font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                        <i className="fas fa-user-plus text-brand-primary" />
                        عميل جديد
                    </h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary hover:bg-red-500/10 hover:text-red-500 transition-colors">
                        <i className="fas fa-times" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <form id="add-customer-form" onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">الاسم الأول *</label>
                                <input required type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                                    className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">الاسم الأخير</label>
                                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                                    className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">البريد الإلكتروني</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">رقم الجوال</label>
                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="05XXXXXXXX"
                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all text-left" dir="ltr"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">المرحلة البيعية</label>
                                <select value={stage} onChange={e => setStage(e.target.value as CrmLifecycleStage)}
                                    className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                                >
                                    {Object.values(CrmLifecycleStage).map(s => (
                                        <option key={s} value={s}>{LIFECYCLE_STAGE_CONFIG[s].labelAr}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">المصدر</label>
                                <select value={source} onChange={e => setSource(e.target.value)}
                                    className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                                >
                                    <option value="Manual">إدخال يدوي</option>
                                    <option value="Website">الموقع</option>
                                    <option value="SocialMedia">السوشيال ميديا</option>
                                    <option value="Referral">إحالة</option>
                                </select>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t border-light-border/50 dark:border-dark-border/50 bg-light-bg/30 dark:bg-dark-bg/30 flex justify-end gap-3">
                    <button type="button" onClick={onClose}
                        className="btn px-5 py-2.5 text-sm font-bold bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-text dark:text-dark-text rounded-xl hover:bg-light-border dark:hover:bg-dark-border transition-colors">
                        إلغاء
                    </button>
                    <button type="submit" form="add-customer-form" disabled={loading}
                        className="btn px-6 py-2.5 text-sm font-bold bg-brand-primary text-white rounded-xl shadow-lg shadow-brand-primary/20 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 transition-all flex items-center gap-2">
                        {loading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-check" />}
                        حفظ العميل
                    </button>
                </div>
            </div>
        </div>
    );
};
