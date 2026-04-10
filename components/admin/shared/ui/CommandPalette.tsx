// components/admin/shared/ui/CommandPalette.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { performAdminSearch } from '../../../../services/adminSearchService';
import type { AdminSearchResultGroup } from '../../../../types';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (page: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<AdminSearchResultGroup[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const flatResults = results.flatMap(group => group.items);

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
        } else {
            setQuery('');
            setResults([]);
            setActiveIndex(0);
        }
    }, [isOpen]);

    useEffect(() => {
        const handler = setTimeout(async () => {
            if (query.length > 0) {
                setIsLoading(true);
                const searchResults = await performAdminSearch(query);
                setResults(searchResults);
                setActiveIndex(0);
                setIsLoading(false);
            } else {
                setResults([]);
            }
        }, 200);

        return () => clearTimeout(handler);
    }, [query]);

    useEffect(() => {
        // Scroll active item into view
        const activeItem = listRef.current?.querySelector(`[data-index='${activeIndex}']`);
        activeItem?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);
    
    const handleItemClick = (item: typeof flatResults[0]) => {
        onNavigate(item.navTarget);
        onClose();
    };

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev + 1) % (flatResults.length || 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev - 1 + (flatResults.length || 1)) % (flatResults.length || 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (flatResults[activeIndex]) {
                handleItemClick(flatResults[activeIndex]);
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    }, [activeIndex, flatResults, onClose, onNavigate]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-20" onClick={onClose}>
            <div 
                className="bg-light-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-xl border border-light-border dark:border-dark-border"
                onClick={e => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                <div className="relative p-3 border-b border-light-border dark:border-dark-border">
                    <i className="fas fa-search absolute top-1/2 -translate-y-1/2 right-6 text-light-text-secondary dark:text-dark-text-secondary"></i>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search for tenants, users, pages..."
                        className="w-full bg-transparent p-2 ps-10 border-0 focus:ring-0 text-light-text dark:text-dark-text"
                    />
                </div>
                <div className="max-h-96 overflow-y-auto p-2">
                    {isLoading && <div className="p-4 text-center text-light-text-secondary dark:text-dark-text-secondary">Searching...</div>}
                    {!isLoading && query && results.length === 0 && <div className="p-4 text-center text-light-text-secondary dark:text-dark-text-secondary">No results found.</div>}
                    
                    {!isLoading && results.map(group => (
                        <div key={group.title}>
                            <h3 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase px-3 pt-2">{group.title}</h3>
                            <ul className="space-y-1 p-1" ref={listRef}>
                                {group.items.map(item => {
                                    const itemIndex = flatResults.findIndex(fr => fr.id === item.id);
                                    const isActive = itemIndex === activeIndex;
                                    return (
                                        <li 
                                            key={item.id}
                                            data-index={itemIndex}
                                            className={`p-3 rounded-md cursor-pointer flex justify-between items-center ${isActive ? 'bg-primary text-white' : 'hover:bg-light-bg dark:hover:bg-dark-bg text-light-text dark:text-dark-text'}`}
                                            onClick={() => handleItemClick(item)}
                                            onMouseEnter={() => setActiveIndex(itemIndex)}
                                        >
                                            <div>
                                                <p className="font-semibold">{item.label}</p>
                                                <p className={`text-xs ${isActive ? 'opacity-80' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{item.description}</p>
                                            </div>
                                            {isActive && <span className="text-xs">↩</span>}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};