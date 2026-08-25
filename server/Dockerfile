# Official Playwright image matching the installed Playwright version (1.49.1).
# Includes Node.js, Chromium, and all required Linux browser dependencies.
FROM mcr.microsoft.com/playwright:v1.49.1-noble

WORKDIR /app

# Copy dependency manifests first for better layer caching.
COPY package.json package-lock.json ./

# Install production dependencies only (no devDependencies like nodemon).
RUN npm ci --omit=dev

# Copy the rest of the server source.
COPY . .

# Render injects PORT; default to 5000 for local runs.
ENV PORT=5000

# Bind to 0.0.0.0 so Render's proxy can reach the app.
EXPOSE 5000

# Start the Express server.
CMD ["node", "index.js"]