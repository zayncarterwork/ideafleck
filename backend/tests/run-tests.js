const fs = require("fs");
const path = require("path");
const assert = require("node:assert");

const tempDbPath = path.join(__dirname, "..", "data", "tests-ideafleck.db");
process.env.IDEAFLECK_DB = tempDbPath;

if (fs.existsSync(tempDbPath)) {
  fs.rmSync(tempDbPath, { force: true });
}

const { listIdeas, insertIdea, incrementVotes, listStages } = require("../db");

async function run() {
  try {
    console.log("Running backend data layer checks...");

    const freshIdeas = await listIdeas();
    assert(Array.isArray(freshIdeas), "Ideas should be an array");
    assert(freshIdeas.length >= 1, "Seed data should create at least one idea");

    const ideaToCreate = {
      title: "Test autop-run",
      description: "Generated during tests.",
      domain: "QA",
      stage: "validate"
    };

    const createdIdea = await insertIdea(ideaToCreate);
    assert.strictEqual(createdIdea.title, ideaToCreate.title);
    assert.strictEqual(createdIdea.stage, ideaToCreate.stage);
    assert.strictEqual(createdIdea.votes, 0);

    const voted = await incrementVotes(createdIdea.id);
    assert.strictEqual(voted.votes, 1, "Vote should increment a single point");

    const stages = await listStages();
    assert(stages.some((stage) => stage.name === "build"), "Default stages should include build");

    console.log("All backend tests passed.");
  } finally {
    if (fs.existsSync(tempDbPath)) {
      fs.rmSync(tempDbPath, { force: true });
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
