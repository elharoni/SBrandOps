// services/integrationsService.ts
// Catalog-only integration metadata.
// Runtime non-social connection state lives in brand_connections via
// brandConnectionService.ts and providerConnectionService.ts.

import { Integration, IntegrationCategory } from '../types';

export const INTEGRATION_CATALOG: Omit<Integration, 'isConnected'>[] = [
    { id: 'slack', name: 'Slack', description: 'إشعارات فورية على قنوات Slack عند نشر محتوى أو وجود تنبيهات.', category: IntegrationCategory.Communication },
    { id: 'whatsapp', name: 'WhatsApp Business', description: 'استقبل رسائل العملاء من WhatsApp مباشرة في صندوق الوارد.', category: IntegrationCategory.Communication },
    { id: 'telegram', name: 'Telegram', description: 'ربط بوت Telegram لإشعارات الفريق وردود الفعل التلقائية.', category: IntegrationCategory.Communication },
    { id: 'mailchimp', name: 'Mailchimp', description: 'مزامنة قوائم البريد الإلكتروني وأتمتة حملات الإيميل.', category: IntegrationCategory.Communication },
    { id: 'zapier', name: 'Zapier', description: 'ربط SBrandOps مع +5000 تطبيق عبر Zapier بدون كود.', category: IntegrationCategory.Communication },
    { id: 'make', name: 'Make (Integromat)', description: 'أتمتة سير العمل المعقدة متعددة الخطوات عبر Make.', category: IntegrationCategory.Communication },
    { id: 'google-drive', name: 'Google Drive', description: 'تخزين ملفات المحتوى والأصول الإبداعية مباشرة على Drive.', category: IntegrationCategory.Storage },
    { id: 'dropbox', name: 'Dropbox', description: 'ربط مكتبة الوسائط مع Dropbox للتخزين السحابي الموحد.', category: IntegrationCategory.Storage },
    { id: 'notion', name: 'Notion', description: 'مزامنة خطط المحتوى وقواعد البيانات مع Notion.', category: IntegrationCategory.Storage },
    { id: 'canva', name: 'Canva', description: 'إنشاء وتعديل تصاميم المنشورات مباشرة من داخل SBrandOps.', category: IntegrationCategory.Design },
    { id: 'adobe-express', name: 'Adobe Express', description: 'استخدم قوالب Adobe Express لتصميم محتوى احترافي بسرعة.', category: IntegrationCategory.Design },
    { id: 'figma', name: 'Figma', description: 'استيراد أصول العلامة التجارية وملفات التصميم من Figma.', category: IntegrationCategory.Design },
    { id: 'google-analytics', name: 'Google Analytics', description: 'ربط بيانات حركة الموقع مع تحليلات المحتوى والإعلانات.', category: IntegrationCategory.Analytics },
    { id: 'meta-pixel', name: 'Meta Pixel', description: 'تتبع تحويلات الإعلانات وبناء جماهير مخصصة على Meta.', category: IntegrationCategory.Analytics },
    { id: 'google-tag-manager', name: 'Google Tag Manager', description: 'إدارة تاغات التتبع بدون كود عبر GTM.', category: IntegrationCategory.Analytics },
    { id: 'hotjar', name: 'Hotjar', description: 'ربط خرائط الحرارة وتحليل سلوك الزوار لتحسين الصفحات.', category: IntegrationCategory.Analytics },
];

export const INTEGRATION_ICONS: Record<string, string> = {
    slack: 'fa-slack',
    whatsapp: 'fa-whatsapp',
    telegram: 'fa-telegram',
    mailchimp: 'fa-envelope-open-text',
    zapier: 'fa-bolt',
    make: 'fa-random',
    'google-drive': 'fa-google-drive',
    dropbox: 'fa-dropbox',
    notion: 'fa-book',
    canva: 'fa-paint-brush',
    'adobe-express': 'fa-adobe',
    figma: 'fa-figma',
    'google-analytics': 'fa-chart-line',
    'meta-pixel': 'fa-facebook-square',
    'google-tag-manager': 'fa-tags',
    hotjar: 'fa-fire',
};

export const CATEGORY_COLORS: Record<string, string> = {
    [IntegrationCategory.Communication]: 'bg-blue-500/10 text-blue-400',
    [IntegrationCategory.Storage]: 'bg-yellow-500/10 text-yellow-400',
    [IntegrationCategory.Design]: 'bg-purple-500/10 text-purple-400',
    [IntegrationCategory.Analytics]: 'bg-green-500/10 text-green-400',
};

export function getCatalogIntegrations(): Integration[] {
    return INTEGRATION_CATALOG.map((integration) => ({
        ...integration,
        isConnected: false,
    }));
}
