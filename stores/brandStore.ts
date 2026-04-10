// stores/brandStore.ts — Zustand global state for brand management
import { create } from 'zustand';
import { Brand } from '../types';
import { getBrands, addBrand, deleteBrand as deleteBrandService, updateBrand as updateBrandService } from '../services/brandService';

interface BrandStore {
    // State
    brands: Brand[];
    activeBrand: Brand | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    setBrands: (brands: Brand[]) => void;
    setActiveBrand: (brand: Brand | null) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;

    // Async actions
    fetchBrands: () => Promise<void>;
    createBrand: (name: string) => Promise<Brand>;
    switchBrand: (brandId: string) => void;
    deleteBrand: (brandId: string) => Promise<void>;
    updateBrand: (brandId: string, updates: { name?: string; logoUrl?: string }) => Promise<Brand>;
}

export const useBrandStore = create<BrandStore>((set, get) => ({
    // Initial state
    brands: [],
    activeBrand: null,
    isLoading: false,
    error: null,

    // Sync setters
    setBrands: (brands) => set({ brands }),
    setActiveBrand: (brand) => set({ activeBrand: brand }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),

    // Fetch all brands for current user
    fetchBrands: async () => {
        set({ isLoading: true, error: null });
        try {
            const brands = await getBrands();
            set({ brands, isLoading: false });
            // Auto-select first brand if none selected
            const current = get().activeBrand;
            if (!current && brands.length > 0) {
                set({ activeBrand: brands[0] });
            }
        } catch (err: any) {
            set({ error: err.message || 'Failed to load brands', isLoading: false });
        }
    },

    // Create a new brand
    createBrand: async (name: string) => {
        const newBrand = await addBrand(name);
        set(state => ({
            brands: [...state.brands, newBrand],
            activeBrand: newBrand,
        }));
        return newBrand;
    },

    // Switch active brand
    switchBrand: (brandId: string) => {
        const brand = get().brands.find(b => b.id === brandId);
        if (brand) set({ activeBrand: brand });
    },

    // Delete a brand
    deleteBrand: async (brandId: string) => {
        await deleteBrandService(brandId);
        set(state => {
            const brands = state.brands.filter(b => b.id !== brandId);
            const activeBrand = state.activeBrand?.id === brandId
                ? (brands[0] ?? null)
                : state.activeBrand;
            return { brands, activeBrand };
        });
    },

    // Update a brand (rename / change logo)
    updateBrand: async (brandId: string, updates: { name?: string; logoUrl?: string }) => {
        const updated = await updateBrandService(brandId, updates);
        set(state => ({
            brands: state.brands.map(b => b.id === brandId ? updated : b),
            activeBrand: state.activeBrand?.id === brandId ? updated : state.activeBrand,
        }));
        return updated;
    },
}));
