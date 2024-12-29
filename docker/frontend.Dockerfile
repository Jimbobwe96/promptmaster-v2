FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first
COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy source files
COPY packages/shared/ ./packages/shared/
COPY apps/frontend/ ./apps/frontend/

# Build shared package first
WORKDIR /app/packages/shared
RUN npm run build

# Build frontend
WORKDIR /app/apps/frontend
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy necessary files from builder
COPY --from=builder /app/packages/shared/package*.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/frontend/package*.json ./
COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./.next/static

# Change the package.json modification to be more explicit
RUN node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('./package.json')); pkg.dependencies['@promptmaster/shared'] = 'file:packages/shared'; fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2));"

# Change this line to use a cleaner install
RUN npm ci --only=production --ignore-scripts

# Set environment variables
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]