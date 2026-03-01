# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WriteTeam is a Chinese-language (zh-CN) AI creative writing assistant for fiction authors. It provides a rich text editor with AI-powered writing tools, story world management, and multi-provider LLM support (BYOK — Bring Your Own Key).

## Commands

```bash
npm run dev      # Next.js dev server on 0.0.0.0:3000
npm run build    # production build
npm run lint     # ESLint
npm run test     # all tests (Vitest unit + Node.js contract tests)
```

Run a single Vitest test file:

```bash
npx vitest run src/path/to/file.test.ts
```

Run all Vitest tests only (skip contract tests):

```bash
npm run test -- --some-flag  # passing any extra arg skips the contract test phase
```

Contract tests (Node.js native test runner):

```bash
node --test tests/story-4-2-quick-edit.test.mjs
```

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **UI**: shadcn/ui (new-york style) + Tailwind CSS v4 + Radix UI + Lucide icons
- **Database**: Supabase (Postgres + Auth + RLS)
- **Editor**: TipTap (rich text, StarterKit + CharacterCount + Highlight + Typography + Placeholder)
- **AI**: BYOK via OpenAI-compatible API streaming (`@ai-sdk/openai`, `ai` SDK)
- **Canvas**: @xyflow/react for visual story planning
- **Testing**: Vitest + @testing-library/react + jsdom; Node.js native test runner for contract tests

## Architecture

### Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json and vitest.config.ts).

### Auth — Next.js 16 Proxy

`src/proxy.ts` exports a `proxy` function (Next.js 16 convention, replaces deprecated `middleware.ts`) that calls `updateSession()` from `src/lib/supabase/middleware.ts`. This refreshes the Supabase session cookie on every request, redirects unauthenticated users to `/login`, and redirects authenticated users away from auth pages to `/dashboard`. API routes (`/api`) are excluded from redirect logic.

### Route Groups

- `(auth)/` — login, signup (public)
- `(dashboard)/` — dashboard, series, settings (server-side auth guard in layout)
- `(editor)/` — editor (`/editor/[id]`), canvas (`/canvas/[id]`)
- `api/ai/*` — 21 AI endpoint route handlers (all POST, server-side only)
- `api/auth/callback` — Supabase OAuth callback
- `actions/` — Server Actions for documents, projects, series, canvas, images, plugins, auth

### BYOK AI Configuration

AI config is stored client-side in localStorage (key `"writeteam-ai-config"`) and passed to API routes via custom HTTP headers: `X-AI-Base-URL`, `X-AI-API-Key`, `X-AI-Model-ID`. The server extracts config with `resolveAIConfig(request)` from `src/lib/ai/resolve-config.ts`. No server-side API keys are required.

Provider presets: DeepSeek, OpenAI, Ollama, OpenRouter, 硅基流动.

### AI Streaming Pipeline

All 21 AI route handlers follow the same pattern:

1. Authenticate user via `supabase.auth.getUser()`
2. `resolveAIConfig()` extracts BYOK config from headers
3. `fetchStoryContext()` loads Story Bible + characters from DB
4. `buildStoryPromptContext()` orchestrates context into a feature-aware system prompt
5. `createOpenAIStreamResponse()` calls the OpenAI-compatible `/chat/completions` endpoint with streaming, strips SSE framing, and logs telemetry to `ai_history` table

Key AI files:
- `src/lib/ai/story-context.ts` — story context orchestration and prompt engineering (17 AI features with different context needs)
- `src/lib/ai/openai-stream.ts` — generic OpenAI-compatible streaming + telemetry logging
- `src/lib/ai/error-classification.ts` — structured error classification with recovery actions (auth, rate_limit, timeout, etc.)
- `src/lib/ai/prose-mode.ts` — 5 prose styles (balanced, cinematic, lyrical, minimal, match-style)
- `src/lib/ai/saliency.ts` — client-side heuristic analysis of active characters/locations/plotlines
- `src/lib/ai/ai-config.ts` — shared BYOK types, header constants, provider presets

### Editor Architecture

`EditorShell` (`src/components/editor/editor-shell.tsx`) is the main editor container:
- Left sidebar: document list with CRUD and drag-to-reorder
- Center: `WritingEditor` (TipTap instance) with formatting toolbar, autosave (1s debounce), word count
- Right panel: toggleable panels (Story Bible, AI Chat, Muse/灵感伙伴, Visualize)
- `AIToolbar`: AI writing tools toolbar above the editor
- `SelectionAIMenu`: floating AI menu on text selection
- `SaliencyIndicator`: shows detected characters/locations in current text (5s debounce)

### Database

Supabase Postgres with Row Level Security. All tables enforce `user_id = auth.uid()`.

14 migrations in `supabase/migrations/`:
- 001: profiles, projects, documents, characters, story_bibles, ai_history
- 002: ai_history telemetry fields (latency_ms, output_chars, response_fingerprint)
- 003–005: story_bible extensions (prose_mode, style_sample, tone, ai_rules, visibility)
- 006: plugins
- 007: model_selection
- 008: series support (series, series_bibles, project.series_id)
- 009: canvas (canvas_nodes, canvas_edges)
- 010: images
- 011: ai_failure_recovery + story_bibles update policy
- 012: reorder_documents RPC
- 013: characters unique name per project constraint
- 014: ai_history provider column

Types: `src/types/database.ts` — TypeScript interfaces for all DB tables.

### Provider Architecture

Root layout (`src/app/layout.tsx`) wraps the app in: `ThemeProvider` > `AuthProvider` > `AIConfigProvider` > `TooltipProvider`.

- `AuthProvider`: Supabase auth state via React Context (`useAuth()` hook)
- `AIConfigProvider`: BYOK config from localStorage (`useAIConfig()` hook)
- `ThemeProvider`: next-themes for dark/light mode

### Supabase Client Helpers

- `src/lib/supabase/server.ts` — `createClient()` for Server Components, Server Actions, Route Handlers (uses cookie store from `next/headers`)
- `src/lib/supabase/client.ts` — `createClient()` for Client Components (browser-side)

### Environment Variables

Required in `.env.local` (or `.env`):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Conventions

- All user-facing strings are in Chinese (zh-CN)
- Server Actions in `src/app/actions/` always verify auth with `supabase.auth.getUser()` before DB operations
- AI route handlers follow the consistent 5-step pipeline described above
- Document content is stored as TipTap JSON (`content` column) with a plain-text mirror (`content_text` column) and word count
- Test files are colocated alongside source files with `.test.ts`/`.test.tsx` suffixes
- Add new shadcn/ui components via `npx shadcn@latest add <component>` from the project root
- The `_bmad/` directory contains BMAD methodology workflow templates (not application code)
