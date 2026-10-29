import React, { useEffect, useState } from 'react';
import { 
  Send, 
  Clock, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle, 
  PlayCircle 
} from 'lucide-react';
import { api } from '../api/client';
import { ReplyLog } from '../types';

export const ReplyLogsPage: React.FC = () => {
  const [replies, setReplies] = useState<ReplyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedType, setSelectedType] = useState('');

  const fetchReplies = async () => {
    setLoading(true);
    try {
      const res = await api.getReplies({
        page,
        limit: 15,
        deliveryStatus: selectedStatus || undefined,
        replyType: selectedType || undefined,
      });
      setReplies(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalItems(res.pagination.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReplies();
  }, [page, selectedStatus, selectedType]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reply Logs</h1>
        <p className="text-sm text-slate-500">
          Delivery records and provider acceptance statuses for all automated outgoing direct messages.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <select
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        >
          <option value="">All Delivery Statuses</option>
          <option value="delivered_to_api">Delivered to Meta API</option>
          <option value="simulated">Simulated (Demo Mode)</option>
          <option value="failed">Delivery Failed</option>
          <option value="pending">Pending</option>
        </select>

        <select
          value={selectedType}
          onChange={(e) => {
            setSelectedType(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        >
          <option value="">All Reply Types</option>
          <option value="resource_found">Resource Found</option>
          <option value="resource_not_found">Resource Not Found</option>
          <option value="unsupported_reel">Unsupported Reel</option>
          <option value="resource_unavailable">Resource Unavailable</option>
        </select>
      </div>

      {/* Replies Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/75 text-xs uppercase font-medium text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Sent At</th>
                <th className="px-6 py-3.5">Recipient ID</th>
                <th className="px-6 py-3.5">Reply Type</th>
                <th className="px-6 py-3.5">Delivered Content</th>
                <th className="px-6 py-3.5">Delivery Status</th>
                <th className="px-6 py-3.5 text-right">Attempts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  </td>
                </tr>
              ) : replies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No reply records logged yet.
                  </td>
                </tr>
              ) : (
                replies.map((reply) => (
                  <tr key={reply._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5 whitespace-nowrap text-xs text-slate-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(reply.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-xs font-mono text-slate-700">
                      {reply.recipientId}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-xs uppercase font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {reply.replyType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <p className="text-xs text-slate-900 font-medium line-clamp-2 max-w-md">
                        "{reply.renderedMessage}"
                      </p>
                      {reply.lastError && (
                        <span className="text-[11px] text-red-600 block mt-1">
                          Error: {reply.lastError}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          reply.deliveryStatus === 'delivered_to_api'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : reply.deliveryStatus === 'simulated'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {reply.deliveryStatus === 'delivered_to_api' && (
                          <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                        )}
                        {reply.deliveryStatus === 'simulated' && (
                          <PlayCircle className="w-3 h-3 mr-1 text-amber-600" />
                        )}
                        {reply.deliveryStatus === 'failed' && (
                          <AlertTriangle className="w-3 h-3 mr-1 text-red-600" />
                        )}
                        {reply.deliveryStatus === 'delivered_to_api'
                          ? 'API Accepted'
                          : reply.deliveryStatus === 'simulated'
                          ? 'Simulated'
                          : 'Failed'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right text-xs font-semibold text-slate-700">
                      {reply.attemptCount}
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
            Showing {replies.length} of {totalItems} replies
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
    </div>
  );
};

