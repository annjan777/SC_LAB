import { useEffect } from 'react';
import { X } from 'lucide-react';
import AiConnectionsCard from './AiConnectionsCard';

/** Sidebar pop-up for connecting AI assistants (MCP) and managing their access. */
export default function AiConnectorModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="AI Connector"
    >
      <div className="relative w-full max-w-2xl my-8" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-slate-200 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
        <AiConnectionsCard />
      </div>
    </div>
  );
}
