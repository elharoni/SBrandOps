import React, { useState } from 'react';
import { CrmPipelineStage, CrmDeal } from '../../../types';
import { createDeal } from '../../../services/crmService';

interface AddDealModalProps {
    brandId: string;
    onClose: () => void;
    onDealAdded: (newDeal: CrmDeal) => void;
    addNotification?: (type: any, msg: string) => void;
}

export const AddDealModal: React.FC<AddDealModalProps> = ({ brandId, onClose, onDealAdded, addNotification }) => {
    const [title, setTitle] = useState('');
    const [company, setCompany] = useState('');
    const [amount, setAmount] = useState<number | ''>('');
    const [probability, setProbability] = useState<number | ''>(20);
    const [stage, setStage] = useState<CrmPipelineStage>('Qualify');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const newDeal = await createDeal(brandId, {
            title,
            company,
            amount: Number(amount) || 0,
            probability: Number(probability) || 0,
            stage,
        });

        setLoading(false);

        if (newDeal) {
            if (addNotification) addNotification('success', 'تمت إضافة الصفقة بنجاح');
            onDealAdded(newDeal);
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
                        <i className="fas fa-handshake text-brand-primary" />
                        صفقة جديدة
                    </h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary hover:bg-red-500/10 hover:text-red-500 transition-colors">
                        <i className="fas fa-times" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <form id="add-deal-form" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">عنوان الصفقة *</label>
                            <input required type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: عقد تسويق سنوي"
                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">الشركة أو العميل</label>
                            <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="اسم العميل أو الجهة"
                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">قيمة الصفقة المتوقعة (ر.س)</label>
                                <input required type="number" min="0" value={amount} onChange={e => setAmount(e.target.value ? Number(e.target.value) : '')} placeholder="0"
                                    className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">نسبة الإغلاق (%)</label>
                                <input required type="number" min="0" max="100" value={probability} onChange={e => setProbability(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">المرحلة الحالية</label>
                            <select value={stage} onChange={e => setStage(e.target.value as CrmPipelineStage)}
                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                            >
                                <option value="Qualify">تأهيل العميل</option>
                                <option value="Proposal">عرض السعر والتفاوض</option>
                                <option value="Won">مغلق - تم الفوز</option>
                                <option value="Lost">مغلق - لم يتم</option>
                            </select>
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t border-light-border/50 dark:border-dark-border/50 bg-light-bg/30 dark:bg-dark-bg/30 flex justify-end gap-3">
                    <button type="button" onClick={onClose}
                        className="btn px-5 py-2.5 text-sm font-bold bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-text dark:text-dark-text rounded-xl hover:bg-light-border dark:hover:bg-dark-border transition-colors">
                        إلغاء
                    </button>
                    <button type="submit" form="add-deal-form" disabled={loading}
                        className="btn px-6 py-2.5 text-sm font-bold bg-brand-primary text-white rounded-xl shadow-lg shadow-brand-primary/20 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 transition-all flex items-center gap-2">
                        {loading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-check" />}
                        إضافة الصفقة
                    </button>
                </div>
            </div>
        </div>
    );
};
