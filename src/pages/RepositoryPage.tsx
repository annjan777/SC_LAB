import { useEffect, useState } from 'react';
import { Upload, FileText, Search, Download, Eye, Trash2, X, FolderOpen, File, Edit, Share2, User, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { api, getStoredToken } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, Button, FilterBar, EmptyState } from '../components/ui';

interface RepositoryDocument {
  id: string;
  filename: string;
  file_path: string | null;
  document_url?: string | null;
  file_type: string | null;
  category: string;
  title: string;
  description: string | null;
  tags: string[];
  uploaded_by: string;
  uploaded_at: string;
  file_size: number | null;
  visibility: string;
  shared_with_users: string[];
  uploader_name?: string;
  is_shared?: boolean;
}

const USER_CATEGORIES = [
  { value: 'research_papers', label: 'Research Papers', icon: FileText, color: 'from-blue-500 to-blue-600' },
  { value: 'experiment_data', label: 'Experiment Data', icon: File, color: 'from-green-500 to-green-600' },
  { value: 'lab_reports', label: 'Lab Reports', icon: FileText, color: 'from-amber-500 to-amber-600' },
  { value: 'patents', label: 'Patents', icon: FileText, color: 'from-red-500 to-red-600' },
  { value: 'other_documents', label: 'Other Documents', icon: FolderOpen, color: 'from-gray-500 to-gray-600' },
];

export default function RepositoryPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<RepositoryDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<RepositoryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState<RepositoryDocument | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    filterDocuments();
  }, [documents, searchTerm, selectedCategory]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const { data, error } = await api.get('/api/repository', { order: 'created_at', ascending: 'false' });

      if (error) throw error;

      const documentsWithUploaderName = (data || []).map((doc: any) => ({
        ...doc,
        is_shared: doc.uploaded_by !== user?.id,
      }));

      setDocuments(documentsWithUploaderName);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setMessage({ type: 'error', text: 'Failed to load documents' });
    } finally {
      setLoading(false);
    }
  };

  const filterDocuments = () => {
    let filtered = documents;

    if (searchTerm) {
      filtered = filtered.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(doc => doc.category === selectedCategory);
    }

    setFilteredDocuments(filtered);
  };

  const getCategoryCount = (category: string) => {
    return documents.filter(doc => doc.category === category).length;
  };

  const handleDeleteDocument = async (documentId: string, filePath: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const { error: dbError } = await api.delete('/api/repository/' + documentId);

      if (dbError) throw dbError;

      setMessage({ type: 'success', text: 'Document deleted successfully' });
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      setMessage({ type: 'error', text: 'Failed to delete document' });
    }
  };

  const handleViewDocument = async (documentId: string) => {
    try {
      const { data, error } = await api.get('/api/repository/url/' + documentId);
      if (error || !data?.url) throw error || new Error('Document URL not available');
      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Error viewing document:', error);
      setMessage({ type: 'error', text: 'Failed to open document' });
    }
  };

  const handleDownloadDocument = async (documentId: string, filename: string, documentUrl?: string | null) => {
    if (documentUrl) {
      window.open(documentUrl, '_blank');
      return;
    }
    try {
      // A plain link can't send the Authorization header; the server accepts ?token= on download paths only.
      const url = `/api/repository/download/${documentId}?token=${encodeURIComponent(getStoredToken() || '')}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading document:', error);
      setMessage({ type: 'error', text: 'Failed to download document' });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getCategoryLabel = (value: string) => {
    return USER_CATEGORIES.find(cat => cat.value === value)?.label || value;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="My Documents"
        action={
          <Button
            variant="primary"
            onClick={() => setShowUploadModal(true)}
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Upload Document
          </Button>
        }
      />

      {message && (
        <div
          className={`p-4 rounded-xl border ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-emerald-950/40 border-green-200 dark:border-emerald-800 text-green-800 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
          }`}
        >
          <div className="flex justify-between items-center text-sm">
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <FilterBar
        searchValue={searchTerm}
        onSearchChange={(e) => setSearchTerm(e.target.value)}
        onSearchClear={() => setSearchTerm('')}
        searchPlaceholder="Search by title, description, filename, or tags..."
      >
        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
          <span className="text-xs text-gray-500 dark:text-slate-400">
            Showing <strong>{filteredDocuments.length}</strong> of <strong>{documents.length}</strong> documents
          </span>
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Clear Category Filter
            </button>
          )}
        </div>
      </FilterBar>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {USER_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const count = getCategoryCount(category.value);
          const isSelected = selectedCategory === category.value;

          return (
            <button
              key={category.value}
              onClick={() => setSelectedCategory(isSelected ? null : category.value)}
              className={`relative overflow-hidden rounded-xl shadow-sm border-2 transition-all duration-200 hover:shadow-md cursor-pointer ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/20'
                  : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
              }`}
            >
              <div className={`bg-gradient-to-br ${category.color} p-5 text-white`}>
                <div className="flex justify-between items-start mb-3">
                  <Icon className="w-6 h-6" />
                  <div className="text-right">
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-[11px] opacity-85">documents</div>
                  </div>
                </div>
                <p className="text-xs font-semibold truncate">{category.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {filteredDocuments.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No Documents Found"
          description={
            searchTerm || selectedCategory
              ? 'No documents match your search criteria'
              : 'Upload your first document to get started'
          }
          actionText={!searchTerm && !selectedCategory ? 'Upload Document' : undefined}
          onAction={!searchTerm && !selectedCategory ? () => setShowUploadModal(true) : undefined}
          actionIcon={<Upload className="w-4 h-4" />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden group"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition">
                        {doc.title}
                      </h3>
                      {doc.is_shared && (
                        <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                          <Share2 className="w-3 h-3 mr-1" />
                          Shared
                        </span>
                      )}
                      {doc.document_url && !doc.file_path && (
                        <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          <LinkIcon className="w-3 h-3 mr-1" />
                          Link
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate flex items-center gap-1.5">
                      {doc.document_url && !doc.file_path ? (
                        <>
                          <ExternalLink className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="truncate">{doc.document_url}</span>
                        </>
                      ) : (
                        <span>{doc.filename}</span>
                      )}
                    </p>
                  </div>
                </div>

                {doc.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">{doc.description}</p>
                )}

                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {getCategoryLabel(doc.category)}
                  </span>
                  {doc.document_url && !doc.file_path ? (
                    <span className="text-xs text-blue-600 font-medium inline-flex items-center gap-1">
                      <LinkIcon className="w-3 h-3" /> Web Link
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">{formatFileSize(doc.file_size)}</span>
                  )}
                </div>

                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {doc.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700"
                      >
                        {tag}
                      </span>
                    ))}
                    {doc.tags.length > 3 && (
                      <span className="text-xs text-gray-500">+{doc.tags.length - 3} more</span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="text-xs text-gray-500">
                    <p className="font-medium text-gray-700">{doc.uploader_name}</p>
                    <p>{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewDocument(doc.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title={doc.document_url && !doc.file_path ? "Open Link" : "View"}
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDownloadDocument(doc.id, doc.filename, doc.document_url)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                      title={doc.document_url && !doc.file_path ? "Open Link" : "Download"}
                    >
                      {doc.document_url && !doc.file_path ? <ExternalLink className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                    </button>
                    {doc.uploaded_by === user?.id && (
                      <>
                        <button
                          onClick={() => {
                            setEditingDocument(doc);
                            setShowEditModal(true);
                          }}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          title="Edit"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(doc.id, doc.file_path || '')}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showUploadModal && (
        <UploadDocumentModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            fetchDocuments();
            setMessage({ type: 'success', text: 'Document uploaded successfully' });
            setTimeout(() => setMessage(null), 5000);
          }}
        />
      )}

      {showEditModal && editingDocument && (
        <EditDocumentModal
          document={editingDocument}
          onClose={() => {
            setShowEditModal(false);
            setEditingDocument(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setEditingDocument(null);
            fetchDocuments();
            setMessage({ type: 'success', text: 'Document updated successfully' });
            setTimeout(() => setMessage(null), 5000);
          }}
        />
      )}
    </div>
  );
}

interface UploadDocumentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function UploadDocumentModal({ onClose, onSuccess }: UploadDocumentModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [inputType, setInputType] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [documentUrl, setDocumentUrl] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'other_documents',
    tags: '',
    visibility: 'private' as 'private' | 'shared' | 'all_members',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setUploadProgress(0);

    try {
      if (inputType === 'file') {
        if (!file) {
          setError('Please select a file to upload');
          setLoading(false);
          return;
        }

        if (file.size > 50 * 1024 * 1024) {
          setError('File size must be less than 50MB');
          setLoading(false);
          return;
        }
      } else {
        if (!documentUrl.trim()) {
          setError('Please enter a document link / URL');
          setLoading(false);
          return;
        }
      }

      setUploadProgress(30);

      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const uploadData = new FormData();
      if (inputType === 'file' && file) {
        uploadData.append('file', file);
        uploadData.append('title', formData.title || file.name);
      } else {
        uploadData.append('document_url', documentUrl.trim());
        uploadData.append('title', formData.title || 'Document Link');
      }
      uploadData.append('category', formData.category);
      uploadData.append('description', formData.description || '');
      uploadData.append('tags', JSON.stringify(tagsArray));
      uploadData.append('visibility', formData.visibility);

      setUploadProgress(60);

      const { error: uploadError } = await api.upload('/api/repository/upload', uploadData);

      if (uploadError) throw uploadError;

      setUploadProgress(100);
      onSuccess();
    } catch (err: any) {
      console.error('Error uploading document:', err);
      setError(err.message || 'Failed to upload document');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Upload Document</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {loading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex justify-between text-sm text-blue-700 mb-2">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Mode Switch: Upload File vs Document Link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Source <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setInputType('file')}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-semibold transition ${
                  inputType === 'file'
                    ? 'border-blue-600 bg-blue-50/80 text-blue-700 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Upload Document File</span>
              </button>
              <button
                type="button"
                onClick={() => setInputType('link')}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-semibold transition ${
                  inputType === 'link'
                    ? 'border-blue-600 bg-blue-50/80 text-blue-700 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                <span>Document Link / URL</span>
              </button>
            </div>
          </div>

          {inputType === 'file' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                File <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required={inputType === 'file'}
                disabled={loading}
              />
              <p className="text-sm text-gray-500 mt-1">
                Maximum file size: 50MB (PDF, DOCX, XLSX, etc.)
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Document Web Link / URL <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://drive.google.com/... or OneDrive / cloud link"
                  required={inputType === 'link'}
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Paste the link to your cloud document instead of downloading and uploading the file.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Leave empty to use filename"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={loading}
            >
              {USER_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Optional description"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Separate tags with commas"
              disabled={loading}
            />
            <p className="text-sm text-gray-500 mt-1">
              Example: analysis, q1-2024, important
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditDocumentModalProps {
  document: RepositoryDocument;
  onClose: () => void;
  onSuccess: () => void;
}

function EditDocumentModal({ document, onClose, onSuccess }: EditDocumentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: document.title,
    description: document.description || '',
    category: document.category,
    tags: document.tags.join(', '),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const { error: updateError } = await api.put('/api/repository/' + document.id, {
        title: formData.title,
        description: formData.description || null,
        category: formData.category,
        tags: tagsArray,
      });

      if (updateError) throw updateError;

      onSuccess();
    } catch (err: any) {
      console.error('Error updating document:', err);
      setError(err.message || 'Failed to update document');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Edit Document</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {document.document_url && !document.file_path ? 'Document Link (Read-only)' : 'Filename (Read-only)'}
            </label>
            <input
              type="text"
              value={document.document_url && !document.file_path ? document.document_url : document.filename}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={loading}
            >
              {USER_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Optional description"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Separate tags with commas"
              disabled={loading}
            />
            <p className="text-sm text-gray-500 mt-1">
              Example: analysis, q1-2024, important
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
