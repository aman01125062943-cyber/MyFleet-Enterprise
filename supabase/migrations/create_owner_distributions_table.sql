-- ============================================================
-- SQL Migration: Create owner_distributions Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.owner_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    owner_name TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    car_id UUID REFERENCES public.cars(id) ON DELETE SET NULL,
    car_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.owner_distributions ENABLE ROW LEVEL SECURITY;

-- Select Policy: Authenticated users can view distributions for their org
CREATE POLICY "Users can view owner distributions in their org"
    ON public.owner_distributions FOR SELECT
    USING (
        org_id IN (
            SELECT org_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Insert/Update/Delete Policy: Admins and Owners can modify distributions
CREATE POLICY "Admins and owners can manage owner distributions"
    ON public.owner_distributions FOR ALL
    USING (
        org_id IN (
            SELECT org_id FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'owner')
        )
    );

-- Performance Index
CREATE INDEX IF NOT EXISTS idx_owner_distributions_org_date 
    ON public.owner_distributions (org_id, date DESC);
