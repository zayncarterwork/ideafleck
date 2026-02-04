const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const DB_PATH = process.env.IDEAFLECK_DB || path.join(__dirname, "data", "ideafleck.sqlite");
const WASM_PATH = require.resolve("sql.js/dist/sql-wasm.wasm");

const stageMetadata = [
  { name: "new", label: "New", description: "Fresh sparks waiting for validation." },
  { name: "validate", label: "Validate", description: "Experiments, interviews, and quick tests." },
  { name: "build", label: "Build", description: "Engineering and design work in progress." },
  { name: "launch", label: "Launch", description: "Live rollouts and ongoing monitoring." }
];

const seedIdeas = [
  {
    title: "Signalstorms",
    description: "Capture emerging problems from Slack channels and build a public idea wall.",
    domain: "ResearchOps",
    stage: "new",
    votes: 12
  },
  {
    title: "Spark Summaries",
    description: "Auto-generate memo drafts whenever an idea reaches the validation board.",
    domain: "Product",
    stage: "validate",
    votes: 8
  },
  {
    title: "Flecks for Customers",
    description: "Invite beta customers to remix ideas before we commit to a roadmap slot.",
    domain: "Customer",
    stage: "build",
    votes: 6
  },
  {
    title: "Launch Ritual",
    description: "Track the playbook, team, and impact of every idea after release.",
    domain: "Growth",
    stage: "launch",
    votes: 4
  }
];

let dbState;

async function ready() {
  if (dbState) {
    return dbState;
  }

  const SQL = await initSqlJs({ locateFile: () => WASM_PATH });
  const buffer = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
  const db = buffer ? new SQL.Database(new Uint8Array(buffer)) : new SQL.Database();

  ensureSchema(db);
  seedStages(db);
  const seededIdeas = seedIdeaSeeds(db);
  if (seededIdeas) {
    persist(db);
  }

  dbState = { SQL, db };
  return dbState;
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stages (
      name TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT
    );
    CREATE TABLE IF NOT EXISTS ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      domain TEXT,
      stage TEXT NOT NULL REFERENCES stages(name),
      votes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function seedStages(db) {
  const insert = db.prepare("INSERT OR IGNORE INTO stages (name, label, description) VALUES (?, ?, ?)");
  for (const stage of stageMetadata) {
    insert.run([stage.name, stage.label, stage.description]);
  }
  insert.free();
}

function seedIdeaSeeds(db) {
  const countStmt = db.prepare("SELECT COUNT(*) as count FROM ideas");
  countStmt.step();
  const count = countStmt.getAsObject().count;
  countStmt.free();

  if (count > 0) {
    return false;
  }

  const insert = db.prepare(
    "INSERT INTO ideas (title, description, domain, stage, votes) VALUES (?, ?, ?, ?, ?)"
  );

  for (const idea of seedIdeas) {
    insert.run([idea.title, idea.description, idea.domain, idea.stage, idea.votes]);
  }

  insert.free();
  return true;
}

function persist(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function collectRows(stmt) {
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

async function listIdeas() {
  const { db } = await ready();
  const query = `
    SELECT
      ideas.id,
      ideas.title,
      ideas.description AS description,
      ideas.domain,
      ideas.stage,
      ideas.votes,
      ideas.created_at,
      COALESCE(stages.label, ideas.stage) AS stageLabel,
      stages.description AS stageDescription
    FROM ideas
    LEFT JOIN stages ON ideas.stage = stages.name
    ORDER BY ideas.votes DESC, ideas.created_at DESC
  `;
  const stmt = db.prepare(query);
  const rows = collectRows(stmt);
  return rows;
}

async function selectIdea(db, id) {
  const query = `
    SELECT
      ideas.id,
      ideas.title,
      ideas.description AS description,
      ideas.domain,
      ideas.stage,
      ideas.votes,
      ideas.created_at,
      COALESCE(stages.label, ideas.stage) AS stageLabel,
      stages.description AS stageDescription
    FROM ideas
    LEFT JOIN stages ON ideas.stage = stages.name
    WHERE ideas.id = ?
  `;
  const stmt = db.prepare(query);
  stmt.bind([id]);
  const row = stmt.step() ? stmt.getAsObject() : undefined;
  stmt.free();
  return row;
}

async function insertIdea({ title, description = "", domain = "Unassigned", stage = "new" }) {
  const sanitizedTitle = title?.trim();
  if (!sanitizedTitle) {
    throw new Error("Title is required");
  }

  const normalizedStage = stageMetadata.some((entry) => entry.name === stage) ? stage : "new";
  const { db } = await ready();
  const insert = db.prepare(
    "INSERT INTO ideas (title, description, domain, stage, votes) VALUES (?, ?, ?, ?, ?)"
  );
  insert.run([sanitizedTitle, description.trim(), domain.trim() || "Unassigned", normalizedStage, 0]);
  insert.free();

  const idResult = db.exec("SELECT last_insert_rowid() AS id")[0];
  const insertedId = idResult.values[0][0];
  persist(db);
  return selectIdea(db, insertedId);
}

async function incrementVotes(id) {
  const { db } = await ready();
  const update = db.prepare("UPDATE ideas SET votes = votes + 1 WHERE id = ?");
  update.run([id]);
  update.free();
  persist(db);
  return selectIdea(db, id);
}

async function listStages() {
  await ready();
  return stageMetadata;
}

module.exports = {
  listIdeas,
  insertIdea,
  incrementVotes,
  listStages
};
