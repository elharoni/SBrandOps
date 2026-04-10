import React, { useState, useEffect, useCallback } from 'react';
import {
    CrmAutomation, CrmAutomationTrigger, CrmAutomationAction, CrmLifecycleStage,
} from '../../../types';
import {
    getAutomations, createAutomation, toggleAutomation, deleteAutomation, LIFECYCLE_STAGE_CONFIG,
} from '../../../services/crmService';

// ── Constants ──────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<CrmAutomationTrigger, { label: string; icon: string; color: string }> = {
    [CrmAutomationTrigger.CustomerCreated]:              { label: 'تسجيل عميل جديد',          icon: 'fa-user-plus',          color: 'text-blue-600' },
    [CrmAutomationTrigger.OrderCreated]:                 { label: 'طلب جديد',                 icon: 'fa-shopping-bag',       color: 'text-green-600' },
    [CrmAutomationTrigger.FirstOrderCompleted]:          { label: 'أول طلب مكتمل',            icon: 'fa-check-circle',       color: 'text-emerald-600' },
    [CrmAutomationTrigger.OrderCancelled]:               { label: 'إلغاء طلب',                icon: 'fa-times-circle',       color: 'text-red-600' },
    [CrmAutomationTrigger.RefundCreated]:                { label: 'استرداد طلب',              icon: 'fa-undo',               color: 'text-orange-600' },
    [CrmAutomationTrigger.CustomerInactive30d]:          { label: 'عميل غائب 30 يومًا',       icon: 'fa-clock',              color: 'text-yellow-600' },
    [CrmAutomationTrigger.CustomerInactive60d]:          { label: 'عميل غائب 60 يومًا',       icon: 'fa-clock',              color: 'text-orange-600' },
    [CrmAutomationTrigger.CustomerInactive90d]:          { label: 'عميل غائب 90 يومًا',       icon: 'fa-clock',              color: 'text-red-600' },
    [CrmAutomationTrigger.CustomerSpentOverThreshold]:   { label: 'تجاوز عتبة الإنفاق',       icon: 'fa-dollar-sign',        color: 'text-amber-600' },
    [CrmAutomationTrigger.CustomerTagAdded]:             { label: 'إضافة تاج للعميل',         icon: 'fa-tag',                color: 'text-purple-600' },
    [CrmAutomationTrigger.VipCustomerDetected]:          { label: 'تحديد عميل VIP',           icon: 'fa-crown',              color: 'text-amber-500' },
};

const ACTION_TYPES: { value: CrmAutomationAction['type']; label: string; icon: string }[] = [
    { value: 'create_task',                  label: 'إنشاء مهمة',                icon: 'fa-tasks' },
    { value: 'send_internal_notification',   label: 'إرسال إشعار داخلي',         icon: 'fa-bell' },
    { value: 'add_tag',                      label: 'إضافة تاج',                  icon: 'fa-tag' },
    { value: 'assign_owner',                 label: 'تعيين مسؤول',               icon: 'fa-user-tie' },
    { value: 'move_lifecycle_stage',         label: 'تغيير مرحلة العميل',        icon: 'fa-exchange-alt' },
    { value: 'send_to_campaign_audience',    label: 'إضافة لجمهور الحملة',       icon: 'fa-bullhorn' },
    { value: 'create_support_followup',      label: 'إنشاء متابعة دعم',          icon: 'fa-headset' },
];

// ── Automation Card ───────────────────────────────────────────────────────────

const AutomationCard: React.FC<{
    automation: CrmAutomation;
    onToggle: (id: string, active: boolean) => void;
    onDelete: (id: string) => void;
}> = ({ automation, onToggle, onDelete }) => {
    const trigger = TRIGGER_LABELS[automation.triggerType];
    return (
        <div className={`bg-white border rounded-xl p-4 transition-opacity ${automation.isActive ? '' : 'opacity-60'}`}>
            <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${automation.isActive ? 'bg-indigo-50' : 'bg-gray-100'}`}>
                    <i className={`fas ${trigger?.icon ?? 'fa-bolt'} ${trigger?.color ?? 'text-gray-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 text-sm">{automation.name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${automation.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {automation.isActive ? 'نشط' : 'موقوف'}
                        </span>
                    </div>
                    {automation.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{automation.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {/* Trigger */}
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            <i className="fas fa-bolt text-xs" />
                            {trigger?.label ?? automation.triggerType}
                        </span>
                        {/* Actions */}
                        {automation.actions.slice(0, 2).map((action, i) => {
                            const actionDef = ACTION_TYPES.find(a => a.value === action.type);
                            return (
                                <span key={i} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                                    <i className={`fas ${actionDef?.icon ?? 'fa-play'} text-xs`} />
                                    {actionDef?.label ?? action.type}
                                </span>
                            );
                        })}
                        {automation.actions.length > 2 && (
                            <span className="text-xs text-gray-400">+{automation.actions.length - 2} أخرى</span>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <i className="fas fa-play-circle" />
                    <span>تشغيل {automation.runCount} مرة</span>
                    {automation.lastRunAt && (
                        <span>· آخر تشغيل: {new Date(automation.lastRunAt).toLocaleDateString('ar-SA')}</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onToggle(automation.id, !automation.isActive)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${automation.isActive ? 'bg-indigo-600' : 'bg-gray-300'}`}
                    >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${automation.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <button onClick={() => onDelete(automation.id)} className="p-1 text-gray-300 hover:text-red-500">
                        <i className="fas fa-trash text-xs" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── New Automation Drawer ─────────────────────────────────────────────────────

interface NewAutomationDrawerProps {
    brandId: string;
    onSave: () => void;
    onClose: () => void;
}

type DraftAction = { type: CrmAutomationAction['type']; config: Record<string, string> };

const NewAutomationDrawer: React.FC<NewAutomationDrawerProps> = ({ brandId, onSave, onClose }) => {
    const [name, setName]           = useState('');
    const [desc, setDesc]           = useState('');
    const [trigger, setTrigger]     = useState<CrmAutomationTrigger | ''>('');
    const [triggerCfg, setTriggerCfg] = useState<Record<string, string>>({});
    const [actions, setActions]     = useState<DraftAction[]>([]);
    const [saving, setSaving]       = useState(false);

    const addAction = () => setActions(a => [...a, { type: 'create_task', config: {} }]);
    const removeAction = (i: number) => setActions(a => a.filter((_, idx) => idx !== i));
    const updateAction = (i: number, updates: Partial<DraftAction>) =>
        setActions(a => a.map((x, idx) => idx === i ? { ...x, ...updates } : x));

    const handleSave = async () => {
        if (!name || !trigger || actions.length === 0) return;
        setSaving(true);
        await createAutomation(brandId, {
            name, description: desc, isActive: true,
            triggerType: trigger as CrmAutomationTrigger,
            triggerConfig: triggerCfg,
            actions: actions.map(a => ({ type: a.type, config: a.config })),
        });
        setSaving(false);
        onSave();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={onClose} />
            <div className="relative w-96 bg-white h-full shadow-2xl overflow-y-auto p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">أتمتة جديدة</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times" /></button>
                </div>

                <div className="space-y-3">
                    <input type="text" value={name} onChange={e => setName(e.target.value)}
                        placeholder="اسم الأتمتة *"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
                        placeholder="الوصف (اختياري)"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                {/* Trigger */}
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                        <i className="fas fa-bolt mr-1 text-yellow-500" />المحفّز (Trigger)
                    </label>
                    <select value={trigger} onChange={e => { setTrigger(e.target.value as CrmAutomationTrigger); setTriggerCfg({}); }}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700">
                        <option value="" disabled>اختر المحفّز</option>
                        {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>
                    {/* Trigger-specific config */}
                    {trigger === CrmAutomationTrigger.CustomerSpentOverThreshold && (
                        <div className="mt-2">
                            <label className="text-xs text-gray-500 mb-1 block">عتبة الإنفاق (ريال)</label>
                            <input type="number" value={triggerCfg.threshold ?? ''} placeholder="5000"
                                onChange={e => setTriggerCfg(c => ({ ...c, threshold: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                            />
                        </div>
                    )}
                    {trigger === CrmAutomationTrigger.CustomerTagAdded && (
                        <div className="mt-2">
                            <label className="text-xs text-gray-500 mb-1 block">اسم التاج</label>
                            <input type="text" value={triggerCfg.tagName ?? ''} placeholder="VIP"
                                onChange={e => setTriggerCfg(c => ({ ...c, tagName: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                            />
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-600">
                            <i className="fas fa-play mr-1 text-indigo-500" />الإجراءات
                        </label>
                        <button onClick={addAction} className="text-xs text-indigo-600 hover:text-indigo-800">
                            <i className="fas fa-plus" /> إضافة
                        </button>
                    </div>
                    <div className="space-y-2">
                        {actions.map((action, i) => (
                            <div key={i} className="bg-gray-50 rounded-lg p-2 space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <select value={action.type} onChange={e => updateAction(i, { type: e.target.value as CrmAutomationAction['type'], config: {} })}
                                        className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs text-gray-700">
                                        {ACTION_TYPES.map(at => <option key={at.value} value={at.value}>{at.label}</option>)}
                                    </select>
                                    <button onClick={() => removeAction(i)} className="text-gray-400 hover:text-red-500 p-0.5">
                                        <i className="fas fa-times text-xs" />
                                    </button>
                                </div>
                                {/* Action-specific config */}
                                {action.type === 'create_task' && (
                                    <input type="text" value={action.config.title ?? ''} placeholder="عنوان المهمة"
                                        onChange={e => updateAction(i, { config: { ...action.config, title: e.target.value } })}
                                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs"
                                    />
                                )}
                                {action.type === 'move_lifecycle_stage' && (
                                    <select value={action.config.stage ?? ''} onChange={e => updateAction(i, { config: { ...action.config, stage: e.target.value } })}
                                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-700">
                                        <option value="" disabled>اختر المرحلة</option>
                                        {Object.values(CrmLifecycleStage).map(s => (
                                            <option key={s} value={s}>{LIFECYCLE_STAGE_CONFIG[s].labelAr}</option>
                                        ))}
                                    </select>
                                )}
                                {action.type === 'add_tag' && (
                                    <input type="text" value={action.config.tagName ?? ''} placeholder="اسم التاج"
                                        onChange={e => updateAction(i, { config: { ...action.config, tagName: e.target.value } })}
                                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs"
                                    />
                                )}
                                {action.type === 'send_internal_notification' && (
                                    <input type="text" value={action.config.message ?? ''} placeholder="نص الإشعار"
                                        onChange={e => updateAction(i, { config: { ...action.config, message: e.target.value } })}
                                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs"
                                    />
                                )}
                            </div>
                        ))}
                        {actions.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-2">أضف إجراءً واحدًا على الأقل</p>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving || !name || !trigger || actions.length === 0}
                    className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {saving ? <i className="fas fa-circle-notch fa-spin" /> : null}
                    حفظ الأتمتة
                </button>
            </div>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

interface CrmAutomationsPageProps { brandId: string }

export const CrmAutomationsPage: React.FC<CrmAutomationsPageProps> = ({ brandId }) => {
    const [automations, setAutomations] = useState<CrmAutomation[]>([]);
    const [loading, setLoading]         = useState(true);
    const [showNew, setShowNew]         = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setAutomations(await getAutomations(brandId));
        setLoading(false);
    }, [brandId]);

    useEffect(() => { void load(); }, [load]);

    const handleToggle = async (id: string, active: boolean) => {
        await toggleAutomation(brandId, id, active);
        void load();
    };

    const handleDelete = async (id: string) => {
        await deleteAutomation(brandId, id);
        void load();
    };

    const activeCount = automations.filter(a => a.isActive).length;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">أتمتة CRM</h1>
                    <p className="text-sm text-gray-500">{activeCount} نشطة من {automations.length}</p>
                </div>
                <button onClick={() => setShowNew(true)}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 flex items-center gap-1.5">
                    <i className="fas fa-plus text-xs" /> أتمتة جديدة
                </button>
            </div>

            {/* Info banner */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2">
                <i className="fas fa-info-circle mt-0.5 flex-shrink-0" />
                <p>الأتمتة تعمل عبر Workflow Engine. كل محفّز يتحقق عند حدوث الحدث ويُطلق الإجراءات بالترتيب.</p>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : automations.length === 0 ? (
                <div className="text-center py-16">
                    <i className="fas fa-robot text-4xl text-gray-200 mb-3 block" />
                    <p className="text-gray-500 mb-1">لا توجد أتمتة حتى الآن</p>
                    <p className="text-xs text-gray-400">أنشئ أول أتمتة لتوفير وقت فريق المبيعات</p>
                    <button onClick={() => setShowNew(true)}
                        className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                        إنشاء أتمتة
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {automations.map(a => (
                        <AutomationCard key={a.id} automation={a} onToggle={handleToggle} onDelete={handleDelete} />
                    ))}
                </div>
            )}

            {showNew && <NewAutomationDrawer brandId={brandId} onSave={load} onClose={() => setShowNew(false)} />}
        </div>
    );
};
