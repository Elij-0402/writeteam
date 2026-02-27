# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WriteTeam is a Chinese-language (zh-CN) AI creative writing assistant for fiction authors, inspired by Sudowrite. It provides a rich text editor with AI-powered writing tools, story world management, and multi-provider LLM support.

## Monorepo Structure

The root `package.json` delegates all commands to the `writeteam/` subdirectory:

```bash
npm run dev      # starts Next.js dev server on 0.0.0.0:3000
npm run build    # production build
npm run lint     # ESLint
```

All source code lives in `writeteam/`. The `_bmad/` directory contains BMAD methodology workflow templates (not application code).

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **UI**: shadcn/ui (new-york style) + Tailwind CSS v4 + Radix UI + Lucide icons
- **Database**: Supabase (Postgres + Auth + RLS)
- **Editor**: TipTap (rich text, with StarterKit + CharacterCount + Highlight + Typography + Placeholder)
- **AI**: BYOK (Bring Your Own Key) via OpenAI-compatible API streaming
- **Canvas**: @xyflow/react for visual story planning
- **Import/Export**: mammoth (docx import), docx (docx export), file-saver

## Architecture

### Path alias

`@/*` maps to `writeteam/src/*` (configured in tsconfig.json).

### Request lifecycle (Auth)

`src/proxy.ts` exports a `proxy` function (Next.js 16 proxy convention, replaces deprecated `middleware.ts`) that calls `updateSession()` from `src/lib/supabase/middleware.ts`. This refreshes the Supabase session cookie on every request, redirects unauthenticated users to `/login`, and redirects authenticated users away from auth pages to `/dashboard`.

### Route groups

- `(auth)/` — login, signup pages (public)
- `(dashboard)/` — dashboard, series, settings (server-side auth guard in layout)
- `(editor)/` — editor (`/editor/[id]`), canvas (`/canvas/[id]`)
- `api/ai/*` — 21 AI endpoint route handlers (all POST, server-side only)
- `api/auth/callback` — Supabase OAuth callback
- `actions/` — Server Actions for documents, projects, series, canvas, images, plugins, auth

### BYOK AI Configuration System

AI config is stored client-side in localStorage and passed to API routes via custom HTTP headers (`X-AI-Base-URL`, `X-AI-API-Key`, `X-AI-Model-ID`). The server extracts config with `resolveAIConfig(request)` from `src/lib/ai/resolve-config.ts`. No server-side API keys are required — users provide their own.

Provider presets: DeepSeek, OpenAI, Ollama, OpenRouter, 硅基流动.

### AI Streaming Pipeline

1. API route authenticates user via Supabase
2. `resolveAIConfig()` extracts BYOK config from headers
3. `fetchStoryContext()` loads Story Bible + characters from DB
4. `buildStoryPromptContext()` orchestrates context into system prompt (feature-aware: writing vs planning vs checking features get different context)
5. `createOpenAIStreamResponse()` calls any OpenAI-compatible `/chat/completions` endpoint with streaming, strips SSE framing, and logs telemetry to `ai_history` table

Key AI files:
- `src/lib/ai/story-context.ts` — story context orchestration (the core prompt engineering)
- `src/lib/ai/openai-stream.ts` — generic OpenAI-compatible streaming + telemetry
- `src/lib/ai/prose-mode.ts` — 5 prose styles (balanced, cinematic, lyrical, minimal, match-style)
- `src/lib/ai/saliency.ts` — client-side heuristic analysis of active characters/locations/plotlines
- `src/lib/ai/ai-config.ts` — shared BYOK types, header constants, provider presets

### Editor Architecture

`EditorShell` (`src/components/editor/editor-shell.tsx`) is the main editor container:
- Left sidebar: document list with CRUD
- Center: `WritingEditor` (TipTap instance) with formatting toolbar, autosave (1s debounce), word count
- Right panel: toggleable panels (Story Bible, AI Chat, Muse/灵感伙伴, Visualize)
- `AIToolbar`: AI writing tools toolbar above the editor
- `SelectionAIMenu`: floating AI menu on text selection
- `SaliencyIndicator`: shows detected characters/locations in current text (5s debounce)

### Database

Supabase Postgres with Row Level Security. All tables enforce `user_id = auth.uid()`.

Migrations in `writeteam/supabase/migrations/` (001-010):
- 001: profiles, projects, documents, characters, story_bibles, ai_history
- 002: ai_history telemetry fields (latency_ms, output_chars, response_fingerprint)
- 003-005: story_bible extensions (prose_mode, style_sample, tone, ai_rules, visibility)
- 006: plugins
- 007: model_selection
- 008: series_support (series, series_bibles, project.series_id)
- 009: canvas (canvas_nodes, canvas_edges)
- 010: images

Types: `src/types/database.ts` — TypeScript interfaces for all DB tables.

### Provider Architecture

Root layout wraps the app in: `ThemeProvider` > `AuthProvider` > `AIConfigProvider` > `TooltipProvider`.

- `AuthProvider`: Supabase auth state via React Context (`useAuth()` hook)
- `AIConfigProvider`: BYOK config from localStorage (`useAIConfig()` hook)
- `ThemeProvider`: next-themes for dark/light mode

### Supabase Client Helpers

- `src/lib/supabase/server.ts` — server-side client (Server Components, Server Actions, Route Handlers)
- `src/lib/supabase/client.ts` — browser-side client (Client Components)

### Environment Variables

Required in `writeteam/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Conventions

- All user-facing strings are in Chinese (zh-CN)
- Server Actions in `src/app/actions/` always verify auth with `supabase.auth.getUser()` before DB operations
- AI route handlers follow a consistent pattern: auth check → resolveAIConfig → fetchStoryContext → buildStoryPromptContext → createOpenAIStreamResponse
- Document content is stored as TipTap JSON (`content` column) with a plain-text mirror (`content_text` column) and word count
- shadcn/ui components live in `src/components/ui/` — add new ones via `npx shadcn@latest add <component>` from the `writeteam/` directory
