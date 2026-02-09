/**
 * Health Monitor Section
 * @ Displays system incidents and allows resolution
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw, X, Info, Activity } from 'lucide-react';
import { getActiveIncidents, resolveIncident, getHealthSummary, checkSystemHealth, runHealthChecks } from '../../lib/healthMonitor';
import { SystemIncident, HealthSummary } from '../../lib/healthMonitor';

const HealthMonitorSection: React.FC = () => {
  const [incidents, setIncidents] = useState<SystemIncident[]>([]);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [incidentsData, summaryData] = await Promise.all([
      getActiveIncidents(50),
      getHealthSummary()
    ]);
    setIncidents(incidentsData);
    setSummary(summaryData);
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await runHealthChecks();
    await loadData();
    setRefreshing(false);
  };

  const handleResolve = async (incidentId: number) => {
    if (!confirm('هل أنت متأكد من حل هذه المشكلة؟')) return;

    const success = await resolveIncident(incidentId);
    if (success) {
      setIncidents(incidents.filter(i => i.id !== incidentId));
      if (summary) {
        setSummary({
          ...summary,
          total_incidents: summary.total_incidents - 1
        });
      }
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'medium': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'low': return <Info className="w-4 h-4 text-blue-500" />;
      default: return <Activity className="w-4 h-4 text-slate-500" />;
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500/50 bg-red-500/5';
      case 'high': return 'border-orange-500/50 bg-orange-500/5';
      case 'medium': return 'border-yellow-500/50 bg-yellow-500/5';
      case 'low': return 'border-blue-500/50 bg-blue-500/5';
      default: return 'border-slate-500/50 bg-slate-500/5';
    }
  };

  const getSeverityLabel = (severity: string) => {
    const labels: Record<string, string> = {
      critical: 'حرجة',
      high: 'عالية',
      medium: 'متوسطة',
      low: 'منخفضة'
    };
    return labels[severity] || severity;
  };

  const getIncidentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      whatsapp_failure: 'فشل واتساب',
      subscription_failure: 'فشل اشتراك',
      api_error: 'خطأ API',
      process_failure: 'فشل عملية',
      database_error: 'خطأ قاعدة بيانات'
    };
    return labels[type] || type;
  };

  const filteredIncidents = incidents.filter(i =>
    selectedSeverity === 'all' || i.severity === selectedSeverity
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header with Refresh */}
      <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              مراقبة صحة النظام
            </h3>
            <p className="text-slate-400 text-xs mt-1">مراقبة تلقائية للمشاكل والأخطاء</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          تحديث الآن
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-slate-400 text-xs mb-1">إجمالي المشاكل</div>
            <div className="text-2xl font-bold text-white">{summary.total_incidents}</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <div className="text-red-400 text-xs mb-1">حرجة</div>
            <div className="text-2xl font-bold text-red-400">{summary.critical_count}</div>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
            <div className="text-orange-400 text-xs mb-1">عالية</div>
            <div className="text-2xl font-bold text-orange-400">{summary.high_count}</div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <div className="text-yellow-400 text-xs mb-1">متوسطة</div>
            <div className="text-2xl font-bold text-yellow-400">{summary.medium_count}</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {[
          { id: 'all', label: 'الكل' },
          { id: 'critical', label: 'حرجة' },
          { id: 'high', label: 'عالية' },
          { id: 'medium', label: 'متوسطة' },
          { id: 'low', label: 'منخفضة' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSelectedSeverity(tab.id)}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition ${
              selectedSeverity === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Incidents List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filteredIncidents.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h4 className="text-xl font-bold text-white mb-2">لا توجد مشاكل نشطة</h4>
          <p className="text-slate-400">الظام يعمل بشكل طبيعي</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIncidents.map(incident => (
            <div
              key={incident.id}
              className={`bg-slate-900 border rounded-xl p-4 transition hover:shadow-lg ${getSeverityClass(incident.severity)}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="mt-1">
                    {getSeverityIcon(incident.severity)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-white font-bold">{incident.title}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        incident.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        incident.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        incident.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {getSeverityLabel(incident.severity)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-700 text-slate-300">
                        {getIncidentTypeLabel(incident.incident_type)}
                      </span>
                    </div>
                    {incident.message && (
                      <p className="text-slate-400 text-sm mb-2">{incident.message}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {incident.time_ago || 'الآن'}
                      </span>
                      <span>
                        {new Date(incident.created_at).toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleResolve(incident.id)}
                  className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                >
                  <CheckCircle className="w-3 h-3" />
                  حل
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HealthMonitorSection;
