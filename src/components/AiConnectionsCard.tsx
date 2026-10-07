import { useEffect, useState, FormEvent } from 'react';
import { Bot, Copy, Check, Trash2, KeyRound } from 'lucide-react';
import { api } from '../lib/api';

interface Connection {
  id: string;
  kind: 'oauth' | 'pat';
  name: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 p-2 text-gray-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
      title={label}
      aria-label={label}
    >
      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

/** Profile section where a member connects AI assistants (MCP) and revokes their access. */
export default function AiConnectionsCard() {
  const [serverUrl, setServerUrl] = useState('');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data, error: loadError } = await api.get<{ server_url: string; connections: Connection[] }>('/api/mcp/connections');
    if (loadError || !data) {
      setUnavailable(true);
    } else {
      setServerUrl(data.server_url);
      setConnections(data.connections);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createToken = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const { data, error: createError } = await api.post<{ token: string }>('/api/mcp/tokens', { name: tokenName });
    if (createError || !data) {
      setError(createError?.message || 'Could not create the token');
      return;
    }
    setNewToken(data.token);
    setTokenName('');
    load();
  };

  const disconnect = async (c: Connection) => {
    if (!window.confirm(`Disconnect "${c.name}"? It will immediately lose access to your SC Lab account.`)) return;
    const { error: deleteError } = await api.delete(`/api/mcp/connections/${c.id}`);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    load();
  };

  if (unavailable) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-5 sm:p-6 transition-colors">
      <div className="flex items-center space-x-2 mb-4">
        <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">AI Assistant Connections</h2>
      </div>

      <p className="text-gray-600 dark:text-slate-400 text-sm mb-4">
        Let an AI assistant (Claude, ChatGPT, Copilot, Cursor and others) manage your work, to-dos, requests and bookings for you.
        Add this address as a custom connector in your AI app and sign in with your SC Lab account when asked.
      </p>

      <label htmlFor="mcp-server-url" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Connector address</label>
      <div className="flex items-center gap-2 mb-6">
        <input
          id="mcp-server-url"
          readOnly
          value={serverUrl}
          className="w-full px-4 py-2 h-[42px] border border-gray-300 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 font-mono text-sm"
        />
        {serverUrl && <CopyButton text={serverUrl} label="Copy connector address" />}
      </div>

      <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">Connected apps</h3>
      {loading ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Loading...</p>
      ) : connections.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">No AI assistants are connected.</p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-slate-800 border border-gray-200 dark:border-slate-800 rounded-lg mb-6">
          {connections.map(c => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                  {c.name}
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-slate-400">{c.kind === 'pat' ? 'Access token' : 'Signed in'}</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Connected {formatDate(c.created_at)} · Last used {formatDate(c.last_used_at)}
                  {c.kind === 'pat' && c.expires_at ? ` · Expires ${formatDate(c.expires_at)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => disconnect(c)}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-1">Access token</h3>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
        Only for tools that cannot sign in by themselves (for example GitHub Copilot's coding agent). Treat it like a password.
      </p>

      {newToken && (
        <div className="mb-4 p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-2">Copy this token now. It will not be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 break-all text-xs font-mono text-gray-900 dark:text-slate-100">{newToken}</code>
            <CopyButton text={newToken} label="Copy access token" />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3" role="alert">{error}</p>}

      <form onSubmit={createToken} className="flex flex-col sm:flex-row gap-2 max-w-xl">
        <label htmlFor="mcp-token-name" className="sr-only">Token name</label>
        <input
          id="mcp-token-name"
          value={tokenName}
          onChange={e => setTokenName(e.target.value)}
          maxLength={80}
          placeholder='Name, e.g. "Copilot on my laptop"'
          className="flex-1 px-4 py-2 h-[42px] border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
        <button
          type="submit"
          className="px-4 py-2 h-[42px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 font-medium"
        >
          <KeyRound className="w-4 h-4" />
          <span>Create token</span>
        </button>
      </form>
    </div>
  );
}
