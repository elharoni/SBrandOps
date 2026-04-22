import React, { lazy } from 'react';
import { NotificationType } from '../../types';

const AdminDashboardPage    = lazy(() => import('../admin/pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const AdminUsersPage        = lazy(() => import('../admin/pages/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const TenantsPage           = lazy(() => import('../admin/pages/TenantsPage').then(m => ({ default: m.TenantsPage })));
const BillingPage           = lazy(() => import('../admin/pages/BillingPage').then(m => ({ default: m.BillingPage })));
const AIMonitorPage         = lazy(() => import('../admin/pages/AIMonitorPage').then(m => ({ default: m.AIMonitorPage })));
const QueuesPage            = lazy(() => import('../admin/pages/QueuesPage').then(m => ({ default: m.QueuesPage })));
const AdminSettingsPage     = lazy(() => import('../admin/pages/AdminSettingsPage').then(m => ({ default: m.AdminSettingsPage })));
const SystemHealthPage      = lazy(() => import('../admin/pages/SystemHealthPage').then(m => ({ default: m.SystemHealthPage })));
const AIProviderKeysPage    = lazy(() => import('../admin/pages/AIProviderKeysPage').then(m => ({ default: m.AIProviderKeysPage })));
const AdminLogsPage         = lazy(() => import('../admin/pages/AdminLogsPage').then(m => ({ default: m.AdminLogsPage })));
const AdminDataAnalyticsPage = lazy(() => import('../admin/pages/AdminDataAnalyticsPage').then(m => ({ default: m.AdminDataAnalyticsPage })));

export interface AdminRouterProps {
    activePage: string;
    adminStats: any;
    adminUsers: any[];
    tenants: any[];
    subscriptionPlans: any[];
    billingOverview: any;
    billingSubscriptions: any[];
    billingInvoices: any[];
    billingEvents: any[];
    billingAuditLogs: any[];
    aiMetrics: any[];
    queueJobs: any[];
    systemHealth: any[];
    activityLogs: any[];
    adminPermissions: any;
    generalSettings: any;
    securitySettings: any;
    isLoading: boolean;
    addNotification: (type: NotificationType, message: string) => void;
    onRefresh: () => Promise<void>;
}

export const AdminRouter: React.FC<AdminRouterProps> = ({
    activePage,
    adminStats, adminUsers, tenants, subscriptionPlans,
    billingOverview, billingSubscriptions, billingInvoices, billingEvents, billingAuditLogs,
    aiMetrics, queueJobs, systemHealth, activityLogs,
    adminPermissions, generalSettings, securitySettings,
    isLoading, addNotification, onRefresh,
}) => {
    switch (activePage) {
        case 'admin-dashboard':
            return <AdminDashboardPage stats={adminStats} activityLogs={activityLogs} />;
        case 'admin-users':
            return <AdminUsersPage users={adminUsers} isLoading={isLoading} addNotification={addNotification} onRefresh={onRefresh} />;
        case 'admin-tenants':
            return <TenantsPage tenants={tenants} isLoading={isLoading} plans={subscriptionPlans} addNotification={addNotification} onRefresh={onRefresh} />;
        case 'admin-billing':
            return (
                <BillingPage
                    plans={subscriptionPlans}
                    overview={billingOverview}
                    subscriptions={billingSubscriptions}
                    invoices={billingInvoices}
                    webhookEvents={billingEvents}
                    auditLogs={billingAuditLogs}
                    isLoading={isLoading}
                    onRefreshBilling={onRefresh}
                    addNotification={addNotification}
                />
            );
        case 'admin-ai-monitor':
            return <AIMonitorPage metrics={aiMetrics} isLoading={isLoading} />;
        case 'admin-queues':
            return <QueuesPage jobs={queueJobs} isLoading={isLoading} />;
        case 'admin-system-health':
            return <SystemHealthPage healthData={systemHealth} isLoading={isLoading} />;
        case 'admin-settings':
            return (
                <AdminSettingsPage
                    permissions={adminPermissions}
                    generalSettings={generalSettings}
                    securitySettings={securitySettings}
                    isLoading={isLoading}
                    addNotification={addNotification}
                />
            );
        case 'admin-ai-keys':   return <AIProviderKeysPage />;
        case 'admin-logs':      return <AdminLogsPage />;
        case 'admin-data-analytics': return <AdminDataAnalyticsPage />;
        default:
            return <div>Admin page not found: {activePage}</div>;
    }
};
