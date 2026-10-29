import React, { useEffect, useState } from 'react';
import { 
  Layers, 
  CheckCircle2, 
  MessageSquare, 
  Send, 
  XCircle, 
  HelpCircle, 
  Radio, 
  ShieldCheck, 
  ExternalLink,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../api/client';
import { OverviewMetrics, IntegrationStatus } from '../types';
import { Link } from 'react-router-dom';

export const OverviewPage: React.FC = () => {
  const [data, setData] = useState<OverviewMetrics | null>(null);
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getOverview(), api.getIntegrationStatus()])
      .then(([overviewRes, statusRes]) => {
        setData(overviewRes.data);
        setStatus(statusRes.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const { metrics, recentActivity } = data;

  const statCards = [
    {
      label: 'Total Resources',
      value: metrics.totalResources,
      subtext: `${metrics.availableResources} currently active & available`,
      icon: Layers,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    },
    {
      label: 'Incoming Reel Events',
      value: metrics.totalEvents,
      subtext: 'Direct messages processed',
      icon: MessageSquare,
      color: 'text-blue-600 bg-blue-50 border-blue-100',
    },
    {
      label: 'Successful Resource Matches',
      value: metrics.matchedEvents,
      subtext: `${metrics.totalEvents ? Math.round((metrics.matchedEvents / metrics.totalEvents) * 100) : 0}% library match rate`,
      icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    },
    {
      label: 'Replies Dispatched',
      value: metrics.successfulReplies,
      subtext: `${metrics.failedReplies} failed delivery attempts`,
      icon: Send,
      color: 'text-purple-600 bg-purple-50 border-purple-100',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Title & Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Automation Overview</h1>
          <p className="text-sm text-slate-500">Live operational monitoring of Reel-to-Resource matching.</p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/integration"
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-sm"
          >
            <Radio className="w-4 h-4 mr-2 text-slate-500" />
            Live Simulator
          </Link>
          <Link
            to="/resources"
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm"
          >
            <Layers className="w-4 h-4 mr-2" />
            Manage Resources
          </Link>
        </div>
      </div>

      {/* Integration Status Card */}
      {status && (
        <div className={`p-4 rounded-xl border ${status.simulationMode ? 'bg-amber-50/60 border-amber-200' : status.readinessStatus === 'ready' ? 'bg-emerald-50/60 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${status.simulationMode ? 'bg-amber-500 animate-pulse' : status.readinessStatus === 'ready' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
              <div>
                <span className="text-sm font-semibold text-slate-900 block">
                  {status.simulationMode
                    ? 'Operating in Simulation Mode (Safe Testing)'
                    : status.readinessStatus === 'ready'
                    ? 'Meta Instagram Send API Connected & Live'
                    : 'Meta API Credentials Pending'}
                </span>
                <span className="text-xs text-slate-600">
                  {status.simulationMode
                    ? 'Incoming webhooks are matched against MongoDB and simulated replies are logged without sending live DMs.'
                    : status.readinessStatus === 'ready'
                    ? `Ready to process live incoming Reels and deliver DMs via Graph API ${status.graphApiVersion}.`
                    : 'Check the Integration Setup page to connect your Meta App Secret and Page Access Token.'}
                </span>
              </div>
            </div>
            <Link
              to="/integration"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center whitespace-nowrap"
            >
              Configure Setup <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{card.label}</span>
                <div className={`p-2 rounded-lg border ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900 block">{card.value}</span>
                <span className="text-xs text-slate-500 block mt-1">{card.subtext}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent Webhook Activity</h2>
            <p className="text-xs text-slate-500">Real-time incoming Instagram DM events and matching outcomes</p>
          </div>
          <Link to="/events" className="text-xs font-medium text-emerald-600 hover:text-emerald-700">
            View all events &rarr;
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/75 text-xs uppercase font-medium text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Sender ID</th>
                <th className="px-6 py-3">Identified Reel</th>
                <th className="px-6 py-3">Matched Resource</th>
                <th className="px-6 py-3">Processing Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm">
                    No incoming events logged yet. Use the Simulator to test an event!
                  </td>
                </tr>
              ) : (
                recentActivity.map((event) => (
                  <tr key={event._id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3 whitespace-nowrap text-xs text-slate-500">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-xs font-mono text-slate-600">
                      {event.senderId.slice(0, 4)}...{event.senderId.slice(-4)}
                    </td>
                    <td className="px-6 py-3">
                      {event.extractedReelId ? (
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                          {event.extractedReelId}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-xs">
                      {event.matchResult?.title ? (
                        <span className="font-medium text-slate-900 block truncate max-w-xs">
                          {event.matchResult.title}
                        </span>
                      ) : (
                        <span className="text-slate-400">No match</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          event.processingStatus === 'matched' || event.processingStatus === 'reply_sent'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : event.processingStatus === 'not_found'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : event.processingStatus === 'unavailable'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : event.processingStatus === 'unsupported_share'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {event.processingStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

