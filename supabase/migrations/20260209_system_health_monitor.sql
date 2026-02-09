-- =====================================================
-- System Health Monitor Migration
-- =====================================================
-- Creates tables and functions for monitoring system health
-- =====================================================

-- ==========================================
-- 1. Create system_incidents table
-- ==========================================
CREATE TABLE IF NOT EXISTS system_incidents (
    id BIGSERIAL PRIMARY KEY,
    incident_type TEXT NOT NULL CHECK (incident_type IN ('whatsapp_failure', 'subscription_failure', 'api_error', 'process_failure', 'database_error')),
    title TEXT NOT NULL,
    message TEXT,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    metadata JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_system_incidents_type ON system_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_system_incidents_severity ON system_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_system_incidents_resolved ON system_incidents(resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_incidents_created_at ON system_incidents(created_at DESC);

-- ==========================================
-- 2. Create health_monitor_log table for raw monitoring data
-- ==========================================
CREATE TABLE IF NOT EXISTS health_monitor_log (
    id BIGSERIAL PRIMARY KEY,
    check_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'warning', 'error', 'critical')),
    response_time_ms INTEGER,
    message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for recent logs
CREATE INDEX IF NOT EXISTS idx_health_monitor_log_created_at ON health_monitor_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_monitor_log_status ON health_monitor_log(status, created_at DESC);

-- ==========================================
-- 3. Enable Row Level Security
-- ==========================================
ALTER TABLE system_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_monitor_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage incidents
CREATE POLICY "Admins can view all incidents"
ON system_incidents FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'owner')
    )
);

CREATE POLICY "Admins can insert incidents"
ON system_incidents FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'owner')
    )
);

CREATE POLICY "Admins can update incidents"
ON system_incidents FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'owner')
    )
);

-- Only admins can view health logs
CREATE POLICY "Admins can view health logs"
ON health_monitor_log FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'owner')
    )
);

-- Service role can write incidents (for automated monitoring)
CREATE POLICY "Service role can write incidents"
ON system_incidents FOR INSERT
TO service_role
WITH CHECK (true);

-- Service role can write health logs
CREATE POLICY "Service role can write health logs"
ON health_monitor_log FOR INSERT
TO service_role
WITH CHECK (true);

-- ==========================================
-- 4. Create function to log incidents
-- ==========================================
CREATE OR REPLACE FUNCTION log_system_incident(
    p_incident_type TEXT,
    p_title TEXT,
    p_message TEXT DEFAULT NULL,
    p_severity TEXT DEFAULT 'medium',
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BIGINT AS $$
DECLARE
    v_incident_id BIGINT;
BEGIN
    -- Insert new incident
    INSERT INTO system_incidents (incident_type, title, message, severity, metadata)
    VALUES (p_incident_type, p_title, p_message, p_severity, p_metadata)
    RETURNING id INTO v_incident_id;

    -- Return the incident ID
    RETURN v_incident_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION log_system_incident TO service_role;

-- ==========================================
-- 5. Create function to get active (unresolved) incidents
-- ==========================================
CREATE OR REPLACE FUNCTION get_active_incidents(
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    id BIGINT,
    incident_type TEXT,
    title TEXT,
    message TEXT,
    severity TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    time_ago TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id,
        i.incident_type,
        i.title,
        i.message,
        i.severity,
        i.metadata,
        i.created_at,
        CASE
            WHEN EXTRACT(EPOCH FROM (NOW() - i.created_at)) < 60 THEN 'الآن'
            WHEN EXTRACT(EPOCH FROM (NOW() - i.created_at)) < 3600 THEN CONCAT(FLOOR(EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 60), ' دقيقة')
            WHEN EXTRACT(EPOCH FROM (NOW() - i.created_at)) < 86400 THEN CONCAT(FLOOR(EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 3600), ' ساعة')
            ELSE CONCAT(FLOOR(EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 86400), ' يوم')
        END AS time_ago
    FROM system_incidents i
    WHERE i.resolved = false
    ORDER BY
        CASE i.severity
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
        END,
        i.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 6. Create function to resolve incident
-- ==========================================
CREATE OR REPLACE FUNCTION resolve_system_incident(
    p_incident_id BIGINT
)
RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE system_incidents
    SET
        resolved = true,
        resolved_at = NOW(),
        resolved_by = v_user_id,
        updated_at = NOW()
    WHERE id = p_incident_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Incident not found';
    END IF;

    RETURN json_build_object('success', true, 'incident_id', p_incident_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 7. Create function to get system health summary
-- ==========================================
CREATE OR REPLACE FUNCTION get_system_health_summary()
RETURNS TABLE (
    total_incidents BIGINT,
    critical_count BIGINT,
    high_count BIGINT,
    medium_count BIGINT,
    low_count BIGINT,
    resolved_today BIGINT,
    created_today BIGINT,
    whatsapp_failures_24h BIGINT,
    subscription_failures_24h BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::BIGINT FROM system_incidents) as total_incidents,
        (SELECT COUNT(*)::BIGINT FROM system_incidents WHERE severity = 'critical' AND resolved = false) as critical_count,
        (SELECT COUNT(*)::BIGINT FROM system_incidents WHERE severity = 'high' AND resolved = false) as high_count,
        (SELECT COUNT(*)::BIGINT FROM system_incidents WHERE severity = 'medium' AND resolved = false) as medium_count,
        (SELECT COUNT(*)::BIGINT FROM system_incidents WHERE severity = 'low' AND resolved = false) as low_count,
        (SELECT COUNT(*)::BIGINT FROM system_incidents WHERE resolved = true AND resolved_at >= DATE_TRUNC('day', NOW())) as resolved_today,
        (SELECT COUNT(*)::BIGINT FROM system_incidents WHERE created_at >= DATE_TRUNC('day', NOW())) as created_today,
        (SELECT COUNT(*)::BIGINT FROM system_incidents WHERE incident_type = 'whatsapp_failure' AND created_at >= NOW() - INTERVAL '24 hours') as whatsapp_failures_24h,
        (SELECT COUNT(*)::BIGINT FROM system_incidents WHERE incident_type = 'subscription_failure' AND created_at >= NOW() - INTERVAL '24 hours') as subscription_failures_24h;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 8. Create function to check health status
-- ==========================================
CREATE OR REPLACE FUNCTION check_system_health()
RETURNS TABLE (
    status TEXT,
    message TEXT,
    checks JSONB
) AS $$
DECLARE
    v_status TEXT := 'healthy';
    v_message TEXT := 'All systems operational';
    v_checks JSONB := '{}'::jsonb;
    v_critical_count INTEGER;
    v_high_count INTEGER;
BEGIN
    -- Count unresolved critical and high incidents
    SELECT
        COALESCE(COUNT(*) FILTER (WHERE severity = 'critical' AND resolved = false), 0),
        COALESCE(COUNT(*) FILTER (WHERE severity = 'high' AND resolved = false), 0)
    INTO v_critical_count, v_high_count
    FROM system_incidents;

    -- Determine overall status
    IF v_critical_count > 0 THEN
        v_status := 'critical';
        v_message := CONCAT(v_critical_count, ' حالة حرجة تتطلب انتباهك');
    ELSIF v_high_count > 0 THEN
        v_status := 'warning';
        v_message := CONCAT(v_high_count, ' حالة عالية الأهمية تحت المراقبة');
    END IF;

    -- Build checks object
    v_checks := jsonb_build_object(
        'critical_incidents', v_critical_count,
        'high_incidents', v_high_count,
        'last_check', NOW()
    );

    RETURN QUERY SELECT v_status, v_message, v_checks;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 9. Auto-resolve old incidents (older than 7 days)
-- ==========================================
CREATE OR REPLACE FUNCTION auto_resolve_old_incidents()
RETURNS INTEGER AS $$
DECLARE
    v_resolved_count INTEGER;
BEGIN
    -- Resolve incidents older than 7 days that are not critical
    UPDATE system_incidents
    SET
        resolved = true,
        resolved_at = NOW(),
        updated_at = NOW()
    WHERE
        resolved = false
        AND severity IN ('low', 'medium')
        AND created_at < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS v_resolved_count = ROW_COUNT;

    RETURN v_resolved_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_active_incidents TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_system_incident TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_health_summary TO authenticated;
GRANT EXECUTE ON FUNCTION check_system_health TO authenticated;
GRANT EXECUTE ON FUNCTION auto_resolve_old_incidents TO service_role;
