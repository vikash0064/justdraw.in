FROM node:18-alpine

WORKDIR /app

# Enable Docker layer caching for dependency installation
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy backend source code
COPY . .

# Ensure directory exist for file uploads
RUN mkdir -p uploads

EXPOSE 5000

ENV NODE_ENV=production
CMD ["npm", "start"]
