import React from 'react';

interface AnalyticsFiltersProps {
    onApplyFilters: (filters: any) => void;
}

export const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({ onApplyFilters }) => {
    return (
        <div className="flex items-center gap-3">
            <select className="bg-dark-bg border border-dark-border rounded-lg py-2 px-3 text-sm text-dark-text-secondary focus:ring-brand-primary focus:border-brand-primary">
                <option>آخر 30 يومًا</option>
                <option>آخر 7 أيام</option>
                <option>آخر 90 يومًا</option>
            </select>
            <button className="text-sm bg-dark-bg border border-dark-border rounded-lg py-2 px-4 text-white hover:border-brand-primary">
                تصفية حسب المنصة
            </button>
             <button className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg flex items-center space-s-2 text-sm">
                <i className="fas fa-file-export"></i>
                <span>تصدير</span>
            </button>
        </div>
    );
};