-- Create notification queue table
CREATE TABLE IF NOT EXISTS public.whatsapp_notifications (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL, -- 'trial_welcome', 'subscription_expiry', etc.
  recipient_phone TEXT NOT NULL,
  template_vars JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error TEXT
);

-- Index for fast polling
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_status ON public.whatsapp_notifications(status);

-- RLS (Service role access only for now)
ALTER TABLE public.whatsapp_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" 
ON public.whatsapp_notifications 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);
