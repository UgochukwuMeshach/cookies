# Official Playwright image matching the installed Playwright version (1.49.1).
# Includes Node.js, Chromium + headless shell, and all required Linux browser
# dependencies. Per https://playwright.dev/docs/docker the image tag MUST match
# the Playwright npm package version exactly, or browser executables will not
# be found at runtime.
FROM mcr.microsoft.com/playwright:v1.49.1-noble

WORKDIR /app

# The official image pre-installs browsers here. Declaring it explicitly
# guards against environment overrides and keeps browser resolution
# independent of any user cache directory (e.g. ~/.cache/ms-playwright).
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Copy dependency manifests first for better layer caching.
COPY package.json package-lock.json ./

# Install production dependencies only (no devDependencies like nodemon).
RUN npm ci --omit=dev

# Build-time verification: fail the image build if the Chromium binary that
# matches Playwright 1.49.1 cannot actually launch in this image. This
# guarantees the browser exists and works BEFORE `node index.js` ever runs,
# without downloading browsers at runtime or on HTTP requests.
RUN node -e "require('playwright').chromium.launch({ headless: true }).then((b) => b.close()).then(() => console.log('Chromium launch verification OK')).catch((err) => { console.error(err); process.exit(1); })"

# Copy the rest of the server source.
COPY . .

# Render injects PORT; default to 5000 for local runs.
ENV PORT=5000

# Bind to 0.0.0.0 so Render's proxy can reach the app.
EXPOSE 5000

# Start the Express server.
CMD ["node", "index.js"]