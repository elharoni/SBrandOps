// components/admin/shared/ui/TableComponent.tsx
import React, { useState, useMemo } from 'react';

export interface ColumnDefinition<T> {
    header: string;
    accessor: keyof T;
    isSortable?: boolean;
    cell?: (item: T) => React.ReactNode;
}

interface TableComponentProps<T> {
    columns: ColumnDefinition<T>[];
    data: T[];
    filterColumn: keyof T;
    filterPlaceholder?: string;
}

export const TableComponent = <T extends { id: string }>({
    columns,
    data,
    filterColumn,
    filterPlaceholder = "Search..."
}: TableComponentProps<T>) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof T; direction: 'asc' | 'desc' } | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 7;

    const filteredData = useMemo(() => {
        return data.filter(item => {
            const value = item[filterColumn];
            if (typeof value === 'string') {
                return value.toLowerCase().includes(searchTerm.toLowerCase());
            }
            return true;
        });
    }, [data, searchTerm, filterColumn]);

    const sortedData = useMemo(() => {
        let sortableItems = [...filteredData];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [filteredData, sortConfig]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedData.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedData, currentPage]);
    
    const totalPages = Math.ceil(sortedData.length / itemsPerPage);

    const handleSort = (key: keyof T) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    return (
        <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg">
            <div className="flex justify-between items-center p-4">
                <input
                    type="text"
                    placeholder={filterPlaceholder}
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg py-2 px-3 text-sm w-64"
                />
                 <button className="bg-primary text-white font-bold py-2 px-4 rounded-lg text-sm">
                    + إضافة جديد
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-light-text-secondary dark:text-dark-text-secondary">
                    <thead className="text-xs uppercase bg-light-bg dark:bg-dark-bg">
                        <tr>
                            {columns.map((col) => (
                                <th key={String(col.accessor)} className="px-4 py-3">
                                    <button 
                                        onClick={() => col.isSortable && handleSort(col.accessor)}
                                        className="flex items-center gap-2"
                                        disabled={!col.isSortable}
                                    >
                                        {col.header}
                                        {col.isSortable && (
                                            <i className={`fas ${
                                                sortConfig?.key === col.accessor 
                                                    ? (sortConfig.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') 
                                                    : 'fa-sort'
                                            } text-gray-400`}></i>
                                        )}
                                    </button>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.map((item) => (
                            <tr key={item.id} className="border-b border-light-border dark:border-dark-border hover:bg-light-bg dark:hover:bg-dark-bg/50">
                                {columns.map((col) => (
                                    <td key={`${item.id}-${String(col.accessor)}`} className="px-4 py-3">
                                        {col.cell ? col.cell(item) : String(item[col.accessor])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {totalPages > 1 && (
                <div className="flex justify-between items-center p-4">
                    <span className="text-xs">صفحة {currentPage} من {totalPages} (إجمالي {sortedData.length} عنصر)</span>
                    <div className="flex gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 text-xs rounded-md bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border disabled:opacity-50">السابق</button>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 text-xs rounded-md bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border disabled:opacity-50">التالي</button>
                    </div>
                </div>
            )}
        </div>
    );
};