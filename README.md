# Credential & Session Manager Dashboard

This project provides a monorepo containing:

- a Vite + React admin dashboard and user portal at `client`
- an Express + Playwright backend at `server`

## Setup

1. Install Node.js 18+.
2. From the repo root, run:
   - `npm install`
   - `npx playwright install --with-deps`
3. Start the app:
   - `npm run dev`
4. Open the frontend at `http://localhost:5173` and the backend at `http://localhost:5000`.

## Environment

Copy `server/.env.example` to `server/.env` and set your MongoDB connection string.

## Notes

The login automation is intentionally implemented as a demonstration and requires valid provider-specific selectors and browser automation access in a real environment.
