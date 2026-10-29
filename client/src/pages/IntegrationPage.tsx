import React, { useEffect, useState } from 'react';
import { 
  Radio, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Play, 
  Copy, 
  ExternalLink,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { api } from '../api/client';
import { IntegrationStatus } from '../types';

export const IntegrationPage: React.FC = () => {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Simulator State
  const [simInput, setSimInput] = useState('https://www.instagram.com/reel/DC5aXYZ89ab/?igsh=demo_share');
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);

  useEffect(() => {
    api.getIntegrationStatus()
      .then((res) => setStatus(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simInput.trim()) return;

    setSimLoading(true);
    setSimResult(null);

    try {
      const res = await api.testMatch(simInput.trim());
      setSimResult(res.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSimLoading(false);
    }
  };

  const handleCopyEndpoint = () => {
    const fullUrl = `${window.location.origin}/api/v1/webhooks/instagram`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Integration Setup & Live Simulator
        </h1>
        <p className="text-sm text-slate-500">
          Connect your Instagram Professional Account, inspect environment readiness, and test matching in real-time.
        </p>
      </div>

      {/* Simulator Card (Interactive Tool) */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-lg border border-slate-700">
        <div className="flex items-center space-x-2 text-emerald-400 mb-2">
          <Sparkles className="w-5 h-5" />
          <h2 className="text-base font-bold text-white">Interactive Reel-to-Resource Simulator</h2>
        </div>
        <p className="text-xs text-slate-300 mb-5">
          Paste any Instagram Reel URL, shortcode, or test text below to test identifier extraction, database lookup, and outbound reply rendering without sending real Instagram messages.
        </p>

        <form onSubmit={handleRunSimulation} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            value={simInput}
            onChange={(e) => setSimInput(e.target.value)}
            placeholder="e.g. https://www.instagram.com/reel/DC5aXYZ89ab/ or C890_MySampleReel"
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
          />
          <button
            type="submit"
            disabled={simLoading}
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-semibold text-slate-950 text-xs shadow-md transition-all disabled:opacity-50"
          >
            <Play className="w-4 h-4 mr-1.5 fill-current" />
            {simLoading ? 'Simulating...' : 'Test Reel Match'}
          </button>
        </form>

        {/* Simulator Results Breakdown */}
        {simResult && (
          <div className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-slate-700/80 space-y-4 text-xs animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-semibold text-slate-300">Simulation Diagnostic Results</span>
              <span
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                  simResult.match?.status === 'matched'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : simResult.identification.status === 'unsupported_share'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}
              >
                Outcome: {simResult.match?.status || simResult.identification.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Identification Status</span>
                <span className="font-semibold text-white block mt-0.5">
                  {simResult.identification.status}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Identified Reel ID</span>
                <span className="font-mono text-emerald-400 block mt-0.5">
                  {simResult.identification.reelId || 'None'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Database Match</span>
                <span className="font-semibold text-white block mt-0.5">
                  {simResult.match?.resource ? simResult.match.resource.title : 'No Match'}
                </span>
              </div>
            </div>

            {/* Outbound DM Output Box */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700 space-y-1.5">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                Outbound Direct Message Delivered to User:
              </span>
              <p className="text-sm font-medium text-slate-100 bg-slate-950 p-3 rounded-lg border border-slate-800">
                "{simResult.renderedReply}"
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Environment Variable Checklist */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
        <h2 className="text-base font-semibold text-slate-900">Environment Readiness Checklist</h2>
        <p className="text-xs text-slate-500">
          The application checks for required Meta credentials in your local <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">.env</code> file. No secrets are ever exposed.
        </p>

        {status && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {Object.entries(status.environmentChecklist).map(([key, configured]) => (
              <div
                key={key}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50"
              >
                <span className="font-mono text-slate-700">{key}</span>
                {configured ? (
                  <span className="inline-flex items-center text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" /> Configured
                  </span>
                ) : (
                  <span className="inline-flex items-center text-slate-400 font-medium">
                    <XCircle className="w-4 h-4 mr-1 text-slate-400" /> Missing
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Meta Developer Setup Instructions */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Meta Webhook Configuration</h2>
        <p className="text-xs text-slate-500">
          Configure these values under <strong>Webhooks &gt; Instagram</strong> in your Meta App Dashboard:
        </p>

        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block font-medium">Callback URL</span>
              <code className="text-slate-800 font-mono">
                {window.location.origin}/api/v1/webhooks/instagram
              </code>
            </div>
            <button
              onClick={handleCopyEndpoint}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200"
              title="Copy URL"
            >
              {copiedEndpoint ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-400 block font-medium">Verify Token</span>
            <span className="text-slate-700">Matches the <code className="font-mono bg-slate-200/60 px-1 py-0.5 rounded">META_WEBHOOK_VERIFY_TOKEN</code> in your .env file.</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-400 block font-medium">Required Webhook Subscription Field</span>
            <span className="font-mono font-semibold text-slate-900">messages</span>
          </div>
        </div>
      </div>
    </div>
  );
};

