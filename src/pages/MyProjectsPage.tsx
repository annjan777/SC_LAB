import { useEffect, useState, FormEvent } from 'react';
import { FolderKanban, Send, Calendar, Users } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, EmptyState } from '../components/ui';

interface Achievement {
  id: string;
  user_id: string;
  author_name: string;
  message: string;
  created_at: string;
}

interface MyProject {
  id: string;
  tracker_id: string;
  project_code: string | null;
  project_title: string;
  status: string;
  start_date: string | null;
  closing_date: string | null;
  faculty_lead_pi: string | null;
  team: { name: string; is_external?: boolean }[];
  last_weekly_update: string | null;
  achievements: Achievement[];
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ProjectCard({ project, onPosted }: { project: MyProject; onPosted: () => void }) {
  const [message, setMessage] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const post = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setPosting(true);
    setError('');
    const { error: postError } = await api.post(`/api/projects/${project.id}/achievements`, { message: message.trim() });
    setPosting(false);
    if (postError) {
      setError(typeof postError === 'string' ? postError : postError.message);
      return;
    }
    setMessage('');
    onPosted();
  };

  return (
    <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-xs font-mono text-blue-700 dark:text-blue-400">
            {project.project_code || project.tracker_id}
          </p>
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{project.project_title}</h2>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300">
          {project.status}
        </span>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm mb-5">
        <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
          <Calendar className="w-4 h-4 shrink-0" />
          <dt className="sr-only">Duration</dt>
          <dd>{formatDate(project.start_date)} – {formatDate(project.closing_date)}</dd>
        </div>
        <div className="text-gray-600 dark:text-slate-400">
          <dt className="inline font-medium text-gray-700 dark:text-slate-300">PI: </dt>
          <dd className="inline">{project.faculty_lead_pi || '—'}</dd>
        </div>
        <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400 min-w-0">
          <Users className="w-4 h-4 shrink-0" />
          <dt className="sr-only">Team</dt>
          <dd className="truncate" title={project.team.map(m => m.name).join(', ')}>
            {project.team.length ? project.team.map(m => m.name).join(', ') : '—'}
          </dd>
        </div>
      </dl>

      <form onSubmit={post} className="mb-5">
        <label htmlFor={`ach-${project.id}`} className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Achieved till date
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <textarea
            id={`ach-${project.id}`}
            rows={2}
            maxLength={5000}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="What has been achieved on this project since the last update?"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={posting || !message.trim()}
            className="sm:self-end px-4 py-2 h-[42px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
          >
            <Send className="w-4 h-4" />
            <span>{posting ? 'Posting...' : 'Post update'}</span>
          </button>
        </div>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}
      </form>

      <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
        Updates ({project.achievements.length})
      </h3>
      {project.achievements.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">No updates posted yet.</p>
      ) : (
        <ol className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {project.achievements.map(a => (
            <li key={a.id} className="border-l-2 border-blue-200 dark:border-blue-900 pl-3">
              <p className="text-xs text-gray-500 dark:text-slate-400">
                <span className="font-medium text-gray-700 dark:text-slate-300">{a.author_name}</span> · {formatDate(a.created_at)}
              </p>
              <p className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap">{a.message}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Projects the signed-in member is on, where they post "achieved till date" updates. */
export default function MyProjectsPage() {
  const [projects, setProjects] = useState<MyProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    const { data, error: loadError } = await api.get<MyProject[]>('/api/projects/mine');
    if (loadError) setError(typeof loadError === 'string' ? loadError : loadError.message);
    else setProjects(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="My Projects" />
      {error && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-gray-500 dark:text-slate-400">Loading...</p>
      ) : projects.length === 0 && !error ? (
        <EmptyState
          icon={FolderKanban}
          title="You're not on any project yet"
          description="When an admin adds you to a project's team, it appears here and you can post your progress updates."
        />
      ) : (
        projects.map(p => <ProjectCard key={p.id} project={p} onPosted={load} />)
      )}
    </div>
  );
}
