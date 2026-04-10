import React from 'react';
import { AdCampaign, CampaignStatus, AD_PLATFORM_ASSETS } from '../../types';

const StatusBadge: React.FC<{ status: CampaignStatus }> = ({ status }) => {
    const styles: Record<CampaignStatus, string> = {
        [CampaignStatus.Active]: 'bg-green-500/20 text-green-400',
        [CampaignStatus.Paused]: 'bg-yellow-500/20 text-yellow-400',
        [CampaignStatus.Completed]: 'bg-gray-500/20 text-gray-400',
        [CampaignStatus.Draft]: 'bg-blue-500/20 text-blue-400',
    };
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>{status}</span>;
};

export const CampaignsList: React.FC<{ campaigns: AdCampaign[] }> = ({ campaigns }) => {
    if (campaigns.length === 0) {
        return (
            <div className="text-center py-16 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg">
                <i className="fas fa-folder-open text-4xl text-light-text-secondary dark:text-dark-text-secondary mb-3"></i>
                <h3 className="font-bold text-light-text dark:text-dark-text">لا توجد حملات إعلانية</h3>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">انقر على "إنشاء حملة جديدة" للبدء.</p>
            </div>
        );
    }
    
    return (
        <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-light-text-secondary dark:text-dark-text-secondary">
                    <thead className="text-xs uppercase bg-light-bg dark:bg-dark-bg">
                        <tr>
                            <th scope="col" className="px-4 py-3">الحملة</th>
                            <th scope="col" className="px-4 py-3">الحالة</th>
                            <th scope="col" className="px-4 py-3">الإنفاق</th>
                            <th scope="col" className="px-4 py-3">ROAS</th>
                            <th scope="col" className="px-4 py-3">الظهور</th>
                            <th scope="col" className="px-4 py-3">CTR</th>
                            <th scope="col" className="px-4 py-3">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {campaigns.map(c => {
                            const platformAsset = AD_PLATFORM_ASSETS[c.platform];
                            return (
                                <tr key={c.id} className="border-b border-light-border dark:border-dark-border hover:bg-light-bg dark:hover:bg-dark-bg/50">
                                    <td className="px-4 py-3 font-bold text-light-text dark:text-dark-text">
                                        <div className="flex items-center gap-2">
                                            <i className={`${platformAsset.icon} text-lg`} style={{ color: platformAsset.color }}></i>
                                            <span>{c.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                                    <td className="px-4 py-3">${c.metrics.spend.toLocaleString()}</td>
                                    <td className="px-4 py-3">{c.metrics.roas}x</td>
                                    <td className="px-4 py-3">{c.metrics.impressions.toLocaleString()}</td>
                                    <td className="px-4 py-3">{c.metrics.ctr}%</td>
                                    <td className="px-4 py-3">
                                        <button className="text-xs text-brand-primary hover:underline">عرض التفاصيل</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};