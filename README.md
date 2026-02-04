# IdeaFleck — Sprint 1

IdeaFleck is an idea-management reference board built with a **Next.js** front-end that talks to a lightweight **Express + SQLite** API. This MVP demonstrates competitor awareness, a simple idea schema, voting, and story-driven insights.

## Highlights
- **Signal-driven dashboard:** Hero copy and stage summaries that reference competitor behavior (Productlogz, Sideways 6, Canny).
- **API-backed idea board:** Express exposes `/api/ideas`, `/api/stages`, and `/api/ideas/:id/vote`, with SQLite data seeded inside `backend/data/`.
- **Votes & submissions:** Front-end forms let you add ideas and upvote existing ones while showing stage totals at a glance.

## Tech Stack
| Layer | Stack | Notes |
| --- | --- | --- |
| Front-end | Next.js 16 + Tailwind 4 | Client component fetches the Express API and renders idea cards, competitor signals, and submission form. |
| API | Express + CORS + Morgan | Validates input, increments votes, and serves stage metadata for the front-end. |
| Data | SQLite via better-sqlite3 | `stages` and `ideas` tables capture structured signals; default seeds keep the board populated. |

## Local Development
1. Install dependencies at the root (this also installs `concurrently`):
   ```bash
   npm install
   ```
2. Start both services together:
   ```bash
   npm run dev
   ```
   - The front-end runs on `http://localhost:3000` and the API on `http://localhost:4000`.
   - The front-end expects `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:4000`). You can override it with `.env.local` for custom addresses.
3. If you want to run services individually:
   ```bash
   npm --prefix backend run dev
   npm --prefix frontend run dev
   ```

## Tests
- Run `npm run test` (delegates to `backend/tests/run-tests.js`) to validate the SQLite schema, insertion logic, and voting.

## Deployment
- See `docs/deployment.md` for Render deployment instructions and `render.yaml` with placeholder service URLs.
- After pushing to GitHub, import `render.yaml` from Render, update the environment variables (`NEXT_PUBLIC_API_BASE_URL`, `ALLOWED_ORIGINS`), and deploy the two services.

## Documentation
- `docs/competitor-research.md` — competitor research notes.
- `docs/stack-plan.md` — architecture intent and data flows.
- `docs/deployment.md` — Render-specific guidance.

## Next Steps
- Wire user stories to idea stages (validation, build, launch) via webhooks or internal automation.
- Add Render health checks and environment secrets once the repository is connected.
- Build analytics for votes per domain to surface trending idea areas.
