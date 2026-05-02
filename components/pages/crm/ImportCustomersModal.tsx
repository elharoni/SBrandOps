import React, { useState, useRef, useCallback, DragEvent } from 'react';
import { CrmCustomer, CrmLifecycleStage } from '../../../types';
import { bulkImportCustomers, CrmImportResult } from '../../../services/crmService';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'map' | 'preview' | 'importing' | 'done';

type CrmField =
    | 'firstName' | 'lastName' | 'email' | 'phone'
    | 'gender' | 'birthDate' | 'language'
    | 'acquisitionSource' | 'acquisitionChannel'
    | 'city' | 'marketingConsent' | 'totalSpent' | 'totalOrders' | '';

const CRM_FIELD_LABELS: Record<CrmField, string> = {
    '':                  'تجاهل هذا العمود',
    firstName:           'الاسم الأول',
    lastName:            'اسم العائلة',
    email:               'البريد الإلكتروني',
    phone:               'رقم الجوال',
    gender:              'الجنس',
    birthDate:           'تاريخ الميلاد',
    language:            'اللغة',
    acquisitionSource:   'مصدر الاكتساب',
    acquisitionChannel:  'قناة الاكتساب',
    city:                'المدينة',
    marketingConsent:    'موافقة تسويقية',
    totalSpent:          'إجمالي الإنفاق',
    totalOrders:         'عدد الطلبات',
};

const ALL_FIELDS: CrmField[] = [
    '', 'firstName', 'lastName', 'email', 'phone',
    'gender', 'birthDate', 'language',
    'acquisitionSource', 'acquisitionChannel',
    'city', 'marketingConsent', 'totalSpent', 'totalOrders',
];

// ── CSV Parser ────────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    return lines.map(line => {
        const cells: string[] = [];
        let cell = '';
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"' && !inQuote) {
                inQuote = true;
            } else if (ch === '"' && inQuote) {
                if (line[i + 1] === '"') { cell += '"'; i++; }
                else { inQuote = false; }
            } else if ((ch === ',' || ch === '\t') && !inQuote) {
                cells.push(cell.trim());
                cell = '';
            } else {
                cell += ch;
            }
        }
        cells.push(cell.trim());
        return cells;
    });
}

function autoMapHeaders(headers: string[]): CrmField[] {
    const map: Record<string, CrmField> = {
        'first name': 'firstName', 'firstname': 'firstName', 'first_name': 'firstName',
        'الاسم الأول': 'firstName', 'الاسم': 'firstName', 'name': 'firstName',
        'last name': 'lastName', 'lastname': 'lastName', 'last_name': 'lastName',
        'اسم العائلة': 'lastName', 'family name': 'lastName',
        'email': 'email', 'e-mail': 'email', 'البريد': 'email', 'الإيميل': 'email', 'الايميل': 'email', 'بريد': 'email',
        'phone': 'phone', 'mobile': 'phone', 'الجوال': 'phone', 'الهاتف': 'phone',
        'رقم الجوال': 'phone', 'رقم': 'phone', 'tel': 'phone',
        'gender': 'gender', 'الجنس': 'gender', 'sex': 'gender',
        'birth date': 'birthDate', 'birthdate': 'birthDate', 'birth_date': 'birthDate',
        'تاريخ الميلاد': 'birthDate', 'dob': 'birthDate',
        'language': 'language', 'اللغة': 'language', 'lang': 'language',
        'source': 'acquisitionSource', 'acquisition source': 'acquisitionSource',
        'acquisition_source': 'acquisitionSource', 'مصدر': 'acquisitionSource',
        'channel': 'acquisitionChannel', 'acquisition channel': 'acquisitionChannel',
        'acquisition_channel': 'acquisitionChannel', 'قناة': 'acquisitionChannel',
        'city': 'city', 'المدينة': 'city', 'مدينة': 'city',
        'marketing consent': 'marketingConsent', 'marketingconsent': 'marketingConsent',
        'موافقة': 'marketingConsent', 'consent': 'marketingConsent',
        'spent': 'totalSpent', 'total spent': 'totalSpent', 'total_spent': 'totalSpent',
        'إنفاق': 'totalSpent', 'إجمالي الإنفاق': 'totalSpent',
        'orders': 'totalOrders', 'total orders': 'totalOrders', 'total_orders': 'totalOrders',
        'طلبات': 'totalOrders', 'عدد الطلبات': 'totalOrders',
    };
    return headers.map(h => map[h.toLowerCase().trim()] ?? '');
}

function rowsToCustomers(columnMap: CrmField[], dataRows: string[][]): Partial<CrmCustomer>[] {
    return dataRows.map(row => {
        const customer: Record<string, unknown> = { metadata: {} };
        columnMap.forEach((field, i) => {
            if (!field) return;
            const val = (row[i] ?? '').trim();
            if (!val) return;
            if (field === 'city') {
                (customer.metadata as Record<string, unknown>).city = val;
            } else if (field === 'marketingConsent') {
                customer.marketingConsent = ['true', '1', 'yes', 'نعم'].includes(val.toLowerCase());
            } else if (field === 'totalSpent') {
                customer.totalSpent = Number(val.replace(/[^0-9.]/g, '')) || 0;
            } else if (field === 'totalOrders') {
                customer.totalOrders = Number(val.replace(/[^0-9]/g, '')) || 0;
            } else {
                customer[field] = val;
            }
        });
        return customer as Partial<CrmCustomer>;
    }).filter(c => c.email || c.phone || c.firstName);
}

function downloadTemplate() {
    const headers = ['first_name', 'last_name', 'email', 'phone', 'gender', 'birth_date', 'language', 'acquisition_source', 'city', 'marketing_consent'];
    const example = ['محمد', 'العلي', 'mohammed@example.com', '+966501234567', 'male', '1990-05-15', 'ar', 'social', 'الرياض', 'true'];
    const csv = '﻿' + [headers.join(','), example.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customers_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── Sub-components ────────────────────────────────────────────────────────────

const StepIndicator: React.FC<{ current: Step }> = ({ current }) => {
    const steps: { id: Step; label: string }[] = [
        { id: 'upload',    label: 'رفع الملف' },
        { id: 'map',       label: 'تعيين الأعمدة' },
        { id: 'preview',   label: 'معاينة' },
        { id: 'importing', label: 'استيراد' },
        { id: 'done',      label: 'اكتمل' },
    ];
    const order: Step[] = ['upload', 'map', 'preview', 'importing', 'done'];
    const currentIdx = order.indexOf(current);
    return (
        <div className="flex items-center gap-0 mb-8">
            {steps.map((s, i) => {
                const idx = order.indexOf(s.id);
                const done = idx < currentIdx;
                const active = idx === currentIdx;
                return (
                    <React.Fragment key={s.id}>
                        <div className="flex flex-col items-center gap-1.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                                done   ? 'bg-brand-primary border-brand-primary text-white' :
                                active ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' :
                                         'bg-light-card border-light-border text-light-text-secondary dark:bg-dark-card dark:border-dark-border dark:text-dark-text-secondary'
                            }`}>
                                {done ? <i className="fas fa-check text-[10px]" /> : <span>{i + 1}</span>}
                            </div>
                            <span className={`text-[10px] font-bold whitespace-nowrap ${active ? 'text-brand-primary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                                {s.label}
                            </span>
                        </div>
                        {i < steps.length - 1 && (
                            <div className={`flex-1 h-0.5 mt-[-14px] transition-colors ${idx < currentIdx ? 'bg-brand-primary' : 'bg-light-border dark:bg-dark-border'}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

// ── Main Modal ────────────────────────────────────────────────────────────────

interface ImportCustomersModalProps {
    brandId: string;
    onClose: () => void;
    onImported: () => void;
}

export const ImportCustomersModal: React.FC<ImportCustomersModalProps> = ({ brandId, onClose, onImported }) => {
    const [step, setStep]           = useState<Step>('upload');
    const [headers, setHeaders]     = useState<string[]>([]);
    const [dataRows, setDataRows]   = useState<string[][]>([]);
    const [columnMap, setColumnMap] = useState<CrmField[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [fileName, setFileName]   = useState('');
    const [progress, setProgress]   = useState(0);
    const [result, setResult]       = useState<CrmImportResult | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const processFile = useCallback((file: File) => {
        if (!file.name.match(/\.(csv|txt|tsv)$/i)) {
            alert('يرجى رفع ملف CSV فقط');
            return;
        }
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const rows = parseCSV(text);
            if (rows.length < 2) { alert('الملف فارغ أو لا يحتوي على بيانات'); return; }
            const hdrs = rows[0];
            const data = rows.slice(1).filter(r => r.some(c => c.trim()));
            setHeaders(hdrs);
            setDataRows(data);
            setColumnMap(autoMapHeaders(hdrs));
            setStep('map');
        };
        reader.readAsText(file, 'utf-8');
    }, []);

    const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }, [processFile]);

    const handleImport = async () => {
        setStep('importing');
        setProgress(0);
        const customers = rowsToCustomers(columnMap, dataRows);
        const CHUNK = 50;
        let total = 0;
        const combined: CrmImportResult = { inserted: 0, skipped: 0, errors: [] };
        for (let i = 0; i < customers.length; i += CHUNK) {
            const chunk = customers.slice(i, i + CHUNK);
            const res = await bulkImportCustomers(brandId, chunk);
            combined.inserted += res.inserted;
            combined.skipped  += res.skipped;
            combined.errors.push(...res.errors);
            total += chunk.length;
            setProgress(Math.round((total / customers.length) * 100));
        }
        setResult(combined);
        setStep('done');
    };

    const mappedCount = columnMap.filter(f => f !== '').length;
    const hasIdentifier = columnMap.some(f => f === 'email' || f === 'phone' || f === 'firstName');
    const previewRows = dataRows.slice(0, 5);
    const validCount = rowsToCustomers(columnMap, dataRows).length;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={step === 'importing' ? undefined : onClose} />
            <div className="relative w-full max-w-2xl bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border shadow-2xl rounded-[2rem] overflow-hidden flex flex-col animate-slide-up max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-8 pt-8 pb-4 border-b border-light-border/40 dark:border-dark-border/40">
                    <div>
                        <h2 className="text-xl font-black text-light-text dark:text-dark-text">استيراد العملاء</h2>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-0.5">ارفع ملف CSV لإضافة عملاء بالجملة</p>
                    </div>
                    {step !== 'importing' && (
                        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl border border-light-border dark:border-dark-border text-light-text-secondary hover:text-red-500 hover:border-red-300 transition-colors">
                            <i className="fas fa-times" />
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
                    <StepIndicator current={step} />

                    {/* ── Step: Upload ── */}
                    {step === 'upload' && (
                        <div className="space-y-5">
                            <div
                                className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${isDragging ? 'border-brand-primary bg-brand-primary/5' : 'border-light-border dark:border-dark-border hover:border-brand-primary hover:bg-brand-primary/3'}`}
                                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={onDrop}
                                onClick={() => fileRef.current?.click()}
                            >
                                <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
                                <div className="w-14 h-14 bg-brand-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <i className="fas fa-cloud-upload-alt text-2xl text-brand-primary" />
                                </div>
                                <p className="font-black text-light-text dark:text-dark-text mb-1">اسحب وأفلت ملف CSV هنا</p>
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">أو <span className="text-brand-primary font-bold underline">انقر لاختيار الملف</span></p>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-3 opacity-60">يدعم: .csv · .tsv · .txt</p>
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-light-card dark:bg-dark-card rounded-xl border border-light-border dark:border-dark-border">
                                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <i className="fas fa-file-csv text-green-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-light-text dark:text-dark-text">تحميل القالب</p>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">ملف CSV جاهز بجميع الأعمدة المدعومة مع مثال</p>
                                </div>
                                <button onClick={e => { e.stopPropagation(); downloadTemplate(); }} className="btn px-4 py-2 text-xs font-bold bg-green-500/10 text-green-600 hover:bg-green-500 hover:text-white rounded-xl transition-all">
                                    <i className="fas fa-download me-1.5" />تحميل
                                </button>
                            </div>

                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-4">
                                <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-2"><i className="fas fa-info-circle me-1.5" />الحقول المدعومة</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {ALL_FIELDS.filter(f => f).map(f => (
                                        <span key={f} className="text-[11px] bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                                            {CRM_FIELD_LABELS[f]}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Step: Map Columns ── */}
                    {step === 'map' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-light-text dark:text-dark-text">{fileName}</p>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{dataRows.length} سطر · {headers.length} عمود</p>
                                </div>
                                {!hasIdentifier && (
                                    <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-700/40">
                                        <i className="fas fa-exclamation-triangle me-1.5" />يجب تعيين اسم أو بريد أو جوال
                                    </span>
                                )}
                            </div>
                            <div className="space-y-2 max-h-[340px] overflow-y-auto custom-scrollbar pe-1">
                                {headers.map((header, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl px-4 py-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-light-text dark:text-dark-text truncate">{header}</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5">
                                                مثال: <span className="font-medium">{dataRows[0]?.[i] ?? '—'}</span>
                                            </p>
                                        </div>
                                        <i className="fas fa-arrow-left text-light-text-secondary/40 dark:text-dark-text-secondary/40 text-xs flex-shrink-0" />
                                        <select
                                            value={columnMap[i] ?? ''}
                                            onChange={e => {
                                                const next = [...columnMap];
                                                next[i] = e.target.value as CrmField;
                                                setColumnMap(next);
                                            }}
                                            className="bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm text-light-text dark:text-dark-text outline-none focus:ring-2 focus:ring-brand-primary min-w-[180px]"
                                        >
                                            {ALL_FIELDS.map(f => (
                                                <option key={f} value={f}>{CRM_FIELD_LABELS[f]}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                تم تعيين <strong className="text-brand-primary">{mappedCount}</strong> عمود من أصل {headers.length}
                            </p>
                        </div>
                    )}

                    {/* ── Step: Preview ── */}
                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="flex-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/40 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-black text-green-600">{validCount.toLocaleString('ar')}</p>
                                    <p className="text-xs font-bold text-green-600/70">سجل صالح</p>
                                </div>
                                <div className="flex-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-black text-amber-600">{(dataRows.length - validCount).toLocaleString('ar')}</p>
                                    <p className="text-xs font-bold text-amber-600/70">سيُتجاهل</p>
                                </div>
                            </div>
                            <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">معاينة أول 5 سجلات:</p>
                            <div className="overflow-x-auto rounded-xl border border-light-border dark:border-dark-border">
                                <table className="w-full text-xs text-right">
                                    <thead className="bg-light-bg dark:bg-dark-bg border-b border-light-border dark:border-dark-border">
                                        <tr>
                                            {columnMap.map((f, i) => f ? (
                                                <th key={i} className="px-3 py-2.5 font-bold text-light-text-secondary dark:text-dark-text-secondary whitespace-nowrap">
                                                    {CRM_FIELD_LABELS[f]}
                                                </th>
                                            ) : null)}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-light-border/30 dark:divide-dark-border/30">
                                        {previewRows.map((row, ri) => (
                                            <tr key={ri} className="hover:bg-light-card dark:hover:bg-dark-card transition-colors">
                                                {columnMap.map((f, ci) => f ? (
                                                    <td key={ci} className="px-3 py-2.5 text-light-text dark:text-dark-text font-medium whitespace-nowrap max-w-[140px] truncate">
                                                        {row[ci] || <span className="text-light-text-secondary/40">—</span>}
                                                    </td>
                                                ) : null)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {dataRows.length > 5 && (
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary text-center">
                                    + {(dataRows.length - 5).toLocaleString('ar')} سجل آخر
                                </p>
                            )}
                        </div>
                    )}

                    {/* ── Step: Importing ── */}
                    {step === 'importing' && (
                        <div className="flex flex-col items-center justify-center py-10 gap-6">
                            <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center">
                                <i className="fas fa-circle-notch fa-spin text-brand-primary text-2xl" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-light-text dark:text-dark-text mb-1">جاري الاستيراد...</p>
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{progress}% مكتمل</p>
                            </div>
                            <div className="w-full bg-light-border dark:bg-dark-border rounded-full h-3 overflow-hidden">
                                <div
                                    className="h-full bg-brand-primary rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── Step: Done ── */}
                    {step === 'done' && result && (
                        <div className="space-y-5">
                            <div className="flex flex-col items-center py-4 gap-2">
                                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-2">
                                    <i className="fas fa-check-circle text-green-500 text-3xl" />
                                </div>
                                <p className="text-xl font-black text-light-text dark:text-dark-text">اكتمل الاستيراد!</p>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/40 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-black text-green-600">{result.inserted.toLocaleString('ar')}</p>
                                    <p className="text-xs font-bold text-green-600/70 mt-1">تم الاستيراد</p>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-black text-amber-600">{result.skipped.toLocaleString('ar')}</p>
                                    <p className="text-xs font-bold text-amber-600/70 mt-1">تم التجاهل</p>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-black text-red-500">{result.errors.length.toLocaleString('ar')}</p>
                                    <p className="text-xs font-bold text-red-500/70 mt-1">أخطاء</p>
                                </div>
                            </div>
                            {result.errors.length > 0 && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-xl p-4 max-h-28 overflow-y-auto custom-scrollbar">
                                    <p className="text-xs font-bold text-red-600 mb-2">تفاصيل الأخطاء:</p>
                                    {result.errors.slice(0, 5).map((e, i) => (
                                        <p key={i} className="text-xs text-red-500">سطر {e.rowIndex + 1}: {e.reason}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-8 py-5 border-t border-light-border/40 dark:border-dark-border/40 bg-light-card/50 dark:bg-dark-card/50">
                    <div>
                        {step === 'map' && (
                            <button onClick={() => setStep('upload')} className="btn px-4 py-2.5 text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text rounded-xl border border-light-border dark:border-dark-border hover:shadow-sm transition-all">
                                <i className="fas fa-arrow-right me-2" />رجوع
                            </button>
                        )}
                        {step === 'preview' && (
                            <button onClick={() => setStep('map')} className="btn px-4 py-2.5 text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text rounded-xl border border-light-border dark:border-dark-border hover:shadow-sm transition-all">
                                <i className="fas fa-arrow-right me-2" />رجوع
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {step === 'upload' && (
                            <button onClick={onClose} className="btn px-5 py-2.5 text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary border border-light-border dark:border-dark-border rounded-xl hover:shadow-sm transition-all">
                                إلغاء
                            </button>
                        )}
                        {step === 'map' && (
                            <button
                                onClick={() => setStep('preview')}
                                disabled={!hasIdentifier}
                                className="btn px-6 py-2.5 text-sm font-black bg-brand-primary text-white rounded-xl shadow-md shadow-brand-primary/20 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
                            >
                                معاينة <i className="fas fa-arrow-left ms-2" />
                            </button>
                        )}
                        {step === 'preview' && (
                            <button
                                onClick={handleImport}
                                disabled={validCount === 0}
                                className="btn px-6 py-2.5 text-sm font-black bg-brand-primary text-white rounded-xl shadow-md shadow-brand-primary/20 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
                            >
                                <i className="fas fa-file-import me-2" />استيراد {validCount.toLocaleString('ar')} عميل
                            </button>
                        )}
                        {step === 'done' && (
                            <>
                                <button onClick={onClose} className="btn px-5 py-2.5 text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary border border-light-border dark:border-dark-border rounded-xl hover:shadow-sm transition-all">
                                    إغلاق
                                </button>
                                <button
                                    onClick={() => { onImported(); onClose(); }}
                                    className="btn px-6 py-2.5 text-sm font-black bg-brand-primary text-white rounded-xl shadow-md shadow-brand-primary/20 hover:-translate-y-0.5 active:scale-95 transition-all"
                                >
                                    <i className="fas fa-users me-2" />عرض العملاء
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
