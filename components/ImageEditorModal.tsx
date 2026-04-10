

import React, { useState, useEffect, useRef } from 'react';
import { MediaItem } from '../types';

interface ImageEditorModalProps {
    mediaItem: MediaItem;
    onClose: () => void;
    onSave: (updatedMedia: MediaItem) => void;
}

interface Filters {
    brightness: number;
    contrast: number;
    saturate: number;
    sepia: number;
    grayscale: number;
}

const initialFilters: Filters = { brightness: 100, contrast: 100, saturate: 100, sepia: 0, grayscale: 0 };

const FilterSlider: React.FC<{ name: keyof Filters, label: string, value: number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, min?: number, max?: number }> = ({ name, label, value, onChange, min = 0, max = 200 }) => (
    <div>
        <label htmlFor={name} className="flex justify-between items-center text-sm font-medium text-dark-text-secondary">
            <span>{label}</span>
            <span>{value}</span>
        </label>
        <input
            id={name}
            name={name}
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={onChange}
            className="w-full h-2 bg-dark-bg rounded-lg appearance-none cursor-pointer accent-brand-primary"
        />
    </div>
);

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ mediaItem, onClose, onSave }) => {
    const [filters, setFilters] = useState<Filters>(initialFilters);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(new Image());

    // Effect to load the image
    useEffect(() => {
        const image = imageRef.current;
        image.crossOrigin = 'anonymous';
        image.src = mediaItem.url;
    }, [mediaItem.url]);

    // Effect to draw the image on the canvas whenever filters or the source image change
    useEffect(() => {
        const image = imageRef.current;
        const drawImage = () => {
            const canvas = canvasRef.current;
            if (!canvas || !image.src || !image.complete) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            // Set canvas size based on a max width/height to fit in the modal
            const MAX_SIZE = 600;
            let width = image.naturalWidth;
            let height = image.naturalHeight;

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }
            canvas.width = width;
            canvas.height = height;

            ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) sepia(${filters.sepia}%) grayscale(${filters.grayscale}%)`;
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        };
        
        if (image.complete) {
            drawImage();
        } else {
            image.onload = drawImage;
        }

    }, [filters, mediaItem.url]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: Number(value) }));
    };

    const handleReset = () => {
        setFilters(initialFilters);
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.toBlob((blob) => {
            if (blob) {
                // Important: Create a new object URL for the updated file
                const newUrl = URL.createObjectURL(blob);
                const newFile = new File([blob], mediaItem.file.name, { type: blob.type });

                const updatedItem: MediaItem = {
                    ...mediaItem,
                    file: newFile,
                    url: newUrl,
                };
                
                // The old URL will be revoked by the parent component upon state update
                // This prevents revoking it before the parent has a chance to re-render
                onSave(updatedItem);
            }
        }, 'image/jpeg', 0.95); // Save as high-quality JPEG
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-dark-card rounded-lg shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-dark-border flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center"><i className="fas fa-pencil-ruler me-3 text-brand-secondary"></i>تحرير الصورة</h2>
                    <button onClick={onClose} className="text-dark-text-secondary hover:text-white text-2xl">&times;</button>
                </div>

                <div className="flex-grow p-4 flex flex-col md:flex-row gap-4 overflow-hidden">
                    {/* Image Preview */}
                    <div className="flex-1 bg-dark-bg border border-dark-border rounded-lg flex items-center justify-center overflow-auto p-2">
                        <canvas ref={canvasRef} />
                    </div>

                    {/* Controls Panel */}
                    <div className="w-full md:w-64 bg-dark-bg/50 p-4 rounded-lg border border-dark-border overflow-y-auto">
                        <div className="space-y-4">
                            <h3 className="font-bold text-white">التعديلات</h3>
                            <FilterSlider name="brightness" label="السطوع" value={filters.brightness} onChange={handleFilterChange} />
                            <FilterSlider name="contrast" label="التباين" value={filters.contrast} onChange={handleFilterChange} />
                            <FilterSlider name="saturate" label="التشبع" value={filters.saturate} onChange={handleFilterChange} />

                            <h3 className="font-bold text-white pt-4 border-t border-dark-border">الفلاتر</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setFilters(prev => ({...prev, sepia: 100, grayscale: 0}))} className="bg-dark-bg p-2 rounded-md text-sm text-center hover:border-brand-primary border border-dark-border">عتيق (Sepia)</button>
                                <button onClick={() => setFilters(prev => ({...prev, grayscale: 100, sepia: 0}))} className="bg-dark-bg p-2 rounded-md text-sm text-center hover:border-brand-primary border border-dark-border">أبيض وأسود</button>
                            </div>
                            <FilterSlider name="sepia" label="Sepia" value={filters.sepia} onChange={handleFilterChange} max={100} />
                            <FilterSlider name="grayscale" label="Grayscale" value={filters.grayscale} onChange={handleFilterChange} max={100} />
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-dark-border flex justify-between items-center">
                    <button onClick={handleReset} className="bg-dark-bg text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700">
                        إعادة تعيين
                    </button>
                    <div className="flex gap-3">
                         <button onClick={onClose} className="text-dark-text-secondary font-bold py-2 px-4 rounded-lg hover:text-white">
                            إلغاء
                        </button>
                        <button onClick={handleSave} className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg hover:bg-brand-secondary">
                            حفظ التعديلات
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};