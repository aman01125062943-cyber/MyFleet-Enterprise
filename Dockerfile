# ===========================================
# Stage 1: Build React App
# ===========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (for caching)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ===========================================
# Stage 2: Production Server (Nginx)
# ===========================================
FROM nginx:stable-alpine

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
