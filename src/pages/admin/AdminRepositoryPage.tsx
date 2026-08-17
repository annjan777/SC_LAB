import { useEffect, useState } from 'react';
import { Upload, FileText, Search, Download, Eye, Trash2, X, FolderOpen, File, Edit, Share2, User, Users, ChevronDown, ChevronRight, Lock, Shield } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

interface RepositoryDocument {
  id: string;
  filename: string;
  file_path: string;
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
  is_admin_only_category: boolean;
  uploader_name?: string;
  uploader_role?: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  user_role: string;
}

interface UserGroup {
  user: UserProfile;
  documents: RepositoryDocument[];
  expanded: boolean;
}

const ALL_CATEGORIES = [
  { value: 'research_papers', label: 'Research Papers', icon: FileText, color: 'from-blue-500 to-blue-600', adminOnly: false },
  { value: 'experiment_data', label: 'Experiment Data', icon: File, color: 'from-green-500 to-green-600', adminOnly: false },
  { value: 'lab_reports', label: 'Lab Reports', icon: FileText, color: 'from-amber-500 to-amber-600', adminOnly: false },
  { value: 'patents', label: 'Patents', icon: FileText, color: 'from-red-500 to-red-600', adminOnly: false },
  { value: 'other_documents', label: 'Other Documents', icon: FolderOpen, color: 'from-gray-500 to-gray-600', adminOnly: false },
  { value: 'internal_reports', label: 'Internal Reports', icon: Shield, color: 'from-rose-500 to-rose-600', adminOnly: true },
  { value: 'admin_documents', label: 'Admin Documents', icon: Lock, color: 'from-violet-500 to-violet-600', adminOnly: true },
  { value: 'confidential', label: 'Confidential', icon: Lock, color: 'from-slate-500 to-slate-600', adminOnly: true },
];

type TabType = 'all_users' | 'my_documents' | 'shared_with_me';

export default function AdminRepositoryPage() {
  const { user, hasPermission } = useAuth();
  const [documents, setDocuments] = useState<RepositoryDocument[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<RepositoryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('all_users');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState<RepositoryDocument | null>(null);
  const [sharingDocument, setSharingDocument] = useState<RepositoryDocument | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canEditAll = hasPermission('edit_repository_all');
  const canDeleteAll = hasPermission('delete_repository_all');
  const canShare = hasPermission('share_repository_documents');

  useEffect(() => {
    fetchUsers();
    fetchDocuments();
  }, []);

  useEffect(() => {
    filterAndGroupDocuments();
  }, [documents, activeTab, searchTerm, selectedCategory]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await api.get('/api/users', { order: 'full_name' });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const { data, error } = await api.get('/api/admin/repository', { order: 'created_at', ascending: 'false' });

      if (error) throw error;

      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setMessage({ type: 'error', text: 'Failed to load documents' });
    } finally {
      setLoading(false);
    }
  };

  const filterAndGroupDocuments = () => {
    let filtered = documents;

    switch (activeTab) {
      case 'all_users':
        filtered = documents.filter(doc => doc.uploader_role !== 'admin');
        break;
      case 'my_documents':
        filtered = documents.filter(doc => doc.uploaded_by === user?.id);
        break;
      case 'shared_with_me':
        filtered = documents.filter(doc =>
          doc.uploaded_by !== user?.id &&
          (doc.shared_with_users.includes(user?.id || '') || doc.visibility === 'public_to_admins')
        );
        break;
    }

    if (searchTerm) {
      filtered = filtered.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.uploader_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(doc => doc.category === selectedCategory);
    }

    setFilteredDocuments(filtered);

    if (activeTab === 'all_users') {
      const groups: Record<string, UserGroup> = {};

      filtered.forEach(doc => {
        if (!groups[doc.uploaded_by]) {
          const userProfile = users.find(u => u.id === doc.uploaded_by);
          if (userProfile) {
            groups[doc.uploaded_by] = {
              user: userProfile,
              documents: [],
              expanded: false,
            };
          }
        }
        if (groups[doc.uploaded_by]) {
          groups[doc.uploaded_by].documents.push(doc);
        }
      });

      setUserGroups(Object.values(groups));
    }
  };

  const toggleUserGroup = (userId: string) => {
    setUserGroups(prev =>
      prev.map(group =>
        group.user.id === userId
          ? { ...group, expanded: !group.expanded }
          : group
      )
    );
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

  const handleDownloadDocument = async (documentId: string, filename: string) => {
    try {
      const url = `/api/repository/download/${documentId}`;
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
    return ALL_CATEGORIES.find(cat => cat.value === value)?.label || value;
  };

  const getCategoryCount = (category: string) => {
    return filteredDocuments.filter(doc => doc.category === category).length;
  };

  const getVisibilityBadge = (doc: RepositoryDocument) => {
    if (doc.visibility === 'private') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
          <Lock className="w-3 h-3 mr-1" />
          Private
        </span>
      );
    }
    if (doc.visibility === 'shared') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
          <Share2 className="w-3 h-3 mr-1" />
          Shared ({doc.shared_with_users.length})
        </span>
      );
    }
    if (doc.visibility === 'public_to_admins') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
          <Shield className="w-3 h-3 mr-1" />
          Public to Admins
        </span>
      );
    }
    return null;
  };

  const renderDocumentCard = (doc: RepositoryDocument) => (
    <div
      key={doc.id}
      className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden group"
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition">
                {doc.title}
              </h3>
              {doc.is_admin_only_category && (
                <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-700">
                  <Shield className="w-3 h-3 mr-1" />
                  Admin Only
                </span>
              )}
              {getVisibilityBadge(doc)}
            </div>
            <p className="text-sm text-gray-500 truncate">{doc.filename}</p>
          </div>
        </div>

        {doc.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{doc.description}</p>
        )}

        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {getCategoryLabel(doc.category)}
          </span>
          <span className="text-xs text-gray-500">{formatFileSize(doc.file_size)}</span>
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
              title="View"
            >
              <Eye className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleDownloadDocument(doc.id, doc.filename)}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>
            {canShare && (
              <button
                onClick={() => {
                  setSharingDocument(doc);
                  setShowShareModal(true);
                }}
                className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg transition"
                title="Share"
              >
                <Share2 className="w-5 h-5" />
              </button>
            )}
            {(doc.uploaded_by === user?.id || canEditAll) && (
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
            )}
            {(doc.uploaded_by === user?.id || canDeleteAll) && (
              <button
                onClick={() => handleDeleteDocument(doc.id, doc.file_path)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Repository Management</h1>
          <p className="text-gray-600 mt-2">Manage all documents, user uploads, and admin resources</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-sm"
        >
          <Upload className="w-5 h-5" />
          Upload Document
        </button>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <div className="flex justify-between items-center">
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-gray-500 hover:text-gray-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('all_users')}
              className={`px-6 py-4 text-sm font-medium transition ${
                activeTab === 'all_users'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4 inline-block mr-2" />
              All User Documents
            </button>
            <button
              onClick={() => setActiveTab('my_documents')}
              className={`px-6 py-4 text-sm font-medium transition ${
                activeTab === 'my_documents'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <User className="w-4 h-4 inline-block mr-2" />
              My Admin Documents
            </button>
            <button
              onClick={() => setActiveTab('shared_with_me')}
              className={`px-6 py-4 text-sm font-medium transition ${
                activeTab === 'shared_with_me'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Share2 className="w-4 h-4 inline-block mr-2" />
              Shared with Me
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by title, description, filename, uploader, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Showing <strong>{filteredDocuments.length}</strong> of <strong>{documents.length}</strong> documents
            </span>
            {(selectedCategory || searchTerm) && (
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setSearchTerm('');
                }}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 mb-8">
        {ALL_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const count = getCategoryCount(category.value);
          const isSelected = selectedCategory === category.value;

          return (
            <button
              key={category.value}
              onClick={() => setSelectedCategory(isSelected ? null : category.value)}
              className={`relative overflow-hidden rounded-xl shadow-sm border-2 transition-all duration-300 transform hover:scale-105 ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`bg-gradient-to-br ${category.color} p-4 text-white`}>
                <div className="flex justify-between items-start mb-2">
                  <Icon className="w-6 h-6" />
                  <div className="text-right">
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs opacity-90">docs</div>
                  </div>
                </div>
                <p className="text-xs font-medium">{category.label}</p>
                {category.adminOnly && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 bg-white bg-opacity-30 rounded text-[10px]">
                    Admin Only
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {activeTab === 'all_users' && userGroups.length > 0 ? (
        <div className="space-y-4">
          {userGroups.map((group) => (
            <div key={group.user.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
              <button
                onClick={() => toggleUserGroup(group.user.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  {group.expanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <User className="w-5 h-5 text-blue-600" />
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">{group.user.full_name}</h3>
                    <p className="text-sm text-gray-500">
                      {group.documents.length} document{group.documents.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-gray-400">
                  {group.expanded ? 'Hide' : 'Show'} Documents
                </span>
              </button>

              {group.expanded && (
                <div className="px-6 pb-6 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.documents.map((doc) => renderDocumentCard(doc))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents Found</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || selectedCategory
              ? 'No documents match your search criteria'
              : activeTab === 'my_documents'
              ? 'Upload your first admin document to get started'
              : 'No documents available'}
          </p>
          {!searchTerm && !selectedCategory && activeTab === 'my_documents' && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Upload className="h-5 w-5" />
              Upload Document
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => renderDocumentCard(doc))}
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
          users={users}
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
          users={users}
        />
      )}

      {showShareModal && sharingDocument && (
        <ShareDocumentModal
          document={sharingDocument}
          users={users}
          onClose={() => {
            setShowShareModal(false);
            setSharingDocument(null);
          }}
          onSuccess={() => {
            setShowShareModal(false);
            setSharingDocument(null);
            fetchDocuments();
            setMessage({ type: 'success', text: 'Document sharing updated successfully' });
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
  users: UserProfile[];
}

function UploadDocumentModal({ onClose, onSuccess, users }: UploadDocumentModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'other_documents',
    tags: '',
    visibility: 'private' as 'private' | 'shared' | 'public_to_admins',
    shared_with: [] as string[],
  });

  const selectedCategory = ALL_CATEGORIES.find(cat => cat.value === formData.category);
  const isAdminCategory = selectedCategory?.adminOnly || false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setUploadProgress(0);

    try {
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

      setUploadProgress(30);

      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('title', formData.title || file.name);
      uploadData.append('category', formData.category);
      if (formData.description) uploadData.append('description', formData.description);
      uploadData.append('tags', JSON.stringify(tagsArray));
      uploadData.append('visibility', formData.visibility);
      if (formData.visibility === 'shared') {
        uploadData.append('shared_with_users', JSON.stringify(formData.shared_with));
      }

      setUploadProgress(70);

      const { error: uploadError } = await api.upload('/api/admin/repository/upload', uploadData);

      if (uploadError) throw new Error(typeof uploadError === 'string' ? uploadError : (uploadError as any).message || 'Failed to upload document');

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              File <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={loading}
            />
            <p className="text-sm text-gray-500 mt-1">
              Maximum file size: 50MB
            </p>
          </div>

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
              {ALL_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label} {cat.adminOnly ? '(Admin Only)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visibility <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.visibility}
              onChange={(e) => setFormData({ ...formData, visibility: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={loading}
            >
              <option value="private">Private - Only visible to me</option>
              <option value="shared">Shared - Visible to specific users</option>
              <option value="public_to_admins">Public to Admins - Visible to all admins</option>
            </select>
          </div>

          {formData.visibility === 'shared' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Share with Users
              </label>
              <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                {users.map(u => (
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={formData.shared_with.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, shared_with: [...formData.shared_with, u.id] });
                        } else {
                          setFormData({ ...formData, shared_with: formData.shared_with.filter(id => id !== u.id) });
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={loading}
                    />
                    <span className="text-sm text-gray-700">{u.full_name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

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
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
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
  users: UserProfile[];
}

function EditDocumentModal({ document, onClose, onSuccess, users }: EditDocumentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: document.title,
    description: document.description || '',
    category: document.category,
    tags: document.tags.join(', '),
    visibility: document.visibility as 'private' | 'shared' | 'public_to_admins',
    shared_with: document.shared_with_users || [],
  });

  const selectedCategory = ALL_CATEGORIES.find(cat => cat.value === formData.category);
  const isAdminCategory = selectedCategory?.adminOnly || false;

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
          visibility: formData.visibility,
          shared_with_users: formData.visibility === 'shared' ? formData.shared_with : [],
          is_admin_only_category: isAdminCategory,
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
              Filename (Read-only)
            </label>
            <input
              type="text"
              value={document.filename}
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
              {ALL_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label} {cat.adminOnly ? '(Admin Only)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visibility <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.visibility}
              onChange={(e) => setFormData({ ...formData, visibility: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={loading}
            >
              <option value="private">Private - Only visible to me</option>
              <option value="shared">Shared - Visible to specific users</option>
              <option value="public_to_admins">Public to Admins - Visible to all admins</option>
            </select>
          </div>

          {formData.visibility === 'shared' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Share with Users
              </label>
              <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                {users.map(u => (
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={formData.shared_with.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, shared_with: [...formData.shared_with, u.id] });
                        } else {
                          setFormData({ ...formData, shared_with: formData.shared_with.filter(id => id !== u.id) });
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={loading}
                    />
                    <span className="text-sm text-gray-700">{u.full_name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

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
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
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

interface ShareDocumentModalProps {
  document: RepositoryDocument;
  users: UserProfile[];
  onClose: () => void;
  onSuccess: () => void;
}

function ShareDocumentModal({ document, users, onClose, onSuccess }: ShareDocumentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sharedWith, setSharedWith] = useState<string[]>(document.shared_with_users || []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: updateError } = await api.put('/api/repository/' + document.id, {
          visibility: sharedWith.length > 0 ? 'shared' : document.visibility,
          shared_with_users: sharedWith,
        });

      if (updateError) throw updateError;

      onSuccess();
    } catch (err: any) {
      console.error('Error updating document sharing:', err);
      setError(err.message || 'Failed to update document sharing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Share Document</h2>
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
            <p className="text-sm text-gray-700 mb-4">
              <strong>Document:</strong> {document.title}
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share with Users
            </label>
            <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
              {users.map(u => (
                <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={sharedWith.includes(u.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSharedWith([...sharedWith, u.id]);
                      } else {
                        setSharedWith(sharedWith.filter(id => id !== u.id));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={loading}
                  />
                  <span className="text-sm text-gray-700">{u.full_name}</span>
                </label>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {sharedWith.length === 0
                ? 'No users selected. Document will remain private.'
                : `Document will be shared with ${sharedWith.length} user${sharedWith.length !== 1 ? 's' : ''}.`}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
