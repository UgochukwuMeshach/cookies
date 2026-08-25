const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth.routes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

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

async function startServer() {
  try {
    if (process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 15000,
      });
      console.log('MongoDB connected successfully.');
    } else {
      console.log('No MONGO_URI provided; running in memory-only mode for local development.');
    }

    app.listen(PORT, () => {
      console.log(`Express server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.log('Continuing in local memory mode so the app can still run.');

    app.listen(PORT, () => {
      console.log(`Express server is running on http://localhost:${PORT}`);
    });
  }
}

startServer();
