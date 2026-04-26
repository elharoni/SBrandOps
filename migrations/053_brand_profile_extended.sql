-- 053_brand_profile_extended.sql
-- Adds extended_profile JSONB column to brand_profiles for new wizard fields:
-- description, businessModel, goals, language, ageRange, targetAudienceSummary, contactInfo

ALTER TABLE brand_profiles
    ADD COLUMN IF NOT EXISTS extended_profile JSONB DEFAULT '{}';

-- Index for fast JSONB queries on businessModel
CREATE INDEX IF NOT EXISTS idx_brand_profiles_extended_model
    ON brand_profiles USING GIN (extended_profile);

-- Backfill: set empty object for existing rows (already default, but explicit)
UPDATE brand_profiles
SET extended_profile = '{}'
WHERE extended_profile IS NULL;

COMMENT ON COLUMN brand_profiles.extended_profile IS
    'Stores extended wizard data: {description, businessModel, goals, language, ageRange, targetAudienceSummary, contactInfo}';
