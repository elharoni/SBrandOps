import React, { useMemo } from 'react';
import { Tenant } from '../../../types';
import { TableComponent, ColumnDefinition } from '../shared/ui/TableComponent';
import { SkeletonLoader } from '../shared/ui/SkeletonLoader';

interface TenantsPageProps {
    tenants: Tenant[];
    isLoading: boolean;
}

const StatusBadge: React.FC<{ status: Tenant['status'] }> = ({ status }) => {
    const styles: Record<Tenant['status'], string> = {
        active: 'bg-green-500/20 text-green-400 dark:bg-success/20 dark:text-success',
        trial: 'bg-brand-primary/10 text-brand-primary',
        past_due: 'bg-amber-500/20 text-amber-600 dark:text-amber-300',
        suspended: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
        cancelled: 'bg-gray-500/20 text-gray-500 dark:bg-gray-500/20 dark:text-dark-text-secondary',
        inactive: 'bg-gray-500/20 text-gray-500 dark:bg-gray-500/20 dark:text-dark-text-secondary',
    };
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>{status}</span>;
};

const AIUsageBar: React.FC<{ usage: number; limit: number }> = ({ usage, limit }) => {
    const percentage = limit > 0 ? (usage / limit) * 100 : 0;
    const color = percentage > 90 ? 'bg-danger' : percentage > 70 ? 'bg-warning' : 'bg-primary';

    return (
        <div className="w-full">
            <div className="w-full bg-light-bg dark:bg-dark-bg h-2 rounded-full">
                <div className={`${color} h-2 rounded-full`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
            </div>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                {usage.toLocaleString()} / {limit.toLocaleString()}
            </p>
        </div>
    );
};

const PageSkeleton: React.FC = () => (
    <div className="space-y-6 animate-pulse">
        <div className="flex justify-between items-center">
            <SkeletonLoader className="h-10 w-64" />
        </div>
        <SkeletonLoader className="h-96" />
    </div>
);


export const TenantsPage: React.FC<TenantsPageProps> = ({ tenants, isLoading }) => {

    const columns = useMemo<ColumnDefinition<Tenant>[]>(() => [
        {
            header: 'اسم العميل',
            accessor: 'name',
            isSortable: true,
            cell: (tenant) => <span className="font-bold text-light-text dark:text-dark-text">{tenant.name}</span>
        },
        {
            header: 'الحالة',
            accessor: 'status',
            isSortable: true,
            cell: (tenant) => <StatusBadge status={tenant.status} />
        },
        {
            header: 'الخطة',
            accessor: 'plan',
            isSortable: true,
        },
        {
            header: 'المستخدمون',
            accessor: 'usersCount',
            isSortable: true,
            cell: (tenant) => <div className="text-center">{tenant.usersCount}</div>
        },
        {
            header: 'البراندات',
            accessor: 'brandsCount',
            isSortable: true,
            cell: (tenant) => <div className="text-center">{tenant.brandsCount}</div>
        },
        {
            header: 'استخدام AI',
            accessor: 'aiTokenUsage',
            isSortable: true,
            cell: (tenant) => <AIUsageBar usage={tenant.aiTokenUsage} limit={tenant.aiTokenLimit} />
        },
        {
            header: 'الإجراءات',
            accessor: 'id',
            cell: (tenant) => <button className="text-xs text-primary hover:underline">إدارة</button>
        }
    ], []);
    
    if (isLoading && tenants.length === 0) {
        return <PageSkeleton />;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">إدارة العملاء (Tenants)</h1>

            <TableComponent<Tenant>
                columns={columns}
                data={tenants}
                filterColumn="name"
                filterPlaceholder="ابحث بالاسم..."
            />
        </div>
    );
};
