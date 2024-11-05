FROM node:18-alpine

WORKDIR /app

# Copy root package.json and workspace files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build shared package
RUN cd packages/shared && npm run build

# Build backend
RUN cd apps/backend && npm run build

EXPOSE 4000

CMD ["npm", "run", "--prefix", "apps/backend", "start"]