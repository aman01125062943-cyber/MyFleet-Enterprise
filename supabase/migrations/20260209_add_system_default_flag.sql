-- ==========================================
-- Add is_system_default flag to whatsapp_sessions
-- ==========================================

-- 1. Add the column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'whatsapp_sessions'
        AND column_name = 'is_system_default'
    ) THEN
        ALTER TABLE whatsapp_sessions
        ADD COLUMN is_system_default BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_system_default
    ON whatsapp_sessions(is_system_default)
    WHERE is_system_default = true;

-- 3. Function to automatically mark a session as system default when connected
CREATE OR REPLACE FUNCTION public.mark_as_system_default_on_connect()
RETURNS TRIGGER AS $$
BEGIN
    -- When status changes to 'connected', mark as system default
    -- and unmark all other sessions
    IF NEW.status = 'connected' AND (OLD.status IS NULL OR OLD.status != 'connected') THEN
        -- First, unmark all other sessions as system default
        UPDATE whatsapp_sessions
        SET is_system_default = false
        WHERE id != NEW.id;

        -- Mark this session as system default
        NEW.is_system_default := true;
    END IF;

    -- If session becomes disconnected, remove system default flag
    IF NEW.status != 'connected' AND (OLD.status IS NULL OR OLD.status = 'connected') THEN
        NEW.is_system_default := false;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS whatsapp_sessions_system_default_trigger
    ON whatsapp_sessions;

CREATE TRIGGER whatsapp_sessions_system_default_trigger
    BEFORE UPDATE ON whatsapp_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.mark_as_system_default_on_connect();

-- 5. Function to get the system default session
CREATE OR REPLACE FUNCTION public.get_system_default_session()
RETURNS TABLE (
    session_id TEXT,
    phone_number TEXT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ws.id,
        ws.phone_number,
        ws.status
    FROM whatsapp_sessions ws
    WHERE ws.is_system_default = true
    AND ws.status = 'connected'
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function to auto-select first connected session as default if none exists
CREATE OR REPLACE FUNCTION public.ensure_system_default_session()
RETURNS jsonb AS $$
DECLARE
    v_session_count INT;
    v_first_session_id TEXT;
BEGIN
    -- Check if we have a system default session
    SELECT COUNT(*) INTO v_session_count
    FROM whatsapp_sessions
    WHERE is_system_default = true
    AND status = 'connected';

    -- If no system default exists, promote the first connected session
    IF v_session_count = 0 THEN
        SELECT id INTO v_first_session_id
        FROM whatsapp_sessions
        WHERE status = 'connected'
        ORDER BY created_at ASC
        LIMIT 1;

        -- If we found a connected session, make it the default
        IF v_first_session_id IS NOT NULL THEN
            UPDATE whatsapp_sessions
            SET is_system_default = true
            WHERE id = v_first_session_id;

            RETURN jsonb_build_object(
                'success', true,
                'action', 'promoted_first_connected',
                'session_id', v_first_session_id
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'action', 'no_change_needed'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant permissions
GRANT EXECUTE ON FUNCTION public.get_system_default_session() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_system_default_session() TO service_role;

-- ==========================================
-- Migration Complete
-- ==========================================
