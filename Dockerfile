# ── Stage 1: Build Frontend (Vite React SPA) ──
FROM node:18-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# ── Stage 2: Express Backend Server Runtime ──
FROM node:18-alpine
WORKDIR /app

# Install backend production dependencies
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy backend source code
COPY server/ .

# Copy compiled frontend build from Stage 1 into server client/dist
COPY --from=client-builder /app/client/dist ./client/dist

# Ensure uploads directory exists
RUN mkdir -p uploads

EXPOSE 5000

ENV NODE_ENV=production
CMD ["node", "server.js"]
