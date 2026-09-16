import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Card, CardContent, Button, Input, Label, Badge } from '@smo/ui';
import {
  Clock01Icon,
  DiningTableIcon,
  Store01Icon,
  Delete01Icon,
  Tick02Icon,
  Cancel01Icon,
  Loading03Icon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  RefreshIcon,
  Settings01Icon,
  Tag01Icon
} from 'hugeicons-react';

export const MaintenanceJobsManager = () => {
  const { user } = useAuthStore();
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(user?.storeId || user?.store?.id || null);
  
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('ALL');
  
  // Pending edits per job: { [jobKey]: { enabled, schedule, params: {} } }
  const [editedConfigs, setEditedConfigs] = useState({});
  const [savingJobKey, setSavingJobKey] = useState(null);
  const [runningJobKey, setRunningJobKey] = useState(null);

  // Notifications / feedback
  const [feedback, setFeedback] = useState({ text: '', error: false, jobKey: null });

  // Fetch stores if Tenant/Super Admin
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const res = await api.get('/stores');
        if (res.data?.success && Array.isArray(res.data.data)) {
          setStores(res.data.data);
          if (!selectedStoreId && res.data.data.length > 0) {
            setSelectedStoreId(res.data.data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load stores:', err);
      }
    };

    if (user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN') {
      fetchStores();
    }
  }, [user]);

  // Fetch jobs for currently selected store
  const fetchJobs = async () => {
    setIsLoading(true);
    setFeedback({ text: '', error: false, jobKey: null });
    try {
      const url = selectedStoreId ? `/maintenance?storeId=${selectedStoreId}` : '/maintenance';
      const res = await api.get(url);
      if (res.data?.success) {
        const list = res.data.data.jobs || [];
        setJobs(list);
        
        // Initialize editable states
        const initial = {};
        list.forEach(j => {
          initial[j.key] = {
            enabled: j.enabled,
            schedule: j.schedule,
            params: { ...(j.params || {}) }
          };
        });
        setEditedConfigs(initial);
      }
    } catch (err) {
      console.error('Failed loading maintenance jobs:', err);
      setFeedback({
        text: 'Failed to load maintenance jobs: ' + (err.response?.data?.error?.message || err.message),
        error: true,
        jobKey: null
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [selectedStoreId]);

  const handleConfigChange = (jobKey, field, value) => {
    setEditedConfigs(prev => ({
      ...prev,
      [jobKey]: {
        ...prev[jobKey],
        [field]: value
      }
    }));
  };

  const handleParamChange = (jobKey, paramKey, value) => {
    setEditedConfigs(prev => ({
      ...prev,
      [jobKey]: {
        ...prev[jobKey],
        params: {
          ...(prev[jobKey]?.params || {}),
          [paramKey]: value
        }
      }
    }));
  };

  const handleSaveConfig = async (jobKey) => {
    setSavingJobKey(jobKey);
    setFeedback({ text: '', error: false, jobKey: null });
    try {
      const config = editedConfigs[jobKey];
      const res = await api.put(`/maintenance/${jobKey}/config`, {
        storeId: selectedStoreId,
        enabled: config.enabled,
        schedule: config.schedule,
        params: config.params
      });

      if (res.data?.success) {
        setFeedback({
          text: `Updated schedule and parameters for ${jobKey}. Background cron rescheduled.`,
          error: false,
          jobKey
        });
        // Update local jobs item
        setJobs(prev => prev.map(j => j.key === jobKey ? res.data.data.job : j));
      }
    } catch (err) {
      setFeedback({
        text: 'Failed updating job schedule: ' + (err.response?.data?.error?.message || err.message),
        error: true,
        jobKey
      });
    } finally {
      setSavingJobKey(null);
    }
  };

  const handleRunManual = async (job) => {
    if (job.isDestructive) {
      const confirmed = window.confirm(`Warning: Running '${job.title}' will permanently delete data matching your retention criteria. Are you sure?`);
      if (!confirmed) return;
    }

    setRunningJobKey(job.key);
    setFeedback({ text: '', error: false, jobKey: null });
    try {
      const currentConfig = editedConfigs[job.key] || {};
      const res = await api.post(`/maintenance/${job.key}/run`, {
        storeId: selectedStoreId,
        params: currentConfig.params
      });

      if (res.data?.success) {
        const data = res.data.data;
        setFeedback({
          text: `✓ ${job.title} completed in ${data.durationMs}ms: ${data.summary}`,
          error: !data.success,
          jobKey: job.key
        });
        // Refresh job run stats
        fetchJobs();
      }
    } catch (err) {
      setFeedback({
        text: `Execution failed for ${job.title}: ` + (err.response?.data?.error?.message || err.message),
        error: true,
        jobKey: job.key
      });
    } finally {
      setRunningJobKey(null);
    }
  };

  const getJobIcon = (category) => {
    switch (category) {
      case 'Tables & Floor':
        return <DiningTableIcon className="w-5 h-5 text-emerald-500" />;
      case 'Inventory':
        return <Store01Icon className="w-5 h-5 text-amber-500" />;
      case 'Finance & Sales':
        return <Clock01Icon className="w-5 h-5 text-indigo-500" />;
      case 'Marketing':
        return <Tag01Icon className="w-5 h-5 text-purple-500" />;
      case 'Data Hygiene':
      default:
        return <Delete01Icon className="w-5 h-5 text-rose-500" />;
    }
  };

  const formatRelativeDate = (dateString) => {
    if (!dateString) return 'Never executed';
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hr ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const categories = ['ALL', 'Data Hygiene', 'Tables & Floor', 'Inventory', 'Finance & Sales', 'Marketing'];
  const filteredJobs = activeCategory === 'ALL' ? jobs : jobs.filter(j => j.category === activeCategory);

  return (
    <section className="mt-10">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Settings01Icon className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
              Automated Operations & Maintenance Jobs
            </h2>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Configure dynamic recurring schedules, adjust store operational thresholds, and trigger on-demand routine tasks.
          </p>
        </div>

        {/* Store Selector for Admins */}
        {stores.length > 1 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Store Scope:</Label>
            <select
              className="text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={selectedStoreId || ''}
              onChange={(e) => setSelectedStoreId(e.target.value)}
            >
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Global Feedback Banner */}
      {feedback.text && (
        <div className={`mb-6 p-4 rounded-xl text-sm flex items-start gap-3 border shadow-sm ${
          feedback.error 
            ? 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/40' 
            : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40'
        }`}>
          {feedback.error ? <AlertCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" /> : <CheckmarkCircle02Icon className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-500" />}
          <div className="flex-1 font-medium">{feedback.text}</div>
          <button 
            onClick={() => setFeedback({ text: '', error: false, jobKey: null })}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-6 scrollbar-none">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              activeCategory === cat
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Jobs Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-zinc-500 flex flex-col items-center gap-3">
          <Loading03Icon className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-sm">Loading dynamic operational jobs...</span>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="p-8 text-center text-zinc-500 border border-dashed rounded-xl">
          No jobs found for the selected category.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredJobs.map(job => {
            const currentEdit = editedConfigs[job.key] || {
              enabled: job.enabled,
              schedule: job.schedule,
              params: job.params || {}
            };
            const isRunning = runningJobKey === job.key;
            const isSaving = savingJobKey === job.key;

            return (
              <Card 
                key={job.key}
                className="flex flex-col justify-between border-zinc-200 dark:border-zinc-800 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all rounded-xl overflow-hidden"
              >
                <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                  {/* Top: Icon, Title, Status Switch */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/80">
                          {getJobIcon(job.category)}
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-zinc-900 dark:text-white leading-tight">
                            {job.title}
                          </h3>
                          <span className="inline-block mt-0.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                            {job.category}
                          </span>
                        </div>
                      </div>

                      {/* Enabled / Disabled Toggle */}
                      <button
                        type="button"
                        onClick={() => handleConfigChange(job.key, 'enabled', !currentEdit.enabled)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          currentEdit.enabled ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'
                        }`}
                        title={currentEdit.enabled ? 'Job is currently active on schedule' : 'Job is currently disabled'}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            currentEdit.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                      {job.description}
                    </p>

                    {/* Schedule Selector */}
                    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-3">
                      <div>
                        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center justify-between">
                          <span>Dynamic Schedule</span>
                          <span className="text-[11px] font-normal text-zinc-400">
                            {currentEdit.enabled ? 'Active' : 'Paused'}
                          </span>
                        </Label>
                        <select
                          className="w-full text-xs bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-medium text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-indigo-500"
                          value={currentEdit.schedule}
                          onChange={(e) => handleConfigChange(job.key, 'schedule', e.target.value)}
                        >
                          {job.scheduleOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Custom Parameters inputs */}
                      {job.paramSchema && job.paramSchema.length > 0 && (
                        <div className="space-y-2.5">
                          {job.paramSchema.map(param => (
                            <div key={param.key}>
                              <Label className="text-xs text-zinc-600 dark:text-zinc-400 mb-1 flex items-center justify-between">
                                <span>{param.label}</span>
                                {param.helper && (
                                  <span className="text-[10px] text-zinc-400 max-w-[200px] truncate" title={param.helper}>
                                    {param.helper}
                                  </span>
                                )}
                              </Label>
                              <Input
                                type={param.type === 'number' ? 'number' : 'text'}
                                min={param.min}
                                max={param.max}
                                placeholder={param.placeholder || ''}
                                value={currentEdit.params?.[param.key] ?? param.default}
                                onChange={(e) => handleParamChange(
                                  job.key,
                                  param.key,
                                  param.type === 'number' ? Number(e.target.value) : e.target.value
                                )}
                                className="h-8 text-xs bg-zinc-50 dark:bg-zinc-800/50"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Execution Feedback & Action Footer */}
                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-3">
                    {/* Last Run Info */}
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-lg">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">Last Run:</span>
                        <span>{formatRelativeDate(job.lastRunAt)}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {job.lastRunStatus === 'SUCCESS' && (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <Tick02Icon className="w-3 h-3" /> Success
                          </span>
                        )}
                        {job.lastRunStatus === 'FAILED' && (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                            <Cancel01Icon className="w-3 h-3" /> Failed
                          </span>
                        )}
                        {!job.lastRunStatus && (
                          <span className="text-zinc-400">Idle</span>
                        )}
                        {job.lastRunDurationMs && (
                          <span className="text-zinc-400 text-[10px]">({job.lastRunDurationMs}ms)</span>
                        )}
                      </div>
                    </div>

                    {job.lastRunSummary && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic px-1 truncate" title={job.lastRunSummary}>
                        "{job.lastRunSummary}"
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 px-3"
                        disabled={isSaving}
                        onClick={() => handleSaveConfig(job.key)}
                      >
                        {isSaving ? (
                          <><Loading03Icon className="w-3.5 h-3.5 animate-spin mr-1.5" /> Saving...</>
                        ) : (
                          'Save Schedule'
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant={job.isDestructive ? 'destructive' : 'default'}
                        size="sm"
                        className="text-xs h-8 px-3 font-semibold"
                        disabled={isRunning}
                        onClick={() => handleRunManual(job)}
                      >
                        {isRunning ? (
                          <><Loading03Icon className="w-3.5 h-3.5 animate-spin mr-1.5" /> Executing...</>
                        ) : (
                          <><RefreshIcon className="w-3.5 h-3.5 mr-1.5" /> Run Now</>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
};
