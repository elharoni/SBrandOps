// hooks/useAdminData.ts — Custom hook for admin panel data fetching
import { useState, useCallback } from 'react';
import {
    AdminDashboardStats, AdminUser, Tenant, SubscriptionPlanAdmin,
    AIMetric, QueueJob, SystemHealthStatus, ActivityLog,
    AdminPermission, GeneralSettings, SecuritySettings, NotificationType,
    AdminBillingOverview, AdminBillingSubscription, AdminBillingInvoice, AdminBillingEvent, AdminBillingAuditLog,
} from '../types';
import {
    getAdminDashboardStats, getAdminUsers, getAIMetrics, getQueueJobs,
    getSystemHealth, getLatestActivities, getAdminPermissions,
    getGeneralSettings, getSecuritySettings,
} from '../services/adminService';
import { getTenants, getSubscriptionPlans } from '../services/tenantService';
import { getAdminBillingSnapshot } from '../services/billingService';

interface AdminDataState {
    adminStats: AdminDashboardStats | null;
    adminUsers: AdminUser[];
    tenants: Tenant[];
    subscriptionPlans: SubscriptionPlanAdmin[];
    billingOverview: AdminBillingOverview | null;
    billingSubscriptions: AdminBillingSubscription[];
    billingInvoices: AdminBillingInvoice[];
    billingEvents: AdminBillingEvent[];
    billingAuditLogs: AdminBillingAuditLog[];
    aiMetrics: AIMetric[];
    queueJobs: QueueJob[];
    systemHealth: SystemHealthStatus[];
    activityLogs: ActivityLog[];
    adminPermissions: AdminPermission[];
    generalSettings: GeneralSettings | null;
    securitySettings: SecuritySettings | null;
    isLoading: boolean;
}

const initialState: AdminDataState = {
    adminStats: null,
    adminUsers: [],
    tenants: [],
    subscriptionPlans: [],
    billingOverview: null,
    billingSubscriptions: [],
    billingInvoices: [],
    billingEvents: [],
    billingAuditLogs: [],
    aiMetrics: [],
    queueJobs: [],
    systemHealth: [],
    activityLogs: [],
    adminPermissions: [],
    generalSettings: null,
    securitySettings: null,
    isLoading: false,
};

export function useAdminData(
    addNotification: (type: NotificationType, message: string) => void
) {
    const [state, setState] = useState<AdminDataState>(initialState);

    const fetchAdminData = useCallback(async () => {
        setState(prev => ({ ...prev, isLoading: true }));
        try {
            const results = await Promise.allSettled([
                getAdminDashboardStats(),
                getAdminUsers(),
                getTenants(),
                getSubscriptionPlans(),
                getAdminBillingSnapshot(),
                getAIMetrics(),
                getQueueJobs(),
                getSystemHealth(),
                getLatestActivities(),
                getAdminPermissions(),
                getGeneralSettings(),
                getSecuritySettings(),
            ]);

            const [
                statsData, usersData, tenantsData, plansData, billingData,
                metricsData, jobsData, healthData, logsData,
                permsData, genSettingsData, secSettingsData,
            ] = results;

            setState({
                adminStats:        statsData.status === 'fulfilled'      ? statsData.value      : null,
                adminUsers:        usersData.status === 'fulfilled'      ? usersData.value      : [],
                tenants:           tenantsData.status === 'fulfilled'    ? tenantsData.value    : [],
                subscriptionPlans: plansData.status === 'fulfilled'      ? plansData.value      : [],
                billingOverview:   billingData.status === 'fulfilled'    ? billingData.value.overview : null,
                billingSubscriptions: billingData.status === 'fulfilled' ? billingData.value.subscriptions : [],
                billingInvoices:   billingData.status === 'fulfilled'    ? billingData.value.invoices : [],
                billingEvents:     billingData.status === 'fulfilled'    ? billingData.value.webhookEvents : [],
                billingAuditLogs:  billingData.status === 'fulfilled'    ? billingData.value.auditLogs : [],
                aiMetrics:         metricsData.status === 'fulfilled'    ? metricsData.value    : [],
                queueJobs:         jobsData.status === 'fulfilled'       ? jobsData.value       : [],
                systemHealth:      healthData.status === 'fulfilled'     ? healthData.value     : [],
                activityLogs:      logsData.status === 'fulfilled'       ? logsData.value       : [],
                adminPermissions:  permsData.status === 'fulfilled'      ? permsData.value      : [],
                generalSettings:   genSettingsData.status === 'fulfilled'? genSettingsData.value: null,
                securitySettings:  secSettingsData.status === 'fulfilled'? secSettingsData.value: null,
                isLoading: false,
            });
        } catch (error) {
            console.error('fetchAdminData error:', error);
            addNotification(NotificationType.Error, 'Failed to load admin data.');
            setState(prev => ({ ...prev, isLoading: false }));
        }
    }, [addNotification]);

    const refresh = useCallback(() => fetchAdminData(), [fetchAdminData]);

    return { ...state, fetchAdminData, refresh };
}
