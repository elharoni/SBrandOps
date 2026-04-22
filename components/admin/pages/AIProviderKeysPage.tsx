// components/admin/pages/AIProviderKeysPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { AIProviderKey, AIProvider } from '../../../types';
import {
    getAIProviderKeys,
    createAIProviderKey,
    deleteAIProviderKey,
    setActiveProviderKey,
    testAIProviderKey,
} from '../../../services/aiProviderKeysService';
import { resetAIClient } from '../../../services/geminiService';
import { SkeletonLoader } from '../shared/ui/SkeletonLoader';

// ── Provider metadata ──────────────────────────────────────────────────────────

const PROVIDER_META: Record<AIProvider, { label: string; icon: string; color: string; bg: string; envKey?: string }> = {
    gemini:    { label: 'Google Gemini',  icon: 'fa-google',   color: 'text-blue-400',   bg: 'bg-blue-500/10' },
    openai:    { label: 'OpenAI (GPT)',   icon: 'fa-robot',    color: 'text-green-400',  bg: 'bg-green-500/10' },
    anthropic: { label: 'Anthropic Claude', icon: 'fa-brain', color: 'text-orange-400', bg: 'bg-orange-500/10' },
    stability: { label: 'Stability AI',  icon: 'fa-image',    color: 'text-purple-400', bg: 'bg-purple-500/10' },
    replicate: { label: 'Replicate',     icon: 'fa-sync',     color: 'text-cyan-400',   bg: 'bg-cyan-500/10' },
};

function maskKey(key: string): string {
    if (key.length <= 8) return '****';
    return key.slice(0, 6) + '...' + key.slice(-4);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const TestStatusBadge: React.FC<{ status: AIProviderKey['testStatus'] }> = ({ status }) => {
    const cfg = {
        ok:       { cls: 'bg-success/20 text-success',   label: 'يعمل ✓' },
        failed:   { cls: 'bg-danger/20 text-danger',     label: 'فشل ✗' },
        untested: { cls: 'bg-gray-500/20 text-gray-400', label: 'لم يُختبر' },
    }[status];
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${cfg.cls}`}>{cfg.label}</span>;
};

// ── DB Key Card ────────────────────────────────────────────────────────────────

interface KeyCardProps {
    keyItem: AIProviderKey;
    onDelete: (id: string) => void;
    onSetActive: (provider: AIProvider, id: string) => void;
    onTest: (id: string) => void;
    testing: boolean;
}

const KeyCard: React.FC<KeyCardProps> = ({ keyItem, onDelete, onSetActive, onTest, testing }) => {
    const meta = PROVIDER_META[keyItem.provider];
    return (
        <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
            keyItem.isActive
                ? 'border-primary/50 bg-primary/5 dark:bg-primary/10'
                : 'border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card hover:border-light-border/80'
        }`}>
            <div className={`w-9 h-9 rounded-full ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                <i className={`fab ${meta.icon} text-sm ${meta.color}`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-light-text dark:text-dark-text">{keyItem.name}</span>
                    {keyItem.isActive && (
                        <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-primary/20 text-primary">نشط</span>
                    )}
                    <TestStatusBadge status={keyItem.testStatus} />
                </div>
                <p className="text-xs font-mono text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{keyItem.keyMasked}</p>
                {keyItem.lastTestedAt && (
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                        آخر اختبار: {new Date(keyItem.lastTestedAt).toLocaleString('ar-EG')}
                    </p>
                )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
                <button
                    onClick={() => onTest(keyItem.id)}
                    disabled={testing}
                    title="اختبار الاتصال"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                >
                    <i className={`fas text-sm ${testing ? 'fa-spinner fa-spin' : 'fa-plug'}`} />
                </button>
                {!keyItem.isActive && (
                    <button
                        onClick={() => onSetActive(keyItem.provider, keyItem.id)}
                        title="تفعيل كمفتاح رئيسي"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-success hover:bg-success/10 transition-colors"
                    >
                        <i className="fas fa-circle-check text-sm" />
                    </button>
                )}
                <button
                    onClick={() => {
                        if (confirm(`هل تريد حذف المفتاح "${keyItem.name}"؟`)) onDelete(keyItem.id);
                    }}
                    title="حذف المفتاح"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-danger hover:bg-danger/10 transition-colors"
                >
                    <i className="fas fa-trash text-sm" />
                </button>
            </div>
        </div>
    );
};

// ── Add Key Modal ──────────────────────────────────────────────────────────────

interface AddKeyModalProps {
    defaultProvider?: AIProvider;
    onClose: () => void;
    onAdd: (provider: AIProvider, name: string, key: string) => Promise<void>;
}

const AddKeyModal: React.FC<AddKeyModalProps> = ({ defaultProvider, onClose, onAdd }) => {
    const [provider, setProvider] = useState<AIProvider>(defaultProvider || 'gemini');
    const [name, setName] = useState('');
    const [key, setKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !key.trim()) { setError('يرجى ملء جميع الحقول'); return; }
        setLoading(true);
        setError('');
        try {
            await onAdd(provider, name.trim(), key.trim());
            onClose();
        } catch (err: any) {
            setError(err.message || 'حدث خطأ');
        } finally {
            setLoading(false);
        }
    };

    const inputCls = "w-full p-2.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-sm text-light-text dark:text-dark-text focus:outline-none focus:border-primary";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center px-6 py-4 border-b border-light-border dark:border-dark-border">
                    <h2 className="text-lg font-bold text-light-text dark:text-dark-text">إضافة مفتاح AI جديد</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-light-text-secondary hover:text-danger hover:bg-danger/10 transition-colors">
                        <i className="fas fa-times" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Provider */}
                    <div>
                        <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mb-2">المزود</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(Object.entries(PROVIDER_META) as [AIProvider, typeof PROVIDER_META[AIProvider]][]).map(([p, meta]) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setProvider(p)}
                                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all ${
                                        provider === p
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg'
                                    }`}
                                >
                                    <i className={`fab ${meta.icon} text-base ${provider === p ? 'text-primary' : meta.color}`} />
                                    <span className="text-[10px] leading-tight text-center">{meta.label.split(' ')[0]}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Name */}
                    <div>
                        <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mb-1">الاسم (وصفي)</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder={`مثال: ${PROVIDER_META[provider].label} - Production`}
                            className={inputCls}
                        />
                    </div>

                    {/* API Key */}
                    <div>
                        <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mb-1">مفتاح API</label>
                        <div className="relative">
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={key}
                                onChange={e => setKey(e.target.value)}
                                placeholder="AIzaSy... / sk-... / sk-ant-..."
                                className={inputCls + ' font-mono pe-10'}
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(s => !s)}
                                className="absolute inset-y-0 end-0 w-10 flex items-center justify-center text-light-text-secondary hover:text-light-text dark:hover:text-dark-text"
                            >
                                <i className={`fas ${showKey ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-xl px-3 py-2">
                            <i className="fas fa-circle-exclamation" />
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-sm font-semibold text-light-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition-colors">
                            إلغاء
                        </button>
                        <button type="submit" disabled={loading}
                            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                            {loading && <i className="fas fa-spinner fa-spin" />}
                            {loading ? 'جارٍ الحفظ...' : 'حفظ المفتاح'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Provider Section ───────────────────────────────────────────────────────────

interface ProviderSectionProps {
    provider: AIProvider;
    dbKeys: AIProviderKey[];
    testingId: string | null;
    onAdd: (provider: AIProvider) => void;
    onDelete: (id: string) => void;
    onSetActive: (provider: AIProvider, id: string) => void;
    onTest: (id: string) => void;
}

const ProviderSection: React.FC<ProviderSectionProps> = ({
    provider, dbKeys, testingId, onAdd, onDelete, onSetActive, onTest
}) => {
    const meta = PROVIDER_META[provider];

    return (
        <div className="bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-light-border dark:border-dark-border">
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center`}>
                        <i className={`fab ${meta.icon} text-base ${meta.color}`} />
                    </div>
                    <div>
                        <p className="font-bold text-light-text dark:text-dark-text">{meta.label}</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {dbKeys.length} مفتاح في قاعدة البيانات
                            {dbKeys.filter(k => k.isActive).length > 0 && ' · واحد نشط'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => onAdd(provider)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-primary/50 text-primary text-sm font-semibold hover:bg-primary/5 transition-colors"
                >
                    <i className="fas fa-plus text-xs" />
                    إضافة مفتاح
                </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
                {/* DB keys */}
                {dbKeys.length === 0 && (
                    <div className="text-center py-8">
                        <i className={`fab ${meta.icon} text-3xl ${meta.color} opacity-30 mb-3`} />
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">لا توجد مفاتيح لهذا المزود</p>
                        <button
                            onClick={() => onAdd(provider)}
                            className="mt-3 text-sm text-primary hover:underline font-semibold"
                        >
                            إضافة أول مفتاح
                        </button>
                    </div>
                )}

                {dbKeys.map(k => (
                    <KeyCard
                        key={k.id}
                        keyItem={k}
                        onDelete={onDelete}
                        onSetActive={onSetActive}
                        onTest={onTest}
                        testing={testingId === k.id}
                    />
                ))}
            </div>
        </div>
    );
};

// ── Toast notification ─────────────────────────────────────────────────────────

const Toast: React.FC<{ msg: string; type: 'success' | 'error' }> = ({ msg, type }) => (
    <div className={`fixed top-5 end-5 z-[100] px-5 py-3 rounded-xl shadow-xl text-white text-sm font-semibold flex items-center gap-2 animate-in slide-in-from-top-2 ${type === 'success' ? 'bg-success' : 'bg-danger'}`}>
        <i className={`fas ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`} />
        {msg}
    </div>
);

// ── Main Page ──────────────────────────────────────────────────────────────────

export const AIProviderKeysPage: React.FC = () => {
    const [keys, setKeys] = useState<AIProviderKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState<AIProvider | null>(null);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    const notify = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const load = useCallback(async () => {
        setLoading(true);
        const data = await getAIProviderKeys();
        setKeys(data);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (provider: AIProvider, name: string, key: string) => {
        const newKey = await createAIProviderKey(provider, name, key);
        setKeys(prev => [newKey, ...prev]);
        notify('success', `تم إضافة مفتاح "${name}" بنجاح`);
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteAIProviderKey(id);
            setKeys(prev => prev.filter(k => k.id !== id));
            notify('success', 'تم حذف المفتاح');
        } catch {
            notify('error', 'فشل حذف المفتاح');
        }
    };

    const handleSetActive = async (provider: AIProvider, keyId: string) => {
        try {
            await setActiveProviderKey(provider, keyId);
            setKeys(prev => prev.map(k =>
                k.provider === provider ? { ...k, isActive: k.id === keyId } : k
            ));
            // Clear the cached AI client so the next call picks up the new key
            if (provider === 'gemini') resetAIClient();
            notify('success', 'تم تفعيل المفتاح كمفتاح رئيسي');
        } catch {
            notify('error', 'فشل تفعيل المفتاح');
        }
    };

    const handleTest = async (id: string) => {
        setTestingId(id);
        try {
            const result = await testAIProviderKey(id);
            setKeys(prev => prev.map(k =>
                k.id === id ? { ...k, testStatus: result, lastTestedAt: new Date().toISOString() } : k
            ));
            notify(result === 'ok' ? 'success' : 'error',
                result === 'ok' ? 'المفتاح يعمل بشكل صحيح ✓' : 'فشل الاتصال — تحقق من المفتاح');
        } catch {
            notify('error', 'حدث خطأ أثناء الاختبار');
        } finally {
            setTestingId(null);
        }
    };

    const totalKeys = keys.length;
    const activeCount = keys.filter(k => k.isActive).length;

    return (
        <div className="space-y-6">
            {toast && <Toast {...toast} />}

            {/* Page Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">مفاتيح مزودي AI</h1>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                        إدارة مفاتيح API لجميع خدمات الذكاء الاصطناعي المستخدمة في النظام.
                    </p>
                </div>
                <button
                    onClick={() => setShowModal('gemini')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
                >
                    <i className="fas fa-plus" />
                    إضافة مفتاح
                </button>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'إجمالي المفاتيح', value: loading ? '...' : totalKeys, icon: 'fa-key', color: 'text-primary' },
                    { label: 'مفاتيح نشطة', value: loading ? '...' : activeCount, icon: 'fa-circle-check', color: 'text-success' },
                    { label: 'مزودون متصلون', value: loading ? '...' : new Set(keys.map(k => k.provider)).size, icon: 'fa-plug', color: 'text-blue-400' },
                ].map(stat => (
                    <div key={stat.label} className="bg-light-card dark:bg-dark-card rounded-xl border border-light-border dark:border-dark-border px-5 py-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-light-bg dark:bg-dark-bg flex items-center justify-center flex-shrink-0">
                            <i className={`fas ${stat.icon} ${stat.color}`} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-light-text dark:text-dark-text">{stat.value}</p>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Info banner about server-side key management */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-700 dark:text-blue-300">
                <i className="fas fa-circle-info mt-0.5 flex-shrink-0" />
                <div>
                    <p className="font-semibold">كيف تعمل المفاتيح؟</p>
                    <p className="mt-0.5 opacity-80">
                        المفاتيح مُدارة <strong>بالكامل من جانب الخادم</strong> ولا تُرسل أبداً للمتصفح.
                        يمكنك إضافة أكثر من مفتاح لكل مزود وتحديد المفتاح النشط.
                        يُقرأ المفتاح النشط تلقائياً من Edge Function عند كل طلب AI.
                    </p>
                </div>
            </div>

            {/* Provider Sections */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <SkeletonLoader key={i} className="h-36 w-full rounded-2xl" />)}
                </div>
            ) : (
                <div className="space-y-4">
                    {(Object.keys(PROVIDER_META) as AIProvider[]).map(provider => {
                        const dbKeys = keys.filter(k => k.provider === provider);
                        return (
                            <ProviderSection
                                key={provider}
                                provider={provider}
                                dbKeys={dbKeys}
                                testingId={testingId}
                                onAdd={(p) => setShowModal(p)}
                                onDelete={handleDelete}
                                onSetActive={handleSetActive}
                                onTest={handleTest}
                            />
                        );
                    })}
                </div>
            )}

            {showModal && (
                <AddKeyModal
                    defaultProvider={showModal}
                    onClose={() => setShowModal(null)}
                    onAdd={handleAdd}
                />
            )}
        </div>
    );
};
