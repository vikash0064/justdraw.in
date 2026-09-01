FROM node:18-alpine

WORKDIR /app

# Copy server package files and install dependencies
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# Copy server source code
COPY server/ .

# Ensure uploads directory exists
RUN mkdir -p uploads

EXPOSE 5000

ENV NODE_ENV=production
CMD ["node", "server.js"]
