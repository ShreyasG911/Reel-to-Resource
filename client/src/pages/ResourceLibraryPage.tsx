import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  ExternalLink, 
  Trash2, 
  Edit3, 
  Layers, 
  Check, 
  X, 
  AlertCircle,
  Copy
} from 'lucide-react';
import { api } from '../api/client';
import { Resource, ResourceType, ResourceStatus } from '../types';

export const ResourceLibraryPage: React.FC = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedAvailable, setSelectedAvailable] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    reelId: '',
    resourceUrl: '',
    resourceType: 'template' as ResourceType,
    tags: '',
    isAvailable: true,
    status: 'active' as ResourceStatus,
  });
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const res = await api.getResources({
        page,
        limit: 10,
        search,
        resourceType: selectedType || undefined,
        isAvailable: selectedAvailable !== '' ? selectedAvailable : undefined,
      });
      setResources(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalItems(res.pagination.total);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, [page, search, selectedType, selectedAvailable]);

  const handleOpenAddModal = () => {
    setEditingResource(null);
    setFormData({
      title: '',
      description: '',
      reelId: '',
      resourceUrl: '',
      resourceType: 'template',
      tags: '',
      isAvailable: true,
      status: 'active',
    });
    setModalError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (resource: Resource) => {
    setEditingResource(resource);
    setFormData({
      title: resource.title,
      description: resource.description || '',
      reelId: resource.reelId,
      resourceUrl: resource.resourceUrl,
      resourceType: resource.resourceType,
      tags: resource.tags.join(', '),
      isAvailable: resource.isAvailable,
      status: resource.status,
    });
    setModalError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setSubmitting(true);

    try {
      const payload = {
        ...formData,
        tags: formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };

      if (editingResource) {
        await api.updateResource(editingResource._id, payload);
      } else {
        await api.createResource(payload);
      }

      setIsModalOpen(false);
      fetchResources();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAvailability = async (resource: Resource) => {
    try {
      await api.updateResource(resource._id, { isAvailable: !resource.isAvailable });
      setResources((prev) =>
        prev.map((r) => (r._id === resource._id ? { ...r, isAvailable: !r.isAvailable } : r))
      );
    } catch (err) {
      console.error('Failed to toggle availability', err);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.deleteResource(deleteId);
      setDeleteId(null);
      fetchResources();
    } catch (err) {
      console.error('Failed to delete resource', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Resource Library</h1>
          <p className="text-sm text-slate-500">
            Register and manage Instagram Reels with their exact resource destination links.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4 mr-2 stroke-[2.5]" />
          Add Resource
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by title, reel shortcode, or tags..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="">All Types</option>
            <option value="template">Template</option>
            <option value="guide">Guide / PDF</option>
            <option value="preset">Preset / LUT</option>
            <option value="code">Code / Repo</option>
            <option value="link">General Link</option>
            <option value="other">Other</option>
          </select>

          <select
            value={selectedAvailable}
            onChange={(e) => {
              setSelectedAvailable(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="">All Availability</option>
            <option value="true">Available</option>
            <option value="false">Unavailable</option>
          </select>
        </div>
      </div>

      {/* Resources Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/75 text-xs uppercase font-medium text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Resource Title</th>
                <th className="px-6 py-3.5">Reel Identifier</th>
                <th className="px-6 py-3.5">Destination Link</th>
                <th className="px-6 py-3.5">Type</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Matches</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  </td>
                </tr>
              ) : resources.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No resources found matching your query.
                  </td>
                </tr>
              ) : (
                resources.map((resource) => (
                  <tr key={resource._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-semibold text-slate-900 block">{resource.title}</span>
                        {resource.description && (
                          <span className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                            {resource.description}
                          </span>
                        )}
                        {resource.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {resource.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-block text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <a
                        href={resource.canonicalReelUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-xs font-mono font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200/60"
                      >
                        {resource.reelId}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <a
                        href={resource.resourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-600 hover:text-slate-900 truncate block max-w-xs underline decoration-slate-300 underline-offset-2"
                      >
                        {resource.resourceUrl}
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-block text-xs uppercase tracking-wide font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {resource.resourceType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleAvailability(resource)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                          resource.isAvailable
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            resource.isAvailable ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                        ></span>
                        {resource.isAvailable ? 'Available' : 'Unavailable'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-800">
                      {resource.matchCount}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(resource)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          title="Edit Resource"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(resource._id)}
                          className="p-1.5 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50"
                          title="Delete Resource"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
            Showing {resources.length} of {totalItems} resources
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

      {/* Add / Edit Resource Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-slate-900">
                {editingResource ? 'Edit Resource' : 'Register New Reel Resource'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resource Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Minimalist Notion Life OS"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reel Identifier or Instagram Reel URL *
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingResource)}
                  placeholder="e.g. C890_MySampleReel or https://www.instagram.com/reel/..."
                  value={formData.reelId}
                  onChange={(e) => setFormData({ ...formData, reelId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-xs disabled:bg-slate-100 disabled:text-slate-500"
                />
                <span className="text-[11px] text-slate-500 block mt-1">
                  Paste the shortcode or full link. The system extracts and normalizes it automatically.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destination Resource URL (Delivered in DM) *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/resource-download"
                  value={formData.resourceUrl}
                  onChange={(e) => setFormData({ ...formData, resourceUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Resource Type
                  </label>
                  <select
                    value={formData.resourceType}
                    onChange={(e) =>
                      setFormData({ ...formData, resourceType: e.target.value as ResourceType })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="template">Template</option>
                    <option value="guide">Guide / PDF</option>
                    <option value="preset">Preset / LUT</option>
                    <option value="code">Code / Software</option>
                    <option value="link">General Link</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as ResourceStatus })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft (Do not deliver)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="design, figma, freebie"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief note about what this resource contains..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="isAvailableCheckbox"
                  checked={formData.isAvailable}
                  onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="isAvailableCheckbox" className="text-xs font-medium text-slate-700">
                  Mark as Available for Automated Delivery
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingResource ? 'Update Resource' : 'Save Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Delete Resource</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Are you sure you want to delete this resource? Users who share this Reel will receive the fallback "not found" response.
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-semibold text-white shadow-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

