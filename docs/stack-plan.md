# Stack Plan for Sprint 1

## Front-end (Next.js)
- Leverages Next 16 with the app router and Tailwind 4 to ship a polished landing page and idea board fast.
- `app/page.tsx` is a client component that fetches the Express API, renders stage summaries, and keeps the voting/submission UI responsive.
- The front-end can be hosted on Render as a managed Next.js service or exported as static assets with `next export` (if we wanted to split hosting later).

## API (Express)
- Express provides a single, familiar Node HTTP server that exposes `/api/ideas`, `/api/stages`, and `/api/ideas/:id/vote`.
- Cors and lightweight request validation keep the API polite for the Next front-end and any future mobile or CLI clients.
- Logging via `morgan` helps with debugging during Render deployment runs.

## Data Layer (SQLite)
- SQLite keeps the schema lightweight, easy to seed, and simple to migrate for Sprint 1.
- The schema includes `stages` (with metadata) and `ideas` (title, description, domain, stage, votes, timestamp).
- `better-sqlite3` offers synchronous APIs that are easy to test; the API script seeds sample ideas when the file is empty.

## Data Flow
1. The Next.js page fetches `/api/ideas` to hydrate the idea board, stage breakdowns, and metrics.
2. The submission form calls `/api/ideas` (POST) to persist new entries into SQLite.
3. Voting requests hit `/api/ideas/:id/vote`, the Express API increments the `votes` column and returns the updated row.
4. Tests exercise the data layer directly to keep the pipeline reliable and ready for Render deployment.
