# Social Autopilot

A complete SaaS for automating social media video creation and publishing.

## Stack

- **Monorepo**: pnpm workspaces
- **Frontend**: Next.js 14, Tailwind, shadcn/ui
- **Backend**: NestJS, Postgres, Redis, BullMQ
- **Worker**: Node.js, FFmpeg
- **Infrastructure**: Docker Compose

## Getting Started

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Start infrastructure**:
   ```bash
   docker-compose up -d
   ```

3. **Setup Database**:
   ```bash
   cd apps/api
   npx prisma migrate dev
   ```

4. **Run development**:
   ```bash
   pnpm dev
   ```

## Structure

- `apps/web`: Next.js frontend
- `apps/api`: NestJS backend API
- `apps/worker`: Background worker for video processing
- `packages/shared`: Shared types and utilities
- `packages/ui`: Shared UI components
