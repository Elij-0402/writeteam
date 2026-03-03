# AGENTS.md
Guidance for coding agents working in `D:\writeteam`.
WriteTeam is a zh-CN AI creative-writing app (Next.js 16, React 19, TypeScript, Supabase, TipTap, Tailwind v4, Vitest).

## Scope And Priority
- Applies repository-wide unless a deeper `AGENTS.md` overrides it.
- User/system/developer instructions override this file.
- Keep changes minimal and task-scoped; avoid unrelated refactors.

## External Agent Rules (Cursor/Copilot)
- Checked `.cursor/rules/`: not present in this repository.
- Checked `.cursorrules`: not present in this repository.
- Checked `.github/copilot-instructions.md`: not present in this repository.
- If any of these files are later added, treat them as additional constraints.

## Project Map
- `src/app/**`: Next.js App Router pages, layouts, route groups, API handlers.
- `src/app/actions/*.ts`: Server Actions (auth, docs, projects, series, canvas, images, plugins, story-bible).
- `src/app/api/ai/**/route.ts`: AI endpoints (streaming and JSON routes).
- `src/components/**`: feature and UI components.
- `src/lib/ai/**`: AI config, prompts, context, streaming, error classification.
- `src/lib/supabase/{server,client}.ts`: Supabase helpers.
- `src/types/database.ts`: Supabase DB types.
- `src/proxy.ts`: Next.js 16 auth/session proxy.
- `scripts/run-tests.mjs`: curated test runner used by `npm run test`.

## Build / Lint / Test Commands
Run from repository root (`D:\writeteam`).

### App Commands
- `npm install` - install dependencies.
- `npm run dev` - start local dev server (`0.0.0.0:3000`).
- `npm run build` - production build.
- `npm run start` - run production server.
- `npm run lint` - run ESLint (`eslint.config.mjs`, Next core-web-vitals + TS).

### Main Test Command
- `npm run test` runs `node scripts/run-tests.mjs`.
- This executes a curated Vitest file list from `scripts/run-tests.mjs`.
- When no extra args are provided, it then runs Node contract tests under `tests/`.

### Important Test Runner Behavior
- `npm run test -- <args>` still runs the curated Vitest list first.
- Any extra arg makes the script skip Node contract tests.
- For true single-test runs, call `vitest` directly (see below).

### Single Test Commands (Use These)
- Single file: `npx vitest run src/path/to/file.test.ts`
- Single test by name: `npx vitest run src/path/to/file.test.ts -t "case name"`
- Watch one file: `npx vitest src/path/to/file.test.ts`
- Contract-style route test: `npx vitest run src/app/api/ai/collab-routes.contract.test.ts`
- Node contract test: `node --test tests/story-4-2-quick-edit.test.mjs`

### Useful Verification Sequence
- For focused edits: run nearest affected test files first.
- For feature-level edits: run `npm run test` then `npm run lint`.
- For cross-cutting or release-critical edits: run `npm run build`.

## Code Style And Conventions

### TypeScript And Types
- `tsconfig.json` has `strict: true`; keep code fully type-safe.
- Prefer explicit interfaces/types for non-trivial object shapes.
- Use `import type` for type-only imports.
- Treat request payloads as `unknown` and narrow with guards.
- Prefer unions/string literals for constrained states and modes.
- Do not use `as any`, `@ts-ignore`, or `@ts-expect-error`.

### Imports
- Prefer alias imports via `@/*` (maps to `src/*`) for app code.
- Keep imports grouped and readable:
  1) external packages
  2) internal modules (`@/...` then relative)
  3) type-only imports
- Match the surrounding file's import ordering and spacing style.

### Formatting
- Follow existing file-local style; do not mass-reformat unrelated code.
- Most code uses no semicolons and compact modern TS formatting.
- Quote style is mostly double quotes, but some legacy files use single quotes; preserve local consistency.
- Use trailing commas in multiline literals where existing style does.

### Naming
- Use English for identifiers; use Simplified Chinese for user-facing strings.
- Prefer descriptive verb-first function names (`getX`, `createX`, `updateX`, `deleteX`, `handleX`).
- Name booleans as predicates (`isX`, `hasX`, `shouldX`, `canX`).
- Extract repeated validation/sanitization into small helpers.

## Client / Server / API Rules

### Client Components
- Add `"use client"` only when client behavior is required.
- Use standard React hooks and keep state updates predictable.
- Show actionable Chinese error messages in UI (toast + stable inline state where needed).

### Server Actions (`src/app/actions`)
- Add `"use server"` at top.
- Create Supabase server client via `createClient()` from `@/lib/supabase/server`.
- Authenticate early using `supabase.auth.getUser()`.
- Enforce ownership with user-scoped filters such as `.eq("user_id", user.id)`.
- Return consistent payload shapes (`{ error }`, `{ success: true }`, `{ data }`).
- Call `revalidatePath(...)` after mutations affecting rendered data.

### Route Handlers (`src/app/api/**/route.ts`)
- Use `NextRequest` and explicit method exports (`POST`, etc.).
- Parse JSON defensively with `try/catch`.
- Validate required fields early and return proper status codes (400/401/403/409/500).
- Keep error responses safe and actionable in Chinese; avoid leaking internals.

## AI Route Expectations
- Preserve the established pipeline: auth -> config resolve -> story context -> prompt context -> streaming response.
- Keep BYOK handling through `resolveAIConfig(request)`.
- Preserve telemetry writes (`ai_history`) and retry/recovery metadata.
- Reuse `extractRetryMeta(...)` when streaming handlers support recovery.
- Never log or expose provider API keys.

## Error Handling
- Prefer explicit guard clauses over deeply nested conditionals.
- Map raw provider/network errors into user-actionable Chinese messages.
- Avoid empty catches unless intentionally swallowing best-effort failures.
- Keep error object shapes consistent within each feature.

## Testing Conventions
- Vitest is primary for unit/component/API tests under `src/**`.
- Co-locate tests with source using `.test.ts` / `.test.tsx`.
- Use `.contract.test.ts` for route contract tests.
- Add `@vitest-environment jsdom` for DOM component tests when needed.
- Reuse project mock patterns (`vi.mock`, `vi.stubGlobal`, Supabase mocks).

## Practical Defaults For Agents
- Read nearby files before changing architecture-level behavior.
- Prefer additive changes over breaking renames/moves unless required.
- Preserve existing response shapes in actions/routes to avoid client regressions.
- Keep logs minimal and never include private request headers or keys.
- When uncertain, follow conventions in the closest sibling file.
- Avoid introducing new dependencies unless there is clear, local justification.

## Security And Data Safety
- Never bypass auth checks in actions/routes.
- Never remove user ownership constraints from queries.
- Never commit secrets or credentials.
- Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Completion Checklist For Agents
Before claiming completion:
1. Confirm modified code stays type-safe (no forbidden suppressions).
2. Run focused tests for touched areas (prefer direct `vitest` single-file commands).
3. Run `npm run lint` for non-trivial edits.
4. Run `npm run build` when changes are cross-cutting or release-critical.
5. Ensure no unrelated files were modified and no secrets were introduced.
