FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build only the backend
RUN cd apps/backend && npm run build

EXPOSE 4000

CMD ["npm", "start", "--prefix", "apps/backend"]