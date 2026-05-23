// components/shared/BotFlowBuilder.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Visual Flow Builder — بناء مسار محادثة البوت بصرياً
// Pure SVG + React — no external dependencies
// ─────────────────────────────────────────────────────────────────────────────

import React, {
    useState, useRef, useCallback, useEffect, useId,
} from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type FlowNodeType =
    | 'start'       // نقطة البداية — دائماً موجودة
    | 'message'     // رسالة من البوت
    | 'question'    // سؤال + خيارات متعددة
    | 'condition'   // شرط (if/else)
    | 'action'      // إجراء: تصعيد / إرسال لـ CRM / إنهاء
    | 'end';        // نهاية المسار

export type FlowActionType =
    | 'escalate'    // تصعيد لإنسان
    | 'crm_lead'    // إنشاء lead في CRM
    | 'crm_ticket'  // إنشاء ticket في CRM
    | 'close'       // إنهاء المحادثة
    | 'handoff';    // تحويل لبوت آخر

export interface FlowNodeChoice {
    id: string;
    label: string;          // نص الخيار
    nextNodeId: string | null;
}

export interface FlowNode {
    id: string;
    type: FlowNodeType;
    x: number;              // موضع على الـ canvas
    y: number;
    // content
    title: string;          // عنوان النود (للعرض)
    message?: string;       // نص الرسالة
    choices?: FlowNodeChoice[];  // للنوع question
    conditionLabel?: string;     // للنوع condition
    actionType?: FlowActionType; // للنوع action
    // connection
    nextNodeId?: string | null;  // للأنواع البسيطة (message/action/end)
}

export interface FlowEdge {
    id: string;
    fromNodeId: string;
    fromChoiceId?: string;  // إذا جاء من choice
    toNodeId: string;
}

export interface BotFlow {
    id: string;
    personaId: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
    createdAt: string;
    updatedAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NODE_WIDTH  = 220;
const NODE_HEIGHT = 80;   // minimum height
const GRID        = 20;   // snap to grid

const NODE_COLORS: Record<FlowNodeType, { bg: string; border: string; icon: string; iconColor: string; label: string }> = {
    start:     { bg: 'bg-emerald-500/10',  border: 'border-emerald-500/40',  icon: 'fa-play-circle',      iconColor: 'text-emerald-500',  label: 'بداية' },
    message:   { bg: 'bg-blue-500/10',     border: 'border-blue-500/40',     icon: 'fa-comment-dots',     iconColor: 'text-blue-500',     label: 'رسالة' },
    question:  { bg: 'bg-violet-500/10',   border: 'border-violet-500/40',   icon: 'fa-circle-question',  iconColor: 'text-violet-500',   label: 'سؤال' },
    condition: { bg: 'bg-amber-500/10',    border: 'border-amber-500/40',    icon: 'fa-code-branch',      iconColor: 'text-amber-500',    label: 'شرط' },
    action:    { bg: 'bg-orange-500/10',   border: 'border-orange-500/40',   icon: 'fa-bolt',             iconColor: 'text-orange-500',   label: 'إجراء' },
    end:       { bg: 'bg-red-500/10',      border: 'border-red-500/40',      icon: 'fa-stop-circle',      iconColor: 'text-red-500',      label: 'نهاية' },
};

const ACTION_LABELS: Record<FlowActionType, string> = {
    escalate:   '⚠️ تصعيد لإنسان',
    crm_lead:   '📋 إنشاء Lead',
    crm_ticket: '🎫 إنشاء Ticket',
    close:      '✅ إنهاء المحادثة',
    handoff:    '🤖 تحويل لبوت آخر',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function snap(v: number): number {
    return Math.round(v / GRID) * GRID;
}

function makeId(): string {
    return crypto.randomUUID();
}

function getNodeOutputY(node: FlowNode, choiceIdx?: number): number {
    if (node.type === 'question' && node.choices && choiceIdx !== undefined) {
        // each choice has its own output port
        const baseY = node.y + NODE_HEIGHT;
        return baseY + choiceIdx * 28 + 14;
    }
    return node.y + NODE_HEIGHT;
}

function getNodeOutputX(node: FlowNode): number {
    return node.x + NODE_WIDTH / 2;
}

// SVG path: smooth cubic bezier between two points
function edgePath(x1: number, y1: number, x2: number, y2: number): string {
    const dy = Math.abs(y2 - y1);
    const cp = Math.max(dy * 0.5, 60);
    return `M ${x1} ${y1} C ${x1} ${y1 + cp}, ${x2} ${y2 - cp}, ${x2} ${y2}`;
}

// ── Default flow (مسار افتراضي للبدء) ────────────────────────────────────────

function createDefaultFlow(personaId: string): BotFlow {
    const startId   = makeId();
    const msgId     = makeId();
    const questionId = makeId();
    const choice1Id = makeId();
    const choice2Id = makeId();
    const action1Id = makeId();
    const endId     = makeId();

    return {
        id: makeId(),
        personaId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nodes: [
            {
                id: startId, type: 'start',
                x: 300, y: 40,
                title: 'بداية المحادثة',
                message: 'أهلاً! كيف أقدر أساعدك؟ 👋',
                nextNodeId: msgId,
            },
            {
                id: msgId, type: 'message',
                x: 300, y: 200,
                title: 'رسالة ترحيب',
                message: 'يسعدني مساعدتك! أخبرني ما تحتاج.',
                nextNodeId: questionId,
            },
            {
                id: questionId, type: 'question',
                x: 300, y: 360,
                title: 'ما هدفك؟',
                message: 'اختر ما يناسبك:',
                choices: [
                    { id: choice1Id, label: 'أريد معرفة الأسعار', nextNodeId: action1Id },
                    { id: choice2Id, label: 'لدي مشكلة أو شكوى', nextNodeId: endId },
                ],
            },
            {
                id: action1Id, type: 'action',
                x: 160, y: 580,
                title: 'إنشاء Lead',
                actionType: 'crm_lead',
                nextNodeId: endId,
            },
            {
                id: endId, type: 'end',
                x: 440, y: 580,
                title: 'إنهاء',
                actionType: 'close',
            },
        ],
        edges: [
            { id: makeId(), fromNodeId: startId,    toNodeId: msgId },
            { id: makeId(), fromNodeId: msgId,      toNodeId: questionId },
            { id: makeId(), fromNodeId: questionId, fromChoiceId: choice1Id, toNodeId: action1Id },
            { id: makeId(), fromNodeId: questionId, fromChoiceId: choice2Id, toNodeId: endId },
            { id: makeId(), fromNodeId: action1Id,  toNodeId: endId },
        ],
    };
}

// ── Node Editor Panel ─────────────────────────────────────────────────────────

interface NodeEditorProps {
    node: FlowNode;
    onChange: (updated: FlowNode) => void;
    onClose: () => void;
    onDelete: () => void;
}

const NodeEditor: React.FC<NodeEditorProps> = ({ node, onChange, onClose, onDelete }) => {
    const [local, setLocal] = useState<FlowNode>(node);
    const isReadonly = node.type === 'start' || node.type === 'end';

    const update = (patch: Partial<FlowNode>) => {
        const updated = { ...local, ...patch };
        setLocal(updated);
        onChange(updated);
    };

    const addChoice = () => {
        const choices = [...(local.choices || []), { id: makeId(), label: 'خيار جديد', nextNodeId: null }];
        update({ choices });
    };

    const updateChoice = (idx: number, patch: Partial<FlowNodeChoice>) => {
        const choices = (local.choices || []).map((c, i) => i === idx ? { ...c, ...patch } : c);
        update({ choices });
    };

    const removeChoice = (idx: number) => {
        const choices = (local.choices || []).filter((_, i) => i !== idx);
        update({ choices });
    };

    const colors = NODE_COLORS[node.type];

    return (
        <div className="absolute top-0 right-0 h-full w-80 bg-white dark:bg-[#0d1629] border-s border-light-border dark:border-dark-border flex flex-col shadow-2xl z-20 animate-slide-in-right">
            {/* Header */}
            <div className={`p-4 border-b border-light-border dark:border-dark-border flex items-center gap-3`}>
                <div className={`w-8 h-8 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center`}>
                    <i className={`fas ${colors.icon} text-sm ${colors.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{colors.label}</p>
                    <p className="text-sm font-bold text-light-text dark:text-dark-text truncate">{local.title}</p>
                </div>
                <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-light-text-secondary hover:bg-light-card dark:hover:bg-dark-card transition">
                    <i className="fas fa-times text-xs" />
                </button>
            </div>

            {/* Fields */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                    <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5 block">اسم النود</label>
                    <input
                        value={local.title}
                        onChange={e => update({ title: e.target.value })}
                        disabled={isReadonly}
                        className="w-full rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg px-3 py-2 text-sm text-light-text dark:text-dark-text focus:outline-none focus:border-violet-500 disabled:opacity-50"
                        placeholder="اسم واضح للخطوة..."
                    />
                </div>

                {(node.type === 'start' || node.type === 'message' || node.type === 'question') && (
                    <div>
                        <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5 block">
                            نص الرسالة
                        </label>
                        <textarea
                            value={local.message || ''}
                            onChange={e => update({ message: e.target.value })}
                            rows={4}
                            className="w-full rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg px-3 py-2 text-sm text-light-text dark:text-dark-text focus:outline-none focus:border-violet-500 resize-none"
                            placeholder="اكتب ما سيقوله البوت..."
                        />
                        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1 text-end">
                            {(local.message || '').length}/500
                        </p>
                    </div>
                )}

                {node.type === 'question' && (
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">الخيارات</label>
                            <button
                                onClick={addChoice}
                                className="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 flex items-center gap-1"
                            >
                                <i className="fas fa-plus" /> إضافة خيار
                            </button>
                        </div>
                        <div className="space-y-2">
                            {(local.choices || []).map((choice, i) => (
                                <div key={choice.id} className="flex items-center gap-2 group">
                                    <div className="w-5 h-5 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center shrink-0">
                                        <span className="text-[9px] font-bold text-violet-600">{i + 1}</span>
                                    </div>
                                    <input
                                        value={choice.label}
                                        onChange={e => updateChoice(i, { label: e.target.value })}
                                        className="flex-1 rounded-lg border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg px-2 py-1.5 text-xs text-light-text dark:text-dark-text focus:outline-none focus:border-violet-500"
                                        placeholder={`الخيار ${i + 1}...`}
                                    />
                                    <button
                                        onClick={() => removeChoice(i)}
                                        className="w-6 h-6 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition"
                                    >
                                        <i className="fas fa-times text-[10px]" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {node.type === 'action' && (
                    <div>
                        <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5 block">نوع الإجراء</label>
                        <div className="space-y-2">
                            {(Object.entries(ACTION_LABELS) as [FlowActionType, string][]).map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => update({ actionType: key })}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all text-start ${
                                        local.actionType === key
                                            ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold'
                                            : 'border-light-border dark:border-dark-border text-light-text dark:text-dark-text hover:border-orange-500/50'
                                    }`}
                                >
                                    <span>{label}</span>
                                    {local.actionType === key && <i className="fas fa-check ms-auto text-xs" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {node.type === 'condition' && (
                    <div>
                        <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5 block">وصف الشرط</label>
                        <input
                            value={local.conditionLabel || ''}
                            onChange={e => update({ conditionLabel: e.target.value })}
                            className="w-full rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg px-3 py-2 text-sm text-light-text dark:text-dark-text focus:outline-none focus:border-amber-500"
                            placeholder="مثال: إذا ذكر سعر أو خصم..."
                        />
                    </div>
                )}
            </div>

            {/* Footer */}
            {!isReadonly && (
                <div className="p-4 border-t border-light-border dark:border-dark-border">
                    <button
                        onClick={onDelete}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-red-200 dark:border-red-900/50 text-red-500 text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                    >
                        <i className="fas fa-trash text-xs" />
                        حذف هذه الخطوة
                    </button>
                </div>
            )}
        </div>
    );
};

// ── Main BotFlowBuilder ───────────────────────────────────────────────────────

interface BotFlowBuilderProps {
    personaId: string;
    personaName: string;
    personaEmoji: string;
    initialFlow?: BotFlow | null;
    onChange?: (flow: BotFlow) => void;
    onClose: () => void;
}

export const BotFlowBuilder: React.FC<BotFlowBuilderProps> = ({
    personaId,
    personaName,
    personaEmoji,
    initialFlow,
    onChange,
    onClose,
}) => {
    const uid = useId();
    const [flow, setFlow] = useState<BotFlow>(() => initialFlow ?? createDefaultFlow(personaId));
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [dragging, setDragging] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
    const [connecting, setConnecting] = useState<{ fromNodeId: string; fromChoiceId?: string } | null>(null);
    const [connectingPos, setConnectingPos] = useState<{ x: number; y: number } | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [showAddMenu, setShowAddMenu] = useState<{ x: number; y: number } | null>(null);

    const canvasRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedNode = flow.nodes.find(n => n.id === selectedNodeId) ?? null;

    // ── Update flow helper ─────────────────────────────────────────────────
    const updateFlow = useCallback((patch: Partial<BotFlow>) => {
        setFlow(prev => {
            const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
            onChange?.(next);
            return next;
        });
    }, [onChange]);

    // ── Canvas coords from screen ──────────────────────────────────────────
    const screenToCanvas = useCallback((sx: number, sy: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        return {
            x: (sx - rect.left - pan.x) / zoom,
            y: (sy - rect.top  - pan.y) / zoom,
        };
    }, [pan, zoom]);

    // ── Drag ───────────────────────────────────────────────────────────────
    const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
        if (connecting) return;
        e.stopPropagation();
        const node = flow.nodes.find(n => n.id === nodeId)!;
        const canvas = screenToCanvas(e.clientX, e.clientY);
        setDragging({ nodeId, offsetX: canvas.x - node.x, offsetY: canvas.y - node.y });
        setSelectedNodeId(nodeId);
        setShowAddMenu(null);
    }, [flow.nodes, connecting, screenToCanvas]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (dragging) {
            const canvas = screenToCanvas(e.clientX, e.clientY);
            const nx = snap(canvas.x - dragging.offsetX);
            const ny = snap(canvas.y - dragging.offsetY);
            updateFlow({
                nodes: flow.nodes.map(n =>
                    n.id === dragging.nodeId ? { ...n, x: Math.max(0, nx), y: Math.max(0, ny) } : n
                ),
            });
        }
        if (connecting) {
            const canvas = screenToCanvas(e.clientX, e.clientY);
            setConnectingPos(canvas);
        }
        if (isPanning) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            setPan(p => ({ x: p.x + dx, y: p.y + dy }));
            setPanStart({ x: e.clientX, y: e.clientY });
        }
    }, [dragging, connecting, isPanning, panStart, flow.nodes, screenToCanvas, updateFlow]);

    const handleMouseUp = useCallback(() => {
        setDragging(null);
        setIsPanning(false);
        if (connecting) {
            setConnecting(null);
            setConnectingPos(null);
        }
    }, [connecting]);

    // ── Canvas pan on empty space ──────────────────────────────────────────
    const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.target === canvasRef.current || (e.target as SVGElement).tagName === 'svg') {
            if (connecting) {
                setConnecting(null);
                setConnectingPos(null);
            } else {
                setSelectedNodeId(null);
                setShowAddMenu(null);
                setIsPanning(true);
                setPanStart({ x: e.clientX, y: e.clientY });
            }
        }
    }, [connecting]);

    // ── Connect: start from output port ───────────────────────────────────
    const startConnect = useCallback((e: React.MouseEvent, fromNodeId: string, fromChoiceId?: string) => {
        e.stopPropagation();
        setConnecting({ fromNodeId, fromChoiceId });
        const canvas = screenToCanvas(e.clientX, e.clientY);
        setConnectingPos(canvas);
    }, [screenToCanvas]);

    // ── Connect: drop on target node ──────────────────────────────────────
    const finishConnect = useCallback((e: React.MouseEvent, toNodeId: string) => {
        e.stopPropagation();
        if (!connecting || connecting.fromNodeId === toNodeId) {
            setConnecting(null);
            setConnectingPos(null);
            return;
        }

        // Remove existing edge from same source/choice
        const filteredEdges = flow.edges.filter(edge => {
            if (connecting.fromChoiceId) {
                return edge.fromChoiceId !== connecting.fromChoiceId;
            }
            return !(edge.fromNodeId === connecting.fromNodeId && !edge.fromChoiceId);
        });

        // Update node's nextNodeId OR choice's nextNodeId
        let updatedNodes = flow.nodes;
        if (connecting.fromChoiceId) {
            updatedNodes = flow.nodes.map(n => {
                if (n.id !== connecting.fromNodeId) return n;
                return {
                    ...n,
                    choices: (n.choices || []).map(c =>
                        c.id === connecting.fromChoiceId ? { ...c, nextNodeId: toNodeId } : c
                    ),
                };
            });
        } else {
            updatedNodes = flow.nodes.map(n =>
                n.id === connecting.fromNodeId ? { ...n, nextNodeId: toNodeId } : n
            );
        }

        const newEdge: FlowEdge = {
            id: makeId(),
            fromNodeId: connecting.fromNodeId,
            fromChoiceId: connecting.fromChoiceId,
            toNodeId,
        };

        updateFlow({ nodes: updatedNodes, edges: [...filteredEdges, newEdge] });
        setConnecting(null);
        setConnectingPos(null);
    }, [connecting, flow.edges, flow.nodes, updateFlow]);

    // ── Add node ──────────────────────────────────────────────────────────
    const addNode = useCallback((type: FlowNodeType, atX?: number, atY?: number) => {
        const x = atX ?? snap(200 + Math.random() * 200);
        const y = atY ?? snap(200 + Math.random() * 200);
        const defaults: Record<FlowNodeType, Partial<FlowNode>> = {
            start:     { title: 'بداية', message: 'أهلاً! كيف أقدر أساعدك؟' },
            message:   { title: 'رسالة جديدة', message: 'اكتب رسالتك هنا...' },
            question:  { title: 'سؤال', message: 'اختر:', choices: [
                { id: makeId(), label: 'خيار 1', nextNodeId: null },
                { id: makeId(), label: 'خيار 2', nextNodeId: null },
            ]},
            condition: { title: 'شرط', conditionLabel: 'إذا ذكر...' },
            action:    { title: 'إجراء', actionType: 'escalate' },
            end:       { title: 'نهاية', actionType: 'close' },
        };
        const newNode: FlowNode = { id: makeId(), type, x, y, ...defaults[type] } as FlowNode;
        updateFlow({ nodes: [...flow.nodes, newNode] });
        setSelectedNodeId(newNode.id);
        setShowAddMenu(null);
    }, [flow.nodes, updateFlow]);

    // ── Delete node ───────────────────────────────────────────────────────
    const deleteNode = useCallback((nodeId: string) => {
        updateFlow({
            nodes: flow.nodes.filter(n => n.id !== nodeId),
            edges: flow.edges.filter(e => e.fromNodeId !== nodeId && e.toNodeId !== nodeId),
        });
        setSelectedNodeId(null);
    }, [flow.nodes, flow.edges, updateFlow]);

    // ── Update node ───────────────────────────────────────────────────────
    const updateNode = useCallback((updated: FlowNode) => {
        updateFlow({ nodes: flow.nodes.map(n => n.id === updated.id ? updated : n) });
    }, [flow.nodes, updateFlow]);

    // ── Zoom ──────────────────────────────────────────────────────────────
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        setZoom(z => Math.min(2, Math.max(0.3, z - e.deltaY * 0.001)));
    }, []);

    // ── Keyboard ──────────────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (connecting) { setConnecting(null); setConnectingPos(null); }
                else if (selectedNodeId) setSelectedNodeId(null);
                else onClose();
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
                const node = flow.nodes.find(n => n.id === selectedNodeId);
                if (node && node.type !== 'start') {
                    deleteNode(selectedNodeId);
                }
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [connecting, selectedNodeId, flow.nodes, deleteNode, onClose]);

    // ── Render edges (SVG) ────────────────────────────────────────────────
    const renderEdges = () => {
        return flow.edges.map(edge => {
            const fromNode = flow.nodes.find(n => n.id === edge.fromNodeId);
            const toNode   = flow.nodes.find(n => n.id === edge.toNodeId);
            if (!fromNode || !toNode) return null;

            let fromY: number;
            if (edge.fromChoiceId && fromNode.choices) {
                const choiceIdx = fromNode.choices.findIndex(c => c.id === edge.fromChoiceId);
                fromY = getNodeOutputY(fromNode, choiceIdx);
            } else {
                fromY = getNodeOutputY(fromNode);
            }
            const fromX = getNodeOutputX(fromNode);
            const toX = toNode.x + NODE_WIDTH / 2;
            const toY = toNode.y;

            const path = edgePath(fromX, fromY, toX, toY);
            const isHighlighted = selectedNodeId === fromNode.id || selectedNodeId === toNode.id;

            return (
                <g key={edge.id}>
                    {/* shadow */}
                    <path d={path} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={4} strokeLinecap="round" />
                    <path
                        d={path}
                        fill="none"
                        stroke={isHighlighted ? '#7c3aed' : '#6366f1'}
                        strokeWidth={isHighlighted ? 2.5 : 1.5}
                        strokeLinecap="round"
                        opacity={isHighlighted ? 1 : 0.5}
                        strokeDasharray={isHighlighted ? undefined : '6 3'}
                    />
                    {/* arrowhead */}
                    <polygon
                        points={`${toX},${toY} ${toX - 5},${toY - 8} ${toX + 5},${toY - 8}`}
                        fill={isHighlighted ? '#7c3aed' : '#6366f1'}
                        opacity={isHighlighted ? 1 : 0.5}
                    />
                </g>
            );
        });
    };

    // ── Render live connecting line ────────────────────────────────────────
    const renderConnectingLine = () => {
        if (!connecting || !connectingPos) return null;
        const fromNode = flow.nodes.find(n => n.id === connecting.fromNodeId);
        if (!fromNode) return null;
        let fromY: number;
        if (connecting.fromChoiceId && fromNode.choices) {
            const idx = fromNode.choices.findIndex(c => c.id === connecting.fromChoiceId);
            fromY = getNodeOutputY(fromNode, idx);
        } else {
            fromY = getNodeOutputY(fromNode);
        }
        const fromX = getNodeOutputX(fromNode);
        return (
            <path
                d={edgePath(fromX, fromY, connectingPos.x, connectingPos.y)}
                fill="none"
                stroke="#7c3aed"
                strokeWidth={2}
                strokeDasharray="6 3"
                strokeLinecap="round"
                opacity={0.8}
            />
        );
    };

    // ── Render a single node ──────────────────────────────────────────────
    const renderNode = (node: FlowNode) => {
        const colors = NODE_COLORS[node.type];
        const isSelected = selectedNodeId === node.id;
        const isConnectTarget = !!connecting && connecting.fromNodeId !== node.id;

        // Dynamic height based on choices
        const choiceCount = node.choices?.length ?? 0;
        const nodeH = NODE_HEIGHT + (node.type === 'question' ? choiceCount * 28 : 0);

        return (
            <foreignObject
                key={node.id}
                x={node.x}
                y={node.y}
                width={NODE_WIDTH}
                height={nodeH + 40}
                style={{ overflow: 'visible' }}
            >
                <div
                    className={`relative select-none cursor-grab active:cursor-grabbing transition-all duration-150 ${isSelected ? 'scale-[1.02]' : ''}`}
                    onMouseDown={e => handleNodeMouseDown(e, node.id)}
                    onClick={e => { e.stopPropagation(); setSelectedNodeId(node.id); }}
                >
                    {/* Input port (top) */}
                    {node.type !== 'start' && (
                        <div
                            className={`absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-crosshair transition-all z-10
                                ${isConnectTarget
                                    ? 'bg-violet-500 border-violet-300 scale-125 shadow-lg shadow-violet-500/40'
                                    : 'bg-white dark:bg-dark-card border-light-border dark:border-dark-border hover:border-violet-400'}`}
                            onMouseUp={e => finishConnect(e, node.id)}
                        >
                            <div className="w-2 h-2 rounded-full bg-violet-400" />
                        </div>
                    )}

                    {/* Node body */}
                    <div className={`rounded-2xl border-2 overflow-hidden transition-all
                        ${isSelected
                            ? 'border-violet-500 shadow-xl shadow-violet-500/20'
                            : `${colors.border} shadow-md hover:shadow-lg`}
                        bg-white dark:bg-[#0d1629]`}
                        style={{ minHeight: NODE_HEIGHT }}
                    >
                        {/* Node header */}
                        <div className={`flex items-center gap-2 px-3 py-2 ${colors.bg} border-b border-light-border/40 dark:border-dark-border/40`}>
                            <i className={`fas ${colors.icon} text-xs ${colors.iconColor}`} />
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.iconColor}`}>{colors.label}</span>
                            {node.type === 'start' && (
                                <span className="ms-auto flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                                    LIVE
                                </span>
                            )}
                        </div>

                        {/* Node content */}
                        <div className="px-3 py-2.5">
                            <p className="text-xs font-bold text-light-text dark:text-dark-text mb-1 truncate">{node.title}</p>
                            {node.message && (
                                <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary leading-relaxed line-clamp-2">
                                    {node.message}
                                </p>
                            )}
                            {node.type === 'action' && node.actionType && (
                                <p className="text-[11px] font-bold text-orange-600 dark:text-orange-400">
                                    {ACTION_LABELS[node.actionType]}
                                </p>
                            )}
                            {node.type === 'condition' && node.conditionLabel && (
                                <p className="text-[11px] text-amber-600 dark:text-amber-400 italic">{node.conditionLabel}</p>
                            )}

                            {/* Choices */}
                            {node.type === 'question' && (node.choices || []).map((choice, idx) => (
                                <div key={choice.id} className="relative flex items-center gap-2 mt-1.5">
                                    <div className="flex-1 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/50 rounded-lg px-2 py-1">
                                        <span className="text-[10px] font-medium text-violet-700 dark:text-violet-300 truncate block">{choice.label}</span>
                                    </div>
                                    {/* choice output port */}
                                    <div
                                        className="w-4 h-4 rounded-full bg-violet-100 dark:bg-violet-900/30 border-2 border-violet-400 hover:bg-violet-500 hover:border-violet-300 cursor-crosshair transition-all flex items-center justify-center shrink-0"
                                        onMouseDown={e => { e.stopPropagation(); startConnect(e, node.id, choice.id); }}
                                        title="اسحب لربط هذا الخيار"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Output port (bottom) — not for question nodes */}
                    {node.type !== 'end' && node.type !== 'question' && (
                        <div
                            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 bg-white dark:bg-dark-card border-light-border dark:border-dark-border hover:border-violet-400 hover:bg-violet-50 cursor-crosshair transition-all z-10 flex items-center justify-center"
                            onMouseDown={e => { e.stopPropagation(); startConnect(e, node.id); }}
                            title="اسحب لربط الخطوة التالية"
                        >
                            <i className="fas fa-arrow-down text-[7px] text-violet-400" />
                        </div>
                    )}
                </div>
            </foreignObject>
        );
    };

    // ── Stats ──────────────────────────────────────────────────────────────
    const nodeCount   = flow.nodes.length;
    const pathCount   = flow.edges.length;
    const hasEnd      = flow.nodes.some(n => n.type === 'end');

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#070e1c]" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>

            {/* ── Top Bar ─────────────────────────────────────────────────── */}
            <div className="flex items-center gap-4 px-5 py-3 bg-[#0d1629]/90 border-b border-dark-border/40 backdrop-blur-sm shrink-0">
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-dark-text-secondary transition">
                    <i className="fas fa-times text-sm" />
                </button>
                <div className="flex items-center gap-2">
                    <span className="text-xl">{personaEmoji}</span>
                    <div>
                        <p className="text-sm font-bold text-white">{personaName}</p>
                        <p className="text-[10px] text-dark-text-secondary">Flow Builder — بناء مسار المحادثة</p>
                    </div>
                </div>

                {/* Stats pills */}
                <div className="flex items-center gap-2 ms-4">
                    {[
                        { label: 'خطوة', value: nodeCount, color: 'bg-blue-500/20 text-blue-400' },
                        { label: 'مسار', value: pathCount, color: 'bg-violet-500/20 text-violet-400' },
                        { label: hasEnd ? '✓ مكتمل' : '⚠ ناقص', value: '', color: hasEnd ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400' },
                    ].map(s => (
                        <span key={s.label} className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${s.color}`}>
                            {s.value} {s.label}
                        </span>
                    ))}
                </div>

                <div className="ms-auto flex items-center gap-2">
                    {/* Zoom controls */}
                    <div className="flex items-center gap-1 bg-white/5 rounded-xl px-2 py-1">
                        <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="w-6 h-6 flex items-center justify-center text-dark-text-secondary hover:text-white transition">
                            <i className="fas fa-minus text-[10px]" />
                        </button>
                        <span className="text-[11px] font-bold text-dark-text-secondary w-10 text-center">{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="w-6 h-6 flex items-center justify-center text-dark-text-secondary hover:text-white transition">
                            <i className="fas fa-plus text-[10px]" />
                        </button>
                    </div>
                    <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="text-[11px] font-bold text-dark-text-secondary hover:text-white px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition">
                        Reset
                    </button>

                    {/* Save */}
                    <button
                        onClick={() => { onChange?.(flow); onClose(); }}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-bold rounded-xl hover:opacity-90 transition shadow-lg shadow-violet-500/20"
                    >
                        <i className="fas fa-save text-xs" />
                        حفظ الـ Flow
                    </button>
                </div>
            </div>

            {/* ── Add Node Toolbar (left) ──────────────────────────────────── */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2">
                {(Object.entries(NODE_COLORS) as [FlowNodeType, typeof NODE_COLORS[FlowNodeType]][])
                    .filter(([type]) => type !== 'start')
                    .map(([type, meta]) => (
                        <button
                            key={type}
                            onClick={() => addNode(type)}
                            title={`إضافة: ${meta.label}`}
                            className={`group w-10 h-10 rounded-xl border ${meta.border} ${meta.bg} flex items-center justify-center transition-all hover:scale-110 hover:shadow-lg`}
                        >
                            <i className={`fas ${meta.icon} text-sm ${meta.iconColor}`} />
                            <div className="absolute left-12 bg-[#0d1629] border border-dark-border/40 text-white text-xs font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
                                {meta.label}
                            </div>
                        </button>
                    ))
                }
            </div>

            {/* ── Canvas ──────────────────────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden relative">
                <div
                    ref={containerRef}
                    className="flex-1 relative overflow-hidden"
                    onWheel={handleWheel}
                    style={{ cursor: isPanning ? 'grabbing' : connecting ? 'crosshair' : 'default' }}
                >
                    {/* Grid background */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id={`${uid}-grid`} width={GRID * zoom} height={GRID * zoom}
                                x={pan.x % (GRID * zoom)} y={pan.y % (GRID * zoom)}
                                patternUnits="userSpaceOnUse">
                                <circle cx={0} cy={0} r={0.8} fill="rgba(99,102,241,0.15)" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill={`url(#${uid}-grid)`} />
                    </svg>

                    {/* Main SVG canvas */}
                    <svg
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full"
                        onMouseDown={handleCanvasMouseDown}
                    >
                        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                            {/* Edges */}
                            {renderEdges()}
                            {renderConnectingLine()}
                            {/* Nodes */}
                            {flow.nodes.map(renderNode)}
                        </g>
                    </svg>

                    {/* Hint when connecting */}
                    {connecting && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg animate-bounce pointer-events-none">
                            <i className="fas fa-arrow-up me-2" />
                            اسحب واختر النود التالية — اضغط Esc للإلغاء
                        </div>
                    )}
                </div>

                {/* ── Right Panel: Node Editor ─────────────────────────────── */}
                {selectedNode && (
                    <NodeEditor
                        node={selectedNode}
                        onChange={updateNode}
                        onClose={() => setSelectedNodeId(null)}
                        onDelete={() => deleteNode(selectedNode.id)}
                    />
                )}
            </div>

            {/* ── Bottom Legend ────────────────────────────────────────────── */}
            <div className="flex items-center gap-4 px-5 py-2 bg-[#0d1629]/80 border-t border-dark-border/30 text-[10px] text-dark-text-secondary shrink-0">
                <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[9px] me-1">Esc</kbd>إلغاء / إغلاق</span>
                <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[9px] me-1">Del</kbd>حذف النود</span>
                <span><i className="fas fa-scroll-wheel me-1 opacity-50" />للتكبير/التصغير</span>
                <span><i className="fas fa-hand-pointer me-1 opacity-50" />اسحب المنفذ السفلي للربط</span>
                <span className="ms-auto">انقر على نود لتعديلها • اسحب لنقلها</span>
            </div>
        </div>
    );
};
