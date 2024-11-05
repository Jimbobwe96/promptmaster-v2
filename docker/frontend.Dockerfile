FROM node:18-alpine

WORKDIR /app

# Copy only frontend package files first
COPY apps/frontend/package*.json ./

# Install frontend dependencies
RUN npm install

# Copy the rest of the frontend code
COPY apps/frontend ./

# Build the Next.js app
RUN npm run build

EXPOSE 3000

# Run Next.js start command
CMD ["npm", "start"]