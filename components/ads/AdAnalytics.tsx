import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AdCampaign, AdPlatform } from '../../types';

const platformColors: { [key in AdPlatform]: string } = {
    [AdPlatform.Meta]: '#3b82f6',
    [AdPlatform.TikTok]: '#000000',
    [AdPlatform.Google]: '#ef4444',
};

export const AdAnalytics: React.FC<{ campaigns: AdCampaign[] }> = ({ campaigns }) => {
    
    const spendByPlatform = campaigns.reduce((acc, campaign) => {
        const existing = acc.find(item => item.name === campaign.platform);
        if (existing) {
            existing.value += campaign.metrics.spend;
        } else {
            acc.push({ name: campaign.platform, value: campaign.metrics.spend });
        }
        return acc;
    }, [] as { name: AdPlatform, value: number }[]);

    const roasData = campaigns
        .filter(c => c.metrics.roas > 0)
        .map(c => ({
            name: c.name.substring(0, 20) + (c.name.length > 20 ? '...' : ''),
            roas: c.metrics.roas,
            spend: c.metrics.spend,
        }));

    return (
        <div className="space-y-6">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border">
                    <h3 className="font-bold text-light-text dark:text-dark-text mb-4">العائد على الإنفاق الإعلاني (ROAS) لكل حملة</h3>
                     <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={roasData} margin={{ top: 5, right: 20, left: -10, bottom: 70 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                            <XAxis dataKey="name" stroke="var(--color-text-secondary)" fontSize={10} interval={0} angle={-35} textAnchor="end" />
                            <YAxis stroke="var(--color-text-secondary)" fontSize={12} label={{ value: 'ROAS', angle: -90, position: 'insideLeft', fill: 'var(--color-text-secondary)' }} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '60px' }} />
                            <Bar dataKey="roas" name="ROAS (x)" fill="#7c3aed" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                 <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border">
                    <h3 className="font-bold text-light-text dark:text-dark-text mb-4 text-center">توزيع الإنفاق حسب المنصة</h3>
                     <ResponsiveContainer width="100%" height={300}>
                         <PieChart>
                             <Pie 
                                data={spendByPlatform} 
                                dataKey="value" 
                                nameKey="name" 
                                cx="50%" 
                                cy="50%" 
                                outerRadius={100} 
                                labelLine={false} 
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                className="text-sm font-bold fill-current text-light-text dark:text-dark-text"
                             >
                                 {spendByPlatform.map((entry) => (
                                     <Cell key={`cell-${entry.name}`} fill={platformColors[entry.name]} />
                                 ))}
                             </Pie>
                             <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}/>
                         </PieChart>
                     </ResponsiveContainer>
                 </div>
            </div>
            <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border">
                 <h3 className="font-bold text-light-text dark:text-dark-text mb-4">المحتويات الإعلانية المستخدمة</h3>
                 <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                     {campaigns.map(campaign => (
                         <div key={campaign.id} className="bg-light-bg dark:bg-dark-bg p-3 rounded-md">
                             <h4 className="font-semibold text-brand-primary">{campaign.name}</h4>
                             {campaign.creatives.map(creative => (
                                <div key={creative.id} className="mt-2 p-2 border-t border-light-border dark:border-dark-border">
                                     <p className="text-sm font-bold text-light-text dark:text-dark-text">{creative.headline}</p>
                                     <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">{creative.primaryText}</p>
                                </div>
                             ))}
                         </div>
                     ))}
                 </div>
            </div>
        </div>
    );
};