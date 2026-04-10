import React, { useState, useCallback } from 'react';
import { Workflow, NotificationType } from '../../types';
import { createWorkflow, updateWorkflow, deleteWorkflow, toggleWorkflowActive } from '../../services/workflowService';

interface WorkflowPageProps {
    initialWorkflows: Workflow[];
    addNotification?: (type: NotificationType, message: string) => void;
}

// ── Trigger options ───────────────────────────────────────────────────────────
const TRIGGER_OPTIONS = [
    { value: 'manual',            label: 'يدوي (تشغيل يدوي)', icon: 'fa-hand-pointer' },
    { value: 'post_scheduled',    label: 'عند جدولة منشور',   icon: 'fa-calendar-plus' },
    { value: 'post_published',    label: 'عند نشر منشور',     icon: 'fa-paper-plane' },
    { value: 'content_approved',  label: 'عند موافقة محتوى',  icon: 'fa-check-double' },
];

// ── Empty form ────────────────────────────────────────────────────────────────
const emptyForm = () => ({
    name: '',
    description: '',
    trigger: 'manual',
    steps: [] as Workflow['steps'],
});

// ── Trigger badge color ───────────────────────────────────────────────────────
const triggerColor = (trigger: string) => {
    switch (trigger) {
        case 'post_published':   return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
        case 'post_scheduled':   return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
        case 'content_approved': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
        default:                 return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
};

// ── Component ─────────────────────────────────────────────────────────────────
export const WorkflowPage: React.FC<WorkflowPageProps> = ({ initialWorkflows, addNotification }) => {
    const [workflows, setWorkflows] = useState<Workflow[]>(initialWorkflows);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm());
    const [isSaving, setIsSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'active' | 'all' | 'notifications' | 'dependencies'>('all');

    // Derived state
    const brandId = ''; // Will be injected via brand context in Phase 2 refactor

    const activeCount  = workflows.filter(w => w.steps?.length > 0).length;
    const triggerLabel = (t: string) => TRIGGER_OPTIONS.find(o => o.value === t)?.label || t;

    const notify = useCallback((type: NotificationType, msg: string) => {
        addNotification?.(type, msg);
    }, [addNotification]);

    // ── Modal helpers ───────────────────────────────────────────────────────
    const openCreateModal = () => {
        setEditingId(null);
        setForm(emptyForm());
        setShowModal(true);
    };

    const openEditModal = (wf: Workflow) => {
        setEditingId(wf.id);
        setForm({ name: wf.name, description: wf.description, trigger: wf.trigger, steps: wf.steps });
        setShowModal(true);
    };

    const closeModal = () => { setShowModal(false); setEditingId(null); };

    // ── Step management ─────────────────────────────────────────────────────
    const addStep = () => {
        setForm(prev => ({
            ...prev,
            steps: [...prev.steps, {
                id: crypto.randomUUID(),
                name: `خطوة ${prev.steps.length + 1}`,
                type: 'approval',
                tasks: [],
            }],
        }));
    };

    const removeStep = (stepId: string) => {
        setForm(prev => ({ ...prev, steps: prev.steps.filter(s => s.id !== stepId) }));
    };

    const updateStep = (stepId: string, field: string, value: any) => {
        setForm(prev => ({
            ...prev,
            steps: prev.steps.map(s => s.id === stepId ? { ...s, [field]: value } : s),
        }));
    };

    // ── Save ────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!form.name.trim()) {
            notify(NotificationType.Warning, 'اسم الـ workflow مطلوب');
            return;
        }
        setIsSaving(true);
        try {
            if (editingId) {
                const updated = await updateWorkflow(brandId, editingId, form);
                setWorkflows(prev => prev.map(w => w.id === editingId ? updated : w));
                notify(NotificationType.Success, `تم تحديث "${updated.name}" بنجاح`);
            } else {
                const created = await createWorkflow(brandId, form as Omit<Workflow, 'id'>);
                setWorkflows(prev => [created, ...prev]);
                notify(NotificationType.Success, `تم إنشاء "${created.name}" بنجاح`);
            }
            closeModal();
        } catch (err: any) {
            notify(NotificationType.Error, err.message || 'فشل الحفظ');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Delete ──────────────────────────────────────────────────────────────
    const handleDelete = async (wf: Workflow) => {
        try {
            await deleteWorkflow(brandId, wf.id);
            setWorkflows(prev => prev.filter(w => w.id !== wf.id));
            notify(NotificationType.Success, `تم حذف "${wf.name}"`);
        } catch (err: any) {
            notify(NotificationType.Error, err.message || 'فشل الحذف');
        } finally {
            setDeleteConfirm(null);
        }
    };

    // ── Toggle ──────────────────────────────────────────────────────────────
    const handleToggle = async (wf: Workflow) => {
        const newState = !(wf.steps?.length > 0);
        try {
            await toggleWorkflowActive(brandId, wf.id, newState);
            notify(NotificationType.Info, `${wf.name}: ${newState ? 'تم التفعيل' : 'تم الإيقاف'}`);
        } catch (_) { /* silent */ }
    };

    const displayedWorkflows = activeTab === 'active'
        ? workflows.filter(w => w.steps?.length > 0)
        : workflows;

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">سير العمل والأتمتة</h1>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                        أتمتة عمليات الموافقة والنشر والإشعارات
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-xl font-bold text-sm hover:bg-brand-primary/90 transition-all shadow-md shadow-brand-primary/20"
                >
                    <i className="fas fa-plus"></i>
                    <span>إنشاء Workflow جديد</span>
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'إجمالي الـ Workflows', value: workflows.length, icon: 'fa-sitemap', color: 'text-brand-primary' },
                    { label: 'فعّال', value: activeCount, icon: 'fa-play-circle', color: 'text-green-500' },
                    { label: 'موقف', value: workflows.length - activeCount, icon: 'fa-pause-circle', color: 'text-yellow-500' },
                    { label: 'إجمالي الخطوات', value: workflows.reduce((sum, w) => sum + (w.steps?.length || 0), 0), icon: 'fa-list-ol', color: 'text-blue-500' },
                ].map(stat => (
                    <div key={stat.label} className="bg-light-card dark:bg-dark-card rounded-xl p-4 border border-light-border dark:border-dark-border">
                        <div className="flex items-center gap-2 mb-1">
                            <i className={`fas ${stat.icon} ${stat.color} text-sm`}></i>
                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{stat.label}</span>
                        </div>
                        <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-light-border dark:border-dark-border overflow-x-auto">
                {[
                    { id: 'all',           label: `الكل (${workflows.length})`,    icon: 'fa-list' },
                    { id: 'active',        label: `الفعّالة (${activeCount})`,      icon: 'fa-bolt' },
                    { id: 'notifications', label: 'إعدادات الإشعارات',             icon: 'fa-bell' },
                    { id: 'dependencies',  label: 'تبعيات المهام',                icon: 'fa-sitemap' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as 'active' | 'all' | 'notifications' | 'dependencies')}
                        className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${activeTab === tab.id
                            ? 'border-brand-primary text-brand-primary'
                            : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                    ><i className={`fas ${tab.icon} text-xs`} />{tab.label}</button>
                ))}
            </div>

            {/* Workflow List */}
            {displayedWorkflows.length === 0 ? (
                <div className="text-center py-16 bg-light-card dark:bg-dark-card rounded-2xl border border-dashed border-light-border dark:border-dark-border">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
                        <i className="fas fa-sitemap text-brand-primary text-2xl"></i>
                    </div>
                    <p className="text-light-text dark:text-dark-text font-bold text-lg mb-1">لا توجد Workflows بعد</p>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm mb-4">أنشئ أول workflow لأتمتة عمليات البراند</p>
                    <button
                        onClick={openCreateModal}
                        className="px-5 py-2 bg-brand-primary text-white rounded-xl font-bold text-sm hover:bg-brand-primary/90 transition"
                    >إنشاء Workflow</button>
                </div>
            ) : (
                <div className="space-y-3">
                    {displayedWorkflows.map(wf => (
                        <div key={wf.id} className="bg-light-card dark:bg-dark-card rounded-xl border border-light-border dark:border-dark-border p-5 hover:border-brand-primary/30 transition-all">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <i className="fas fa-sitemap text-brand-primary text-sm"></i>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-bold text-light-text dark:text-dark-text">{wf.name}</h3>
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${triggerColor(wf.trigger)}`}>
                                                {triggerLabel(wf.trigger)}
                                            </span>
                                        </div>
                                        {wf.description && (
                                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">{wf.description}</p>
                                        )}
                                        <div className="flex items-center gap-4 mt-3">
                                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                <i className="fas fa-list-ol me-1"></i>
                                                {wf.steps?.length || 0} خطوات
                                            </span>
                                        </div>
                                        {/* Steps preview */}
                                        {wf.steps && wf.steps.length > 0 && (
                                            <div className="flex items-center gap-1 mt-3 flex-wrap">
                                                {wf.steps.map((step, idx) => (
                                                    <React.Fragment key={step.id}>
                                                        <span className="text-xs bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border px-2 py-1 rounded-lg text-light-text dark:text-dark-text">
                                                            {step.name}
                                                        </span>
                                                        {idx < wf.steps.length - 1 && (
                                                            <i className="fas fa-chevron-right text-[10px] text-light-text-secondary dark:text-dark-text-secondary"></i>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => openEditModal(wf)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary hover:bg-brand-primary/10 transition"
                                        title="تعديل"
                                    ><i className="fas fa-pen text-xs"></i></button>
                                    <button
                                        onClick={() => setDeleteConfirm(wf.id)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                                        title="حذف"
                                    ><i className="fas fa-trash text-xs"></i></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── WFL-1: Notification Settings ─────────────────────────────── */}
            {activeTab === 'notifications' && (() => {
                const NOTIF_EVENTS = [
                    { key: 'post_published',   label: 'نشر منشور',               icon: 'fa-paper-plane', category: 'المحتوى' },
                    { key: 'post_scheduled',   label: 'جدولة منشور',             icon: 'fa-calendar-plus', category: 'المحتوى' },
                    { key: 'content_approved', label: 'موافقة على محتوى',        icon: 'fa-check-double', category: 'المحتوى' },
                    { key: 'content_rejected', label: 'رفض محتوى',               icon: 'fa-times-circle', category: 'المحتوى' },
                    { key: 'workflow_triggered', label: 'تشغيل Workflow',         icon: 'fa-bolt',  category: 'الأتمتة' },
                    { key: 'campaign_alert',   label: 'تنبيه حملة إعلانية',     icon: 'fa-ad',    category: 'الإعلانات' },
                    { key: 'low_roas',         label: 'ROAS منخفض',              icon: 'fa-chart-line', category: 'الإعلانات' },
                    { key: 'task_due',         label: 'موعد مهمة قريب',          icon: 'fa-clock',  category: 'CRM' },
                    { key: 'new_lead',         label: 'عميل محتمل جديد',         icon: 'fa-user-plus', category: 'CRM' },
                    { key: 'crm_order',        label: 'طلب جديد',                icon: 'fa-shopping-bag', category: 'CRM' },
                ];

                const [prefs, setPrefs] = React.useState<Record<string, { inApp: boolean; email: boolean }>>(() =>
                    Object.fromEntries(NOTIF_EVENTS.map(e => [e.key, { inApp: true, email: e.key.includes('alert') || e.key.includes('roas') }]))
                );

                const categories = [...new Set(NOTIF_EVENTS.map(e => e.category))];

                return (
                    <div className="space-y-6">
                        <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-5">
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">تحكم في الأحداث التي تُولّد إشعارات — وقنوات التسليم</p>
                        </div>
                        {categories.map(cat => (
                            <div key={cat} className="space-y-2">
                                <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wide">{cat}</p>
                                <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl overflow-hidden">
                                    {NOTIF_EVENTS.filter(e => e.category === cat).map((ev, i, arr) => (
                                        <div key={ev.key} className={`flex items-center gap-4 p-4 ${i < arr.length - 1 ? 'border-b border-light-border dark:border-dark-border' : ''}`}>
                                            <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center shrink-0">
                                                <i className={`fas ${ev.icon} text-brand-primary text-sm`} />
                                            </div>
                                            <span className="flex-1 text-sm font-medium text-light-text dark:text-dark-text">{ev.label}</span>
                                            <div className="flex items-center gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">In-App</span>
                                                    <div onClick={() => setPrefs(p => ({ ...p, [ev.key]: { ...p[ev.key], inApp: !p[ev.key].inApp } }))}
                                                        className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative ${prefs[ev.key]?.inApp ? 'bg-brand-primary' : 'bg-light-border dark:bg-dark-border'}`}>
                                                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${prefs[ev.key]?.inApp ? 'left-5' : 'left-0.5'}`} />
                                                    </div>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Email</span>
                                                    <div onClick={() => setPrefs(p => ({ ...p, [ev.key]: { ...p[ev.key], email: !p[ev.key].email } }))}
                                                        className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative ${prefs[ev.key]?.email ? 'bg-green-500' : 'bg-light-border dark:bg-dark-border'}`}>
                                                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${prefs[ev.key]?.email ? 'left-5' : 'left-0.5'}`} />
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <button onClick={() => notify(NotificationType.Success, 'تم حفظ إعدادات الإشعارات')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary/90 transition">
                            <i className="fas fa-save" /> حفظ الإعدادات
                        </button>
                    </div>
                );
            })()}

            {/* ── WFL-2: Task Dependencies ──────────────────────────────────── */}
            {activeTab === 'dependencies' && (() => {
                // Flatten all tasks from all workflows
                const allTasks = workflows.flatMap(wf =>
                    wf.steps.flatMap(step =>
                        step.tasks.map(t => ({ ...t, stepName: step.name, wfName: wf.name, wfId: wf.id }))
                    )
                );
                const [deps, setDeps] = React.useState<Record<string, string[]>>({});
                const addDep = (taskId: string, depId: string) => {
                    if (taskId === depId) return;
                    setDeps(d => ({ ...d, [taskId]: [...new Set([...(d[taskId] ?? []), depId])] }));
                };
                const removeDep = (taskId: string, depId: string) => {
                    setDeps(d => ({ ...d, [taskId]: (d[taskId] ?? []).filter(id => id !== depId) }));
                };

                return (
                    <div className="space-y-5">
                        <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-5">
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">حدّد الترتيب والتبعيات بين مهام الـ Workflows — مهمة لا تبدأ إلا بعد اكتمال المهمة التي تعتمد عليها</p>
                        </div>
                        {allTasks.length === 0 ? (
                            <div className="text-center py-12 text-light-text-secondary dark:text-dark-text-secondary">
                                <i className="fas fa-sitemap text-4xl mb-3 opacity-30" />
                                <p>لا توجد مهام — أنشئ Workflow بخطوات أولاً</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {allTasks.map(task => (
                                    <div key={task.id} className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-4 space-y-3">
                                        <div className="flex items-start gap-3">
                                            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${task.completed ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold text-light-text dark:text-dark-text">{task.description}</p>
                                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{task.wfName} › {task.stepName}</p>
                                            </div>
                                        </div>
                                        {/* Current deps */}
                                        {(deps[task.id] ?? []).length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 ps-5">
                                                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">يعتمد على:</span>
                                                {(deps[task.id] ?? []).map(depId => {
                                                    const dep = allTasks.find(t => t.id === depId);
                                                    return dep ? (
                                                        <span key={depId} className="flex items-center gap-1 text-xs bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full">
                                                            {dep.description}
                                                            <button onClick={() => removeDep(task.id, depId)} className="hover:text-red-500"><i className="fas fa-times text-[10px]" /></button>
                                                        </span>
                                                    ) : null;
                                                })}
                                            </div>
                                        )}
                                        {/* Add dep select */}
                                        <div className="ps-5">
                                            <select onChange={e => { if (e.target.value) { addDep(task.id, e.target.value); e.target.value = ''; } }}
                                                className="text-xs bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-lg px-2 py-1 text-light-text-secondary dark:text-dark-text-secondary focus:outline-none focus:ring-1 focus:ring-brand-primary">
                                                <option value="">+ إضافة تبعية</option>
                                                {allTasks.filter(t => t.id !== task.id && !(deps[task.id] ?? []).includes(t.id)).map(t => (
                                                    <option key={t.id} value={t.id}>{t.description} ({t.wfName})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button onClick={() => notify(NotificationType.Success, 'تم حفظ تبعيات المهام')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary/90 transition">
                            <i className="fas fa-save" /> حفظ التبعيات
                        </button>
                    </div>
                );
            })()}

            {/* ── Create / Edit Modal ─────────────────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeModal}>
                    <div className="bg-light-card dark:bg-dark-card rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-light-border dark:border-dark-border">
                            <h2 className="text-lg font-bold text-light-text dark:text-dark-text">
                                {editingId ? 'تعديل Workflow' : 'إنشاء Workflow جديد'}
                            </h2>
                            <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-light-bg dark:hover:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary transition">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-bold text-light-text dark:text-dark-text mb-1.5">اسم الـ Workflow *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="مثال: موافقة على منشورات Instagram"
                                    className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-light-text dark:text-dark-text text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-bold text-light-text dark:text-dark-text mb-1.5">الوصف</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                    rows={2}
                                    placeholder="وصف مختصر لهذا الـ workflow..."
                                    className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-light-text dark:text-dark-text text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none resize-none"
                                />
                            </div>

                            {/* Trigger */}
                            <div>
                                <label className="block text-sm font-bold text-light-text dark:text-dark-text mb-1.5">المُحفِّز (Trigger)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {TRIGGER_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setForm(p => ({ ...p, trigger: opt.value }))}
                                            className={`flex items-center gap-2 p-3 rounded-xl border text-sm text-start transition ${form.trigger === opt.value
                                                ? 'border-brand-primary bg-brand-primary/5 text-brand-primary font-bold'
                                                : 'border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-brand-primary/50'}`}
                                        >
                                            <i className={`fas ${opt.icon} text-xs`}></i>
                                            <span className="text-xs leading-tight">{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Steps */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-bold text-light-text dark:text-dark-text">الخطوات</label>
                                    <button
                                        onClick={addStep}
                                        className="text-xs text-brand-primary hover:underline flex items-center gap-1"
                                    ><i className="fas fa-plus"></i> إضافة خطوة</button>
                                </div>
                                {form.steps.length === 0 ? (
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary text-center py-3 bg-light-bg dark:bg-dark-bg rounded-xl border border-dashed border-light-border dark:border-dark-border">
                                        لا توجد خطوات — اضغط "إضافة خطوة"
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {form.steps.map((step, idx) => (
                                            <div key={step.id} className="flex items-center gap-2 bg-light-bg dark:bg-dark-bg rounded-xl p-3 border border-light-border dark:border-dark-border">
                                                <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-brand-primary text-white text-xs font-bold">{idx + 1}</span>
                                                <input
                                                    value={step.name}
                                                    onChange={e => updateStep(step.id, 'name', e.target.value)}
                                                    className="flex-1 bg-transparent text-sm text-light-text dark:text-dark-text outline-none"
                                                    placeholder="اسم الخطوة..."
                                                />
                                                <select
                                                    value={step.type}
                                                    onChange={e => updateStep(step.id, 'type', e.target.value)}
                                                    className="text-xs bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg px-2 py-1 text-light-text dark:text-dark-text outline-none"
                                                >
                                                    <option value="approval">موافقة</option>
                                                    <option value="notification">إشعار</option>
                                                </select>
                                                <button onClick={() => removeStep(step.id)} className="text-red-400 hover:text-red-600 transition">
                                                    <i className="fas fa-times text-xs"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-3 p-5 border-t border-light-border dark:border-dark-border">
                            <button onClick={closeModal} className="px-4 py-2 text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text transition">إلغاء</button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !form.name.trim()}
                                className="flex items-center gap-2 px-5 py-2 bg-brand-primary text-white rounded-xl font-bold text-sm hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>}
                                <span>{editingId ? 'حفظ التعديلات' : 'إنشاء Workflow'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Confirm ──────────────────────────────────────────── */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-light-card dark:bg-dark-card rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <i className="fas fa-trash text-red-500 text-xl"></i>
                        </div>
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">حذف الـ Workflow</h3>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-5">
                            هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-sm font-bold text-light-text dark:text-dark-text hover:bg-light-bg dark:hover:bg-dark-bg transition"
                            >إلغاء</button>
                            <button
                                onClick={() => {
                                    const wf = workflows.find(w => w.id === deleteConfirm);
                                    if (wf) handleDelete(wf);
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition"
                            >حذف</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
