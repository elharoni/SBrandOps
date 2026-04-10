import React, { useState, useEffect, useCallback } from 'react';
import { CrmSegment, CrmSegmentRule, CrmSegmentOperator } from '../../../types';
import { getSegments, createSegment, deleteSegment } from '../../../services/crmService';

// ── Segment fields available for rules ───────────────────────────────────────

const SEGMENT_FIELDS: { value: string; label: string; type: 'number' | 'date' | 'text' | 'select' }[] = [
    { value: 'total_spent',       label: 'إجمالي الإنفاق',     type: 'number' },
    { value: 'total_orders',      label: 'عدد الطلبات',        type: 'number' },
    { value: 'average_order_value', label: 'متوسط الطلب',      type: 'number' },
    { value: 'ltv',               label: 'LTV',                type: 'number' },
    { value: 'refund_count',      label: 'عدد المرتجعات',      type: 'number' },
    { value: 'last_order_date',   label: 'تاريخ آخر طلب',     type: 'date' },
    { value: 'first_order_date',  label: 'تاريخ أول طلب',     type: 'date' },
    { value: 'created_at',        label: 'تاريخ التسجيل',     type: 'date' },
    { value: 'lifecycle_stage',   label: 'مرحلة العميل',       type: 'select' },
    { value: 'acquisition_source', label: 'مصدر الاكتساب',     type: 'text' },
    { value: 'country',           label: 'الدولة',             type: 'text' },
    { value: 'city',              label: 'المدينة',            type: 'text' },
    { value: 'marketing_consent', label: 'موافقة تسويقية',     type: 'select' },
];

const OPERATORS_BY_TYPE: Record<string, { value: CrmSegmentOperator; label: string }[]> = {
    number: [
        { value: CrmSegmentOperator.Eq,  label: 'يساوي' },
        { value: CrmSegmentOperator.Neq, label: 'لا يساوي' },
        { value: CrmSegmentOperator.Gt,  label: 'أكبر من' },
        { value: CrmSegmentOperator.Gte, label: 'أكبر من أو يساوي' },
        { value: CrmSegmentOperator.Lt,  label: 'أصغر من' },
        { value: CrmSegmentOperator.Lte, label: 'أصغر من أو يساوي' },
        { value: CrmSegmentOperator.Between, label: 'بين' },
    ],
    date: [
        { value: CrmSegmentOperator.Gt,  label: 'بعد' },
        { value: CrmSegmentOperator.Lt,  label: 'قبل' },
        { value: CrmSegmentOperator.Between, label: 'بين' },
        { value: CrmSegmentOperator.IsNull,    label: 'فارغ' },
        { value: CrmSegmentOperator.IsNotNull, label: 'ليس فارغًا' },
    ],
    text: [
        { value: CrmSegmentOperator.Eq,          label: 'يساوي' },
        { value: CrmSegmentOperator.Neq,         label: 'لا يساوي' },
        { value: CrmSegmentOperator.Contains,    label: 'يحتوي' },
        { value: CrmSegmentOperator.NotContains, label: 'لا يحتوي' },
    ],
    select: [
        { value: CrmSegmentOperator.Eq,  label: 'يساوي' },
        { value: CrmSegmentOperator.Neq, label: 'لا يساوي' },
    ],
};

// ── Pre-built segment templates ───────────────────────────────────────────────

const PRESET_TEMPLATES: { name: string; description: string; icon: string; color: string; rules: Omit<CrmSegmentRule, 'id' | 'segmentId' | 'createdAt'>[] }[] = [
    {
        name: 'عملاء جدد', description: 'طلب واحد فقط', icon: 'fa-user-plus', color: 'text-blue-600',
        rules: [{ field: 'total_orders', operator: CrmSegmentOperator.Eq, value: '1', sortOrder: 0 }],
    },
    {
        name: 'عملاء متكررون', description: '3 طلبات أو أكثر', icon: 'fa-redo', color: 'text-emerald-600',
        rules: [{ field: 'total_orders', operator: CrmSegmentOperator.Gte, value: '3', sortOrder: 0 }],
    },
    {
        name: 'VIP (أعلى 10%)', description: 'إنفاق أعلى من 10,000 ريال', icon: 'fa-crown', color: 'text-amber-600',
        rules: [{ field: 'total_spent', operator: CrmSegmentOperator.Gte, value: '10000', sortOrder: 0 }],
    },
    {
        name: 'متوقفون 60 يومًا', description: 'لا طلبات خلال 60 يومًا', icon: 'fa-clock', color: 'text-orange-600',
        rules: [{
            field: 'last_order_date', operator: CrmSegmentOperator.Lt,
            value: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            sortOrder: 0,
        }],
    },
    {
        name: 'متوقفون 90 يومًا', description: 'لا طلبات خلال 90 يومًا', icon: 'fa-clock', color: 'text-red-600',
        rules: [{
            field: 'last_order_date', operator: CrmSegmentOperator.Lt,
            value: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            sortOrder: 0,
        }],
    },
    {
        name: 'لديهم مرتجعات', description: 'عدد مرتجعات أكبر من 0', icon: 'fa-undo', color: 'text-red-500',
        rules: [{ field: 'refund_count', operator: CrmSegmentOperator.Gt, value: '0', sortOrder: 0 }],
    },
    {
        name: 'AOV عالي', description: 'متوسط طلب أعلى من 1,500 ريال', icon: 'fa-chart-line', color: 'text-indigo-600',
        rules: [{ field: 'average_order_value', operator: CrmSegmentOperator.Gte, value: '1500', sortOrder: 0 }],
    },
    {
        name: 'موافقون على التسويق', description: 'المشتركون في الرسائل التسويقية', icon: 'fa-bullhorn', color: 'text-green-600',
        rules: [{ field: 'marketing_consent', operator: CrmSegmentOperator.Eq, value: 'true', sortOrder: 0 }],
    },
];

// ── Segment Rule Builder ──────────────────────────────────────────────────────

interface RuleRowProps {
    rule: Partial<CrmSegmentRule> & { _key: string };
    onChange: (r: Partial<CrmSegmentRule> & { _key: string }) => void;
    onRemove: () => void;
}
const RuleRow: React.FC<RuleRowProps> = ({ rule, onChange, onRemove }) => {
    const fieldDef = SEGMENT_FIELDS.find(f => f.value === rule.field);
    const fieldType = fieldDef?.type ?? 'text';
    const ops = OPERATORS_BY_TYPE[fieldType] ?? OPERATORS_BY_TYPE.text;

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {/* Field */}
            <select
                value={rule.field ?? ''}
                onChange={e => onChange({ ...rule, field: e.target.value, operator: undefined, value: undefined })}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 min-w-36"
            >
                <option value="" disabled>اختر حقلًا</option>
                {SEGMENT_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>

            {/* Operator */}
            {rule.field && (
                <select
                    value={rule.operator ?? ''}
                    onChange={e => onChange({ ...rule, operator: e.target.value as CrmSegmentOperator })}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 min-w-32"
                >
                    <option value="" disabled>العملية</option>
                    {ops.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
            )}

            {/* Value(s) */}
            {rule.field && rule.operator && rule.operator !== CrmSegmentOperator.IsNull && rule.operator !== CrmSegmentOperator.IsNotNull && (
                <input
                    type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'}
                    value={rule.value ?? ''}
                    onChange={e => onChange({ ...rule, value: e.target.value })}
                    placeholder="القيمة"
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 w-36"
                />
            )}
            {rule.operator === CrmSegmentOperator.Between && (
                <input
                    type={fieldType === 'number' ? 'number' : 'date'}
                    value={rule.value2 ?? ''}
                    onChange={e => onChange({ ...rule, value2: e.target.value })}
                    placeholder="القيمة الثانية"
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 w-36"
                />
            )}

            <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg">
                <i className="fas fa-times text-xs" />
            </button>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

interface CrmSegmentsPageProps {
    brandId: string;
}

type RuleWithKey = Partial<CrmSegmentRule> & { _key: string };

export const CrmSegmentsPage: React.FC<CrmSegmentsPageProps> = ({ brandId }) => {
    const [segments, setSegments]       = useState<CrmSegment[]>([]);
    const [loading, setLoading]         = useState(true);
    const [showBuilder, setShowBuilder] = useState(false);
    const [name, setName]               = useState('');
    const [description, setDescription] = useState('');
    const [rulesOp, setRulesOp]         = useState<'AND' | 'OR'>('AND');
    const [rules, setRules]             = useState<RuleWithKey[]>([]);
    const [saving, setSaving]           = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const segs = await getSegments(brandId);
        setSegments(segs);
        setLoading(false);
    }, [brandId]);

    useEffect(() => { void load(); }, [load]);

    const addRule = () => {
        setRules(r => [...r, { _key: crypto.randomUUID() }]);
    };

    const updateRule = (key: string, updated: RuleWithKey) => {
        setRules(r => r.map(x => x._key === key ? updated : x));
    };

    const removeRule = (key: string) => {
        setRules(r => r.filter(x => x._key !== key));
    };

    const handleSave = async () => {
        if (!name.trim() || rules.length === 0) return;
        setSaving(true);
        const validRules = rules.filter(r => r.field && r.operator) as Omit<CrmSegmentRule, 'id' | 'segmentId' | 'createdAt'>[];
        await createSegment(brandId, name, description, rulesOp, validRules);
        setName(''); setDescription(''); setRules([]); setShowBuilder(false);
        setSaving(false);
        void load();
    };

    const applyTemplate = (tpl: typeof PRESET_TEMPLATES[0]) => {
        setName(tpl.name);
        setDescription(tpl.description);
        setRules(tpl.rules.map(r => ({ ...r, _key: crypto.randomUUID() })));
        setShowBuilder(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">الشرائح</h1>
                    <p className="text-sm text-gray-500">{segments.length} شريحة</p>
                </div>
                <button onClick={() => setShowBuilder(!showBuilder)}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 flex items-center gap-1.5">
                    <i className="fas fa-plus text-xs" /> شريحة جديدة
                </button>
            </div>

            {/* Segment Builder */}
            {showBuilder && (
                <div className="bg-white border border-indigo-200 rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-gray-800">بناء شريحة جديدة</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input type="text" value={name} onChange={e => setName(e.target.value)}
                            placeholder="اسم الشريحة"
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                            placeholder="وصف الشريحة (اختياري)"
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Rules operator */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">تطبيق</span>
                        <div className="flex items-center gap-1">
                            {(['AND', 'OR'] as const).map(op => (
                                <button key={op} onClick={() => setRulesOp(op)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${rulesOp === op ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                    {op === 'AND' ? 'كل الشروط' : 'أي شرط'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Rules */}
                    <div className="space-y-2">
                        {rules.map(rule => (
                            <RuleRow
                                key={rule._key}
                                rule={rule}
                                onChange={updated => updateRule(rule._key, updated)}
                                onRemove={() => removeRule(rule._key)}
                            />
                        ))}
                        <button onClick={addRule}
                            className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                            <i className="fas fa-plus text-xs" /> إضافة شرط
                        </button>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <button onClick={handleSave} disabled={saving || !name || rules.length === 0}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                            {saving ? <i className="fas fa-circle-notch fa-spin" /> : null}
                            حفظ الشريحة
                        </button>
                        <button onClick={() => { setShowBuilder(false); setRules([]); setName(''); }}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                            إلغاء
                        </button>
                    </div>
                </div>
            )}

            {/* Pre-built templates */}
            {!showBuilder && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">قوالب جاهزة</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {PRESET_TEMPLATES.map(tpl => (
                            <button key={tpl.name} onClick={() => applyTemplate(tpl)}
                                className="bg-white border border-gray-200 rounded-xl p-3 text-right hover:border-indigo-300 hover:bg-indigo-50 transition-colors group">
                                <i className={`fas ${tpl.icon} ${tpl.color} mb-1.5 block text-base`} />
                                <p className="text-sm font-medium text-gray-800 leading-tight">{tpl.name}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{tpl.description}</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Segments list */}
            <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">شرائحي</h3>
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : segments.length === 0 ? (
                    <div className="text-center py-12">
                        <i className="fas fa-layer-group text-3xl text-gray-300 mb-3 block" />
                        <p className="text-gray-500">لا توجد شرائح. أنشئ واحدة من القوالب أعلاه.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {segments.map(seg => (
                            <div key={seg.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className="font-medium text-gray-900 text-sm">{seg.name}</p>
                                            {seg.isPreset && (
                                                <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">جاهز</span>
                                            )}
                                            {seg.isDynamic && (
                                                <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full">ديناميكي</span>
                                            )}
                                        </div>
                                        {seg.description && (
                                            <p className="text-xs text-gray-500 mt-0.5">{seg.description}</p>
                                        )}
                                    </div>
                                    {!seg.isPreset && (
                                        <button onClick={() => { void deleteSegment(brandId, seg.id).then(load); }}
                                            className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0">
                                            <i className="fas fa-trash text-xs" />
                                        </button>
                                    )}
                                </div>
                                <div className="mt-3 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <i className="fas fa-users text-xs text-gray-400" />
                                        <span className="text-sm font-bold text-gray-900">{seg.audienceSize.toLocaleString('ar')}</span>
                                        <span className="text-xs text-gray-500">عميل</span>
                                    </div>
                                    <button className="text-xs text-indigo-600 hover:text-indigo-800">
                                        عرض العملاء →
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
