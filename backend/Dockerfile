# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY package.json ./
# Install all deps (including devDependencies for TypeScript compilation)
RUN npm install --frozen-lockfile 2>/dev/null || npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies for better-sqlite3 native bindings
RUN apk add --no-cache python3 make g++

# Copy only production package manifest then install
COPY package.json ./
RUN npm install --omit=dev --frozen-lockfile 2>/dev/null || npm install --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Data volume mount point
RUN mkdir -p /data

# Non-root user for security
RUN addgroup -S sss && adduser -S sss -G sss && chown -R sss:sss /app /data
USER sss

EXPOSE 3000

# Default to API mode; override with MODE=indexer or MODE=worker
ENV NODE_ENV=production \
    DB_PATH=/data/sss.db \
    PORT=3000

CMD ["node", "dist/index.js"]
