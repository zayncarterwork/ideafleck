"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type IdeaRecord = {
  id: number;
  title: string;
  description: string;
  domain: string;
  stage: string;
  votes: number;
};

type KanbanColumnKey = "todo" | "in_progress" | "done";

type KanbanTask = {
  title: string;
  status: KanbanColumnKey;
};

type StatusTask = {
  title: string;
  status: string;
  statusNormalized: KanbanColumnKey;
};

type CronJob = {
  id: string | null;
  name: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string;
  scheduleExpression: string | null;
};

type StatusSnapshot = {
  kanban: {
    total: number;
    progressPct: number;
    columns: Record<KanbanColumnKey, KanbanTask[]>;
    tasks: StatusTask[];
    pending: StatusTask[];
  };
  cron: {
    healthy: boolean;
    statusLabel: string;
    summary: string[];
    jobs: CronJob[];
    loadedAt: string | null;
  };
  refreshedAt: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const REFRESH_INTERVAL_MS = 20_000;

const stageMetadata = {
  new: { label: "New", tone: "text-emerald-200", accent: "bg-emerald-300/20" },
  validate: { label: "Validation", tone: "text-sky-200", accent: "bg-sky-300/20" },
  build: { label: "Build", tone: "text-lime-200", accent: "bg-lime-300/20" },
  launch: { label: "Launch", tone: "text-amber-200", accent: "bg-amber-300/20" }
} as const;

const stageOrder = ["new", "validate", "build", "launch"] as const;

const kanbanColumnMetadata = {
  todo: {
    label: "To Do",
    description: "Fresh items waiting for signals and prioritization."
  },
  in_progress: {
    label: "In Progress",
    description: "Work currently in motion or being investigated."
  },
  done: {
    label: "Done",
    description: "Completed work powering the IdeaFleck story."
  }
} as const;

const kanbanColumnKeys = Object.keys(kanbanColumnMetadata) as KanbanColumnKey[];

const newsroomStories = [
  {
    title: "Global policy shifts in AI",
    label: "Featured briefing",
    detail: "Tracking every regulation update that could reshape product roadmaps this quarter.",
    source: "Worldview",
    time: "8m ago"
  },
  {
    title: "Quantum leaps in adaptive assistants",
    label: "Technology",
    detail: "A new startup stack is weaving data and creative prompts together in record time.",
    source: "Signal Weekly",
    time: "34m ago"
  },
  {
    title: "Markets digest",
    label: "Markets",
    detail: "Private AI funds are repositioning around productivity tools—here’s what we’re watching.",
    source: "Pulse",
    time: "52m ago"
  }
];

const toolCards = [
  {
    name: "Counter App",
    description: "Auto-increment counters so you never lose track of quick tallies.",
    badge: "Utility"
  },
  {
    name: "Quote Catalyst",
    description: "Sips inspiration from curated feeds and delivers shareable quotes instantly.",
    badge: "AI-based"
  },
  {
    name: "Pomodoro Companion",
    description: "Run a focus sprint, log the work, and keep the team tempo steady.",
    badge: "Productivity"
  }
];

const cronBadgeStyles: Record<string, string> = {
  ok: "text-emerald-300 border-emerald-500/50 bg-emerald-500/10",
  degraded: "text-amber-300 border-amber-500/50 bg-amber-500/10",
  missing: "text-slate-300 border-slate-500/40 bg-slate-400/10",
  error: "text-rose-300 border-rose-500/50 bg-rose-500/10"
};

const cronBadgeLabel: Record<string, string> = {
  ok: "Healthy",
  degraded: "Needs attention",
  missing: "Not configured",
  error: "Errored"
};

const createEmptyKanbanColumns = (): Record<KanbanColumnKey, KanbanTask[]> =>
  kanbanColumnKeys.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {} as Record<KanbanColumnKey, KanbanTask[]>);

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "n/a";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "n/a";
  }
  return parsed.toLocaleString("en-IN", { hour12: false });
};

const friendlyStatusLabel = (value: string) =>
  value
    .split(/[_\s]+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ""))
    .join(" ") || "Status";

const normalizeCronTone = (value?: string) => {
  const normalized = (value ?? "").toLowerCase();
  if (["failed", "error", "cancelled"].includes(normalized)) {
    return "text-rose-200 border-rose-500/60 bg-rose-500/10";
  }
  if (["pending", "waiting", "scheduled"].includes(normalized)) {
    return "text-amber-200 border-amber-500/50 bg-amber-500/10";
  }
  return "text-emerald-200 border-emerald-500/60 bg-emerald-500/10";
};

export default function Home() {
  const [ideas, setIdeas] = useState<IdeaRecord[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [ideaStatus, setIdeaStatus] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>({ title: "", description: "", domain: "", stage: "new" });
  const [pending, setPending] = useState(false);
  const [statusSnapshot, setStatusSnapshot] = useState<StatusSnapshot | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const stageTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const stage of stageOrder) {
      totals[stage] = ideas.filter((idea) => idea.stage === stage).length;
    }
    return stageOrder.map((stage) => ({
      stage,
      label: stageMetadata[stage].label,
      count: totals[stage]
    }));
  }, [ideas]);

  const fetchIdeas = async () => {
    setLoadingIdeas(true);
    try {
      const response = await fetch(`${API_BASE}/api/ideas`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to reach the IdeaFleck API");
      }
      const payload = await response.json();
      setIdeas(payload);
    } catch (error) {
      console.error(error);
      setIdeaStatus("Unable to load ideas right now.");
    } finally {
      setLoadingIdeas(false);
    }
  };

  useEffect(() => {
    fetchIdeas();
  }, []);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!isMounted.current) {
      return;
    }
    setStatusLoading(true);
    setStatusError(null);
    try {
      const response = await fetch(`${API_BASE}/api/status?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to reach the IdeaFleck API");
      }
      const payload = await response.json();
      if (isMounted.current) {
        setStatusSnapshot(payload);
      }
    } catch (error) {
      if (isMounted.current) {
        console.error(error);
        setStatusError(error instanceof Error ? error.message : "Unable to load status updates.");
      }
    } finally {
      if (isMounted.current) {
        setStatusLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      fetchStatus();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setIdeaStatus(null);
    try {
      const response = await fetch(`${API_BASE}/api/ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState)
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body?.error || "Failed to save idea");
      }
      setFormState({ title: "", description: "", domain: "", stage: "new" });
      setIdeaStatus("Idea saved—thank you for the signal.");
      fetchIdeas();
    } catch (error) {
      setIdeaStatus(error instanceof Error ? error.message : "Failed to submit idea");
    } finally {
      setPending(false);
    }
  };

  const handleVote = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/ideas/${id}/vote`, { method: "POST" });
      if (!response.ok) {
        throw new Error("Unable to register the vote");
      }
      const updated = await response.json();
      setIdeas((prev) => prev.map((idea) => (idea.id === updated.id ? updated : idea)));
    } catch (error) {
      console.error(error);
      setIdeaStatus("Vote could not be recorded.");
    }
  };

  const kanbanColumns = statusSnapshot?.kanban.columns ?? createEmptyKanbanColumns();
  const kanbanProgress = statusSnapshot?.kanban.progressPct ?? 0;
  const kanbanTotal = statusSnapshot?.kanban.total ?? 0;
  const pendingTasksList = statusSnapshot?.kanban.pending ?? [];
  const cronSnapshot = statusSnapshot?.cron;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10">
        <section className="rounded-3xl bg-gradient-to-br from-slate-900/60 to-slate-800/30 p-8 shadow-2xl shadow-cyan-950/40 backdrop-blur border border-white/10">
          <p className="text-xs uppercase tracking-[0.5em] text-cyan-200/70">IdeaFleck Daily Dispatch</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-5xl">
            Global news briefs + lightweight mini tools for builders who move fast.
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-300">
            IdeaFleck curates the freshest global stories, highlights what’s happening on X + tech, and pairs them
            with simple, AI-powered utilities so your team can act immediately.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full border border-white/20 px-4 py-1 text-slate-200">Global news room</span>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-1 text-emerald-200">Mini tools hub</span>
            <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-4 py-1 text-cyan-200">Idea intelligence stack</span>
          </div>
        </section>

        <section className="grid gap-6 rounded-3xl border border-white/10 bg-slate-900/40 p-6 shadow-lg shadow-black/40 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Global newsroom</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Real stories, fast summaries</h2>
            <p className="mt-2 text-slate-400">We surface the big news, technology shifts, and research notes you need to prioritize decisions.</p>
            <div className="mt-4 space-y-3">
              {newsroomStories.map((story) => (
                <article key={story.title} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{story.label}</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">{story.title}</h3>
                  <p className="mt-1 text-slate-300">{story.detail}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{story.source}</span>
                    <span>{story.time}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Mini tools hub</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Instant utilities</h2>
            <div className="mt-4 space-y-3">
              {toolCards.map((tool) => (
                <article key={tool.name} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-100">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
                    <span>{tool.badge}</span>
                    <span className="text-white font-semibold">{tool.name}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{tool.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-lg shadow-black/50 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold text-white">Competitor signals & differentiators</h2>
            <p className="mt-2 text-slate-400">
              The market is crowded with structured innovation platforms. IdeaFleck pairs story-driven capture with a
              newsroom + tools stack to stay ahead.
            </p>
            <div className="mt-4 space-y-3">
              {competitorHighlights.map((competitor) => (
                <article key={competitor.name} className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-slate-200">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{competitor.focus}</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">{competitor.name}</h3>
                  <p className="mt-1 text-sm text-slate-300">{competitor.insight}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-white/5 bg-slate-950/40 p-4">
            {stageTotals.map(({ stage, label, count }) => (
              <div key={stage} className="space-y-1">
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>{label}</span>
                  <span className="text-base font-semibold text-white">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${stageMetadata[stage].accent}`}
                    style={{ width: `${Math.min(100, count * 25)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-lg shadow-black/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">Agent progress</p>
              <h2 className="text-2xl font-semibold text-white">Kanban board & cron health</h2>
            </div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              {statusSnapshot ? (
                <>
                  <span className="text-[0.6rem] text-slate-500">Last update</span>
                  <span className="block text-white">{formatDateTime(statusSnapshot.refreshedAt)}</span>
                </>
              ) : (
                <span className="text-white">Awaiting updates…</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
              <span>Progress</span>
              <span>{kanbanProgress}% complete</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500"
                style={{ width: `${kanbanProgress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm font-semibold text-slate-300">
            <p>
              {kanbanTotal} task{kanbanTotal === 1 ? "" : "s"} tracked
            </p>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Updated every {REFRESH_INTERVAL_MS / 1000}s</p>
          </div>

          {statusLoading && !statusSnapshot ? (
            <p className="py-6 text-center text-slate-400">Loading status…</p>
          ) : statusError ? (
            <p className="py-6 text-center text-slate-400">{statusError}</p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {kanbanColumnKeys.map((key) => (
                  <div key={key} className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                    <div className="mb-3 flex items-start justify-between gap-2 text-white">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{kanbanColumnMetadata[key].label}</p>
                        <p className="text-xs text-slate-400">{kanbanColumnMetadata[key].description}</p>
                      </div>
                      <span className="text-sm font-semibold text-white">{kanbanColumns[key].length}</span>
                    </div>
                    <ul className="space-y-3 text-sm text-slate-200">
                      {kanbanColumns[key].length ? (
                        kanbanColumns[key].map((task, index) => (
                          <li key={`${task.title}-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
                            {task.title}
                          </li>
                        ))
                      ) : (
                        <li className="text-slate-500">No tasks.</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Pending tasks</p>
                      <h3 className="text-lg font-semibold text-white">
                        {pendingTasksList.length} task{pendingTasksList.length === 1 ? "" : "s"} waiting
                      </h3>
                    </div>
                    <span className="text-xs text-slate-400">Captured live</span>
                  </div>
                  <ul className="mt-4 space-y-3 text-sm text-slate-200">
                    {pendingTasksList.length ? (
                      pendingTasksList.map((task, index) => (
                        <li
                          key={`${task.title}-${index}`}
                          className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3"
                        >
                          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                            <span>{friendlyStatusLabel(task.status)}</span>
                            <span className="rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white">
                              {friendlyStatusLabel(task.statusNormalized)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-white">{task.title}</p>
                        </li>
                      ))
                    ) : (
                      <li className="text-slate-500">All pending work is cleared.</li>
                    )}
                  </ul>
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Cron health</p>
                      <h3 className="text-lg font-semibold text-white">Automation watchdogs</h3>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.3em] ${cronBadgeStyles[cronSnapshot?.statusLabel ?? "ok"] ?? cronBadgeStyles.ok}`}
                    >
                      {cronBadgeLabel[cronSnapshot?.statusLabel ?? "ok"] ?? "Healthy"}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-xs text-slate-400">
                    {cronSnapshot?.summary.length ? (
                      cronSnapshot.summary.map((line, index) => <p key={index}>{line}</p>)
                    ) : (
                      <p className="text-slate-500">Cron jobs not configured yet.</p>
                    )}
                  </div>
                  <div className="mt-4 space-y-3">
                    {cronSnapshot?.jobs.length ? (
                      cronSnapshot.jobs.map((job) => (
                        <article
                          key={job.name}
                          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 text-sm text-slate-200"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-white">{job.name}</p>
                              <p className="text-xs text-slate-500">{job.scheduleExpression ?? "Scheduled run"}</p>
                            </div>
                            <span className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] ${normalizeCronTone(job.lastStatus)}`}>
                              {job.lastStatus}
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-slate-400">
                            <p>Next run: {formatDateTime(job.nextRunAt)}</p>
                            <p>Last run: {formatDateTime(job.lastRunAt)}</p>
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">No cron jobs are registered yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6 rounded-2xl border border-white/10 bg-slate-900/60 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-300/70">Idea board</p>
                <h2 className="text-2xl font-semibold text-white">Signals, priorities, and live votes</h2>
              </div>
              <span className="text-sm font-semibold text-slate-300">{ideas.length} ideas</span>
            </div>

            {loadingIdeas ? (
              <p className="py-10 text-center text-slate-400">Loading ideas…</p>
            ) : !ideas.length ? (
              <p className="py-10 text-center text-slate-400">No ideas yet. Submit something thoughtful.</p>
            ) : (
              <div className="space-y-4">
                {ideas.map((idea) => (
                  <article
                    key={idea.id}
                    className="rounded-2xl border border-white/5 bg-slate-950/60 p-4 shadow-inner shadow-black/20"
                  >
                    <header className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                          {stageMetadata[idea.stage as keyof typeof stageMetadata]?.label ?? idea.stage}
                        </p>
                        <h3 className="text-xl font-semibold text-white">{idea.title}</h3>
                      </div>
                      <button
                        onClick={() => handleVote(idea.id)}
                        className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/40"
                      >
                        + vote
                      </button>
                    </header>
                    <p className="mt-2 text-sm text-slate-300">{idea.description}</p>
                    <footer className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
                      <span>{idea.domain}</span>
                      <span>{idea.votes} vote{idea.votes === 1 ? "" : "s"}</span>
                    </footer>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6 rounded-2xl border border-white/10 bg-slate-900/60 p-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-300/70">Submit an idea</p>
              <h2 className="text-2xl font-semibold text-white">Add your next Fleck</h2>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block text-xs text-slate-400">
                Title
                <input
                  required
                  value={formState.title}
                  onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-cyan-300"
                />
              </label>

              <label className="block text-xs text-slate-400">
                Description
                <textarea
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, description: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-cyan-300"
                  rows={3}
                />
              </label>

              <label className="block text-xs text-slate-400">
                Domain
                <input
                  value={formState.domain}
                  onChange={(event) => setFormState((current) => ({ ...current, domain: event.target.value }))}
                  placeholder="Product, Research, Growth..."
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-cyan-300"
                />
              </label>

              <label className="block text-xs text-slate-400">
                Stage
                <select
                  value={formState.stage}
                  onChange={(event) => setFormState((current) => ({ ...current, stage: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-cyan-300"
                >
                  {stageOrder.map((stage) => (
                    <option key={stage} value={stage} className="text-slate-900">
                      {stageMetadata[stage].label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-400 to-blue-600 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Saving…" : "Submit idea"}
              </button>
            </form>

            {ideaStatus && <p className="text-xs text-slate-300">{ideaStatus}</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
