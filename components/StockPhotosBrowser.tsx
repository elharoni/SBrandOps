/**
 * Stock Photos Browser Modal
 * واجهة البحث عن الصور المجانية
 */

import React, { useState, useEffect } from 'react';
import { searchStockPhotos, downloadStockPhoto, StockPhoto } from '../services/stockPhotosService';
import { Button, Input, Spinner, EmptyState } from './shared/UIComponents';

interface StockPhotosBrowserProps {
    onClose: () => void;
    onSelectPhoto: (photoUrl: string, photoBlob: Blob) => void;
}

export const StockPhotosBrowser: React.FC<StockPhotosBrowserProps> = ({
    onClose,
    onSelectPhoto
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [photos, setPhotos] = useState<StockPhoto[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedSource, setSelectedSource] = useState<'all' | 'unsplash' | 'pexels'>('all');
    const [orientation, setOrientation] = useState<'landscape' | 'portrait' | 'square' | undefined>();
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    const popularSearches = [
        { query: 'طبيعة', icon: '🌿' },
        { query: 'أعمال', icon: '💼' },
        { query: 'طعام', icon: '🍔' },
        { query: 'تكنولوجيا', icon: '💻' },
        { query: 'سفر', icon: '✈️' },
        { query: 'رياضة', icon: '⚽' }
    ];

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsLoading(true);
        try {
            const results = await searchStockPhotos({
                query: searchQuery,
                orientation,
                perPage: 30
            });

            if (selectedSource === 'all') {
                setPhotos(results.all);
            } else if (selectedSource === 'unsplash') {
                setPhotos(results.unsplash);
            } else {
                setPhotos(results.pexels);
            }
        } catch (error) {
            console.error('Error searching photos:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadAndSelect = async (photo: StockPhoto) => {
        setDownloadingId(photo.id);
        try {
            const blob = await downloadStockPhoto(photo);
            onSelectPhoto(photo.url, blob);
            onClose();
        } catch (error) {
            console.error('Error downloading photo:', error);
        } finally {
            setDownloadingId(null);
        }
    };

    const handleQuickSearch = (query: string) => {
        setSearchQuery(query);
        setTimeout(() => handleSearch(), 100);
    };

    useEffect(() => {
        // Load trending photos on mount
        handleSearch();
    }, []);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-dark-card rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
                {/* Header */}
                <div className="p-6 border-b border-dark-border">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-dark-text flex items-center gap-2">
                                <i className="fas fa-images text-brand-secondary" />
                                مكتبة الصور المجانية
                            </h2>
                            <p className="text-sm text-dark-text-secondary mt-1">
                                ملايين الصور عالية الجودة من Unsplash و Pexels
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 rounded-full hover:bg-dark-bg transition-colors flex items-center justify-center"
                        >
                            <i className="fas fa-times text-dark-text-secondary" />
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="ابحث عن صور... (مثال: طبيعة، أعمال، طعام)"
                                icon="fas fa-search"
                            />
                        </div>
                        <Button
                            onClick={handleSearch}
                            variant="primary"
                            loading={isLoading}
                            icon="fas fa-search"
                        >
                            بحث
                        </Button>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-4 mt-4">
                        {/* Source Filter */}
                        <div className="flex gap-2">
                            {[
                                { value: 'all', label: 'الكل', icon: 'fas fa-globe' },
                                { value: 'unsplash', label: 'Unsplash', icon: 'fas fa-camera' },
                                { value: 'pexels', label: 'Pexels', icon: 'fas fa-image' }
                            ].map(source => (
                                <button
                                    key={source.value}
                                    onClick={() => setSelectedSource(source.value as any)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${selectedSource === source.value
                                            ? 'bg-brand-primary text-white'
                                            : 'bg-dark-bg text-dark-text-secondary hover:bg-dark-card'
                                        }`}
                                >
                                    <i className={`${source.icon} me-1`} />
                                    {source.label}
                                </button>
                            ))}
                        </div>

                        {/* Orientation Filter */}
                        <div className="flex gap-2">
                            {[
                                { value: undefined, label: 'الكل', icon: 'fas fa-th' },
                                { value: 'landscape', label: 'أفقي', icon: 'fas fa-rectangle-landscape' },
                                { value: 'portrait', label: 'عمودي', icon: 'fas fa-rectangle-portrait' },
                                { value: 'square', label: 'مربع', icon: 'fas fa-square' }
                            ].map(orient => (
                                <button
                                    key={orient.label}
                                    onClick={() => setOrientation(orient.value as any)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${orientation === orient.value
                                            ? 'bg-brand-primary text-white'
                                            : 'bg-dark-bg text-dark-text-secondary hover:bg-dark-card'
                                        }`}
                                >
                                    <i className={`${orient.icon} me-1`} />
                                    {orient.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Quick Searches */}
                    <div className="flex flex-wrap gap-2 mt-4">
                        <span className="text-sm text-dark-text-secondary">بحث سريع:</span>
                        {popularSearches.map(search => (
                            <button
                                key={search.query}
                                onClick={() => handleQuickSearch(search.query)}
                                className="px-3 py-1 rounded-full bg-dark-bg text-dark-text-secondary hover:bg-brand-primary hover:text-white transition-all text-sm"
                            >
                                <span className="me-1">{search.icon}</span>
                                {search.query}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Photos Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <Spinner size="lg" />
                        </div>
                    ) : photos.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {photos.map(photo => (
                                <div
                                    key={photo.id}
                                    className="group relative aspect-square rounded-lg overflow-hidden bg-dark-bg cursor-pointer hover:ring-2 hover:ring-brand-primary transition-all"
                                    onClick={() => handleDownloadAndSelect(photo)}
                                >
                                    <img
                                        src={photo.thumbnailUrl}
                                        alt={photo.alt || 'Stock photo'}
                                        className="w-full h-full object-cover"
                                    />

                                    {/* Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                        <p className="text-white text-xs font-semibold mb-1">
                                            {photo.photographer}
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-white/80 text-xs">
                                                {photo.source === 'unsplash' ? 'Unsplash' : 'Pexels'}
                                            </span>
                                            {downloadingId === photo.id ? (
                                                <Spinner size="sm" />
                                            ) : (
                                                <i className="fas fa-download text-white" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Source Badge */}
                                    <div className="absolute top-2 right-2">
                                        <span className={`px-2 py-1 rounded text-xs font-bold text-white ${photo.source === 'unsplash' ? 'bg-black/60' : 'bg-green-600/60'
                                            }`}>
                                            {photo.source === 'unsplash' ? 'U' : 'P'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            icon="fas fa-search"
                            title="لم يتم العثور على صور"
                            description="جرب البحث بكلمات مختلفة أو استخدم البحث السريع"
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-dark-border bg-dark-bg">
                    <p className="text-xs text-dark-text-secondary text-center">
                        جميع الصور مجانية للاستخدام التجاري •
                        <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:underline mx-1">
                            Unsplash
                        </a>
                        •
                        <a href="https://pexels.com" target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:underline mx-1">
                            Pexels
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
};
