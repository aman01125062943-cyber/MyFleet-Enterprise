/// <reference types="vite/client" />
/**
 * Health Monitor Service
 * @description Background service that monitors system health and logs incidents
 *
 * Monitors:
 * - WhatsApp message delivery failures
 * - Subscription activation failures
 * - API errors (5xx responses)
 * - Critical backend process failures
 *
 * Runs every 5 minutes automatically
 */

import { supabase } from './supabaseClient';

// Incident types
export type IncidentType = 'whatsapp_failure' | 'subscription_failure' | 'api_error' | 'process_failure' | 'database_error';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SystemIncident {
  id: number;
  incident_type: IncidentType;
  title: string;
  message?: string;
  severity: IncidentSeverity;
  metadata?: Record<string, unknown>;
  resolved: boolean;
  created_at: string;
  time_ago?: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  checks: {
    critical_incidents: number;
    high_incidents: number;
    last_check: string;
  };
}

export interface HealthSummary {
  total_incidents: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  resolved_today: number;
  created_today: number;
  whatsapp_failures_24h: number;
  subscription_failures_24h: number;
}

// Configuration
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const isDev = import.meta.env.DEV;
// Unified: prefer VITE_WHATSAPP_SERVICE_URL (used by WhatsAppSection), fallback to VITE_WHATSAPP_SERVER_URL
const WHATSAPP_SERVER_URL = import.meta.env.VITE_WHATSAPP_SERVICE_URL || import.meta.env.VITE_WHATSAPP_SERVER_URL || '';
const WHATSAPP_ENABLED = import.meta.env.VITE_WHATSAPP_ENABLED !== 'false'; // Default: enabled

let monitoringInterval: ReturnType<typeof setInterval> | null = null;
let isMonitoring = false;

// =====================================================
// Incident Logging
// =====================================================

/**
 * Log a system incident
 */
export async function logIncident(
  type: IncidentType,
  title: string,
  message?: string,
  severity: IncidentSeverity = 'medium',
  metadata?: Record<string, unknown>
): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('log_system_incident', {
      p_incident_type: type,
      p_title: title,
      p_message: message || null,
      p_severity: severity,
      p_metadata: metadata || {}
    });

    if (error) {
      console.error('Failed to log incident:', error);
      return null;
    }

    console.log(`🚨 Incident logged: [${severity.toUpperCase()}] ${title}`);
    return data as number;
  } catch (e) {
    console.error('Error logging incident:', e);
    return null;
  }
}

// =====================================================
// Incident Retrieval
// =====================================================

/**
 * Get active (unresolved) incidents
 */
export async function getActiveIncidents(limit = 100): Promise<SystemIncident[]> {
  try {
    const { data, error } = await supabase.rpc('get_active_incidents', {
      p_limit: limit
    });

    if (error) throw error;
    return (data || []) as SystemIncident[];
  } catch (e) {
    console.error('Error fetching active incidents:', e);
    return [];
  }
}

/**
 * Resolve an incident
 */
export async function resolveIncident(incidentId: number): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('resolve_system_incident', {
      p_incident_id: incidentId
    });

    if (error) throw error;
    console.log(`✅ Incident ${incidentId} resolved`);
    return true;
  } catch (e) {
    console.error('Error resolving incident:', e);
    return false;
  }
}

// =====================================================
// Health Summary
// =====================================================

/**
 * Get system health summary
 */
export async function getHealthSummary(): Promise<HealthSummary | null> {
  try {
    const { data, error } = await supabase.rpc('get_system_health_summary');

    if (error) throw error;
    return data?.[0] as HealthSummary ?? null;
  } catch (e) {
    console.error('Error fetching health summary:', e);
    return null;
  }
}

/**
 * Check overall system health status
 */
export async function checkSystemHealth(): Promise<HealthCheckResult | null> {
  try {
    const { data, error } = await supabase.rpc('check_system_health');

    if (error) throw error;
    return data?.[0] as HealthCheckResult ?? null;
  } catch (e) {
    console.error('Error checking system health:', e);
    return null;
  }
}

// =====================================================
// Health Checks
// =====================================================

/**
 * Check WhatsApp service health
 */
async function checkWhatsAppHealth(): Promise<void> {
  // Skip health check if WhatsApp is disabled
  if (!WHATSAPP_ENABLED) {
    console.log('⏭️ WhatsApp health check skipped (service disabled)');
    return;
  }

  try {
    const response = await fetch(`${WHATSAPP_SERVER_URL}/api/health`);

    if (!response.ok) {
      if (response.status >= 500) {
        await logIncident(
          'whatsapp_failure',
          'WhatsApp Service Error',
          `WhatsApp service returned ${response.status}: ${response.statusText}`,
          'high',
          { status_code: response.status, url: WHATSAPP_SERVER_URL }
        );
      }
    }

    // Check for failed messages in the last hour
    const { data: failedMessages, error } = await supabase
      .from('whatsapp_messages')
      .select('id, created_at, error_message')
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(10);

    if (!error && failedMessages && failedMessages.length > 5) {
      await logIncident(
        'whatsapp_failure',
        'High WhatsApp Message Failure Rate',
        `${failedMessages.length} messages failed in the last hour`,
        'medium',
        { failed_count: failedMessages.length, recent_failures: failedMessages.slice(0, 5) }
      );
    }
  } catch (e) {
    await logIncident(
      'whatsapp_failure',
      'WhatsApp Service Unreachable',
      `Cannot connect to WhatsApp service: ${(e as Error).message}`,
      'critical',
      { error: (e as Error).message }
    );
  }
}

/**
 * Check subscription system health
 */
async function checkSubscriptionHealth(): Promise<void> {
  try {
    // Check for failed subscription activations in the last 24 hours
    const { data: failedSubscriptions, error } = await supabase
      .from('organizations')
      .select('id, name, created_at')
      .eq('subscription_plan', 'trial')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .eq('is_active', true)
      .limit(10);

    if (!error && failedSubscriptions && failedSubscriptions.length > 3) {
      await logIncident(
        'subscription_failure',
        'Multiple Subscription Activation Failures',
        `${failedSubscriptions.length} trial accounts failed to activate in the last 24 hours`,
        'high',
        { failed_count: failedSubscriptions.length, orgs: failedSubscriptions.map(o => o.name) }
      );
    }

    // Check for expired trials without action
    const { data: expiredTrials } = await supabase
      .from('organizations')
      .select('id, name, subscription_end')
      .eq('subscription_plan', 'trial')
      .lt('subscription_end', new Date().toISOString())
      .eq('is_active', true)
      .limit(20);

    if (expiredTrials && expiredTrials.length > 10) {
      await logIncident(
        'subscription_failure',
        'Many Expired Trials Still Active',
        `${expiredTrials.length} expired trial accounts are still marked as active`,
        'medium',
        { expired_count: expiredTrials.length }
      );
    }
  } catch (e) {
    await logIncident(
      'process_failure',
      'Subscription Health Check Failed',
      `Failed to check subscription health: ${(e as Error).message}`,
      'medium',
      { error: (e as Error).message }
    );
  }
}

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<void> {
  try {
    const start = Date.now();

    // Simple health query
    const { error } = await supabase
      .from('organizations')
      .select('id', { count: 'exact', head: true });

    const responseTime = Date.now() - start;

    // Log if database is slow
    if (responseTime > 5000) {
      await logIncident(
        'database_error',
        'Slow Database Response',
        `Database query took ${responseTime}ms`,
        'medium',
        { response_time_ms: responseTime }
      );
    }

    if (error) {
      await logIncident(
        'database_error',
        'Database Query Failed',
        `Health check query failed: ${error.message}`,
        'high',
        { error: error.message, code: error.code }
      );
    }
  } catch (e) {
    await logIncident(
      'database_error',
      'Database Health Check Failed',
      `Failed to check database health: ${(e as Error).message}`,
      'critical',
      { error: (e as Error).message }
    );
  }
}

// =====================================================
// Monitoring Control
// =====================================================

/**
 * Run all health checks once
 */
export async function runHealthChecks(): Promise<void> {
  console.log('🔍 Running health checks...');

  await Promise.allSettled([
    checkWhatsAppHealth(),
    checkSubscriptionHealth(),
    checkDatabaseHealth()
  ]);

  console.log('✅ Health checks completed');
}

/**
 * Start automatic health monitoring
 */
export function startHealthMonitoring(): void {
  if (isMonitoring) {
    console.log('⚠️ Health monitoring already active');
    return;
  }

  console.log('🚀 Starting health monitoring (every 5 minutes)...');

  // Run initial check
  runHealthChecks();

  // Set up interval
  monitoringInterval = setInterval(() => {
    runHealthChecks();
  }, HEALTH_CHECK_INTERVAL);

  isMonitoring = true;
}

/**
 * Stop health monitoring
 */
export function stopHealthMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  isMonitoring = false;
  console.log('🛑 Health monitoring stopped');
}

/**
 * Get monitoring status
 */
export function isHealthMonitoringActive(): boolean {
  return isMonitoring;
}

// =====================================================
// Auto-start monitoring in production
// =====================================================

if (typeof globalThis.window !== 'undefined') {
  // Only start monitoring if user is admin
  (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase.from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (data && (data.role === 'admin' || data.role === 'super_admin' || data.role === 'owner')) {
        // Start monitoring for admin users
        startHealthMonitoring();
      }
    }
  })();
}
