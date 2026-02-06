-- Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', etc.
    entity TEXT NOT NULL, -- 'organization', 'user', 'settings', 'plan'
    entity_id UUID,       -- ID of the affected entity
    details JSONB,        -- Details of the change (e.g., old vs new values)
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies
-- Only Super Admins (owner/admin) can view logs
CREATE POLICY "Super admins can view all audit logs" ON public.audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'owner' OR profiles.role = 'admin')
            AND profiles.org_id IS NULL -- Ensure it's a platform admin, not org admin
        )
    );

-- Only Super Admins can insert logs (via backend or protected procedures usually, but here allowing insert for now from dashboard)
CREATE POLICY "Super admins can insert audit logs" ON public.audit_logs
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'owner' OR profiles.role = 'admin')
            AND profiles.org_id IS NULL
        )
    );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity);

-- Add comment
COMMENT ON TABLE public.audit_logs IS 'Tracks all critical actions performed by super admins';
