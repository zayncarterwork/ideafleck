# Render Deployment Notes

Sprint 1 is packaged so it can live on Render as two services (Next.js front-end + Express API). The repository includes `render.yaml` so you can recreate the infrastructure quickly. The YAML currently references example URLs (`ideafleck-api` and `ideafleck-frontend`) — update the `envVars` to the actual service domains once Render provisions them.

Key points:

1. **Frontend (Next.js)**
   - Root: `frontend`
   - Build command: `npm install && npm run build`
   - Start command: `npm run start`
   - Set `NODE_ENV=production` and `PORT=10000` (Render overrides the port environment variable in production).
   - Set `NEXT_PUBLIC_API_BASE_URL` to the backend service URL that Render provides (look for the HTTP endpoint in the Render dashboard).

2. **Backend (Express + SQLite)**
   - Root: `backend`
   - Build command: `npm install`
   - Start command: `npm run start`
   - Set `PORT=4000` (or let Render inject its preferred port) and `ALLOWED_ORIGINS` to the deployed front-end URL (e.g., `https://ideafleck.onrender.com`).
   - Render will keep the SQLite file under `backend/data/`; the service runs in the `/tmp` writable space.

3. **Render YAML**
   - The provided `render.yaml` declares two web services plus the shared environment variables and health checks.
   - You can drop it into a GitHub repo connected to Render and click “Import from Render.yaml” to provision all services at once.

4. **Manual Steps Needed**
   - I could not run the Render deployment from this environment because there is no Render API key configured here. After pushing this repo to GitHub, log into your Render account, import the `render.yaml`, connect the `frontend` and `backend` services to the same repository, and update the environment variables (especially `NEXT_PUBLIC_API_BASE_URL`).
   - Once Render builds and deploys both services, the frontend should be able to reach `https://<backend-service>.onrender.com/api/ideas` for live data.
