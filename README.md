# Credential & Session Manager Dashboard

This project provides a monorepo containing:

- a Vite + React admin dashboard and user portal at `client`
- an Express + Playwright backend at `server`

## Architecture (Production)

```
Vercel
  ↓
React/Vite frontend (client/)
  ↓
https://cookies-1-ex5p.onrender.com
  ↓
Express API (server/)
  ↓
MongoDB
```

The frontend is deployed independently to **Vercel**.
The backend remains deployed on **Render** at `https://cookies-1-ex5p.onrender.com`.

## Local Development Setup

1. Install Node.js 18+.
2. From the repo root, run:
   - `npm install`
   - `npx playwright install --with-deps`
3. Start the app:
   - `npm run dev`
4. Open the frontend at `http://localhost:5173` and the backend at `http://localhost:5000`.

### Local environment

Copy `server/.env.example` to `server/.env` and set your MongoDB connection string.

For local frontend development, leave `VITE_API_URL` unset in `client/.env` so the
Vite dev server proxies `/api/*` to `http://localhost:5000` (see `client/vite.config.js`).

## Production Environment Variables

### Vercel (frontend)

Set the following environment variable in the Vercel project settings
(Settings → Environment Variables):

| Variable       | Value                                   |
| -------------- | --------------------------------------- |
| `VITE_API_URL` | `https://cookies-1-ex5p.onrender.com`   |

> **Important:** `VITE_API_URL` must NOT include a trailing `/api`.
> The backend routes already include the `/api` prefix
> (e.g. `/api/auth/login`, `/api/auth/credentials`).
>
> **Security note:** Anything prefixed with `VITE_` is exposed to the browser.
> Never put MongoDB passwords, API secrets, private keys, session secrets,
> or credentials in `VITE_*` variables.

A committed `client/.env.production` file is also provided as a fallback so the
production build works even if the Vercel env var is not yet configured. The
Vercel environment variable takes precedence.

### Render (backend)

Set the following environment variables in the Render dashboard
(Environment tab on your existing backend service):

| Variable      | Required | Description                                                                 |
| ------------- | -------- | --------------------------------------------------------------------------- |
| `PORT`        | No       | Render injects this automatically. Defaults to `5000`.                      |
| `MONGO_URI`   | Yes      | Your MongoDB connection string.                                             |
| `CLIENT_URL`  | Yes*     | The deployed Vercel frontend URL, e.g. `https://your-app.vercel.app`.       |

`CLIENT_URL` controls CORS. It accepts a single origin or a comma-separated
list of origins, e.g.:

```
CLIENT_URL=https://your-app.vercel.app,http://localhost:5173
```

If `CLIENT_URL` is unset, CORS falls back to allowing all origins (the previous
behavior) — fine for local development, but you should set it in production.

## Vercel Deployment

The repository root contains a `vercel.json` that configures:

- `rootDirectory`: `client`
- `buildCommand`: `npm run build`
- `outputDirectory`: `dist`
- SPA rewrites so routes like `/login/gmail`, `/dashboard`, `/admin`, `/sessions`
  do not return 404 on refresh.

### Vercel settings (dashboard)

- **Framework Preset:** Vite
- **Root Directory:** `client`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variables:** `VITE_API_URL=https://cookies-1-ex5p.onrender.com`

## API Routes (preserved)

The backend exposes the following routes (unchanged):

| Method | Path                          | Description                          |
| ------ | ----------------------------- | ------------------------------------ |
| GET    | `/api/health`                 | Health check                         |
| GET    | `/api/auth/credentials`       | List saved credentials               |
| POST   | `/api/auth/login`             | Login with provider                  |
| POST   | `/api/auth/verify-2fa`        | Submit 2FA code                      |
| POST   | `/api/auth/launch-session`    | Launch cookie-based browser session  |

## Notes

The login automation is intentionally implemented as a demonstration and requires valid provider-specific selectors and browser automation access in a real environment.