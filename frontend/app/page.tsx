"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type IdeaRecord = {
  id: number;
  title: string;
  description: string;
  domain: string;
  stage: string;
  votes: number;
};

type FormState = {
  title: string;
  description: string;
  domain: string;
  stage: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const stageMetadata = {
  new: { label: "New", tone: "text-emerald-200", accent: "bg-emerald-300/20" },
  validate: { label: "Validation", tone: "text-sky-200", accent: "bg-sky-300/20" },
  build: { label: "Build", tone: "text-lime-200", accent: "bg-lime-300/20" },
  launch: { label: "Launch", tone: "text-amber-200", accent: "bg-amber-300/20" }
} as const;

const stageOrder = ["new", "validate", "build", "launch"] as const;

const competitorHighlights = [
  {
    name: "Productlogz",
    focus: "Complete idea-to-product management",
    insight:
      "A single canvas that moves ideas from discovery to roadmaps with built-in prioritization and voting."
  },
  {
    name: "Sideways 6",
    focus: "Employee-driven innovation",
    insight:
      "Integrations with Teams, Yammer, and Workplace keep idea capture embedded where conversations already happen."
  },
  {
    name: "Canny",
    focus: "Customer feedback for roadmaps",
    insight:
      "Public idea forums, transparent voting, and stages such as planned/in progress/launch for external stakeholders."
  }
];

export default function Home() {
  const [ideas, setIdeas] = useState<IdeaRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>({
    title: "",
    description: "",
    domain: "",
    stage: "new"
  });
  const [pending, setPending] = useState(false);

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
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/ideas`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to reach the IdeaFleck API");
      }
      const payload = await response.json();
      setIdeas(payload);
    } catch (error) {
      console.error(error);
      setStatus("Unable to load ideas right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIdeas();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setStatus(null);

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
      setStatus("Idea saved—thank you for the signal.");
      fetchIdeas();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to submit idea");
    } finally {
      setPending(false);
    }
  };

  const handleVote = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/ideas/${id}/vote`, {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("Unable to register the vote");
      }

      const updated = await response.json();
      setIdeas((prev) => prev.map((idea) => (idea.id === updated.id ? updated : idea)));
    } catch (error) {
      console.error(error);
      setStatus("Vote could not be recorded.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10">
        <section className="rounded-3xl bg-gradient-to-br from-slate-900/40 to-slate-800/60 p-8 shadow-2xl shadow-cyan-950/40 backdrop-blur border border-white/10">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-200/80">IdeaFleck Sprint 1</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-5xl">
            Capture, prioritize, and champion ideas that actually move the needle.
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-300">
            IdeaFleck pairs a lightweight Next.js story-driven front-end with a focused Express API and SQLite
            schema so product teams can research signals, add clarity to early ideas, and make bets faster.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
              Next.js + Express + SQLite
            </div>
            <div className="rounded-xl border border-white/10 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
              APIs + Ideation pipeline
            </div>
            <div className="rounded-xl border border-white/10 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200">
              Designed for rapid Render deployment
            </div>
          </div>
        </section>

        <section className="grid gap-6 rounded-2xl border border-white/10 bg-slate-900/40 p-6 shadow-lg shadow-black/50 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold text-white">Competitor Signals & Differentiators</h2>
            <p className="mt-2 text-slate-400">
              The market is crowded with structured innovation platforms, but few combine fast capture with a clear
              development story. Here is where IdeaFleck aims to carve space:
            </p>
            <div className="mt-4 space-y-3">
              {competitorHighlights.map((competitor) => (
                <article
                  key={competitor.name}
                  className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-slate-200"
                >
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

        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6 rounded-2xl border border-white/10 bg-slate-900/60 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-300/70">Idea board</p>
                <h2 className="text-2xl font-semibold text-white">Signals, priorities, and live votes</h2>
              </div>
              <span className="text-sm font-semibold text-slate-300">{ideas.length} ideas</span>
            </div>

            {loading ? (
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
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{idea.description}</p>
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

            {status && <p className="text-xs text-slate-300">{status}</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
