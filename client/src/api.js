import axios from 'axios';

/**
 * Centralized API client.
 *
 * In production, VITE_API_URL points to the deployed backend, e.g.:
 *   VITE_API_URL=https://cookies-1-ex5p.onrender.com
 *
 * In development, VITE_API_URL is empty and requests go to /api/...
 * which the Vite dev server proxies to http://localhost:5000.
 *
 * The backend routes already include the /api prefix, so the env var
 * must NOT include a trailing /api.
 */
const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;