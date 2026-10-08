import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  FileCheck,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  FileCode,
  HardDrive
} from 'lucide-react';
import { renderAsync } from 'docx-preview';
import { Project } from '../types/project';
import { getStoredToken } from '../lib/api';
import { Button } from './ui';

interface ProposalPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

export default function ProposalPreviewModal({
  isOpen,
  onClose,
  project,
}: ProposalPreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isDocx, setIsDocx] = useState(false);
  const [isPdf, setIsPdf] = useState(false);
  const [isExternalLink, setIsExternalLink] = useState(false);
  const docxContainerRef = useRef<HTMLDivElement>(null);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load document whenever project or modal state changes
  useEffect(() => {
    if (!isOpen || !project) {
      cleanupState();
      return;
    }

    loadDocument();

    return () => {
      cleanupState();
    };
  }, [isOpen, project]);

  const cleanupState = () => {
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    setIsDocx(false);
    setIsPdf(false);
    setIsExternalLink(false);
    setError(null);
    setLoading(true);
    if (docxContainerRef.current) {
      docxContainerRef.current.innerHTML = '';
    }
  };

  const loadDocument = async () => {
    if (!project) return;
    setLoading(true);
    setError(null);

    const token = getStoredToken();
    const hasUploadedFile = Boolean(project.proposal_file_path || project.proposal_filename);
    const filename = (project.proposal_filename || '').toLowerCase();
    const fileType = (project.proposal_file_type || '').toLowerCase();
    const link = project.proposal_link || '';

    // Determine document format
    const docxDetected =
      filename.endsWith('.docx') ||
      fileType.includes('openxmlformats-officedocument.wordprocessingml.document');

    const pdfDetected =
      filename.endsWith('.pdf') ||
      fileType.includes('pdf') ||
      link.toLowerCase().endsWith('.pdf') ||
      (!docxDetected && hasUploadedFile);

    try {
      if (hasUploadedFile) {
        // Fetch document through authenticated endpoint
        const viewUrl = `/api/projects/${project.id}/proposal-document/view`;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(viewUrl, { headers });
        if (!res.ok) {
          throw new Error(`Failed to load proposal document (Status: ${res.status})`);
        }

        if (docxDetected) {
          setIsDocx(true);
          setIsPdf(false);
          setIsExternalLink(false);
          const arrayBuffer = await res.arrayBuffer();

          if (docxContainerRef.current) {
            docxContainerRef.current.innerHTML = '';
            await renderAsync(arrayBuffer, docxContainerRef.current, undefined, {
              className: 'docx-preview-root',
              inWrapper: true,
              ignoreWidth: false,
              ignoreHeight: false,
              breakPages: true,
            });
          }
        } else {
          // Default to PDF stream
          setIsPdf(true);
          setIsDocx(false);
          setIsExternalLink(false);
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          setPdfBlobUrl(blobUrl);
        }
      } else if (link) {
        // Project only has an external link
        setIsExternalLink(true);
        setIsPdf(false);
        setIsDocx(false);
      } else {
        throw new Error('No proposal document or link has been uploaded for this project yet.');
      }
    } catch (err: any) {
      console.error('Error loading project proposal:', err);
      setError(err.message || 'Failed to display proposal document');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!project) return;
    const token = getStoredToken();

    if (project.proposal_file_path || project.proposal_filename) {
      // Direct download link with auth token
      const downloadUrl = `/api/projects/${project.id}/proposal-document/download?token=${encodeURIComponent(
        token || ''
      )}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', project.proposal_filename || `${project.tracker_id}_Proposal.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (project.proposal_link) {
      window.open(project.proposal_link, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenExternal = () => {
    if (!project) return;
    const token = getStoredToken();
    if (project.proposal_file_path || project.proposal_filename) {
      const viewUrl = `/api/projects/${project.id}/proposal-document/view?token=${encodeURIComponent(
        token || ''
      )}`;
      window.open(viewUrl, '_blank', 'noopener,noreferrer');
    } else if (project.proposal_link) {
      window.open(project.proposal_link, '_blank', 'noopener,noreferrer');
    }
  };

  if (!isOpen || !project) return null;

  const formattedSize = project.proposal_file_size
    ? project.proposal_file_size > 1024 * 1024
      ? `${(project.proposal_file_size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(project.proposal_file_size / 1024)} KB`
    : null;

  const docLabel = isDocx
    ? 'DOCX Document'
    : isPdf
    ? 'PDF Document'
    : isExternalLink
    ? 'External Web Document'
    : 'Document';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative flex flex-col w-full max-w-6xl h-[92vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-3 min-w-0 pr-3">
            <div
              className={`p-2.5 rounded-xl flex-shrink-0 ${
                isDocx
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                  : isPdf
                  ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                  : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'
              }`}
            >
              <FileText className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40">
                  {project.tracker_id}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-200/70 dark:bg-slate-700 text-gray-700 dark:text-slate-300">
                  {docLabel}
                </span>
                {formattedSize && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-200/70 dark:bg-slate-700 text-gray-700 dark:text-slate-300">
                    {formattedSize}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-slate-100 truncate mt-0.5">
                {project.proposal_filename || `${project.project_title} — Project Proposal`}
              </h2>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenExternal}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-slate-300"
              title="Open full page in a new window"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in New Tab</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 text-xs shadow-sm"
              title="Download proposal file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </Button>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-200/60 dark:hover:bg-slate-800 rounded-xl transition"
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Viewer Canvas */}
        <div className="relative flex-1 bg-gray-100 dark:bg-slate-950 overflow-hidden flex flex-col">
          {loading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
              <Loader2 className="w-9 h-9 text-blue-600 dark:text-blue-400 animate-spin" />
              <p className="mt-3 text-sm font-medium text-gray-700 dark:text-slate-300">
                Loading project proposal document...
              </p>
            </div>
          )}

          {error && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                Unable to Display Document
              </h3>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1 mb-6">
                {error}
              </p>
              <div className="flex items-center gap-3 flex-wrap justify-center">
                <Button variant="outline" size="sm" onClick={loadDocument}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Try Again
                </Button>
                {project.proposal_link && (
                  <Button variant="primary" size="sm" onClick={handleDownload}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download File Instead
                  </Button>
                )}
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* PDF Inline Viewer */}
              {isPdf && pdfBlobUrl && (
                <div className="w-full h-full flex-1">
                  <iframe
                    src={`${pdfBlobUrl}#view=FitH`}
                    title="Project Proposal Document Preview"
                    className="w-full h-full border-0 bg-white"
                  />
                </div>
              )}

              {/* DOCX Document Viewer via docx-preview */}
              <div
                ref={docxContainerRef}
                className={`w-full h-full overflow-y-auto p-4 sm:p-8 flex justify-center ${
                  isDocx ? 'block' : 'hidden'
                }`}
                style={{ minHeight: '100%' }}
              />

              {/* External Link Viewer / Fallback */}
              {isExternalLink && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-xl mx-auto">
                  <div className="p-4 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl mb-4 shadow-sm">
                    <ExternalLink className="w-10 h-10" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                    External Project Proposal
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mt-2 mb-6">
                    This project proposal is hosted externally (e.g. Google Drive, OneDrive, or Funder Portal):
                  </p>
                  <div className="w-full p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-mono text-blue-600 dark:text-blue-400 truncate mb-6 text-left">
                    {project.proposal_link}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="primary"
                      onClick={() =>
                        window.open(project.proposal_link!, '_blank', 'noopener,noreferrer')
                      }
                      className="inline-flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open Proposal Document</span>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer with quick summary & download reminder */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-gray-700 dark:text-slate-300">
              {project.funding_agency ? `Funder: ${project.funding_agency}` : 'SC Lab Project'}
            </span>
            <span>•</span>
            <span className="truncate">{project.project_title}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleDownload}
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline inline-flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>Download File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
