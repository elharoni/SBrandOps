// components/admin/pages/QueuesPage.tsx
import React, { useMemo, useState, useEffect } from 'react';
import { QueueJob } from '../../../types';
import { TableComponent, ColumnDefinition } from '../shared/ui/TableComponent';
import { SkeletonLoader } from '../shared/ui/SkeletonLoader';

interface QueuesPageProps {
    jobs: QueueJob[];
    isLoading: boolean;
}

const StatusBadge: React.FC<{ status: QueueJob['status'] }> = ({ status }) => {
    const styles = {
        pending: 'bg-warning/20 text-warning',
        running: 'bg-blue-500/20 text-blue-400 animate-pulse',
        completed: 'bg-success/20 text-success',
        failed: 'bg-danger/20 text-danger',
    };
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>{status}</span>;
};

const PageSkeleton: React.FC = () => (
    <div className="space-y-6 animate-pulse">
        <SkeletonLoader className="h-10 w-64" />
        <SkeletonLoader className="h-8 w-96" />
        <SkeletonLoader className="h-96" />
    </div>
);

export const QueuesPage: React.FC<QueuesPageProps> = ({ jobs: initialJobs, isLoading }) => {
    const [jobs, setJobs] = useState<QueueJob[]>(initialJobs);

    useEffect(() => {
        setJobs(initialJobs);
    }, [initialJobs]);

    const handleRetry = (jobId: string) => {
        setJobs(prevJobs => prevJobs.map(job => 
            job.id === jobId ? { ...job, status: 'pending' } : job
        ));
        // In a real app, you would add a notification and call an API to re-queue the job.
    };

    const columns = useMemo<ColumnDefinition<QueueJob>[]>(() => [
        { header: 'معرف المهمة', accessor: 'id', cell: (job) => <span className="font-mono text-xs">{job.id}</span> },
        { header: 'النوع', accessor: 'type', isSortable: true },
        { header: 'الحالة', accessor: 'status', isSortable: true, cell: (job) => <StatusBadge status={job.status} /> },
        { header: 'وقت الإرسال', accessor: 'submittedAt', isSortable: true, cell: (job) => new Date(job.submittedAt).toLocaleString('ar-EG') },
        { header: 'الإجراءات', accessor: 'id', cell: (job) => (
            job.status === 'failed' ? <button onClick={() => handleRetry(job.id)} className="text-xs text-primary hover:underline">إعادة المحاولة</button> : null
        )},
    ], [handleRetry]);

    if (isLoading && jobs.length === 0) {
        return <PageSkeleton />;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">قوائم الانتظار والمهام</h1>
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
                مراقبة المهام الخلفية التي تعمل في النظام مثل معالجة الفيديو وتقارير التحليلات.
            </p>

            <TableComponent<QueueJob>
                columns={columns}
                data={jobs}
                filterColumn="type"
                filterPlaceholder="ابحث بنوع المهمة..."
            />
        </div>
    );
};