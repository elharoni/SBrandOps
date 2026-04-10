/**
 * CRM Hub Page — entry point for the Customer Hub module.
 * Sub-pages are lazy-loaded to keep the base CRM shell light.
 */
import React, { Suspense, lazy, useMemo, useState } from 'react';
import { PageScaffold, PageSection } from '../shared/PageScaffold';
import type { BrandAsset, BrandConnection } from '../../services/brandConnectionService';

const CrmDashboardPage = lazy(() => import('./crm/CrmDashboardPage').then((module) => ({ default: module.CrmDashboardPage })));
const CrmPipelinePage = lazy(() => import('./crm/CrmPipelinePage').then((module) => ({ default: module.CrmPipelinePage })));
const CustomersPage = lazy(() => import('./crm/CustomersPage').then((module) => ({ default: module.CustomersPage })));
const CustomerProfilePage = lazy(() => import('./crm/CustomerProfilePage').then((module) => ({ default: module.CustomerProfilePage })));
const CrmTicketsPage = lazy(() => import('./crm/CrmTicketsPage').then((module) => ({ default: module.CrmTicketsPage })));
const CrmOrdersPage = lazy(() => import('./crm/CrmOrdersPage').then((module) => ({ default: module.CrmOrdersPage })));
const CrmSegmentsPage = lazy(() => import('./crm/CrmSegmentsPage').then((module) => ({ default: module.CrmSegmentsPage })));
const CrmAutomationsPage = lazy(() => import('./crm/CrmAutomationsPage').then((module) => ({ default: module.CrmAutomationsPage })));
const CrmIntegrationsPage = lazy(() => import('./crm/CrmIntegrationsPage').then((module) => ({ default: module.CrmIntegrationsPage })));
const CrmRolesPage = lazy(() => import('./crm/CrmRolesPage').then((module) => ({ default: module.CrmRolesPage })));
const CrmAnalyticsPage = lazy(() => import('./crm/CrmAnalyticsPage').then((module) => ({ default: module.CrmAnalyticsPage })));

type CrmSubPage =
    | 'dashboard'
    | 'pipeline'
    | 'customers'
    | 'customer-profile'
    | 'tickets'
    | 'orders'
    | 'segments'
    | 'automations'
    | 'integrations'
    | 'roles'
    | 'analytics';

// Grouping navigation visually
const NAVIGATION_GROUPS = [
    {
        name: 'Sales & Growth',
        items: [
            { id: 'dashboard' as CrmSubPage, label: 'لوحة التحكم', icon: 'fa-chart-pie', description: 'صورة تشغيلية سريعة لحالة المبيعات.' },
            { id: 'pipeline' as CrmSubPage, label: 'مسار المبيعات', icon: 'fa-funnel-dollar', description: 'نظام إدارة فرص البيع والصفقات (Kanban).' },
            { id: 'customers' as CrmSubPage, label: 'قاعدة العملاء', icon: 'fa-users', description: 'بحث، فلترة، وعمليات جماعية على قاعدة العملاء.' },
        ]
    },
    {
        name: 'Operations & Support',
        items: [
            { id: 'orders' as CrmSubPage, label: 'الطلبات', icon: 'fa-shopping-bag', description: 'تتبع الطلبات، الدفع، وحالة التوصيل.' },
            { id: 'tickets' as CrmSubPage, label: 'الدعم الفني', icon: 'fa-life-ring', description: 'إدارة التذاكر وحل مشكلات العملاء.' },
        ]
    },
    {
        name: 'Marketing & Intelligence',
        items: [
            { id: 'segments' as CrmSubPage, label: 'الشرائح', icon: 'fa-layer-group', description: 'بناء جماهير ديناميكية للتسويق الموجه.' },
            { id: 'analytics' as CrmSubPage, label: 'تحليلات', icon: 'fa-chart-line', description: 'قراءة القيمة، الاحتفاظ، وربحية العملاء.' },
        ]
    },
    {
        name: 'Settings',
        items: [
            { id: 'automations' as CrmSubPage, label: 'الأتمتة', icon: 'fa-robot', description: 'تشغيل إجراءات متكررة تلقائياً.' },
            { id: 'integrations' as CrmSubPage, label: 'التكاملات', icon: 'fa-plug', description: 'ربط المتاجر وأنظمة الدفع.' },
            { id: 'roles' as CrmSubPage, label: 'الصلاحيات', icon: 'fa-shield-alt', description: 'فرق العمل والأدوار.' },
        ]
    }
];

const CRM_NAV = NAVIGATION_GROUPS.flatMap(g => g.items);

export interface CrmPageProps {
    brandId: string;
    brandConnections: BrandConnection[];
    brandAssets: BrandAsset | null;
    onNavigate: (page: string) => void;
}

const CrmLoadingState: React.FC = () => (
    <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-[1.35rem] bg-light-bg dark:bg-dark-bg" />
            ))}
        </div>
        <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-2xl bg-light-bg dark:bg-dark-bg" />
            ))}
        </div>
    </div>
);

export const CrmPage: React.FC<CrmPageProps> = ({ brandId, brandConnections, brandAssets, onNavigate }) => {
    const [subPage, setSubPage] = useState<CrmSubPage>('dashboard');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

    const activePage = useMemo(
        () => CRM_NAV.find((item) => item.id === (subPage === 'customer-profile' ? 'customers' : subPage)) ?? CRM_NAV[0],
        [subPage]
    );

    const handleViewCustomer = (customerId: string) => {
        setSelectedCustomerId(customerId);
        setSubPage('customer-profile');
    };

    const handleBackToCustomers = () => {
        setSelectedCustomerId(null);
        setSubPage('customers');
    };

    const handleNavigate = (page: string) => {
        if (!page.startsWith('crm/')) return;
        const nextPage = page.replace('crm/', '') as CrmSubPage;
        setSubPage(nextPage);
    };

    const renderActivePage = () => {
        switch (subPage) {
            case 'dashboard':
                return <CrmDashboardPage brandId={brandId} onNavigate={handleNavigate} />;
            case 'pipeline':
                return <CrmPipelinePage brandId={brandId} />;
            case 'customers':
                return <CustomersPage brandId={brandId} onViewCustomer={handleViewCustomer} />;
            case 'customer-profile':
                return selectedCustomerId ? (
                    <CustomerProfilePage brandId={brandId} customerId={selectedCustomerId} onBack={handleBackToCustomers} />
                ) : (
                    <CustomersPage brandId={brandId} onViewCustomer={handleViewCustomer} />
                );
            case 'tickets':
                return <CrmTicketsPage brandId={brandId} />;
            case 'orders':
                return <CrmOrdersPage brandId={brandId} />;
            case 'segments':
                return <CrmSegmentsPage brandId={brandId} />;
            case 'automations':
                return <CrmAutomationsPage brandId={brandId} />;
            case 'integrations':
                return (
                    <CrmIntegrationsPage
                        brandId={brandId}
                        brandConnections={brandConnections}
                        brandAssets={brandAssets}
                        onNavigate={onNavigate}
                    />
                );
            case 'analytics':
                return <CrmAnalyticsPage brandId={brandId} />;
            case 'roles':
                return <CrmRolesPage brandId={brandId} />;
            default:
                return null;
        }
    };

    return (
        <PageScaffold
            kicker="Customer Hub"
            title="CRM & Customer Operations"
            description="إدارة العملاء، الطلبات، الشرائح، والأتمتة من مساحة واحدة أخف وأوضح تشغيليًا."
            stats={[
                { label: 'الوحدة النشطة', value: activePage.label, tone: 'text-brand-primary' },
                { label: 'الوحدات الجاهزة', value: `${CRM_NAV.length}` },
                { label: 'الوضع', value: subPage === 'customer-profile' ? 'ملف عميل' : 'تشغيل مباشر' },
            ]}
        >
            <PageSection
                title={activePage.label}
                description={activePage.description}
                className="overflow-hidden"
            >
                <div className="mb-6 overflow-x-auto pb-2">
                    <nav className="flex min-w-max items-center gap-6 border-b border-light-border/40 dark:border-dark-border/40 pb-2">
                        {NAVIGATION_GROUPS.map((group) => (
                            <div key={group.name} className="flex items-center gap-2">
                                <div className="hidden text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary/60 dark:text-dark-text-secondary/60 xl:block me-2">
                                    {group.name}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {group.items.map((item) => {
                                        const isActive = subPage === item.id || (subPage === 'customer-profile' && item.id === 'customers');
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => {
                                                    setSubPage(item.id);
                                                    if (item.id !== 'customer-profile') setSelectedCustomerId(null);
                                                }}
                                                className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all active:scale-95 ${
                                                    isActive
                                                        ? 'bg-brand-primary/10 text-brand-primary ring-1 ring-brand-primary/30 shadow-inner'
                                                        : 'text-light-text-secondary hover:bg-light-bg hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-dark-bg/60 dark:hover:text-dark-text'
                                                }`}
                                            >
                                                <i className={`fas ${item.icon} text-xs`} />
                                                {item.label}
                                                {isActive && (
                                                    <span className="absolute -bottom-2.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-brand-primary" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                {/* Divider between groups */}
                                <div className="h-6 w-px bg-light-border dark:bg-dark-border ms-4 last:hidden" />
                            </div>
                        ))}
                    </nav>
                </div>

                <Suspense fallback={<CrmLoadingState />}>
                    {renderActivePage()}
                </Suspense>
            </PageSection>
        </PageScaffold>
    );
};
