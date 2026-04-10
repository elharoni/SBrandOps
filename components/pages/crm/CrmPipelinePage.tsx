import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { PageScaffold, PageSection } from '../../shared/PageScaffold';
import { getDeals, updateDeal } from '../../../services/crmService';
import { CrmDeal, CrmPipelineStage } from '../../../types';
import { AddDealModal } from './AddDealModal';

export interface CrmPipelinePageProps {
    brandId: string;
}

const STAGE_CONFIG: Record<CrmPipelineStage, { label: string; color: string; border: string }> = {
    Qualify: { label: 'تأهيل العميل', color: 'bg-blue-500', border: 'border-blue-500' },
    Proposal: { label: 'عرض السعر والتفاوض', color: 'bg-yellow-500', border: 'border-yellow-500' },
    Won: { label: 'مغلق - تم الفوز', color: 'bg-green-500', border: 'border-green-500' },
    Lost: { label: 'مغلق - لم يتم', color: 'bg-red-500', border: 'border-red-500' }
};

export const CrmPipelinePage: React.FC<CrmPipelinePageProps> = ({ brandId }) => {
    const { t } = useLanguage();
    const [deals, setDeals] = useState<CrmDeal[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddDealOpen, setIsAddDealOpen] = useState(false);

    const stages: CrmPipelineStage[] = ['Qualify', 'Proposal', 'Won', 'Lost'];

    const loadDeals = useCallback(async () => {
        setLoading(true);
        const fetchedDeals = await getDeals(brandId);
        setDeals(fetchedDeals);
        setLoading(false);
    }, [brandId]);

    useEffect(() => {
        void loadDeals();
    }, [loadDeals]);

    const handleDragStart = (e: React.DragEvent, dealId: string) => {
        e.dataTransfer.setData('dealId', dealId);
    };

    const handleDrop = async (e: React.DragEvent, targetStage: CrmPipelineStage) => {
        const dealId = e.dataTransfer.getData('dealId');
        
        // Optimistic UI update
        setDeals(prev => prev.map(deal =>
            deal.id === dealId ? { ...deal, stage: targetStage } : deal
        ));

        // Background sync
        await updateDeal(brandId, dealId, { stage: targetStage });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    return (
        <PageScaffold
            kicker="Sales CRM"
            title="مسار المبيعات"
            description="تتبع وتحريك الصفقات المحتملة عبر مسار المبيعات بسهولة."
            stats={[
                { label: 'إجمالي الصفقات', value: deals.length.toString() },
                { label: 'القيمة الإجمالية', value: `${deals.reduce((s,d) => s + d.amount, 0).toLocaleString()} ر.س` }
            ]}
            actions={
                <button onClick={() => setIsAddDealOpen(true)} className="btn rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-primary/20 transition-all hover:-translate-y-0.5 active:scale-95">
                    <i className="fas fa-plus me-2" />
                    إضافة صفقة
                </button>
            }
        >
            <PageSection className="h-full flex flex-col pt-0">

            {/* Kanban Board Container */}
            <div className="flex flex-1 gap-6 overflow-x-auto pb-4">
                {stages.map(stage => {
                    const stageDeals = deals.filter(d => d.stage === stage);
                    const config = STAGE_CONFIG[stage];
                    const stageAmount = stageDeals.reduce((sum, d) => sum + d.amount, 0);

                    return (
                        <div
                            key={stage}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, stage)}
                            className="flex h-full w-80 flex-shrink-0 flex-col rounded-[2rem] bg-light-bg/50 p-4 dark:bg-dark-bg/50 border border-light-border dark:border-dark-border"
                        >
                            {/* Column Header */}
                            <div className="mb-4 px-2">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${config.color}`} />
                                            {config.label}
                                        </h3>
                                        <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary bg-light-card dark:bg-dark-card px-2 py-1 rounded-full shadow-inner">
                                            {stageDeals.length}
                                        </span>
                                    </div>
                                    <div className="text-xs font-bold text-brand-secondary">
                                        {stageAmount.toLocaleString()} ر.س
                                    </div>
                                </div>
                            </div>

                            {/* Cards Area */}
                            <div className="flex-1 space-y-3 overflow-y-auto px-1 pb-2">
                                {stageDeals.map(deal => (
                                    <div
                                        key={deal.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, deal.id)}
                                        className={`group surface-panel-soft relative cursor-grab rounded-2xl p-4 transition-all hover:-translate-y-1 hover:shadow-lg active:scale-95 active:cursor-grabbing border-s-4 ${config.border}`}
                                    >
                                        <div className="flexjustify-between mb-2">
                                            <h4 className="text-sm font-bold text-light-text dark:text-dark-text">{deal.title}</h4>
                                        </div>
                                        <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-3">
                                            <i className="far fa-building me-1 opacity-70"></i>{deal.company}
                                        </p>
                                        
                                        <div className="flex items-end justify-between border-t border-light-border/40 pt-3 dark:border-dark-border/40">
                                            <div className="text-sm font-black text-brand-primary">
                                                {deal.amount.toLocaleString()} ر.س
                                            </div>
                                            <div className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1 bg-light-bg dark:bg-dark-bg px-2 py-1 rounded-md shadow-inner">
                                                <i className="fas fa-bullseye opacity-50"></i> {deal.probability}%
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {stageDeals.length === 0 && (
                                    <div className="flex h-32 items-center justify-center rounded-2xl border-2 border-dashed border-light-border dark:border-dark-border">
                                        <span className="text-xs font-bold text-light-text-secondary/50 dark:text-dark-text-secondary/50">قم بالسحب والإفلات هنا</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            </PageSection>

            {isAddDealOpen && (
                <AddDealModal 
                    brandId={brandId} 
                    onClose={() => setIsAddDealOpen(false)} 
                    onDealAdded={(newDeal) => { setDeals(prev => [newDeal, ...prev]); setIsAddDealOpen(false); }} 
                />
            )}
        </PageScaffold>
    );
};
