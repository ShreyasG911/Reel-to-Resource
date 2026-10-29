import React, { useEffect, useState } from 'react';
import { 
  Sliders, 
  Save, 
  Check, 
  AlertCircle, 
  HelpCircle, 
  Info,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { api } from '../api/client';
import { AutomationSettings } from '../types';

export const AutomationSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSettings()
      .then((res) => setSettings(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    setSaveSuccess(false);
    setError('');

    try {
      await api.updateSettings(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Preview helper
  const previewFound = settings.templates.resourceFound
    .replace('{{resourceUrl}}', 'https://example.com/starter-kit')
    .replace('{{title}}', 'Full-Stack SaaS Starter Kit')
    .replace('{{reelId}}', 'DC5aXYZ89ab')
    .replace('{{senderId}}', '@user123');

  return (
    <div className="max-w-4xl space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Automation Settings</h1>
        <p className="text-sm text-slate-500">
          Configure response templates, toggle automated processing, and manage delivery behavior.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center">
          <Check className="w-5 h-5 mr-2 flex-shrink-0 text-emerald-600" />
          <span>Settings successfully saved and active in the database.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Automation Switches */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Operational Controls
          </h2>

          <div className="flex items-center justify-between">
            <div className="max-w-xl">
              <span className="text-sm font-semibold text-slate-900 block">
                Automatic Direct Message Replies
              </span>
              <span className="text-xs text-slate-500">
                When disabled, incoming webhooks are still received and logged, but no automated outbound DM is dispatched to the user.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSettings({ ...settings, autoReplyEnabled: !settings.autoReplyEnabled })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.autoReplyEnabled ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.autoReplyEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-6">
            <div className="max-w-xl">
              <span className="text-sm font-semibold text-slate-900 block">
                Simulation Mode (Safe Testing)
              </span>
              <span className="text-xs text-slate-500">
                When active, incoming Reel shares are identified and matched against the database, but outbound DMs are marked as "simulated" without calling the live Meta API.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSettings({ ...settings, simulationMode: !settings.simulationMode })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.simulationMode ? 'bg-amber-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.simulationMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-6">
            <div className="max-w-xl">
              <span className="text-sm font-semibold text-slate-900 block">
                Maximum Retry Attempts
              </span>
              <span className="text-xs text-slate-500">
                Number of retry attempts with exponential backoff if Meta Send API returns a transient error (e.g. rate limit HTTP 429).
              </span>
            </div>
            <input
              type="number"
              min={1}
              max={10}
              value={settings.maxRetryAttempts}
              onChange={(e) =>
                setSettings({ ...settings, maxRetryAttempts: parseInt(e.target.value, 10) || 3 })
              }
              className="w-20 px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center font-semibold"
            />
          </div>
        </div>

        {/* Section 2: Response Templates */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Direct Message Reply Templates</h2>
              <p className="text-xs text-slate-500">
                Customize the automated copy sent to users for each scenario.
              </p>
            </div>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono">
              Placeholders: {'{{resourceUrl}}'} &bull; {'{{title}}'} &bull; {'{{reelId}}'}
            </span>
          </div>

          {/* Template 1: Resource Found */}
          <div>
            <label className="block text-xs font-semibold text-slate-900 mb-1">
              1. Resource Found & Active (Successful Delivery)
            </label>
            <textarea
              rows={2}
              value={settings.templates.resourceFound}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  templates: { ...settings.templates, resourceFound: e.target.value },
                })
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            {/* Live Preview */}
            <div className="mt-2 p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-emerald-900">
              <span className="font-semibold block text-[11px] text-emerald-700 uppercase tracking-wider mb-1">
                Live Preview Output:
              </span>
              "{previewFound}"
            </div>
          </div>

          {/* Template 2: Resource Not Found */}
          <div>
            <label className="block text-xs font-semibold text-slate-900 mb-1">
              2. Resource Not Found in Library (Fallback)
            </label>
            <textarea
              rows={2}
              value={settings.templates.resourceNotFound}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  templates: { ...settings.templates, resourceNotFound: e.target.value },
                })
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Template 3: Unsupported Media */}
          <div>
            <label className="block text-xs font-semibold text-slate-900 mb-1">
              3. Unsupported Media or Ambiguous Share (Guidance)
            </label>
            <textarea
              rows={2}
              value={settings.templates.unsupportedReel}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  templates: { ...settings.templates, unsupportedReel: e.target.value },
                })
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Template 4: Resource Temporarily Unavailable */}
          <div>
            <label className="block text-xs font-semibold text-slate-900 mb-1">
              4. Resource Registered but Marked Unavailable
            </label>
            <textarea
              rows={2}
              value={settings.templates.resourceUnavailable}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  templates: { ...settings.templates, resourceUnavailable: e.target.value },
                })
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

