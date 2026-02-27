---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/prd-validation-report.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/project-context.md'
  - 'docs/index.md'
  - 'docs/project-overview.md'
  - 'docs/architecture.md'
  - 'docs/source-tree-analysis.md'
  - 'docs/component-inventory.md'
  - 'docs/api-contracts.md'
  - 'docs/data-models.md'
  - 'docs/development-guide.md'
workflowType: 'architecture'
project_name: 'writeteam'
user_name: 'Elij'
date: '2026-02-27T18:11:31+08:00'
lastStep: 8
status: 'complete'
completedAt: '2026-02-27T18:11:31+08:00'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
PRD 定义了 28 个 FR，覆盖账号认证、项目/文档工作区、故事设定管理、AI 写作能力、BYOK 配置与可靠性、可视化规划、质量反馈与运营支持。架构上可归纳为 7 个能力域：认证与权限、内容工作区、故事知识层、AI 编排层、配置与连接诊断、可视化规划层、可观测与支持层。核心业务主线是“写作连续性与失败可恢复”，意味着 AI 编排与编辑器会话状态必须深度耦合但边界清晰。

**Non-Functional Requirements:**
PRD 定义了 12 个 NFR，关键驱动包括：交互性能（编辑操作 P95 <= 100ms、AI 首字返回 P95 <= 3s、长文档面板切换 <= 200ms）、安全与隐私（BYOK 密钥不落库不入日志、数据隔离）、扩展性与可用性（3x 并发增长下核心链路可用性 99.5%/故障场景 99.0%）、可访问性（WCAG 2.1 AA）、以及多 Provider OpenAI-compatible 集成与可解释错误。

**Scale & Complexity:**
该项目属于中高复杂度的全栈 Web 应用：业务域集中但跨层耦合度高（编辑器、AI 流式调用、故事上下文、多模型兼容、可恢复机制、可观测）。

- Primary domain: AI-assisted creative writing web app
- Complexity level: medium-high
- Estimated architectural components: 12-16

### Technical Constraints & Dependencies

- 现有技术基线已明确：Next.js 16 App Router + React 19 + TypeScript strict + Supabase + TipTap + shadcn/ui。
- 必须遵循 BYOK 架构：密钥在客户端，服务端仅经 `X-AI-*` 请求头读取，禁止持久化与日志泄漏。
- AI 路由需兼容 OpenAI-compatible 差异，且已存在固定编排链路（auth -> resolveAIConfig -> fetchStoryContext -> buildStoryPromptContext -> stream）。
- 数据层受 RLS 强约束（`user_id = auth.uid()`），新增能力需保持同等隔离模型。
- 核心编辑体验依赖 TipTap 与自动保存/Saliency 防抖策略，性能预算对前端与接口都提出硬约束。
- UX 明确桌面优先、移动可用与 WCAG 2.1 AA；失败恢复链路是主流程而非边角流程。

### Cross-Cutting Concerns Identified

- **Reliability & Recovery:** 模型不可用、断流、格式不兼容时的诊断、降级、快速恢复。
- **Security & Privacy:** BYOK 密钥保护、创作数据隔离、审计与最小采集。
- **Observability:** AI 调用成功率、失败类型、恢复成功率、TTFB 与编辑链路性能度量。
- **Consistency of Story Context:** Story Bible/角色/系列继承在各 AI 能力中的一致注入与可见性控制。
- **UX Continuity:** 写作主链路与排障动作的同屏低打断整合。
- **Accessibility & Responsive Behavior:** 键盘可达、状态可读、跨断点行为一致。

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web application（Next.js App Router + Supabase + AI route handlers） based on project requirements analysis.

### Starter Options Considered

- **Option 1: `create-next-app` (official Next.js CLI)**
  - Maintainer: Vercel/Next.js 官方
  - Current docs baseline: Next.js 16.1.6（官方文档“Last updated February 20, 2026”）
  - 默认能力与本项目目标高度一致：TypeScript、Tailwind、ESLint、App Router、`@/*` 别名、Turbopack。

- **Option 2: `create-t3-app`**
  - 优势：全栈 type-safe 生态整合（tRPC/DB/Auth 可选）
  - 不匹配点：当前项目已采用 Supabase + Server Actions + Route Handlers，而非 tRPC 中心架构；迁移成本与架构偏差较大。

- **Option 3: Vercel Supabase Starter (`with-supabase` example)**
  - 优势：Supabase SSR 与 cookie auth 预置
  - 不匹配点：更适合 greenfield 起步；当前仓库已具备成熟 Supabase 集成，直接采用官方 Next.js 起手模板更轻、更可控。

### Selected Starter: create-next-app (official)

**Rationale for Selection:**
选择官方 `create-next-app` 作为架构基线参考模板，原因是其与当前代码库技术决策最一致、维护活跃、文档与生态最稳定。对于本 brownfield 项目，它不是“重建项目”的命令，而是“新模块/并行孵化仓”或“未来绿地子应用”时的标准起手基线，能最大化保持实现一致性并降低认知分叉。

**Initialization Command:**

```bash
npm create next-app@latest writeteam-foundation --yes --ts --tailwind --eslint --app --src-dir --import-alias "@/*"
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
TypeScript-first、Node 20.9+ 环境基线、React + Next.js App Router 结构化初始化。

**Styling Solution:**
Tailwind CSS 默认集成，可无缝延续当前项目的 utility-first 与 design-token 扩展策略。

**Build Tooling:**
默认 Turbopack 开发链路、Next.js 生产构建管线、ESM 友好配置。

**Testing Framework:**
不强制注入测试框架（与当前仓库状态一致），便于后续按项目策略单独引入 Vitest/RTL/Playwright。

**Code Organization:**
`src/` 目录结构、App Router 路由约定、`@/*` 路径别名、按约定优于配置的文件组织模式。

**Development Experience:**
开箱热更新、严格类型检查、ESLint 规范、官方文档/CLI 版本演进同步，降低团队维护摩擦。

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Data platform fixed to Supabase Postgres + RLS isolation as mandatory baseline for all business data.
- Authentication fixed to Supabase Auth cookie session with server-side enforcement in Route Handlers and Server Actions.
- AI communication fixed to unified OpenAI-compatible adapter and shared streaming pipeline.
- Secret handling fixed to BYOK client-held key model (no server persistence, no key logging).

**Important Decisions (Shape Architecture):**
- Frontend keeps App Router hybrid model (RSC for data loading, client components for rich editor interactions).
- State architecture uses Context + local component state instead of global state library.
- Observability relies on structured `ai_history` telemetry + operational logs for failure triage and recovery metrics.
- Deployment remains Vercel-first with Supabase-managed backend services.

**Deferred Decisions (Post-MVP):**
- Fine-grained cache invalidation and edge caching policy for high-traffic read paths.
- Dedicated analytics warehouse / BI pipeline.
- Multi-region deployment and active-active failover strategy.

### Data Architecture

- **Decision:** Supabase Postgres as system of record, with RLS on all tables and `user_id = auth.uid()` policy model.
- **Validation/Data points:** Existing schema and migrations already align with this model (12 tables, migration 001-010).
- **Data modeling approach:** relational core + selective JSONB fields (`content`, `outline`, `visibility`, metadata-like payloads).
- **Validation strategy:** TypeScript strict types generated/maintained in `src/types/database.ts` + server-side auth-gated mutations.
- **Migration strategy:** append-only SQL migration files, monotonic numbering, no destructive out-of-band schema edits.
- **Caching strategy:** application-layer short-lived/derived-state caching only; source-of-truth reads remain DB-authoritative for story context.

### Authentication & Security

- **Decision:** Supabase Auth for identity, session refresh via `proxy.ts` + `updateSession()` middleware helper.
- **Authorization pattern:** resource ownership enforced by RLS + explicit `getUser()` guard in every mutation path.
- **API security:** authenticated-only AI endpoints, standardized 401/400 responses, no privileged bypass channels.
- **Secrets policy:** BYOK keys pass only through request headers (`X-AI-*`), never persisted to DB/logs/telemetry.
- **Data protection:** private writing assets treated as high-sensitivity content with least-exposure access pattern.

### API & Communication Patterns

- **Decision:** Route-Handler-centric API with feature-scoped endpoints under `app/api/ai/*`.
- **API pattern:** pragmatic REST-like endpoints (task/feature oriented) over GraphQL adoption.
- **AI pipeline contract:** `auth -> resolveAIConfig -> fetchStoryContext -> buildStoryPromptContext -> createOpenAIStreamResponse`.
- **Error handling standard:** JSON error payloads with consistent status codes; streaming endpoints return plain text stream on success.
- **Rate limiting strategy:** staged rollout (application-level quotas/guards first, edge-level enforcement later).
- **Inter-service communication:** direct server-to-provider HTTPS calls with adapter normalization, not brokered through additional internal services.

### Frontend Architecture

- **Decision:** App Router + hybrid rendering stays as canonical model.
- **State management:** `Theme/Auth/AIConfig` Context layers + local `useState`/`useRef` for editor-rich interactions.
- **Component architecture:** shadcn/ui primitives + domain components (`editor`, `ai`, `canvas`, `story-bible`) with clear boundary ownership.
- **Performance strategy:** debounced autosave (1s), debounced saliency computation (5s), context-windowed text processing.
- **UX reliability:** recovery-first interaction pattern (retry, switch model, preserve context) is required behavior, not optional enhancement.

### Infrastructure & Deployment

- **Decision:** Vercel deployment target for web tier; Supabase managed services for DB/Auth.
- **Environment strategy:** minimal required public env vars for Supabase project wiring; no server-side AI secrets.
- **CI/CD baseline:** lint + build must pass before merge/release; add explicit typecheck gate in pipeline.
- **Monitoring & logging:** `ai_history` telemetry + app logs for compatibility failures, latency spikes, and recovery outcome tracking.
- **Scaling strategy:** prioritize graceful degradation of non-critical AI features while preserving core writing workflow availability.

### Decision Impact Analysis

**Implementation Sequence:**
1. Enforce and codify AI pipeline contract + error envelope consistency.
2. Harden BYOK security controls and redaction guarantees.
3. Stabilize model compatibility matrix + recovery orchestration path.
4. Consolidate editor performance safeguards and session continuity behavior.
5. Extend operational observability for failure-to-recovery loop.

**Cross-Component Dependencies:**
- Story context quality depends on consistent data modeling in `story_bibles/characters/series_bibles` and API orchestration fidelity.
- Recovery UX depends on backend error classification quality and model availability detection.
- Security posture depends on synchronized behavior across frontend header injection, server config resolution, and telemetry redaction.
- Performance SLOs depend jointly on frontend debouncing, backend streaming latency, and provider responsiveness.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
15 areas where AI agents could make inconsistent choices across naming, structure, API format, state flow, and error recovery behavior.

### Naming Patterns

**Database Naming Conventions:**
- Table/column/index naming follows `snake_case` SQL conventions (`story_bibles`, `user_id`, `idx_projects_user_id`).
- FK naming uses semantic column style (`project_id`, `series_id`) not prefixed alias forms.
- Migration files use ordered numeric prefix + concise snake_case suffix (`011_feature_name.sql`).

**API Naming Conventions:**
- Route segments use kebab-case nouns/actions under feature grouping (`/api/ai/scene-plan`, `/api/ai/test-connection`).
- Query/body fields at API boundary use camelCase for frontend ergonomics (`projectId`, `documentId`), with explicit mapping at persistence boundary.
- Custom AI headers use canonical `X-AI-*` format.

**Code Naming Conventions:**
- File and directory names use kebab-case (`editor-shell.tsx`, `story-context.ts`).
- React components and types use PascalCase (`EditorShell`, `AIConfigProvider`).
- Functions/variables use camelCase (`fetchStoryContext`, `resolveAIConfig`).
- Database physical names remain snake_case and never leak into UI labels.

### Structure Patterns

**Project Organization:**
- Route handlers in `src/app/api/**/route.ts`; Server Actions in `src/app/actions/*.ts`; domain logic in `src/lib/**`.
- UI primitives in `src/components/ui/`; feature components grouped by domain (`editor`, `ai`, `canvas`, `series`, `settings`).
- Supabase clients split strictly by runtime (`lib/supabase/server.ts` vs `lib/supabase/client.ts`).

**File Structure Patterns:**
- New feature adds: route handler (if API), action (if mutation), domain lib, typed model updates, and UI entry point.
- Tests (when introduced) co-locate with source using `*.test.ts(x)` naming.
- Architecture/PRD/UX artifacts live under `_bmad-output/planning-artifacts/` only.

### Format Patterns

**API Response Formats:**
- Non-streaming endpoints return JSON envelope style: success payload or `Response.json({ error: "..." }, { status })`.
- Streaming AI endpoints return `text/plain` chunked stream; failures return JSON error and status code.
- Error messages are user-facing Chinese where surfaced to UI.

**Data Exchange Formats:**
- Frontend contracts use camelCase; DB layer persists snake_case.
- Date-time in API and logs uses ISO-8601 strings.
- Rich text persists as TipTap JSON (`content`) plus plain-text mirror (`content_text`) and derived `word_count`.
- Boolean/null semantics remain native JSON (`true/false/null`), never 0/1 surrogates in API payloads.

### Communication Patterns

**Event System Patterns:**
- No custom event bus introduced unless required; cross-layer orchestration flows through explicit function pipeline.
- Telemetry event identity uses stable feature keys (`write`, `rewrite`, `continuity-check`, etc.).
- Async operations expose explicit lifecycle states: pending -> success/failure -> recovery action.

**State Management Patterns:**
- Global concerns only in Context providers (Theme/Auth/AIConfig); feature-local state stays local.
- State updates are immutable and typed; no hidden mutable shared module state.
- Debounced workflows (autosave, saliency) must keep cancellation-safe cleanup semantics.

### Process Patterns

**Error Handling Patterns:**
- Distinguish user-actionable errors (config/auth/model availability) from internal faults.
- Every failure path must provide at least one recovery action (retry, switch model, continue with preserved context).
- Never leak secrets or raw provider key material in logs/errors.

**Loading State Patterns:**
- Long-running AI actions always expose visible in-context loading state.
- Loading indicators must bind to operation scope (selection-level vs editor-level vs panel-level).
- On completion/failure, loading states clear deterministically before next action path.

### Enforcement Guidelines

**All AI Agents MUST:**
- Follow naming/structure conventions exactly before introducing new files or endpoints.
- Preserve BYOK and auth guard invariants in every AI/API change.
- Maintain API format and error semantics consistency across all endpoints.
- Keep user-visible strings in Chinese and keep technical internals in typed English identifiers.

**Pattern Enforcement:**
- Verify with lint/build/type checks and targeted review against this architecture document.
- Record deviations as architecture notes in planning artifacts before merging behavioral changes.
- Update pattern section first when introducing a new cross-cutting convention.

### Pattern Examples

**Good Examples:**
- `src/app/api/ai/quick-edit/route.ts` with auth check -> config resolve -> context fetch -> stream pipeline.
- DB schema `story_bibles.visibility` with typed handling and controlled AI context inclusion.
- Frontend using `useAIConfig().getHeaders()` instead of ad-hoc header construction in each component.

**Anti-Patterns:**
- Mixing `camelCase` DB columns into SQL migrations.
- Returning mixed error shapes across AI endpoints.
- Persisting `X-AI-API-Key` or echoing it in error logs.
- Creating `middleware.ts` in this Next.js 16 codebase (must use `proxy.ts` convention).

## Project Structure & Boundaries

### Complete Project Directory Structure
```
writeteam/
├── CLAUDE.md
├── package.json
├── _bmad/
├── _bmad-output/
│   ├── planning-artifacts/
│   │   ├── prd.md
│   │   ├── prd-validation-report.md
│   │   ├── ux-design-specification.md
│   │   └── architecture.md
│   ├── implementation-artifacts/
│   ├── test-artifacts/
│   └── project-context.md
├── docs/
│   ├── index.md
│   ├── project-overview.md
│   ├── architecture.md
│   ├── source-tree-analysis.md
│   ├── component-inventory.md
│   ├── api-contracts.md
│   ├── data-models.md
│   └── development-guide.md
└── writeteam/
    ├── package.json
    ├── next.config.ts
    ├── tsconfig.json
    ├── eslint.config.mjs
    ├── postcss.config.mjs
    ├── components.json
    ├── .env.local (local only)
    ├── public/
    ├── supabase/
    │   └── migrations/
    │       ├── 001_initial_schema.sql
    │       ├── 002_ai_quality_observability.sql
    │       ├── 003_story_bible_prose_mode.sql
    │       ├── 004_story_bible_tone_ai_rules.sql
    │       ├── 005_story_bible_visibility.sql
    │       ├── 006_plugins.sql
    │       ├── 007_model_selection.sql
    │       ├── 008_series_support.sql
    │       ├── 009_canvas.sql
    │       └── 010_images.sql
    └── src/
        ├── proxy.ts
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx
        │   ├── globals.css
        │   ├── (auth)/
        │   │   ├── login/page.tsx
        │   │   └── signup/page.tsx
        │   ├── (dashboard)/
        │   │   ├── layout.tsx
        │   │   ├── dashboard/page.tsx
        │   │   ├── projects/[id]/page.tsx
        │   │   ├── series/page.tsx
        │   │   ├── series/[id]/page.tsx
        │   │   └── settings/page.tsx
        │   ├── (editor)/
        │   │   ├── editor/[id]/page.tsx
        │   │   └── canvas/[id]/page.tsx
        │   ├── actions/
        │   │   ├── auth.ts
        │   │   ├── projects.ts
        │   │   ├── documents.ts
        │   │   ├── series.ts
        │   │   ├── canvas.ts
        │   │   ├── images.ts
        │   │   ├── plugins.ts
        │   │   └── story-bible.ts
        │   └── api/
        │       ├── auth/callback/route.ts
        │       └── ai/
        │           ├── write/route.ts
        │           ├── rewrite/route.ts
        │           ├── expand/route.ts
        │           ├── shrink/route.ts
        │           ├── quick-edit/route.ts
        │           ├── first-draft/route.ts
        │           ├── describe/route.ts
        │           ├── tone-shift/route.ts
        │           ├── brainstorm/route.ts
        │           ├── scene-plan/route.ts
        │           ├── twist/route.ts
        │           ├── muse/route.ts
        │           ├── chat/route.ts
        │           ├── continuity-check/route.ts
        │           ├── plugin/route.ts
        │           ├── visualize/route.ts
        │           ├── canvas-generate/route.ts
        │           ├── saliency/route.ts
        │           ├── models/route.ts
        │           ├── test-connection/route.ts
        │           ├── feedback/route.ts
        │           └── generate-bible/route.ts
        ├── components/
        │   ├── ui/
        │   ├── providers/
        │   ├── editor/
        │   ├── ai/
        │   ├── canvas/
        │   ├── dashboard/
        │   ├── series/
        │   ├── settings/
        │   ├── story-bible/
        │   ├── plugins/
        │   └── layout/
        ├── lib/
        │   ├── ai/
        │   ├── supabase/
        │   ├── export.ts
        │   ├── import.ts
        │   └── utils.ts
        ├── hooks/
        │   └── use-mobile.ts
        └── types/
            └── database.ts
```

### Architectural Boundaries

**API Boundaries:**
- External boundary: browser <-> `app/api/**` via HTTP.
- AI capability boundary: only `app/api/ai/**` can call provider endpoints.
- Auth boundary: all route handlers and actions must pass `supabase.auth.getUser()` gate.
- Data boundary: route/actions -> `lib/supabase/server.ts` -> Postgres with RLS.

**Component Boundaries:**
- `components/ui/*` holds presentation primitives only.
- Feature components own interaction logic but never call DB directly.
- Data mutations/read orchestration lives in Server Actions and route handlers.

**Service Boundaries:**
- AI prompt/context orchestration isolated in `lib/ai/story-context.ts`.
- Streaming transport and telemetry isolated in `lib/ai/openai-stream.ts`.
- Config extraction isolated in `lib/ai/resolve-config.ts`.

**Data Boundaries:**
- Persistence schema authority is SQL migrations + `types/database.ts`.
- Story context aggregation composes project, series, characters, and bible data; no ad-hoc context builders in feature routes.
- BYOK keys are transient request data, never persistent domain data.

### Requirements to Structure Mapping

**Feature/Epic Mapping:**
- Account & access (FR1-3) -> `app/(auth)/*`, `app/actions/auth.ts`, `lib/supabase/*`, `proxy.ts`.
- Project/document workspace (FR4-8) -> `app/(dashboard)/*`, `app/actions/projects.ts`, `app/actions/documents.ts`, `components/editor/*`.
- Story intelligence (FR9-12) -> `components/story-bible/*`, `app/actions/story-bible.ts`, `app/actions/series.ts`, `lib/ai/story-context.ts`.
- AI-assisted writing (FR13-22) -> `app/api/ai/*`, `components/ai/*`, `components/editor/selection-ai-menu.tsx`, `lib/ai/*`.
- Visualization flow (FR23-25) -> `components/canvas/*`, `app/(editor)/canvas/[id]/page.tsx`, `app/actions/canvas.ts`, `app/api/ai/canvas-generate/route.ts`.
- Quality/ops (FR26-28) -> `app/api/ai/feedback/route.ts`, `ai_history` schema, admin/support diagnostics from logs + telemetry.

**Cross-Cutting Concerns:**
- Auth + session refresh -> `proxy.ts` + `lib/supabase/middleware.ts` + action/route guards.
- AI config and model compatibility -> `components/settings/ai-provider-form.tsx` + `lib/ai/ai-config.ts` + `lib/ai/resolve-config.ts`.
- Reliability and recovery UX -> `components/ai/*` + route-level error taxonomy + telemetry feedback loop.

### Integration Points

**Internal Communication:**
- Client components call Server Actions for CRUD and call AI API routes for generation.
- API routes call shared lib functions for context/prompt/streaming.
- Providers expose auth/theme/AI-config context to all interactive surfaces.

**External Integrations:**
- Supabase (Auth, Postgres, RLS)
- OpenAI-compatible providers via BYOK endpoints
- Optional image generation provider path through visualize flow

**Data Flow:**
- User action -> UI component -> Server Action/API route -> Supabase/provider -> transformed result -> UI state update -> autosave/telemetry.

### File Organization Patterns

**Configuration Files:**
- Framework/build config in repo root of app (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`).
- Environment variables in `.env.local` only; checked-in template via docs/instructions.

**Source Organization:**
- Route-first organization in `app/`, domain-first organization in `components/` and `lib/`.
- Keep feature-specific logic local to feature folders; extract only true cross-feature utility.

**Test Organization:**
- Introduce `*.test.ts(x)` co-located when adding automated tests.
- E2E flows (when added) centralized under dedicated test root.

**Asset Organization:**
- Static assets in `public/`; generated artifacts in `_bmad-output/`; source docs in `docs/`.

### Development Workflow Integration

**Development Server Structure:**
- Root script delegates to `writeteam/`; local dev with `npm run dev` uses Next.js App Router runtime.

**Build Process Structure:**
- Build consumes route handlers, actions, component graph, and typed libs with strict TS + ESLint gatekeeping.

**Deployment Structure:**
- Deploy app directory artifact to Vercel; runtime environment wired with Supabase public config.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
已验证核心决策之间无冲突：Next.js App Router、Supabase Auth/Postgres、BYOK AI 编排、shadcn/Tailwind 前端体系在当前代码库中已协同运行，且与选定 starter 基线兼容。

**Pattern Consistency:**
命名、结构、格式、通信与流程模式与既有项目约束一致（kebab-case 文件、snake_case DB、camelCase API 合同、统一 AI 流程与错误语义），可直接约束多代理实现。

**Structure Alignment:**
项目结构与架构边界一致：路由、动作、领域库、组件层、数据库迁移和文档产物位置清晰，边界职责明确。

### Requirements Coverage Validation ✅

**Epic/Feature Coverage:**
当前以 FR 分类覆盖（无 epics 输入）：账号/权限、工作区、故事管理、AI 工具、可靠性、可视化、运营反馈均已映射到具体目录与服务边界。

**Functional Requirements Coverage:**
28 项 FR 均有对应架构承载路径（UI 层、API/Action 层、领域库层、数据层），无阻塞性缺口。

**Non-Functional Requirements Coverage:**
12 项 NFR 覆盖如下：
- 性能：已定义编辑与 AI 流式关键性能策略（防抖、流式首字、长文档响应）
- 安全：BYOK 不落库、RLS 强隔离、服务端鉴权门禁
- 可扩展：Vercel + Supabase 模式下的扩容与降级策略
- 可访问性：WCAG 2.1 AA 作为交付基线

### Implementation Readiness Validation ✅

**Decision Completeness:**
关键决策已明确并有可执行落点，技术基线和约束可直接用于实现指导。

**Structure Completeness:**
目录树、边界、映射与集成点已完整定义，覆盖实现阶段主要路径。

**Pattern Completeness:**
已定义常见冲突场景下的统一规则与反例，足以避免多代理并行开发中的风格漂移和集成冲突。

### Gap Analysis Results

**Critical Gaps:** 无。

**Important Gaps:**
- 需在实施阶段补充“模型兼容矩阵”的可观测字段规范（用于更快定位 provider/模型组合问题）。
- 建议将“错误分类码字典”固化为共享常量，进一步降低前后端恢复逻辑偏差。

**Nice-to-Have Gaps:**
- 增加自动化架构约束检查（例如 API 响应 shape lint 规则）。
- 增加示例级实现模板（story 级脚手架）以进一步提升多代理一致性。

### Validation Issues Addressed

- 已消除“starter 决策与 brownfield 现实不一致”风险：明确 starter 作为基线参考与新模块起手规范，而非重建当前仓库。
- 已补全“要求到结构映射”中跨层依赖描述，避免实现阶段职责重叠。

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**✅ Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** high based on validation results

**Key Strengths:**
- 与现有仓库高度对齐，迁移成本低且可立即执行
- 多代理冲突面已前置约束，降低实现分叉风险
- 安全与可靠性主轴（BYOK + 恢复优先）定义清晰

**Areas for Future Enhancement:**
- 增强错误分类与恢复策略的标准化 SDK 化能力
- 补充自动化测试与质量门禁以承接后续扩展复杂度

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions

**First Implementation Priority:**
以“模型兼容与失败恢复主链路”为首个实施故事，优先固化错误分类、恢复动作与可观测字段，再扩展功能面。
