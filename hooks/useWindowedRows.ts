import type { UIEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface UseWindowedRowsOptions {
    rowHeight: number;
    overscan?: number;
    enabled?: boolean;
}

export function useWindowedRows<T>(
    rows: T[],
    { rowHeight, overscan = 6, enabled = true }: UseWindowedRowsOptions
) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(640);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const updateHeight = () => setViewportHeight(element.clientHeight || 640);
        updateHeight();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateHeight);
            return () => window.removeEventListener('resize', updateHeight);
        }

        const observer = new ResizeObserver(() => updateHeight());
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        setScrollTop(0);
        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
        }
    }, [rows]);

    const metrics = useMemo(() => {
        if (!enabled) {
            return {
                startIndex: 0,
                endIndex: rows.length,
                topSpacerHeight: 0,
                bottomSpacerHeight: 0,
            };
        }

        const visibleCount = Math.ceil(viewportHeight / rowHeight);
        const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
        const endIndex = Math.min(rows.length, startIndex + visibleCount + (overscan * 2));
        const topSpacerHeight = startIndex * rowHeight;
        const bottomSpacerHeight = Math.max(0, (rows.length - endIndex) * rowHeight);

        return { startIndex, endIndex, topSpacerHeight, bottomSpacerHeight };
    }, [enabled, overscan, rowHeight, rows.length, scrollTop, viewportHeight]);

    return {
        containerRef,
        onScroll: (event: UIEvent<HTMLDivElement>) => setScrollTop(event.currentTarget.scrollTop),
        visibleRows: rows.slice(metrics.startIndex, metrics.endIndex),
        startIndex: metrics.startIndex,
        topSpacerHeight: metrics.topSpacerHeight,
        bottomSpacerHeight: metrics.bottomSpacerHeight,
        isWindowed: enabled,
    };
}
