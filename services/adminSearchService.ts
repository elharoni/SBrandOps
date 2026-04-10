// services/adminSearchService.ts
import { AdminUser, Tenant, AdminSearchResultGroup, AdminSearchResultItem } from '../types';
import { getAdminUsers } from './adminService';
import { getTenants } from './tenantService';

export async function performAdminSearch(query: string): Promise<AdminSearchResultGroup[]> {
    if (!query) return [];

    const lowerCaseQuery = query.toLowerCase();
    
    // In a real app, these would be separate, optimized API calls.
    // For this mock, we fetch them once.
    const [users, tenants] = await Promise.all([getAdminUsers(), getTenants()]);

    const userResults: AdminSearchResultItem[] = users
        .filter(user => user.name.toLowerCase().includes(lowerCaseQuery) || user.email.toLowerCase().includes(lowerCaseQuery))
        .map(user => ({
            id: user.id,
            label: user.name,
            description: `User • ${user.email}`,
            type: 'User',
            navTarget: 'admin-users'
        }));

    const tenantResults: AdminSearchResultItem[] = tenants
        .filter(tenant => tenant.name.toLowerCase().includes(lowerCaseQuery))
        .map(tenant => ({
            id: tenant.id,
            label: tenant.name,
            description: `Tenant • Plan: ${tenant.plan}`,
            type: 'Tenant',
            navTarget: 'admin-tenants'
        }));
        
    const results: AdminSearchResultGroup[] = [];
    if (tenantResults.length > 0) {
        results.push({ title: 'Tenants', items: tenantResults });
    }
    if (userResults.length > 0) {
        results.push({ title: 'Users', items: userResults });
    }

    return results;
}