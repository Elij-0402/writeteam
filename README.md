# WriteTeam

WriteTeam is a full-stack AI creative writing app inspired by Sudowrite. It includes project/document management, a rich text editor, Story Bible, and streaming AI writing tools.

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- shadcn/ui + Tailwind CSS v4
- Supabase (Auth + Postgres + RLS)
- TipTap editor
- BYOK OpenAI-compatible API (server-side route handlers)

## Features

- Email/password auth with Supabase
- Dashboard with project CRUD
- Editor with document CRUD and autosave
- AI tools: Write, Rewrite, Describe, Brainstorm, Expand, First Draft
- AI chat sidebar with project/story context
- Story Bible with character management
- Command palette (`Cmd/Ctrl + K`) and theme toggle

## Prerequisites

- Node.js 20+
- npm 10+
- A Supabase project
- A compatible model provider endpoint/key configured in-app (BYOK)

## Environment Variables

Create `.env.local` in the project root with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

Quick start:

```bash
cp .env.local.example .env.local
```

On Windows Command Prompt:

```bash
copy .env.local.example .env.local
```

## Supabase Setup

1. Create a Supabase project.
2. In Supabase dashboard, get:
   - Project URL
   - Anon public key
3. Put both values into `.env.local`.
4. Apply the SQL schema from:
   - `supabase/migrations/001_initial_schema.sql`

You can run that SQL in the Supabase SQL Editor, or with Supabase CLI if your environment is configured.

## Install and Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Scripts

- `npm run dev` - start local dev server
- `npm run lint` - run ESLint
- `npm run build` - production build
- `npm run start` - run production server

## Project Structure

- `src/app` - routes, layouts, API routes, server actions
- `src/components` - editor, AI UI, dashboard, story bible, shadcn/ui
- `src/lib/supabase` - server/browser/proxy session helpers
- `src/types/database.ts` - typed Supabase schema
- `supabase/migrations` - database schema migrations

## AI and Security Notes

- This project uses BYOK: users provide model config client-side and requests pass via `X-AI-*` headers.
- The server never persists provider API keys.
- AI route handlers live in `src/app/api/ai/*` and run on the server.
- Supabase auth/session handling is wired through `src/proxy.ts` and `src/lib/supabase/*`.

## Verification

Recommended local checks before pushing changes:

```bash
npm run lint
npm run build
```

If build fails with missing Supabase env vars, verify `.env.local` exists and includes all required keys.

## Notes

- Next.js 16 uses `proxy.ts` convention for request/session handling in this project.
