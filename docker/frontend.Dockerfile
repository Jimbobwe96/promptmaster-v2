FROM node:18-alpine

WORKDIR /app

# Copy root package.json and workspace files
COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build shared package
RUN cd packages/shared && npm run build

# Build frontend
RUN cd apps/frontend && npm run build

EXPOSE 3000

CMD ["npm", "run", "--prefix", "apps/frontend", "start"]