import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Clock, 
  ExternalLink, 
  Eye, 
  X, 
  MessageSquare,
  AlertCircle,
  Filter
} from 'lucide-react';
import { api } from '../api/client';
import { AutomationEvent } from '../types';

export const EventLogsPage: React.FC = () => {
  const [events, setEvents] = useState<AutomationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [activeEvent, setActiveEvent] = useState<AutomationEvent | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await api.getEvents({
        page,
        limit: 15,
        search,
        status: selectedStatus || undefined,
      });
      setEvents(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalItems(res.pagination.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [page, search, selectedStatus]);

  const handleOpenDetail = async (id: string) => {
    try {
      const res = await api.getEventById(id);
      setActiveEvent(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Event Logs</h1>
        <p className="text-sm text-slate-500">
          Sanitized operational audit log of all incoming Instagram direct message webhook events.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by provider message ID, sender ID, or reel shortcode..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <select
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        >
          <option value="">All Statuses</option>
          <option value="matched">Matched</option>
          <option value="not_found">Not Found</option>
          <option value="unavailable">Unavailable</option>
          <option value="unsupported_share">Unsupported Share</option>
          <option value="ignored">Ignored</option>
          <option value="duplicate">Duplicate (Dropped)</option>
        </select>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/75 text-xs uppercase font-medium text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Received At</th>
                <th className="px-6 py-3.5">Provider Message ID</th>
                <th className="px-6 py-3.5">Sender</th>
                <th className="px-6 py-3.5">Source</th>
                <th className="px-6 py-3.5">Extracted Reel</th>
                <th className="px-6 py-3.5">Result</th>
                <th className="px-6 py-3.5 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No incoming events logged.
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5 whitespace-nowrap text-xs text-slate-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-xs font-mono text-slate-600">
                      <span className="truncate block max-w-[140px]" title={event.providerMessageId}>
                        {event.providerMessageId}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-xs font-mono text-slate-600">
                      {event.senderId.slice(0, 4)}...{event.senderId.slice(-4)}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {event.messageType}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      {event.extractedReelId ? (
                        <span className="font-mono text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/50">
                          {event.extractedReelId}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
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
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => handleOpenDetail(event._id)}
                        className="inline-flex items-center p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        title="View Event Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {events.length} of {totalItems} events
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <span className="font-medium text-slate-700">
              Page {page} of {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Sanitized Detail Drawer / Modal */}
      {activeEvent && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Event Inspection & Payload Breakdown</h2>
              <button
                onClick={() => setActiveEvent(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block font-medium">Provider Message ID</span>
                  <span className="font-mono text-slate-800 break-all">{activeEvent.providerMessageId}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block font-medium">Sender ID (Masked)</span>
                  <span className="font-mono text-slate-800">{activeEvent.senderId}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Identification Status:</span>
                  <span className="font-semibold text-slate-900">{activeEvent.identificationStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Extraction Source:</span>
                  <span className="font-semibold text-slate-900">{activeEvent.messageType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Extracted Reel ID:</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    {activeEvent.extractedReelId || 'N/A'}
                  </span>
                </div>
                {activeEvent.extractedCanonicalUrl && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Canonical URL:</span>
                    <a
                      href={activeEvent.extractedCanonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-600 hover:underline flex items-center"
                    >
                      {activeEvent.extractedCanonicalUrl} <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                )}
              </div>

              {/* Matched Resource Section */}
              {activeEvent.matchResult?.title && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="text-emerald-800 font-semibold block mb-1">Matched Resource:</span>
                  <span className="text-slate-900 font-medium block">{activeEvent.matchResult.title}</span>
                  <a
                    href={activeEvent.matchResult.resourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 underline text-[11px] block mt-1 break-all"
                  >
                    {activeEvent.matchResult.resourceUrl}
                  </a>
                </div>
              )}

              {/* Associated Outbound Replies */}
              {activeEvent.replies && activeEvent.replies.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-900 block mb-2">Outbound Delivery Dispatched:</span>
                  {activeEvent.replies.map((reply) => (
                    <div
                      key={reply._id}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5"
                    >
                      <div className="flex justify-between text-[11px]">
                        <span className="font-semibold text-slate-700 uppercase">
                          Type: {reply.replyType}
                        </span>
                        <span className="text-emerald-700 font-medium">
                          Status: {reply.deliveryStatus}
                        </span>
                      </div>
                      <p className="text-slate-800 italic">"{reply.renderedMessage}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => setActiveEvent(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

