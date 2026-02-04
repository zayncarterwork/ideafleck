# Sprint 1 Implementation Summary

This repository captures everything I built for IdeaFleck Sprint 1: competitor research, stack planning, the Next.js + Express + SQLite implementation, testing, and Render deployment preparation.

## Research
- Competitor research is documented in `docs/competitor-research.md`, with notes on how Productlogz, Sideways 6, and Canny structure idea pipelines and voting. That analysis informed the stage-driven narrative in the front-end and the way we surface signals alongside vote totals.
- The front-end copy and stage definitions intentionally reference those differentiators so stakeholders immediately see why IdeaFleck is leaner but still signal-aware.

## Stack Plan
- `docs/stack-plan.md` walks through the architecture: Next 16 + Tailwind 4 on the front-end, a simple Express API with CORS/morgan, and a SQLite data layer seeded with stages and ideas.
- Data flow is intentionally linear: the Next client fetches `/api/ideas`, posts submissions to `/api/ideas`, and calls `/api/ideas/:id/vote` for each upvote. The `db.js` module centralizes schema, seeding, and persistence, making it easy to swap storage later if needed.

## Local Development & Testing
- Run `npm install` at the repo root and then `npm run dev` to bring up both services (Next on port 3000, Express on 4000). The front-end defaults to `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`.
- Tests live in `backend/tests/run-tests.js`. They exercise the SQLite data layer (listing ideas, inserting a new idea, voting, listing stages) and clean up the temporary DB after each run. Execute them with `npm run test` from the repo root; the script already cleans up the test database at `backend/data/tests-ideafleck.db`.

## Deployment Readiness
- `docs/deployment.md` plus `render.yaml` describe how to push to Render. The YAML defines the two services (`ideafleck-frontend`, `ideafleck-api`) and their required environment variables.
- Before shipping, update the Render env vars so `NEXT_PUBLIC_API_BASE_URL` points to the backend service URL, and `ALLOWED_ORIGINS` on the API includes the deployed front-end domain (for example, `https://ideafleck-frontend.onrender.com`). Render will host the SQLite file under `backend/data/` by default; the backend already seeds the DB on first start.
- The README also references these docs so future contributors can find the research, stack plan, testing, and deployment steps quickly.

## Next Steps
- Once Render builds succeed, verify the front-end can fetch ideas and register votes, and then enable health checks or monitoring as needed.
- Future sprints can add automated migrations, schedulable migrations, or a richer analytics layer for idea trends.
