-- WhatsApp Integration Tables for Fleet Management

-- ============================================================================
-- WHATSAPP SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    org_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'initializing',
    phone_number TEXT,
    qr_code TEXT,
    connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_status CHECK (status IN ('initializing', 'waiting_qr', 'connected', 'disconnected', 'error'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_org_id ON public.whatsapp_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_status ON public.whatsapp_sessions(status);

-- RLS Policies
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view sessions for their org
CREATE POLICY "Users can view WhatsApp sessions for their org"
    ON public.whatsapp_sessions FOR SELECT
    USING (
        org_id IN (
            SELECT id FROM public.organizations
            WHERE owner_id = auth.uid()
            OR id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid())
        )
    );

-- Service role can do anything
CREATE POLICY "Service role can manage WhatsApp sessions"
    ON public.whatsapp_sessions FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- WHATSAPP MESSAGES TABLE (for logging sent messages)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_phone_number CHECK (phone_number ~ '^[0-9]+$')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_session_id ON public.whatsapp_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_at ON public.whatsapp_messages(sent_at DESC);

-- RLS Policies
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages for their org's sessions
CREATE POLICY "Users can view WhatsApp messages for their org"
    ON public.whatsapp_messages FOR SELECT
    USING (
        session_id IN (
            SELECT id FROM public.whatsapp_sessions
            WHERE org_id IN (
                SELECT id FROM public.organizations
                WHERE owner_id = auth.uid()
                OR id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid())
            )
        )
    );

-- Service role can insert messages
CREATE POLICY "Service role can insert WhatsApp messages"
    ON public.whatsapp_messages FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- WHATSAPP TEMPLATES TABLE (for message templates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    org_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_template_name CHECK (char_length(name) >= 3)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_org_id ON public.whatsapp_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_is_active ON public.whatsapp_templates(is_active);

-- RLS Policies
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Users can manage templates for their org
CREATE POLICY "Users can manage WhatsApp templates for their org"
    ON public.whatsapp_templates FOR ALL
    USING (
        org_id IN (
            SELECT id FROM public.organizations
            WHERE owner_id = auth.uid()
            OR id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid())
        )
    )
    WITH CHECK (
        org_id IN (
            SELECT id FROM public.organizations
            WHERE owner_id = auth.uid()
            OR id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid())
        )
    );

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_whatsapp_sessions_updated_at
    BEFORE UPDATE ON public.whatsapp_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_templates_updated_at
    BEFORE UPDATE ON public.whatsapp_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_sessions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO service_role;
GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated, service_role;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
