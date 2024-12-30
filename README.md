# Promptmaster v2

PromptMaster is an innovative AI-powered game that pioneers an entirely new usage of AI tools — guessing the _prompt_ used to make them.

### Features of PromptMaster

- Real-time multiplayer gameplay
- AI-powered image generation
- Intelligent prompt similarity scoring
- Customizable game settings
- Lobby system with host controls

## Quick Start

### Prerequisites

- Node.js 20+
- Redis (for development)
- Docker and Docker Compose (for production)

### Development Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/promptmaster-v2.git
cd promptmaster-v2
```

2. Install all dependencies:

```bash
npm install
```

3. Set up environment variables:

Frontend (`apps/frontend/.env.local`):

```
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

Backend (`apps/backend/.env`):

```
FRONTEND_URL=http://localhost:3000
OPENAI_API_KEY=your_key_here
FAL_KEY=your_key_here
```

4. Start the development servers:

Option 1 - All services in one command:

```bash
# Start Redis first in a separate terminal
redis-server

# Then start all development servers
npm run dev
```

Option 2 - Individual terminals for better log visibility:

```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Build and watch shared package
npm run dev:shared

# Terminal 3: Start backend
npm run dev:backend

# Terminal 4: Start frontend
npm run dev:frontend
```

5. Open http://localhost:3000 in your browser

### Production Deployment

```bash
# Build and start all services
docker-compose up --build

# Access the application at http://localhost:3000
```

## Tech Stack

### Backend:

- Express + TypeScript
- socket.io (real-time communication)
- Redis (state management)
- Zod (validation)

### Frontend:

- React + Next.js + TypeScript
- Tailwind CSS
- socket.io client
- Zod (shared validation)

### Developer Tools:

- Docker + Docker Compose (containerization for Redis)
- ESlint + Prettier

## Project Structure

```
promptmaster-v2/
├── apps/
│   ├── backend/     # Express server
│   └── frontend/    # Next.js application
├── packages/
│   └── shared/      # Shared types and utilities
└── docker/          # Docker configuration
```
