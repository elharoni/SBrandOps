// components/pages/MediaOpsPage.tsx
// Media Ops — خط إنتاج الميديا الكامل للبراند
// المراحل: Request → Brief → Matrix → Production → Review → Approved → Published

import React, { useState, useEffect, useCallback } from 'react';
import {
    BrandHubProfile,
    NotificationType,
    MediaProjectSummary,
    MediaProject,
    MediaProjectPiece,
    MediaProjectStatus,
    CreativeRequestForm,
    IdeaMatrixAngle,
    SocialPlatform,
    PostStatus,
} from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import {
    getMediaProjects,
    getMediaProject,
    createMediaProject,
    updateMediaProject,
    getProjectPieces,
    createProjectPiece,
    updateProjectPiece,
    deleteMediaProject,
    getNextStatus,
    STATUS_LABELS,
    GOAL_LABELS,
    OUTPUT_TYPE_LABELS,
} from '../../services/mediaProjectService';
import { CreativeRequestModal } from '../media/CreativeRequestModal';
import { ReviewPanel } from '../media/ReviewPanel';
import { AdaptationModal } from '../media/AdaptationModal';
import { PerformancePulse } from '../media/PerformancePulse';

// ── Props ─────────────────────────────────────────────────────────────────────

interface MediaOpsPageProps {
    brandId: string;
    brandProfile: BrandHubProfile;
    addNotification: (type: NotificationType, message: string) => void;
    onNavigate?: (page: string) => void;
    onSendToPublisher?: (brief: {
        id: string; source: string; title: string; objective: string;
        angle: string; competitors: string[]; keywords: string[];
        hashtags: string[]; suggestedPlatforms: SocialPlatform[]; cta?: string; notes: string[];
    }) => void;
}

// ── Status pipeline ───────────────────────────────────────────────────────────

const STATUS_STEPS: MediaProjectStatus[] = [
    'request', 'brief', 'matrix', 'production', 'review', 'approved', 'published',
];

const StatusPipeline: React.FC<{ current: MediaProjectStatus; ar: boolean }> = ({ current, ar }) => {
    const currentIdx = STATUS_STEPS.indexOf(current);
    return (
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {STATUS_STEPS.map((s, i) => {
                const done   = i < currentIdx;
                const active = i === currentIdx;
                const label  = STATUS_LABELS[s];
                return (
                    <React.Fragment key={s}>
                        <div className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            active ? `${label.color} ring-1 ring-current` :
                            done   ? 'bg-emerald-400/10 text-emerald-400' :
                                     'bg-dark-bg text-dark-text-secondary/40'
                        }`}>
                            {done && <i className="fas fa-check text-[8px]" />}
                            {ar ? label.ar : label.en}
                        </div>
                        {i < STATUS_STEPS.length - 1 && (
                            <i className={`fas fa-chevron-left text-[8px] flex-shrink-0 ${
                                i < currentIdx ? 'text-emerald-400/60' : 'text-dark-text-secondary/20'
                            }`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

// ── Project Card ──────────────────────────────────────────────────────────────

const ProjectCard: React.FC<{
    project: MediaProjectSummary;
    ar: boolean;
    onClick: () => void;
    onDelete: () => void;
}> = ({ project, ar, onClick, onDelete }) => {
    const label  = STATUS_LABELS[project.status];
    const goal   = GOAL_LABELS[project.goal];
    const output = OUTPUT_TYPE_LABELS[project.outputType];

    return (
        <div
            onClick={onClick}
            className={`surface-panel cursor-pointer rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                project.priority === 'urgent' ? 'border-rose-400/30' :
                project.priority === 'high'   ? 'border-amber-400/20' : ''
            }`}
        >
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${label.color}`}>
                            {ar ? label.ar : label.en}
                        </span>
                        {project.priority === 'urgent' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-400/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                                <i className="fas fa-bolt text-[8px]" />
                                {ar ? 'عاجل' : 'Urgent'}
                            </span>
                        )}
                    </div>
                    <h3 className="mt-2 font-bold leading-tight text-white line-clamp-2">{project.title}</h3>
                </div>
                <button
                    onClick={e => { e.stopPropagation(); onDelete(); }}
                    className="flex-shrink-0 rounded-lg p-1.5 text-dark-text-secondary/40 transition-colors hover:bg-rose-400/10 hover:text-rose-400"
                >
                    <i className="fas fa-trash text-xs" />
                </button>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
                <span className="flex items-center gap-1 rounded-lg bg-dark-bg px-2 py-1 text-[10px] text-dark-text-secondary">
                    <i className={`fas ${goal.icon} text-brand-secondary`} />
                    {ar ? goal.ar : goal.en}
                </span>
                <span className="flex items-center gap-1 rounded-lg bg-dark-bg px-2 py-1 text-[10px] text-dark-text-secondary">
                    <i className={`fas ${output.icon} text-brand-secondary`} />
                    {ar ? output.ar : output.en}
                </span>
                {project.campaign && (
                    <span className="max-w-[120px] truncate rounded-lg bg-dark-bg px-2 py-1 text-[10px] text-dark-text-secondary">
                        <i className="fas fa-tag me-1 text-brand-secondary/60" />
                        {project.campaign}
                    </span>
                )}
            </div>

            <div className="flex items-center gap-3 text-xs text-dark-text-secondary">
                {project.piecesCount > 0 && (
                    <span>
                        <i className="fas fa-layer-group me-1 text-brand-secondary/60" />
                        {project.piecesCount} {ar ? 'قطعة' : 'pieces'}
                    </span>
                )}
                {project.pendingReviews > 0 && (
                    <span className="text-amber-400">
                        <i className="fas fa-clock me-1" />
                        {project.pendingReviews} {ar ? 'مراجعة' : 'pending'}
                    </span>
                )}
                {project.deadline && (
                    <span className={`ms-auto ${new Date(project.deadline) < new Date() ? 'text-rose-400' : ''}`}>
                        <i className="fas fa-calendar me-1" />
                        {project.deadline}
                    </span>
                )}
            </div>
        </div>
    );
};

// ── Brief Panel ───────────────────────────────────────────────────────────────

const BriefPanel: React.FC<{ brief: import('../../types').CreativeBrief; ar: boolean }> = ({ brief, ar }) => {
    const sections = [
        { key: 'objective',         labelAr: 'الهدف',               labelEn: 'Objective' },
        { key: 'audience',          labelAr: 'الجمهور المستهدف',    labelEn: 'Audience' },
        { key: 'coreMessage',       labelAr: 'الرسالة الجوهرية',    labelEn: 'Core Message' },
        { key: 'offer',             labelAr: 'العرض',               labelEn: 'Offer' },
        { key: 'tone',              labelAr: 'النبرة',              labelEn: 'Tone' },
        { key: 'visualDirection',   labelAr: 'الاتجاه البصري',      labelEn: 'Visual Direction' },
        { key: 'formatSpecs',       labelAr: 'مواصفات الفورمات',    labelEn: 'Format Specs' },
        { key: 'cta',               labelAr: 'الدعوة للإجراء',      labelEn: 'CTA' },
        { key: 'deliverables',      labelAr: 'المخرجات',            labelEn: 'Deliverables',        isList: true },
        { key: 'mandatoryElements', labelAr: 'العناصر الإلزامية',   labelEn: 'Mandatory Elements',  isList: true },
        { key: 'prohibitions',      labelAr: 'المحظورات',           labelEn: 'Prohibitions',        isList: true },
        { key: 'successCriteria',   labelAr: 'معايير النجاح',       labelEn: 'Success Criteria',    isList: true },
    ] as const;

    return (
        <div className="space-y-3">
            {sections.map(s => {
                const val = (brief as any)[s.key];
                if (!val || (Array.isArray(val) && val.length === 0)) return null;
                return (
                    <div key={s.key} className="rounded-xl border border-dark-border bg-dark-bg/60 p-3">
                        <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-brand-secondary">
                            {ar ? s.labelAr : s.labelEn}
                        </p>
                        {(s as any).isList && Array.isArray(val) ? (
                            <ul className="space-y-1">
                                {(val as string[]).map((item: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-dark-text-secondary">
                                        <i className="fas fa-circle-dot mt-0.5 flex-shrink-0 text-[8px] text-brand-secondary/60" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm leading-relaxed text-white">{val as string}</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ── Idea Matrix Panel ─────────────────────────────────────────────────────────

const IdeaMatrixPanel: React.FC<{
    matrix: IdeaMatrixAngle[];
    ar: boolean;
    onSelectAngle: (angle: IdeaMatrixAngle, format: string) => void;
}> = ({ matrix, ar, onSelectAngle }) => (
    <div className="space-y-4">
        {matrix.map((angle, ai) => (
            <div key={ai} className="rounded-2xl border border-dark-border bg-dark-bg/40 p-4">
                <div className="mb-3">
                    <div className="mb-1 flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary/20 text-[10px] font-black text-brand-secondary">
                            {ai + 1}
                        </span>
                        <p className="text-sm font-bold text-white">{angle.angle}</p>
                    </div>
                    <p className="ms-7 mb-1 text-xs font-semibold text-brand-secondary">
                        <i className="fas fa-quote-right me-1 text-[9px]" />
                        {angle.hook}
                    </p>
                    <p className="ms-7 text-xs text-dark-text-secondary">{angle.rationale}</p>
                </div>
                <div className="ms-7 flex flex-wrap gap-2">
                    {angle.formats.map((fmt, fi) => (
                        <button
                            key={fi}
                            onClick={() => onSelectAngle(angle, fmt.type)}
                            title={fmt.description}
                            className="rounded-lg border border-brand-primary/20 bg-brand-primary/5 px-3 py-1.5 text-xs font-semibold text-brand-secondary transition-colors hover:bg-brand-primary/15"
                        >
                            <i className="fas fa-plus me-1 text-[9px]" />
                            {fmt.type}
                        </button>
                    ))}
                </div>
            </div>
        ))}
    </div>
);

// ── Pieces Board ──────────────────────────────────────────────────────────────

const PIECE_COLS = ['draft', 'in_progress', 'review', 'approved', 'published'] as const;
type PieceCol = typeof PIECE_COLS[number];

const PIECE_STATUS_CFG: Record<PieceCol, { ar: string; en: string; color: string }> = {
    draft:       { ar: 'مسودة',   en: 'Draft',       color: 'text-gray-400' },
    in_progress: { ar: 'جارٍ',    en: 'In Progress', color: 'text-amber-400' },
    review:      { ar: 'مراجعة',  en: 'Review',      color: 'text-orange-400' },
    approved:    { ar: 'مُعتمد',  en: 'Approved',    color: 'text-emerald-400' },
    published:   { ar: 'منشور',   en: 'Published',   color: 'text-green-400' },
};

const PiecesBoard: React.FC<{
    pieces: MediaProjectPiece[];
    ar: boolean;
    projectTitle: string;
    projectGoal: string;
    onStatusChange: (pieceId: string, status: PieceCol) => void;
    onAdapt: (piece: MediaProjectPiece) => void;
    onPublish: (piece: MediaProjectPiece) => void;
    canPublish: boolean;
}> = ({ pieces, ar, projectTitle, projectGoal, onStatusChange, onAdapt, onPublish, canPublish }) => (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {PIECE_COLS.map(col => {
            const colPieces = pieces.filter(p => p.status === col);
            const cfg = PIECE_STATUS_CFG[col];
            return (
                <div key={col} className="space-y-2">
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${cfg.color}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {ar ? cfg.ar : cfg.en}
                        <span className="ms-auto opacity-60">{colPieces.length}</span>
                    </div>

                    {colPieces.map(piece => (
                        <div key={piece.id} className="rounded-xl border border-dark-border bg-dark-card p-3 text-xs space-y-2">
                            <div>
                                {piece.isMaster && (
                                    <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-brand-secondary">
                                        <i className="fas fa-star text-[8px]" /> Master
                                    </span>
                                )}
                                {piece.variantOf && !piece.isMaster && (
                                    <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-purple-400/10 px-1.5 py-0.5 text-[9px] font-bold text-purple-400">
                                        <i className="fas fa-code-branch text-[8px]" />
                                        {piece.variantLabel ?? 'Variant'}
                                    </span>
                                )}
                                <p className="font-semibold leading-tight text-white">{piece.title}</p>
                                {piece.format && (
                                    <p className="text-dark-text-secondary">{piece.format}</p>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-1">
                                {/* Advance */}
                                {col !== 'published' && (
                                    <button
                                        onClick={() => {
                                            const next = PIECE_COLS[PIECE_COLS.indexOf(col) + 1];
                                            if (next) onStatusChange(piece.id, next);
                                        }}
                                        className="w-full rounded-lg border border-dark-border py-1 text-[10px] font-semibold text-dark-text-secondary transition-colors hover:border-brand-primary/30 hover:text-white"
                                    >
                                        {ar ? 'تقدّم →' : 'Advance →'}
                                    </button>
                                )}

                                {/* Adapt (master only) */}
                                {piece.isMaster && (
                                    <button
                                        onClick={() => onAdapt(piece)}
                                        className="w-full rounded-lg border border-purple-400/20 bg-purple-400/5 py-1 text-[10px] font-semibold text-purple-400 transition-colors hover:bg-purple-400/10"
                                    >
                                        <i className="fas fa-code-branch me-1 text-[9px]" />
                                        {ar ? 'تكيّف' : 'Adapt'}
                                    </button>
                                )}

                                {/* Publish (approved pieces) */}
                                {col === 'approved' && canPublish && (
                                    <button
                                        onClick={() => onPublish(piece)}
                                        className="w-full rounded-lg border border-emerald-400/20 bg-emerald-400/5 py-1 text-[10px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-400/10"
                                    >
                                        <i className="fas fa-paper-plane me-1 text-[9px]" />
                                        {ar ? 'أرسل للناشر' : 'To Publisher'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {colPieces.length === 0 && (
                        <div className="rounded-xl border border-dashed border-dark-border/50 py-6 text-center text-[10px] text-dark-text-secondary/40">
                            {ar ? 'لا توجد قطع' : 'Empty'}
                        </div>
                    )}
                </div>
            );
        })}
    </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────

type DetailTab = 'brief' | 'matrix' | 'pieces' | 'review' | 'performance';

export const MediaOpsPage: React.FC<MediaOpsPageProps> = ({
    brandId,
    brandProfile,
    addNotification,
    onNavigate,
    onSendToPublisher,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    // ── List state ─────────────────────────────────────────────────────────────
    const [projects, setProjects] = useState<MediaProjectSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState<MediaProjectStatus | 'all'>('all');

    // ── Detail state ───────────────────────────────────────────────────────────
    const [selectedProject, setSelectedProject] = useState<MediaProject | null>(null);
    const [pieces, setPieces] = useState<MediaProjectPiece[]>([]);
    const [detailTab, setDetailTab] = useState<DetailTab>('brief');
    const [isBuildingBrief, setIsBuildingBrief] = useState(false);
    const [isBuildingMatrix, setIsBuildingMatrix] = useState(false);
    const [isAdvancing, setIsAdvancing] = useState(false);

    // ── Modals ─────────────────────────────────────────────────────────────────
    const [adaptingPiece, setAdaptingPiece] = useState<MediaProjectPiece | null>(null);

    // ── Load ───────────────────────────────────────────────────────────────────
    const loadProjects = useCallback(async () => {
        if (!brandId) return;
        setIsLoading(true);
        try {
            setProjects(await getMediaProjects(brandId));
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل تحميل المشاريع.' : 'Failed to load projects.');
        } finally {
            setIsLoading(false);
        }
    }, [brandId, addNotification, ar]);

    useEffect(() => { loadProjects(); }, [loadProjects]);

    const openProject = async (projectId: string) => {
        try {
            const [proj, proj_pieces] = await Promise.all([
                getMediaProject(projectId),
                getProjectPieces(projectId),
            ]);
            setSelectedProject(proj);
            setPieces(proj_pieces);
            setDetailTab(proj.brief ? (proj.ideaMatrix.length > 0 ? 'pieces' : 'matrix') : 'brief');
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل فتح المشروع.' : 'Failed to open project.');
        }
    };

    // ── Create request + auto-build brief ──────────────────────────────────────
    const handleCreateRequest = async (form: CreativeRequestForm) => {
        const proj = await createMediaProject({
            brandId,
            title: form.title,
            goal: form.goal,
            outputType: form.outputType,
            campaign: form.campaign || undefined,
            productOffer: form.productOffer || undefined,
            cta: form.cta || undefined,
            platforms: form.platforms,
            deadline: form.deadline || undefined,
            priority: form.priority,
            notes: form.notes || undefined,
        });

        setShowRequestModal(false);
        await loadProjects();
        addNotification(NotificationType.Success, ar ? 'تم إنشاء المشروع.' : 'Project created.');

        const proj_pieces = await getProjectPieces(proj.id);
        setSelectedProject(proj);
        setPieces(proj_pieces);
        setDetailTab('brief');
        setIsBuildingBrief(true);

        try {
            const { buildCreativeBrief } = await import('../../services/geminiService');
            const brief = await buildCreativeBrief(form, brandProfile);
            await updateMediaProject(proj.id, { brief, status: 'brief' });
            setSelectedProject(await getMediaProject(proj.id));
            await loadProjects();
            addNotification(NotificationType.Success, ar ? 'تم بناء البريف.' : 'Brief built.');
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل بناء البريف.' : 'Brief failed.');
        } finally {
            setIsBuildingBrief(false);
        }
    };

    // ── Build Matrix ───────────────────────────────────────────────────────────
    const handleBuildMatrix = async () => {
        if (!selectedProject?.brief) return;
        setIsBuildingMatrix(true);
        try {
            const { generateIdeaMatrix } = await import('../../services/geminiService');
            const matrix = await generateIdeaMatrix(
                selectedProject.brief,
                { goal: selectedProject.goal, outputType: selectedProject.outputType, platforms: selectedProject.platforms as any },
                brandProfile,
            );
            await updateMediaProject(selectedProject.id, { ideaMatrix: matrix, status: 'matrix' });
            setSelectedProject(await getMediaProject(selectedProject.id));
            await loadProjects();
            setDetailTab('matrix');
            addNotification(NotificationType.Success, ar ? 'تم بناء المصفوفة.' : 'Matrix built.');
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل بناء المصفوفة.' : 'Matrix failed.');
        } finally {
            setIsBuildingMatrix(false);
        }
    };

    // ── Add piece from matrix ──────────────────────────────────────────────────
    const handleSelectAngle = async (angle: IdeaMatrixAngle, format: string) => {
        if (!selectedProject) return;
        try {
            const piece = await createProjectPiece({
                projectId: selectedProject.id,
                brandId,
                title: `${angle.angle} — ${format}`,
                angle: angle.angle,
                hook: angle.hook,
                format,
                track: ['Reel', 'Story', 'Motion'].includes(format) ? 'video' : 'design',
                isMaster: pieces.length === 0,
            });
            setPieces(prev => [...prev, piece]);
            if (selectedProject.status === 'matrix') {
                await updateMediaProject(selectedProject.id, { status: 'production' });
                setSelectedProject(await getMediaProject(selectedProject.id));
                await loadProjects();
            }
            setDetailTab('pieces');
            addNotification(NotificationType.Success, ar ? 'تمت إضافة القطعة.' : 'Piece added.');
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل إضافة القطعة.' : 'Failed.');
        }
    };

    // ── Piece status ───────────────────────────────────────────────────────────
    const handlePieceStatus = async (pieceId: string, status: string) => {
        try {
            await updateProjectPiece(pieceId, { status: status as any });
            setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, status: status as any } : p));
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل التحديث.' : 'Update failed.');
        }
    };

    // ── Project status advance ─────────────────────────────────────────────────
    const handleAdvanceProject = async () => {
        if (!selectedProject) return;
        const next = getNextStatus(selectedProject.status);
        if (!next) return;
        setIsAdvancing(true);
        try {
            await updateMediaProject(selectedProject.id, { status: next });
            setSelectedProject(await getMediaProject(selectedProject.id));
            await loadProjects();
            addNotification(NotificationType.Success, ar
                ? `تم الانتقال إلى: ${STATUS_LABELS[next].ar}`
                : `Advanced to: ${STATUS_LABELS[next].en}`);
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل التحديث.' : 'Update failed.');
        } finally {
            setIsAdvancing(false);
        }
    };

    // ── Delete project ─────────────────────────────────────────────────────────
    const handleDeleteProject = async (projectId: string) => {
        if (!window.confirm(ar ? 'هل تريد حذف هذا المشروع؟' : 'Delete this project?')) return;
        try {
            await deleteMediaProject(projectId);
            setProjects(prev => prev.filter(p => p.id !== projectId));
            if (selectedProject?.id === projectId) setSelectedProject(null);
            addNotification(NotificationType.Success, ar ? 'تم الحذف.' : 'Deleted.');
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل الحذف.' : 'Delete failed.');
        }
    };

    // ── Publishing Loop ────────────────────────────────────────────────────────
    const handlePublishPiece = async (piece: MediaProjectPiece) => {
        if (!selectedProject) return;

        if (onSendToPublisher) {
            onSendToPublisher({
                id: piece.id,
                source: 'content-ops',
                title: piece.title,
                objective: GOAL_LABELS[selectedProject.goal]?.en ?? selectedProject.goal,
                angle: piece.content || piece.hook || piece.angle || '',
                competitors: [],
                keywords: [],
                hashtags: [],
                suggestedPlatforms: selectedProject.platforms as SocialPlatform[],
                cta: selectedProject.cta,
                notes: piece.notes ? [piece.notes] : [],
            });
            addNotification(
                NotificationType.Info,
                ar ? 'تم إرسال القطعة للناشر.' : 'Piece sent to publisher.',
            );
        } else if (onNavigate) {
            onNavigate('social-ops/publisher');
        }

        // Mark piece as published
        try {
            await updateProjectPiece(piece.id, { status: 'published' });
            setPieces(prev => prev.map(p => p.id === piece.id ? { ...p, status: 'published' } : p));

            // If all pieces published → advance project
            const allPublished = pieces.every(p => p.id === piece.id ? true : p.status === 'published');
            if (allPublished && selectedProject.status !== 'published') {
                await updateMediaProject(selectedProject.id, { status: 'published' });
                setSelectedProject(await getMediaProject(selectedProject.id));
                await loadProjects();
            }
        } catch { /* non-critical */ }
    };

    // ── Adaptation variants added ──────────────────────────────────────────────
    const handleVariantsCreated = (newPieces: MediaProjectPiece[]) => {
        setPieces(prev => [...prev, ...newPieces]);
        setDetailTab('pieces');
    };

    // ── All reviews approved → advance to approved ─────────────────────────────
    const handleAllReviewsApproved = async () => {
        if (!selectedProject || selectedProject.status === 'approved') return;
        await updateMediaProject(selectedProject.id, { status: 'approved' });
        setSelectedProject(await getMediaProject(selectedProject.id));
        await loadProjects();
        addNotification(
            NotificationType.Success,
            ar ? 'تمت الموافقة على المشروع بالكامل.' : 'Project fully approved.',
        );
    };

    // ── Derived ────────────────────────────────────────────────────────────────
    const filtered    = filterStatus === 'all' ? projects : projects.filter(p => p.status === filterStatus);
    const nextStatus  = selectedProject ? getNextStatus(selectedProject.status) : null;
    const masterPiece = pieces.find(p => p.isMaster);

    const detailTabs: { id: DetailTab; ar: string; en: string; icon: string }[] = [
        { id: 'brief',       ar: 'البريف',      en: 'Brief',       icon: 'fa-file-lines' },
        { id: 'matrix',      ar: 'الأفكار',     en: 'Matrix',      icon: 'fa-table-cells' },
        { id: 'pieces',      ar: 'الإنتاج',     en: 'Board',       icon: 'fa-layer-group' },
        { id: 'review',      ar: 'المراجعات',   en: 'Reviews',     icon: 'fa-circle-check' },
        { id: 'performance', ar: 'الأداء',      en: 'Performance', icon: 'fa-chart-line' },
    ];

    // ─────────────────────────────────────────────────────────────────────────
    // Detail view
    // ─────────────────────────────────────────────────────────────────────────

    if (selectedProject) {
        return (
            <div className="flex flex-col gap-6">
                {/* Project header */}
                <div className="surface-panel rounded-2xl p-5">
                    <div className="mb-4 flex items-start gap-3">
                        <button
                            onClick={() => setSelectedProject(null)}
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-dark-border text-dark-text-secondary transition-colors hover:text-white"
                        >
                            <i className="fas fa-arrow-right text-sm" />
                        </button>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-xl font-black leading-tight text-white">{selectedProject.title}</h1>
                            {selectedProject.campaign && (
                                <p className="mt-0.5 text-xs text-dark-text-secondary">
                                    <i className="fas fa-tag me-1 text-brand-secondary/60" />
                                    {selectedProject.campaign}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                            {/* Send to Publisher (project-level, when approved) */}
                            {selectedProject.status === 'approved' && onNavigate && (
                                <button
                                    onClick={() => onNavigate('social-ops/publisher')}
                                    className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-400 transition-colors hover:bg-emerald-400/15"
                                >
                                    <i className="fas fa-paper-plane text-xs" />
                                    {ar ? 'للناشر' : 'Publish'}
                                </button>
                            )}
                            {nextStatus && (
                                <button
                                    onClick={handleAdvanceProject}
                                    disabled={isAdvancing}
                                    className="flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                                >
                                    <i className={`fas ${isAdvancing ? 'fa-spinner fa-spin' : 'fa-arrow-left'} text-xs`} />
                                    {ar ? STATUS_LABELS[nextStatus].ar : STATUS_LABELS[nextStatus].en}
                                </button>
                            )}
                        </div>
                    </div>
                    <StatusPipeline current={selectedProject.status} ar={ar} />
                </div>

                {/* Detail tabs */}
                <div className="surface-panel overflow-hidden rounded-2xl">
                    <div className="flex border-b border-dark-border">
                        {detailTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setDetailTab(tab.id)}
                                className={`flex flex-1 items-center justify-center gap-1.5 py-3.5 text-xs font-semibold transition-colors ${
                                    detailTab === tab.id
                                        ? 'border-b-2 border-brand-primary text-white'
                                        : 'text-dark-text-secondary hover:text-white'
                                }`}
                            >
                                <i className={`fas ${tab.icon} text-[10px]`} />
                                <span className="hidden sm:inline">{ar ? tab.ar : tab.en}</span>
                            </button>
                        ))}
                    </div>

                    <div className="p-5">
                        {/* Brief */}
                        {detailTab === 'brief' && (
                            isBuildingBrief ? (
                                <div className="py-16 text-center">
                                    <i className="fas fa-spinner fa-spin mb-3 block text-3xl text-brand-secondary" />
                                    <p className="text-sm text-dark-text-secondary">
                                        {ar ? 'الذكاء الاصطناعي يبني البريف...' : 'AI is building your brief...'}
                                    </p>
                                </div>
                            ) : selectedProject.brief ? (
                                <div className="space-y-4">
                                    <BriefPanel brief={selectedProject.brief} ar={ar} />
                                    {selectedProject.ideaMatrix.length === 0 && (
                                        <button
                                            onClick={handleBuildMatrix}
                                            disabled={isBuildingMatrix}
                                            className="w-full rounded-xl bg-brand-primary/10 py-3 text-sm font-bold text-brand-secondary transition-colors hover:bg-brand-primary/20 disabled:opacity-50"
                                        >
                                            <i className={`fas ${isBuildingMatrix ? 'fa-spinner fa-spin' : 'fa-table-cells'} me-2`} />
                                            {ar ? 'بناء مصفوفة الأفكار' : 'Build Idea Matrix'}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="py-16 text-center">
                                    <i className="fas fa-file-lines mb-3 block text-4xl text-dark-text-secondary" />
                                    <p className="text-sm text-dark-text-secondary">{ar ? 'لا يوجد بريف بعد.' : 'No brief yet.'}</p>
                                </div>
                            )
                        )}

                        {/* Matrix */}
                        {detailTab === 'matrix' && (
                            isBuildingMatrix ? (
                                <div className="py-16 text-center">
                                    <i className="fas fa-spinner fa-spin mb-3 block text-3xl text-brand-secondary" />
                                    <p className="text-sm text-dark-text-secondary">{ar ? 'يبني المصفوفة...' : 'Building matrix...'}</p>
                                </div>
                            ) : selectedProject.ideaMatrix.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-dark-text-secondary">
                                            {ar ? 'اختر فورمات لإضافة قطعة إنتاج' : 'Pick a format to add a piece'}
                                        </p>
                                        <button
                                            onClick={handleBuildMatrix}
                                            disabled={isBuildingMatrix}
                                            className="rounded-lg border border-dark-border px-3 py-1.5 text-xs font-semibold text-dark-text-secondary transition-colors hover:text-white"
                                        >
                                            <i className="fas fa-sync-alt me-1 text-[10px]" />
                                            {ar ? 'إعادة توليد' : 'Regenerate'}
                                        </button>
                                    </div>
                                    <IdeaMatrixPanel
                                        matrix={selectedProject.ideaMatrix}
                                        ar={ar}
                                        onSelectAngle={handleSelectAngle}
                                    />
                                </div>
                            ) : (
                                <div className="py-16 text-center">
                                    <i className="fas fa-table-cells mb-3 block text-4xl text-dark-text-secondary" />
                                    <p className="mb-4 text-sm text-dark-text-secondary">
                                        {ar ? 'ابنِ البريف أولاً.' : 'Build the brief first.'}
                                    </p>
                                    {selectedProject.brief && (
                                        <button
                                            onClick={handleBuildMatrix}
                                            disabled={isBuildingMatrix}
                                            className="rounded-xl bg-brand-primary/10 px-5 py-2.5 text-sm font-bold text-brand-secondary hover:bg-brand-primary/20"
                                        >
                                            <i className="fas fa-table-cells me-2" />
                                            {ar ? 'بناء المصفوفة' : 'Build Matrix'}
                                        </button>
                                    )}
                                </div>
                            )
                        )}

                        {/* Pieces Board */}
                        {detailTab === 'pieces' && (
                            pieces.length > 0 ? (
                                <PiecesBoard
                                    pieces={pieces}
                                    ar={ar}
                                    projectTitle={selectedProject.title}
                                    projectGoal={selectedProject.goal}
                                    onStatusChange={handlePieceStatus}
                                    onAdapt={setAdaptingPiece}
                                    onPublish={handlePublishPiece}
                                    canPublish={!!(onSendToPublisher || onNavigate)}
                                />
                            ) : (
                                <div className="py-16 text-center">
                                    <i className="fas fa-layer-group mb-3 block text-4xl text-dark-text-secondary" />
                                    <p className="text-sm text-dark-text-secondary">
                                        {ar ? 'اذهب لـ "الأفكار" واختر فورمات.' : 'Go to "Matrix" and pick a format.'}
                                    </p>
                                </div>
                            )
                        )}

                        {/* Reviews */}
                        {detailTab === 'review' && (
                            <ReviewPanel
                                projectId={selectedProject.id}
                                brandId={brandId}
                                addNotification={addNotification}
                                onAllApproved={handleAllReviewsApproved}
                            />
                        )}

                        {/* Performance / Learning Loop */}
                        {detailTab === 'performance' && (
                            <PerformancePulse
                                project={selectedProject}
                                pieces={pieces}
                                brandProfile={brandProfile}
                                addNotification={addNotification}
                                onStartNextCampaign={() => setShowRequestModal(true)}
                            />
                        )}
                    </div>
                </div>

                {/* Adaptation Modal */}
                {adaptingPiece && (
                    <AdaptationModal
                        masterPiece={adaptingPiece}
                        projectId={selectedProject.id}
                        brandId={brandId}
                        onClose={() => setAdaptingPiece(null)}
                        onCreated={handleVariantsCreated}
                        addNotification={addNotification}
                    />
                )}
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // List view
    // ─────────────────────────────────────────────────────────────────────────

    const stats = {
        total:      projects.length,
        production: projects.filter(p => p.status === 'production').length,
        review:     projects.filter(p => p.status === 'review').length,
        approved:   projects.filter(p => p.status === 'approved').length,
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-brand-secondary">
                        {ar ? 'استوديو الميديا' : 'Media Studio'}
                    </p>
                    <h1 className="mt-1.5 text-2xl font-black tracking-tight text-light-text dark:text-dark-text">
                        {ar ? 'خط إنتاج الميديا' : 'Media Production Flow'}
                    </h1>
                    <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {ar
                            ? 'من الهدف إلى مخرجات ميديا جاهزة ومرتبطة بالأداء.'
                            : 'From goal to ready media outputs — tracked, adapted, and performance-linked.'}
                    </p>
                </div>
                <button
                    onClick={() => setShowRequestModal(true)}
                    className="flex items-center gap-2 rounded-2xl bg-brand-primary px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-0.5"
                >
                    <i className="fas fa-plus text-xs" />
                    {ar ? 'طلب إبداعي جديد' : 'New Creative Request'}
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { ar: 'إجمالي',      en: 'Total',      val: stats.total,      icon: 'fa-folder-open',  color: 'text-brand-secondary' },
                    { ar: 'في الإنتاج',  en: 'Production', val: stats.production, icon: 'fa-pen-nib',      color: 'text-amber-400' },
                    { ar: 'في المراجعة', en: 'Review',     val: stats.review,     icon: 'fa-clock',        color: 'text-orange-400' },
                    { ar: 'مُعتمد',      en: 'Approved',   val: stats.approved,   icon: 'fa-circle-check', color: 'text-emerald-400' },
                ].map(s => (
                    <div key={s.en} className="surface-panel flex items-center gap-3 rounded-2xl p-4">
                        <i className={`fas ${s.icon} text-lg ${s.color}`} />
                        <div>
                            <p className="text-xs text-dark-text-secondary">{ar ? s.ar : s.en}</p>
                            <p className="text-xl font-black text-white">{s.val}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap gap-2">
                {(['all', ...STATUS_STEPS] as const).map(s => (
                    <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                            filterStatus === s
                                ? 'bg-brand-primary text-white'
                                : 'border border-dark-border text-dark-text-secondary hover:text-white'
                        }`}
                    >
                        {s === 'all' ? (ar ? 'الكل' : 'All') : (ar ? STATUS_LABELS[s].ar : STATUS_LABELS[s].en)}
                        {s !== 'all' && (
                            <span className="ms-1.5 opacity-60">
                                {projects.filter(p => p.status === s).length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Projects */}
            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map(i => <div key={i} className="surface-panel h-44 animate-pulse rounded-2xl" />)}
                </div>
            ) : filtered.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map(p => (
                        <ProjectCard
                            key={p.id}
                            project={p}
                            ar={ar}
                            onClick={() => openProject(p.id)}
                            onDelete={() => handleDeleteProject(p.id)}
                        />
                    ))}
                </div>
            ) : (
                <div className="surface-panel flex flex-col items-center justify-center rounded-2xl py-20 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/10">
                        <i className="fas fa-film text-2xl text-brand-secondary" />
                    </div>
                    <h3 className="mb-2 text-lg font-bold text-white">{ar ? 'لا توجد مشاريع بعد' : 'No projects yet'}</h3>
                    <p className="mb-6 max-w-xs text-sm text-dark-text-secondary">
                        {ar
                            ? 'ابدأ بطلب إبداعي وسيبني الذكاء الاصطناعي البريف والأفكار تلقائياً.'
                            : 'Start with a creative request — AI builds the brief and ideas automatically.'}
                    </p>
                    <button
                        onClick={() => setShowRequestModal(true)}
                        className="flex items-center gap-2 rounded-2xl bg-brand-primary px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-primary)]"
                    >
                        <i className="fas fa-plus text-xs" />
                        {ar ? 'طلب إبداعي جديد' : 'New Creative Request'}
                    </button>
                </div>
            )}

            {showRequestModal && (
                <CreativeRequestModal
                    onClose={() => setShowRequestModal(false)}
                    onSubmit={handleCreateRequest}
                    addNotification={addNotification}
                />
            )}
        </div>
    );
};
