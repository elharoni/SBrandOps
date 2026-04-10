/**
 * Stock Photos Service
 * خدمة التكامل مع مواقع الصور المجانية
 */

export interface StockPhoto {
    id: string;
    url: string;
    thumbnailUrl: string;
    downloadUrl: string;
    width: number;
    height: number;
    photographer: string;
    photographerUrl: string;
    source: 'unsplash' | 'pexels';
    description?: string;
    alt?: string;
    color?: string;
}

export interface SearchOptions {
    query: string;
    page?: number;
    perPage?: number;
    orientation?: 'landscape' | 'portrait' | 'square';
    color?: string;
}

const UNSPLASH_ACCESS_KEY = 'YOUR_UNSPLASH_ACCESS_KEY'; // يجب إضافته في .env
const PEXELS_API_KEY = 'YOUR_PEXELS_API_KEY'; // يجب إضافته في .env

/**
 * البحث في Unsplash
 */
export async function searchUnsplash(options: SearchOptions): Promise<StockPhoto[]> {
    const { query, page = 1, perPage = 20, orientation, color } = options;

    try {
        const params = new URLSearchParams({
            query,
            page: page.toString(),
            per_page: perPage.toString(),
            ...(orientation && { orientation }),
            ...(color && { color })
        });

        const response = await fetch(
            `https://api.unsplash.com/search/photos?${params}`,
            {
                headers: {
                    'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
                }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch from Unsplash');
        }

        const data = await response.json();

        return data.results.map((photo: any) => ({
            id: photo.id,
            url: photo.urls.regular,
            thumbnailUrl: photo.urls.thumb,
            downloadUrl: photo.urls.full,
            width: photo.width,
            height: photo.height,
            photographer: photo.user.name,
            photographerUrl: photo.user.links.html,
            source: 'unsplash' as const,
            description: photo.description || photo.alt_description,
            alt: photo.alt_description,
            color: photo.color
        }));
    } catch (error) {
        console.error('Error searching Unsplash:', error);
        return [];
    }
}

/**
 * البحث في Pexels
 */
export async function searchPexels(options: SearchOptions): Promise<StockPhoto[]> {
    const { query, page = 1, perPage = 20, orientation } = options;

    try {
        const params = new URLSearchParams({
            query,
            page: page.toString(),
            per_page: perPage.toString(),
            ...(orientation && { orientation })
        });

        const response = await fetch(
            `https://api.pexels.com/v1/search?${params}`,
            {
                headers: {
                    'Authorization': PEXELS_API_KEY
                }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch from Pexels');
        }

        const data = await response.json();

        return data.photos.map((photo: any) => ({
            id: photo.id.toString(),
            url: photo.src.large,
            thumbnailUrl: photo.src.small,
            downloadUrl: photo.src.original,
            width: photo.width,
            height: photo.height,
            photographer: photo.photographer,
            photographerUrl: photo.photographer_url,
            source: 'pexels' as const,
            description: photo.alt,
            alt: photo.alt,
            color: photo.avg_color
        }));
    } catch (error) {
        console.error('Error searching Pexels:', error);
        return [];
    }
}

/**
 * البحث في كلا المصدرين
 */
export async function searchStockPhotos(options: SearchOptions): Promise<{
    unsplash: StockPhoto[];
    pexels: StockPhoto[];
    all: StockPhoto[];
}> {
    const [unsplashResults, pexelsResults] = await Promise.all([
        searchUnsplash(options),
        searchPexels(options)
    ]);

    return {
        unsplash: unsplashResults,
        pexels: pexelsResults,
        all: [...unsplashResults, ...pexelsResults]
    };
}

/**
 * تحميل صورة
 */
export async function downloadStockPhoto(photo: StockPhoto): Promise<Blob> {
    try {
        const response = await fetch(photo.downloadUrl);

        if (!response.ok) {
            throw new Error('Failed to download photo');
        }

        // Track download for Unsplash (required by their API)
        if (photo.source === 'unsplash') {
            trackUnsplashDownload(photo.id);
        }

        return await response.blob();
    } catch (error) {
        console.error('Error downloading photo:', error);
        throw new Error('فشل في تحميل الصورة');
    }
}

/**
 * تتبع التحميل في Unsplash (مطلوب حسب شروط API)
 */
async function trackUnsplashDownload(photoId: string): Promise<void> {
    try {
        await fetch(
            `https://api.unsplash.com/photos/${photoId}/download`,
            {
                headers: {
                    'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
                }
            }
        );
    } catch (error) {
        console.error('Error tracking download:', error);
    }
}

/**
 * الحصول على صور شائعة/متداولة
 */
export async function getTrendingPhotos(
    source: 'unsplash' | 'pexels' | 'both' = 'both',
    perPage: number = 20
): Promise<StockPhoto[]> {
    try {
        const results: StockPhoto[] = [];

        if (source === 'unsplash' || source === 'both') {
            const response = await fetch(
                `https://api.unsplash.com/photos?page=1&per_page=${perPage}&order_by=popular`,
                {
                    headers: {
                        'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                results.push(...data.map((photo: any) => ({
                    id: photo.id,
                    url: photo.urls.regular,
                    thumbnailUrl: photo.urls.thumb,
                    downloadUrl: photo.urls.full,
                    width: photo.width,
                    height: photo.height,
                    photographer: photo.user.name,
                    photographerUrl: photo.user.links.html,
                    source: 'unsplash' as const,
                    description: photo.description || photo.alt_description,
                    alt: photo.alt_description,
                    color: photo.color
                })));
            }
        }

        if (source === 'pexels' || source === 'both') {
            const response = await fetch(
                `https://api.pexels.com/v1/curated?page=1&per_page=${perPage}`,
                {
                    headers: {
                        'Authorization': PEXELS_API_KEY
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                results.push(...data.photos.map((photo: any) => ({
                    id: photo.id.toString(),
                    url: photo.src.large,
                    thumbnailUrl: photo.src.small,
                    downloadUrl: photo.src.original,
                    width: photo.width,
                    height: photo.height,
                    photographer: photo.photographer,
                    photographerUrl: photo.photographer_url,
                    source: 'pexels' as const,
                    description: photo.alt,
                    alt: photo.alt,
                    color: photo.avg_color
                })));
            }
        }

        return results;
    } catch (error) {
        console.error('Error fetching trending photos:', error);
        return [];
    }
}

/**
 * الحصول على صور بناءً على لون معين
 */
export async function searchByColor(
    color: string,
    perPage: number = 20
): Promise<StockPhoto[]> {
    return searchUnsplash({
        query: 'nature', // استعلام عام
        color,
        perPage
    });
}

/**
 * اقتراحات بحث ذكية
 */
export function getSearchSuggestions(category: string): string[] {
    const suggestions: Record<string, string[]> = {
        business: ['مكتب', 'اجتماع', 'فريق عمل', 'تكنولوجيا', 'نجاح'],
        food: ['طعام', 'مطعم', 'طبخ', 'وجبة', 'حلويات'],
        travel: ['سفر', 'طبيعة', 'شاطئ', 'جبال', 'مدينة'],
        lifestyle: ['حياة', 'سعادة', 'رياضة', 'صحة', 'عائلة'],
        technology: ['تقنية', 'كمبيوتر', 'هاتف', 'ابتكار', 'مستقبل'],
        fashion: ['موضة', 'ملابس', 'أزياء', 'أناقة', 'إكسسوارات']
    };

    return suggestions[category] || [];
}
