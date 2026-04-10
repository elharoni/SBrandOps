import React, { useMemo } from 'react';
import { AdminUser, AdminUserRole } from '../../../types';
import { TableComponent, ColumnDefinition } from '../shared/ui/TableComponent';
import { SkeletonLoader } from '../shared/ui/SkeletonLoader';

interface AdminUsersPageProps {
    users: AdminUser[];
    isLoading: boolean;
}

const RoleBadge: React.FC<{ role: AdminUserRole }> = ({ role }) => {
    const styles = {
        [AdminUserRole.SUPER_ADMIN]: 'bg-danger/20 text-danger',
        [AdminUserRole.ADMIN]: 'bg-purple-500/20 text-purple-400',
        [AdminUserRole.MODERATOR]: 'bg-blue-500/20 text-blue-400',
        [AdminUserRole.SUPPORT]: 'bg-success/20 text-success',
    };
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[role]}`}>{role}</span>;
};

const PageSkeleton: React.FC = () => (
    <div className="space-y-6 animate-pulse">
        <div className="flex justify-between items-center">
            <SkeletonLoader className="h-10 w-64" />
        </div>
        <SkeletonLoader className="h-96" />
    </div>
);

export const AdminUsersPage: React.FC<AdminUsersPageProps> = ({ users, isLoading }) => {
    const columns = useMemo<ColumnDefinition<AdminUser>[]>(() => [
        {
            header: 'المستخدم',
            accessor: 'name',
            isSortable: true,
            cell: (user) => (
                <div className="font-bold text-light-text dark:text-dark-text">
                    {user.name}
                    <span className="block font-normal text-xs text-light-text-secondary dark:text-dark-text-secondary">{user.email}</span>
                </div>
            )
        },
        {
            header: 'الدور',
            accessor: 'role',
            isSortable: true,
            cell: (user) => <RoleBadge role={user.role} />
        },
        {
            header: 'اسم العميل',
            accessor: 'tenantName',
            isSortable: true,
        },
        {
            header: 'آخر تسجيل دخول',
            accessor: 'lastLogin',
            isSortable: true,
            cell: (user) => new Date(user.lastLogin).toLocaleString('ar-EG')
        },
        {
            header: '2FA',
            accessor: 'twoFactorEnabled',
            cell: (user) => (
                <span className={`font-bold ${user.twoFactorEnabled ? 'text-success' : 'text-danger'}`}>
                    {user.twoFactorEnabled ? '✅' : '❌'}
                </span>
            )
        },
        {
            header: 'الإجراءات',
            accessor: 'id',
            cell: () => <button className="text-xs text-primary hover:underline">تعديل</button>
        }
    ], []);
    
    if (isLoading && users.length === 0) {
        return <PageSkeleton />;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">إدارة المستخدمين</h1>
            
            <TableComponent<AdminUser>
                columns={columns}
                data={users}
                filterColumn="name"
                filterPlaceholder="ابحث بالاسم أو البريد..."
            />
        </div>
    );
};