import { supabase } from './supabaseClient';

export interface UploadResult {
    success: boolean;
    url?: string;
    error?: string;
}

/**
 * رفع ملف إلى Supabase Storage
 */
export async function uploadFile(
    file: File,
    bucket: string = 'media',
    folder: string = 'posts'
): Promise<UploadResult> {
    try {
        // إنشاء اسم فريد للملف
        const fileExt = file.name.split('.').pop();
        const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        // رفع الملف
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Error uploading file:', error);
            return { success: false, error: error.message };
        }

        // الحصول على الرابط العام للملف
        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileName);

        return {
            success: true,
            url: publicUrl
        };
    } catch (error: any) {
        console.error('Upload error:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }
}

/**
 * رفع عدة ملفات دفعة واحدة
 */
export async function uploadMultipleFiles(
    files: File[],
    bucket: string = 'media',
    folder: string = 'posts'
): Promise<UploadResult[]> {
    const uploadPromises = files.map(file => uploadFile(file, bucket, folder));
    return Promise.all(uploadPromises);
}

/**
 * حذف ملف من Storage
 */
export async function deleteFile(
    filePath: string,
    bucket: string = 'media'
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.storage
            .from(bucket)
            .remove([filePath]);

        if (error) {
            console.error('Error deleting file:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error('Delete error:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }
}

/**
 * الحصول على رابط عام لملف
 */
export function getPublicUrl(filePath: string, bucket: string = 'media'): string {
    const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

    return publicUrl;
}

/**
 * إنشاء bucket جديد (للاستخدام في الإعداد الأولي)
 */
export async function createBucket(
    bucketName: string,
    isPublic: boolean = true
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.storage.createBucket(bucketName, {
            public: isPublic,
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: ['image/*', 'video/*']
        });

        if (error) {
            console.error('Error creating bucket:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error('Create bucket error:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }
}

/**
 * تحويل Blob URL إلى File object
 */
export async function blobUrlToFile(blobUrl: string, fileName: string): Promise<File | null> {
    try {
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        return new File([blob], fileName, { type: blob.type });
    } catch (error) {
        console.error('Error converting blob to file:', error);
        return null;
    }
}
