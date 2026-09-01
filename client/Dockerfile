# Stage 1: Build Vite React bundle
FROM node:18-alpine AS build
WORKDIR /app

# Copy dependency graphs first for Docker layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy remaining client application code and execute production build
COPY . .
RUN npm run build

# Stage 2: Serve compiled static files with Nginx
FROM nginx:alpine
# Copy custom Nginx routing configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy built static assets from Stage 1
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
