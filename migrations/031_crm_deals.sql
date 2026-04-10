-- Migration: 031_crm_deals.sql
-- Description: Create Deals (Opportunities) table for CRM pipeline functionality

CREATE TABLE IF NOT EXISTS public.crm_deals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id uuid NOT NULL REFERENCES public.brand_profiles(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL, -- Optional linking to a customer
    title text NOT NULL,
    company text,
    amount numeric(15,2) DEFAULT 0,
    stage text NOT NULL DEFAULT 'Qualify',
    probability integer DEFAULT 0,
    expected_close_date date,
    assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Indices for fast searching and filtering
CREATE INDEX IF NOT EXISTS crm_deals_brand_id_idx ON public.crm_deals (brand_id);
CREATE INDEX IF NOT EXISTS crm_deals_customer_id_idx ON public.crm_deals (customer_id);
CREATE INDEX IF NOT EXISTS crm_deals_stage_idx ON public.crm_deals (stage);

-- RLS Enablement
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

-- Policy definitions for Deals
CREATE POLICY "Users can view deals in their tenant" 
ON public.crm_deals FOR SELECT 
USING (brand_id = ANY(public.crm_user_brand_ids()));

CREATE POLICY "Users can insert deals in their tenant" 
ON public.crm_deals FOR INSERT 
WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

CREATE POLICY "Users can update deals in their tenant" 
ON public.crm_deals FOR UPDATE 
USING (brand_id = ANY(public.crm_user_brand_ids()))
WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

CREATE POLICY "Users can delete deals in their tenant" 
ON public.crm_deals FOR DELETE 
USING (brand_id = ANY(public.crm_user_brand_ids()));

-- Function to autoset updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_crm_deals_timestamp
    BEFORE UPDATE ON public.crm_deals
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Insert mock data for test brands if necessary
-- For now, let's leave it blank. UI will manage standard Deals.