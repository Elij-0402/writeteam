# AGENTS.md

Guidance for coding agents operating in this repository (`D:\writeteam`).

WriteTeam is a zh-CN AI creative writing app built with Next.js 16, React 19, TypeScript, Supabase, TipTap, and Vitest.

## Scope & Priority

- This file applies to the whole repository.
- If nested `AGENTS.md` files appear later, deeper scope overrides this file.
- User/system/developer instructions always override AGENTS guidance.

## Core Working Principles

- Make minimal, surgical changes aligned with existing architecture.
- Keep all user-facing copy in Simplified Chinese (zh-CN).
- Fix root causes instead of patching symptoms.
- Avoid unrelated refactors while solving targeted tasks.
- Preserve type safety and user-data ownership checks.

## Required Commands

Run commands from repository root.

### Dev / Build / Lint

- `npm run dev` → starts Next dev server on `0.0.0.0:3000`
- `npm run build` → production build
- `npm run start` → production server
- `npm run lint` → ESLint

### Tests (official workflow)

- `npm run test`
  - Executes `node scripts/run-tests.mjs`
  - Runs a curated Vitest list
  - With no extra args, also runs:
    - `node --test tests/story-4-2-quick-edit.test.mjs`

- `npm run test -- --some-flag`
  - Vitest-only path (contract phase skipped)
  - Any extra arg triggers skip behavior

### Single Test Execution

- Single Vitest file:
  - `npx vitest run src/path/to/file.test.ts`
  - Example: `npx vitest run src/app/api/ai/quick-edit/route.test.ts`

- Single Vitest test by name:
  - `npx vitest run src/path/to/file.test.ts -t "test name"`

- Single Node contract test:
  - `node --test tests/story-1-2-auth-flow.test.mjs`
  - `node --test tests/story-1-3-byok-config.test.mjs`
  - `node --test tests/story-2-2-document-order.test.mjs`
  - `node --test tests/story-4-2-quick-edit.test.mjs`

- All Node contract tests:
  - `node --test tests`

## Repo Architecture Conventions

- `src/app/**`: routes, layouts, API handlers, Server Actions
- `src/app/api/**/route.ts`: API route handlers (mostly POST)
- `src/app/actions/*.ts`: Server Actions
- `src/components/**`: client UI and feature components
- `src/lib/**`: shared logic (AI, Supabase, helpers)
- `src/types/**`: DB/domain types
- `tests/*.mjs`: Node-native contract tests

Respect layer boundaries; avoid moving logic across layers without clear need.

## Client / Server / API Rules

### Client Components

- Put `"use client"` on first line when required.
- Use hooks (`useState`, `useEffect`, `useCallback`) for state and effects.
- Use `toast` and/or inline UI for actionable Chinese error feedback.

### Server Actions

- Put `"use server"` at top of action files.
- Use `createClient()` from `@/lib/supabase/server`.
- Authenticate early via `supabase.auth.getUser()`.
- Enforce ownership filters with `eq("user_id", user.id)` where applicable.
- Return structured objects (e.g., `{ error: "..." }`, `{ success: true }`).
- Call `revalidatePath(...)` after successful mutations affecting rendered pages.

### API Route Handlers

- Use `NextRequest` and method exports (`POST`, etc.).
- Parse `request.json()` defensively (try/catch).
- Validate required fields with early returns.
- Return status-appropriate JSON errors (401/400/500 patterns).
- Keep internal error details private; return safe Chinese messages.

## AI Pipeline Rules

When adding/changing AI routes, follow established flow:

1. Authenticate user
2. Resolve BYOK headers using `resolveAIConfig(request)`
3. Load story context via `fetchStoryContext(...)`
4. Build prompt context via `buildStoryPromptContext(...)`
5. Stream via `createOpenAIStreamResponse(...)`

Additional requirements:

- Preserve telemetry behavior (`ai_history` fields and retry/recovery metadata).
- Use `extractRetryMeta(...)` when retry/recovery is supported.
- Do not log or persist provider API keys.

## TypeScript & Safety Standards

- TS strict mode is enabled; keep code strictly typed.
- Prefer explicit interfaces/types and `import type` for type-only imports.
- Narrow unknown values with guards/validation before use.
- Use unions/string literals for constrained modes/features.

Forbidden:

- `as any`
- `@ts-ignore`
- `@ts-expect-error`

## Import / Naming / Formatting Style

- Use alias imports (`@/*`) for internal modules.
- Typical import grouping:
  1) external/framework 2) internal modules 3) type imports
- Follow existing formatting in touched files; avoid repo-wide formatting churn.
- Prefer descriptive English identifiers in code.
- Keep UX strings/messages in Chinese.
- Use clear verb-based names (`getX`, `createX`, `updateX`, `deleteX`, `handleX`).

## Error Handling Conventions

- Return actionable Chinese errors (retry/refresh/config hints).
- Avoid empty `catch {}` unless intentionally using fallback behavior.
- Keep API errors consistent and non-sensitive.
- In UI, pair toasts with stable inline error states when helpful.

## Testing Conventions

- Vitest is primary for unit/component/API tests under `src/**`.
- Test files are colocated: `.test.ts` / `.test.tsx`.
- Some route contract-style tests use `.contract.test.ts` under `src/app/api/ai`.
- Node-native contract tests live in `tests/*.mjs`.
- Reuse existing mock style (`vi.mock`, `vi.stubGlobal`, mocked Supabase clients).

When changing code:

- Run nearest affected test files first.
- Then run broader checks (`npm run test`, `npm run lint`, `npm run build`) as needed.

## Security & Data Rules

- Never bypass auth checks in actions/routes.
- Never remove user ownership constraints in DB queries.
- Never hardcode credentials or expose secrets in logs/errors.
- Required env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Next.js Project-Specific Notes

- Project uses Next.js 16 `proxy.ts` session handling convention.
- Keep root provider composition in `src/app/layout.tsx` consistent.
- Follow existing route-group organization: `(auth)`, `(dashboard)`, `(editor)`.

## Cursor / Copilot Rules Check

At time of writing, these files are not present:

- `.cursorrules`
- `.cursor/rules/**`
- `.github/copilot-instructions.md`

If added later, merge their instructions into agent behavior with proper scope precedence.

## Completion Checklist for Agents

Before finishing a task:

1. Ensure modified files type-check via diagnostics
2. Run focused tests for changed area
3. Run lint when edits are non-trivial
4. Run build for cross-cutting/release-critical changes
5. Confirm no secrets, no type-suppression comments, no unrelated edits
