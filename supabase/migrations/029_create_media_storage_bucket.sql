-- ============================================================
-- Migration 029: Create media storage bucket + user-isolated RLS
--
-- Files are stored under  {userId}/{folder}/filename
-- so each user has a private namespace. Policies enforce this
-- at the storage level — a user cannot write into another
-- user's folder even if they know the path.
-- ============================================================

-- Create the media bucket (public reads, user-isolated writes)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'media',
    'media',
    true,
    52428800,
    ARRAY[
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop any old permissive policies
DROP POLICY IF EXISTS "media_upload_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "media_read_public"          ON storage.objects;
DROP POLICY IF EXISTS "media_update_owner"         ON storage.objects;
DROP POLICY IF EXISTS "media_delete_owner"         ON storage.objects;

-- Upload: user can only write into their own folder ({userId}/...)
CREATE POLICY "media_upload_own_folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

-- Read: public (content is meant to be published on social media)
CREATE POLICY "media_read_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'media');

-- Update: only files inside the user's own folder
CREATE POLICY "media_update_own_folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

-- Delete: only files inside the user's own folder
CREATE POLICY "media_delete_own_folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);
