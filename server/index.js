const dns = require("dns");

// Force Node to use public DNS servers
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth.routes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// CORS: allow the frontend origin(s) configured via CLIENT_URL.
// In production, set CLIENT_URL to the deployed Vercel frontend URL,
// e.g. CLIENT_URL=https://your-app.vercel.app
// Multiple origins can be provided as a comma-separated list.
const clientUrls = (process.env.CLIENT_URL || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (e.g. server-to-server, curl, health checks)
    if (!origin) {
      return callback(null, true);
    }

    // If CLIENT_URL is not configured, fall back to allowing all origins
    // (same behavior as the previous app.use(cors()) for local development).
    if (clientUrls.length === 0) {
      return callback(null, true);
    }

    if (clientUrls.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Server is running.' });
});

// Database health check: verifies MONGO_URI exists, the mongoose connection
// is established, and a real ping succeeds against the Atlas deployment.
// Never echoes the URI or credentials.
app.get('/api/health/db', async (req, res) => {
  if (!process.env.MONGO_URI) {
    return res.status(503).json({
      ok: false,
      database: 'unconfigured',
      message: 'MONGO_URI is not configured.',
    });
  }

  const state = mongoose.connection.readyState; // 0=disconnected 1=connected 2=connecting 3=disconnecting
  if (state !== 1) {
    return res.status(503).json({
      ok: false,
      database: 'disconnected',
      connectionState: state,
      message: 'MongoDB is not connected.',
    });
  }

  try {
    await mongoose.connection.db.admin().command({ ping: 1 });
    return res.json({
      ok: true,
      database: 'healthy',
      message: 'MongoDB ping succeeded.',
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      database: 'unreachable',
      message: 'MongoDB ping failed.',
    });
  }
});

// Playwright health check: verifies the Playwright package resolves, the
// Chromium executable matches the installed Playwright version, the browser
// actually launches, a harmless page opens, and the browser closes cleanly.
// A hard race-timeout guarantees this endpoint can never hang.
function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

app.get('/api/health/playwright', async (req, res) => {
  let browser;
  try {
    const { chromium } = require('playwright');
    const check = (async () => {
      browser = await chromium.launch({ headless: true, timeout: 10000 });
      const page = await browser.newPage();
      await page.goto('about:blank');
      await page.close();
    })();
    await withTimeout(check, 20000, 'Playwright health check');
    return res.json({
      ok: true,
      playwright: 'healthy',
      message: 'Chromium launched, loaded a test page, and closed successfully.',
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      playwright: 'unhealthy',
      message: 'Playwright health check failed. Chromium could not be launched.',
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
});

async function startServer() {
  const mongoUri = process.env.MONGO_URI;

  // Production must not start without MongoDB configured (fail fast).
  if (IS_PRODUCTION && !mongoUri) {
    console.error('MongoDB connection failed. MONGO_URI is not configured.');
    console.error('Set MONGO_URI (the MongoDB Atlas connection string) as a secret environment variable in Render.');
    process.exit(1);
  }

  try {
    if (mongoUri) {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 15000,
      });
      console.log('MongoDB connected successfully.');
    } else {
      console.log('No MONGO_URI provided; running in memory-only mode for local development.');
    }
  } catch (error) {
    if (IS_PRODUCTION) {
      // Safe production error: no URI, no credentials, no raw error output.
      console.error('MongoDB connection failed.');
      console.error('Verify MONGO_URI is configured and MongoDB Atlas network access allows the Render service.');
      process.exit(1);
    }
    console.error('MongoDB connection failed:', error.message);
    console.log('Continuing in local memory mode so the app can still run (local development only).');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
