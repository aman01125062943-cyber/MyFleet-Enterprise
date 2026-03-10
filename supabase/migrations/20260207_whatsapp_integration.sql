-- ============================================================================
-- WhatsApp Integration Migration
-- Created: 2026-02-07
-- Description: Creates tables and policies for WhatsApp integration with Baileys
-- ============================================================================

-- ============================================================================
-- 1. WHATSAPP SESSIONS TABLE
-- Stores WhatsApp connection sessions for each organization
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Session Status
    status TEXT NOT NULL DEFAULT 'disconnected', 
    -- 'disconnected' | 'connecting' | 'qr_pending' | 'connected' | 'error'
    
    -- WhatsApp Account Info
    phone_number TEXT,
    whatsapp_id TEXT, -- WhatsApp JID (e.g., 201234567890@s.whatsapp.net)
    display_name TEXT,
    
    -- Authentication State (Baileys format)
    -- Stores creds, keys, pre-keys, etc. in JSONB format
    auth_state JSONB,
    
    -- QR Code (for initial connection)
    qr_code TEXT, -- Base64 encoded QR or plain text
    qr_expires_at TIMESTAMPTZ,
    
    -- Connection Metadata
    last_connected_at TIMESTAMPTZ,
    last_disconnected_at TIMESTAMPTZ,
    connection_error TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Settings
    auto_reconnect BOOLEAN DEFAULT true,
    enabled BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT whatsapp_sessions_org_unique UNIQUE(org_id),
    CONSTRAINT whatsapp_sessions_status_check CHECK (
        status IN ('disconnected', 'connecting', 'qr_pending', 'connected', 'error')
    )
);

-- Indexes for performance
CREATE INDEX idx_whatsapp_sessions_org_id ON whatsapp_sessions(org_id);
CREATE INDEX idx_whatsapp_sessions_status ON whatsapp_sessions(status);
CREATE INDEX idx_whatsapp_sessions_phone ON whatsapp_sessions(phone_number) WHERE phone_number IS NOT NULL;

-- Enable RLS
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Organizations can view own session"
    ON whatsapp_sessions FOR SELECT
    USING (
        org_id IN (
            SELECT org_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Owners and admins can manage sessions"
    ON whatsapp_sessions FOR ALL
    USING (
        org_id IN (
            SELECT org_id FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Super admins can view all sessions"
    ON whatsapp_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER whatsapp_sessions_updated_at
    BEFORE UPDATE ON whatsapp_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_whatsapp_sessions_updated_at();

-- ============================================================================
-- 2. WHATSAPP MESSAGES TABLE
-- Stores all WhatsApp messages sent through the system
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
    
    -- Message Details
    recipient_phone TEXT NOT NULL, -- E.164 format: +201234567890
    recipient_name TEXT,
    message_type TEXT NOT NULL DEFAULT 'text', 
    -- 'text' | 'image' | 'document' | 'template'
    
    -- Content
    message_body TEXT,
    template_name TEXT,
    template_params JSONB,
    media_url TEXT, -- Supabase Storage URL
    
    -- Status Tracking
    status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
    
    whatsapp_message_id TEXT, -- WhatsApp's internal message ID
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Metadata
    sent_by UUID REFERENCES profiles(id),
    trigger_type TEXT,
    -- 'manual' | 'trial_welcome' | 'subscription_expiring' | 'subscription_activated' | 'payment_reminder'
    related_entity_id UUID,
    
    -- Timestamps
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT whatsapp_messages_status_check CHECK (
        status IN ('pending', 'queued', 'sending', 'sent', 'delivered', 'read', 'failed')
    ),
    CONSTRAINT whatsapp_messages_type_check CHECK (
        message_type IN ('text', 'image', 'document', 'template')
    )
);

-- Indexes
CREATE INDEX idx_whatsapp_messages_org_id ON whatsapp_messages(org_id);
CREATE INDEX idx_whatsapp_messages_session_id ON whatsapp_messages(session_id);
CREATE INDEX idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX idx_whatsapp_messages_recipient ON whatsapp_messages(recipient_phone);
CREATE INDEX idx_whatsapp_messages_created_at ON whatsapp_messages(created_at DESC);
CREATE INDEX idx_whatsapp_messages_scheduled ON whatsapp_messages(scheduled_at) 
    WHERE status = 'pending' AND scheduled_at IS NOT NULL;
CREATE INDEX idx_whatsapp_messages_trigger ON whatsapp_messages(trigger_type);

-- Enable RLS
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Organizations can view own messages"
    ON whatsapp_messages FOR SELECT
    USING (
        org_id IN (
            SELECT org_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Authorized users can send messages"
    ON whatsapp_messages FOR INSERT
    WITH CHECK (
        org_id IN (
            SELECT org_id FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "System can update message status"
    ON whatsapp_messages FOR UPDATE
    USING (true); -- Service role will update statuses

-- Trigger to update updated_at
CREATE TRIGGER whatsapp_messages_updated_at
    BEFORE UPDATE ON whatsapp_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_whatsapp_sessions_updated_at();

-- ============================================================================
-- 3. WHATSAPP TEMPLATES TABLE
-- Stores message templates for automated notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    -- NULL org_id means system-wide template
    
    -- Template Info
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, 
    -- 'trial_welcome' | 'subscription_expiring' | 'subscription_activated' | 'payment_reminder' | 'custom'
    
    -- Content
    message_template TEXT NOT NULL, -- Supports {{variable}} syntax
    variables JSONB, -- Array of variable names
    
    -- Media (optional)
    media_type TEXT, -- 'image' | 'document' | null
    media_url TEXT,
    
    -- Settings
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false, -- System templates can't be deleted
    
    -- Usage Stats
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT whatsapp_templates_org_name_unique UNIQUE(org_id, name),
    CONSTRAINT whatsapp_templates_category_check CHECK (
        category IN ('trial_welcome', 'subscription_expiring', 'subscription_activated', 'payment_reminder', 'custom')
    )
);

-- Indexes
CREATE INDEX idx_whatsapp_templates_org_id ON whatsapp_templates(org_id);
CREATE INDEX idx_whatsapp_templates_category ON whatsapp_templates(category);
CREATE INDEX idx_whatsapp_templates_active ON whatsapp_templates(is_active) WHERE is_active = true;
CREATE INDEX idx_whatsapp_templates_system ON whatsapp_templates(is_system) WHERE is_system = true;

-- Enable RLS
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own org templates and system templates"
    ON whatsapp_templates FOR SELECT
    USING (
        org_id IS NULL -- System templates
        OR org_id IN (
            SELECT org_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Owners can manage own templates"
    ON whatsapp_templates FOR ALL
    USING (
        org_id IN (
            SELECT org_id FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
        AND is_system = false -- Can't modify system templates
    );

CREATE POLICY "Super admins can manage system templates"
    ON whatsapp_templates FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- Trigger to update updated_at
CREATE TRIGGER whatsapp_templates_updated_at
    BEFORE UPDATE ON whatsapp_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_whatsapp_sessions_updated_at();

-- ============================================================================
-- 4. NOTIFICATION QUEUE TABLE
-- Queue for processing automated notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Notification Type
    notification_type TEXT NOT NULL,
    -- 'whatsapp' | 'email' | 'sms' (future)
    
    -- Target
    recipient_id UUID REFERENCES profiles(id),
    recipient_phone TEXT,
    recipient_email TEXT,
    recipient_name TEXT,
    
    -- Content
    template_id UUID REFERENCES whatsapp_templates(id),
    message_data JSONB, -- Template variables + custom data
    
    -- Scheduling
    priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
    
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_attempt_at TIMESTAMPTZ,
    error_message TEXT,
    
    -- Result
    whatsapp_message_id UUID REFERENCES whatsapp_messages(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT notification_queue_status_check CHECK (
        status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')
    ),
    CONSTRAINT notification_queue_type_check CHECK (
        notification_type IN ('whatsapp', 'email', 'sms')
    ),
    CONSTRAINT notification_queue_priority_check CHECK (
        priority BETWEEN 1 AND 10
    )
);

-- Indexes
CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_scheduled ON notification_queue(scheduled_for) 
    WHERE status = 'pending';
CREATE INDEX idx_notification_queue_org_id ON notification_queue(org_id);
CREATE INDEX idx_notification_queue_priority ON notification_queue(priority DESC);
CREATE INDEX idx_notification_queue_type ON notification_queue(notification_type);

-- Enable RLS
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Organizations can view own notifications"
    ON notification_queue FOR SELECT
    USING (
        org_id IN (
            SELECT org_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "System can manage queue"
    ON notification_queue FOR ALL
    USING (true); -- Service role manages the queue

-- Trigger to update updated_at
CREATE TRIGGER notification_queue_updated_at
    BEFORE UPDATE ON notification_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_whatsapp_sessions_updated_at();

-- ============================================================================
-- 5. WHATSAPP AUDIT LOGS TABLE
-- Audit trail for WhatsApp events
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    session_id UUID REFERENCES whatsapp_sessions(id) ON DELETE SET NULL,
    
    -- Event Details
    event_type TEXT NOT NULL,
    -- 'session_connected' | 'session_disconnected' | 'message_sent' | 'message_failed' | 'qr_generated'
    event_data JSONB,
    
    -- User Context
    user_id UUID REFERENCES profiles(id),
    ip_address TEXT,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_whatsapp_audit_org ON whatsapp_audit_logs(org_id);
CREATE INDEX idx_whatsapp_audit_session ON whatsapp_audit_logs(session_id);
CREATE INDEX idx_whatsapp_audit_created ON whatsapp_audit_logs(created_at DESC);
CREATE INDEX idx_whatsapp_audit_event ON whatsapp_audit_logs(event_type);

-- Enable RLS
ALTER TABLE whatsapp_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Organizations can view own audit logs"
    ON whatsapp_audit_logs FOR SELECT
    USING (
        org_id IN (
            SELECT org_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Super admins can view all audit logs"
    ON whatsapp_audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- ============================================================================
-- 6. INSERT DEFAULT SYSTEM TEMPLATES
-- ============================================================================

INSERT INTO whatsapp_templates (
    org_id, 
    name, 
    description, 
    category, 
    message_template, 
    variables, 
    is_system, 
    is_active
) VALUES
(
    NULL,
    'trial_welcome',
    'رسالة ترحيب للمستخدمين الجدد في الفترة التجريبية',
    'trial_welcome',
    'مرحباً {{customer_name}}! 👋

شكراً لتسجيلك في MyFleet Pro. نحن سعداء بانضمامك!

🎁 لديك فترة تجريبية مجانية لمدة {{trial_days}} يوم للاستمتاع بجميع المميزات.

📱 ابدأ الآن من: {{app_url}}

إذا كان لديك أي استفسار، نحن هنا للمساعدة!',
    '["customer_name", "trial_days", "app_url"]'::jsonb,
    true,
    true
),
(
    NULL,
    'subscription_expiring',
    'تنبيه انتهاء الاشتراك قبل 3 أيام',
    'subscription_expiring',
    '⚠️ تنبيه مهم

مرحباً {{customer_name}},

اشتراكك في خطة {{plan_name}} سينتهي في {{expiry_date}} (بعد {{days_remaining}} أيام).

💡 جدد اشتراكك الآن لتجنب انقطاع الخدمة:
{{renewal_url}}

شكراً لثقتك في MyFleet Pro! 🚗',
    '["customer_name", "plan_name", "expiry_date", "days_remaining", "renewal_url"]'::jsonb,
    true,
    true
),
(
    NULL,
    'subscription_activated',
    'تأكيد تفعيل الاشتراك الجديد',
    'subscription_activated',
    '✅ تم تفعيل اشتراكك بنجاح!

مرحباً {{customer_name}},

تم تفعيل خطة {{plan_name}} بنجاح.

📅 صالح حتى: {{end_date}}
✨ المميزات المتاحة:
{{features_list}}

استمتع بإدارة أسطولك بكفاءة! 🚀',
    '["customer_name", "plan_name", "end_date", "features_list"]'::jsonb,
    true,
    true
),
(
    NULL,
    'payment_reminder',
    'تذكير بالدفع المستحق',
    'payment_reminder',
    '💳 تذكير بالدفع

مرحباً {{customer_name}},

لديك فاتورة مستحقة بقيمة {{amount}} {{currency}}.

📄 رقم الفاتورة: {{invoice_number}}
📅 تاريخ الاستحقاق: {{due_date}}

ادفع الآن: {{payment_url}}',
    '["customer_name", "amount", "currency", "invoice_number", "due_date", "payment_url"]'::jsonb,
    true,
    true
);

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function to get active WhatsApp session for an organization
CREATE OR REPLACE FUNCTION get_active_whatsapp_session(p_org_id UUID)
RETURNS TABLE (
    session_id UUID,
    status TEXT,
    phone_number TEXT,
    last_connected_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        id,
        whatsapp_sessions.status,
        whatsapp_sessions.phone_number,
        whatsapp_sessions.last_connected_at
    FROM whatsapp_sessions
    WHERE org_id = p_org_id
    AND enabled = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to queue a WhatsApp notification
CREATE OR REPLACE FUNCTION queue_whatsapp_notification(
    p_org_id UUID,
    p_recipient_phone TEXT,
    p_template_id UUID,
    p_message_data JSONB,
    p_priority INTEGER DEFAULT 5,
    p_scheduled_for TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO notification_queue (
        org_id,
        notification_type,
        recipient_phone,
        template_id,
        message_data,
        priority,
        scheduled_for
    ) VALUES (
        p_org_id,
        'whatsapp',
        p_recipient_phone,
        p_template_id,
        p_message_data,
        p_priority,
        p_scheduled_for
    )
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. GRANTS
-- ============================================================================

-- Grant usage to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON whatsapp_sessions TO authenticated;
GRANT ALL ON whatsapp_messages TO authenticated;
GRANT ALL ON whatsapp_templates TO authenticated;
GRANT ALL ON notification_queue TO authenticated;
GRANT ALL ON whatsapp_audit_logs TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_active_whatsapp_session TO authenticated;
GRANT EXECUTE ON FUNCTION queue_whatsapp_notification TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE whatsapp_sessions IS 'Stores WhatsApp connection sessions for each organization';
COMMENT ON TABLE whatsapp_messages IS 'Stores all WhatsApp messages sent through the system';
COMMENT ON TABLE whatsapp_templates IS 'Message templates for automated notifications';
COMMENT ON TABLE notification_queue IS 'Queue for processing automated notifications';
COMMENT ON TABLE whatsapp_audit_logs IS 'Audit trail for WhatsApp events';
