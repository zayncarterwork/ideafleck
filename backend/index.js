const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const db = require("./db");
const { getKanbanSnapshot } = require("./kanban");
const { getStatusSnapshot } = require("./status");

const PORT = parseInt(process.env.PORT, 10) || 4000;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(",").map((origin) => origin.trim()).filter(Boolean);

const app = express();

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} not allowed`));
  }
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan("tiny"));

app.get("/api/ideas", async (req, res) => {
  try {
    const ideas = await db.listIdeas();
    res.json(ideas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/kanban", async (req, res) => {
  try {
    const snapshot = await getKanbanSnapshot();
    res.json(snapshot);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load Kanban status" });
  }
});

app.get("/api/status", async (req, res) => {
  try {
    const snapshot = await getStatusSnapshot();
    res.json(snapshot);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Unable to load status" });
  }
});

app.get("/api/stages", async (req, res) => {
  try {
    const stages = await db.listStages();
    res.json(stages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ideas", async (req, res) => {
  try {
    const idea = await db.insertIdea(req.body);
    res.status(201).json(idea);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/ideas/:id/vote", async (req, res) => {
  try {
    const idea = await db.incrementVotes(Number(req.params.id));
    if (!idea) {
      res.status(404).json({ error: "Idea not found" });
      return;
    }
    res.json(idea);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.listen(PORT, () => {
  console.log(`IdeaFleck API listening on port ${PORT}`);
});
