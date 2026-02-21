const fs = require("fs");
const os = require("os");
const path = require("path");
const { getKanbanSnapshot, loadKanbanTasks, normalizeStatus } = require("./kanban");

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || path.join(os.homedir(), ".openclaw");
const CRON_JOBS_FILE = path.join(OPENCLAW_DIR, "cron", "jobs.json");
const UNHEALTHY_STATUSES = new Set(["failed", "error", "timeout", "cancelled"]);

function formatTimestamp(ms) {
  if (!ms || typeof ms !== "number") {
    return null;
  }
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sanitizeTask(task) {
  const title = (typeof task?.title === "string" ? task.title.trim() : "") || "Untitled task";
  const status = (typeof task?.status === "string" ? task.status.trim().toLowerCase() : "todo") || "todo";
  const normalized = normalizeStatus(status);

  return {
    title,
    status,
    statusNormalized: normalized
  };
}

async function readCronJobs() {
  if (!fs.existsSync(CRON_JOBS_FILE)) {
    return null;
  }

  try {
    const raw = await fs.promises.readFile(CRON_JOBS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    return { error: error.message };
  }
}

function summarizeCronJobs(jobs) {
  if (!jobs || !jobs.length) {
    return ["Cron jobs: not initialized yet."];
  }

  return jobs.map((job) => {
    const name = job.name || "<unnamed>";
    const nextRun = job.nextRunAt ?? "n/a";
    const lastStatus = (job.lastStatus || "pending").toLowerCase();
    const lastRun = job.lastRunAt ?? "n/a";
    return `${name}: next @ ${nextRun}, last ${lastStatus} @ ${lastRun}`;
  });
}

function normalizeCronJob(job) {
  const state = job?.state ?? {};
  const schedule = job?.schedule ?? {};
  const nextRunMs = state.nextRunAtMs ?? schedule.atMs ?? null;
  const lastRunMs = state.lastRunAtMs ?? null;
  const status = (state.lastStatus || "pending").toLowerCase();

  return {
    id: job?.id ?? null,
    name: job?.name ?? "<unnamed>",
    nextRunAt: formatTimestamp(nextRunMs),
    nextRunAtMs: typeof nextRunMs === "number" ? nextRunMs : null,
    lastRunAt: formatTimestamp(lastRunMs),
    lastRunAtMs: typeof lastRunMs === "number" ? lastRunMs : null,
    lastStatus: status,
    scheduleExpression: schedule.expression ?? schedule.at ?? null
  };
}

async function getCronSnapshot() {
  const jobsPayload = await readCronJobs();
  if (!jobsPayload) {
    return {
      healthy: false,
      statusLabel: "missing",
      summary: ["Cron jobs: not initialized yet."],
      jobs: [],
      loadedAt: new Date().toISOString()
    };
  }

  if (jobsPayload.error) {
    return {
      healthy: false,
      statusLabel: "error",
      summary: [`Cron jobs: failed to read jobs.json (${jobsPayload.error})`],
      jobs: [],
      loadedAt: new Date().toISOString()
    };
  }

  const jobs = Array.isArray(jobsPayload.jobs) ? jobsPayload.jobs.map((job) => normalizeCronJob(job)) : [];
  const summary = summarizeCronJobs(jobs);
  const healthy = jobs.length > 0 && jobs.every((job) => !UNHEALTHY_STATUSES.has(job.lastStatus));
  let statusLabel = "ok";
  if (!jobs.length) {
    statusLabel = "missing";
  } else if (!healthy) {
    statusLabel = "degraded";
  }

  return {
    healthy,
    statusLabel,
    summary,
    jobs,
    loadedAt: new Date().toISOString()
  };
}

async function getStatusSnapshot() {
  const kanbanSnapshot = await getKanbanSnapshot();
  const rawTasks = await loadKanbanTasks();
  const tasks = rawTasks.map(sanitizeTask);
  const pending = tasks.filter((task) => task.statusNormalized !== "done");
  const cronSnapshot = await getCronSnapshot();

  return {
    kanban: {
      ...kanbanSnapshot,
      tasks,
      pending
    },
    cron: cronSnapshot,
    refreshedAt: new Date().toISOString()
  };
}

module.exports = {
  getStatusSnapshot
};
