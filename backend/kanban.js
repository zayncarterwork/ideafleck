const fs = require("fs");
const path = require("path");

const STATUS_WEIGHTS = {
  todo: 0,
  in_progress: 0.5,
  done: 1
};

const COLUMN_KEYS = ["todo", "in_progress", "done"];
const KANBAN_STATUS_FILE = path.join(__dirname, "..", "..", "scripts", "kanban_status.json");

function normalizeStatus(value) {
  if (!value || typeof value !== "string") {
    return "todo";
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return COLUMN_KEYS.includes(normalized) ? normalized : "todo";
}

async function loadKanbanTasks() {
  try {
    const raw = await fs.promises.readFile(KANBAN_STATUS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.tasks)) {
      return [];
    }

    return parsed.tasks;
  } catch (error) {
    return [];
  }
}

async function getKanbanSnapshot() {
  const tasks = await loadKanbanTasks();
  const columns = COLUMN_KEYS.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});

  let score = 0;

  for (const task of tasks) {
    const status = normalizeStatus(task?.status);
    const title = (typeof task?.title === "string" ? task.title.trim() : "") || "Untitled task";

    columns[status].push({
      title,
      status
    });
    score += STATUS_WEIGHTS[status] ?? 0;
  }

  const total = tasks.length;
  const progressPct = total === 0 ? 0 : Math.round(100 * Math.min(score / total, 1));

  return {
    total,
    progressPct,
    columns
  };
}

module.exports = {
  STATUS_WEIGHTS,
  COLUMN_KEYS,
  normalizeStatus,
  loadKanbanTasks,
  getKanbanSnapshot
};
