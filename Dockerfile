# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm install
COPY server/ .
RUN npx tsc

# Stage 3: Production
FROM node:20-alpine
WORKDIR /app

# pg_dump/pg_restore, used by the admin data export/import feature — matches the
# postgres:16-alpine image used for the database in docker-compose.yml
RUN apk add --no-cache postgresql16-client

# Copy server
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-build /app/server/node_modules ./server/node_modules
COPY --from=server-build /app/server/package.json ./server/package.json

# Copy frontend build
COPY --from=frontend-build /app/dist ./dist

# Create upload dirs
RUN mkdir -p uploads/documents uploads/facility-images

WORKDIR /app/server
EXPOSE 3001
CMD ["node", "dist/index.js"]
