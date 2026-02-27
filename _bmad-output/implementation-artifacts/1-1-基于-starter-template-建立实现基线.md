# Story 1.1: 基于 Starter Template 建立实现基线

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 开发团队成员,
I want 基于官方 create-next-app 基线建立并校验项目初始化规范,
so that 后续功能故事在一致的工程基线下可稳定实现。

## Acceptance Criteria

1. Given 架构文档已指定 starter template 约束，When 团队按既定命令完成基线校验并确认核心配置（TypeScript、Tailwind、App Router、`@/*` 别名），Then 项目基线与当前仓库架构约束保持一致可用于后续故事实现。
2. Given Story 1.1 聚焦实现基线，When 执行本故事，Then 仅建立并验证基线规范，不提前创建与后续故事无关的实体或业务功能。
3. Given 现有仓库是 brownfield，When 落地基线约束，Then 与既有约定保持一致：`proxy.ts`（非 `middleware.ts`）、Server Action 鉴权门禁、BYOK 仅走 `X-AI-*` 请求头且不落库不入日志。

## Tasks / Subtasks

- [x] 校验并固化 Starter Baseline（AC: 1）
  - [x] 使用架构文档中的标准初始化命令作为基线参照：`npm create next-app@latest writeteam-foundation --yes --ts --tailwind --eslint --app --src-dir --import-alias "@/*"`
  - [x] 对照当前仓库核验关键基线：TypeScript strict、Tailwind v4、App Router、`@/*` 别名
  - [x] 核验 Node 运行时与框架版本约束（Next.js 16 / React 19 / Tailwind v4 / Supabase JS v2 + SSR）
- [x] 对齐仓库结构与实现约束（AC: 1, 3）
  - [x] 保持路由分组结构：`(auth)` / `(dashboard)` / `(editor)`
  - [x] 保持 AI 路由与 Server Actions 目录规范：`src/app/api/ai/*/route.ts`、`src/app/actions/*.ts`
  - [x] 保持 Supabase 客户端运行时分离：`lib/supabase/server.ts` 与 `lib/supabase/client.ts`
- [x] 建立安全与鉴权底线（AC: 3）
  - [x] 所有 Route Handlers / Server Actions 执行 `supabase.auth.getUser()` 门禁
  - [x] BYOK API Key 只经 `X-AI-API-Key` 头传输，不持久化、不写入日志/遥测
  - [x] 所有数据访问继续遵循 RLS 与 `user_id = auth.uid()` 约束
- [x] 保持故事范围收敛（AC: 2）
  - [x] 不新增与后续故事相关的业务实体、页面、表结构或额外功能
  - [x] 仅输出可供 dev-story 直接执行的实现基线指导与校验清单

## Dev Notes

- 本故事是 Epic 1 的第一个故事，目标是给后续实现提供统一起点，而非重建现有仓库。
- create-next-app 命令在本项目语境中是基线参照，不是替换当前代码库。
- Next.js 16 升级重点：请求相关参数异步化（`params` 等需 `await`），开发默认 Turbopack，构建链路不再默认执行 lint。
- Tailwind v4 采用 `@tailwindcss/postcss` 与 `@import "tailwindcss"` 新配置范式。

### Project Structure Notes

- 保持当前统一结构：应用代码仅位于 `writeteam/src/*`，BMAD 产物位于 `_bmad-output/*`。
- API 与动作分层：AI 能力由 `app/api/ai/*` 提供，业务数据变更由 `app/actions/*` 处理。
- 明确禁止创建 `middleware.ts`；Next.js 16 统一使用 `src/proxy.ts`。

### Developer Context Section

#### Technical Requirements

- 必须保持 TypeScript strict 与 `@/*` 导入别名约束。
- 必须遵循 AI 固定调用链：`auth -> resolveAIConfig -> fetchStoryContext -> buildStoryPromptContext -> createOpenAIStreamResponse`。
- BYOK Key 必须客户端持有，服务端只读请求头，不存储明文密钥。

#### Architecture Compliance

- 与 ADR 一致：Next.js App Router + React 19 + Supabase + Tailwind v4。
- 认证与权限一致性：`proxy.ts` 会话刷新 + Route/Action 显式鉴权 + RLS。
- 错误语义一致性：非流式接口返回 JSON 错误包络，流式成功返回文本流。

#### Library / Framework Requirements

- Next.js: 16.1.6（稳定线）
- React: 19.x（当前稳定线）
- Tailwind CSS: v4.2（当前稳定线）
- Supabase: `@supabase/supabase-js` v2 + `@supabase/ssr` v0.8.x

#### File Structure Requirements

- 新增/调整代码必须遵守 kebab-case 文件命名与既有目录归属。
- 认证页面放在 `(auth)`；受保护页面放在 `(dashboard)`/`(editor)` 并受布局门禁。
- AI 路由统一使用 `route.ts`，Server Actions 使用 `"use server"`。

#### Testing Requirements

- 基线验证至少执行：`npm run lint`、`npm run build`。
- 如引入测试，按项目约定优先 Vitest，并采用源文件同目录 `*.test.ts(x)`。
- 校验重点：不破坏现有路由、认证、BYOK 头传递与 AI 管线一致性。

### Latest Tech Information

- Next.js 16 当前稳定线为 16.1.6，Node.js 需 >= 20.9，升级应关注 Async Request APIs（`params` 等异步化）。
- React 19 当前稳定线 19.x，升级时需同步检查类型定义与生态兼容。
- Tailwind CSS v4 使用 `@tailwindcss/postcss` 与 CSS-first 配置方式。
- Supabase SSR 推荐 `@supabase/ssr` 客户端分离模式，服务端鉴权建议使用 `getUser()/getClaims()` 语义路径。

### Project Context Reference

- 本故事遵循项目上下文约束：中文用户可见文案、TypeScript strict、BYOK 安全红线、RLS 权限隔离、Next.js 16 `proxy.ts` 约定。
- 若与旧约定冲突，以 `project-context.md` 与 `architecture.md` 的明确规则为准。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1 / Story 1.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Starter Template Evaluation]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/prd.md#Functional Requirements]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design Direction Decision]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: https://nextjs.org/docs]
- [Source: https://nextjs.org/docs/app/guides/upgrading/version-16]
- [Source: https://react.dev/blog/2024/12/05/react-19]
- [Source: https://tailwindcss.com/docs/upgrade-guide]
- [Source: https://supabase.com/docs/guides/auth/server-side/nextjs]

## Dev Agent Record

### Agent Model Used

openai/gpt-5.3-codex

### Debug Log References

- 校验命令：`node -e`（README 基线约束检查，先失败后修复通过）
- 质量门禁：`npm run lint`（0 error, 2 warning），`npm run build`（通过）

### Implementation Plan

- 以故事任务为唯一边界，先做基线事实核验（配置、结构、安全）再回填执行清单。
- 通过最小改动修正基线偏差：README 中去除 `OPENAI_API_KEY` 与 `middleware.ts` 旧约定。
- 输出独立实施清单文件，作为后续故事执行时的统一基线参考。

### Completion Notes List

- 完成 Story 1.1 全部任务：基线校验、结构约束校验、安全红线校验、范围收敛校验。
- 新增 `_bmad-output/implementation-artifacts/1-1-starter-baseline-checklist.md` 作为实现基线指导与校验清单。
- 更新 `writeteam/README.md` 以对齐 BYOK 与 `proxy.ts` 基线要求。
- 运行验证：`npm run lint`（仅现存 2 条 no-img-element 警告，无错误）与 `npm run build`（通过）。
- 当前无测试框架与现有测试集，未新增业务逻辑代码，因此本次无新增单测/集成/E2E 用例。

### File List

- _bmad-output/implementation-artifacts/1-1-基于-starter-template-建立实现基线.md
- _bmad-output/implementation-artifacts/1-1-starter-baseline-checklist.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/project-context.md
- writeteam/README.md
- writeteam/pnpm-lock.yaml (deleted — stale lockfile, project uses npm)
- writeteam/src/app/api/ai/brainstorm/route.ts
- writeteam/src/app/api/ai/chat/route.ts
- writeteam/src/app/api/ai/continuity-check/route.ts
- writeteam/src/app/api/ai/describe/route.ts
- writeteam/src/app/api/ai/expand/route.ts
- writeteam/src/app/api/ai/first-draft/route.ts
- writeteam/src/app/api/ai/models/route.ts
- writeteam/src/app/api/ai/plugin/route.ts
- writeteam/src/app/api/ai/quick-edit/route.ts
- writeteam/src/app/api/ai/rewrite/route.ts
- writeteam/src/app/api/ai/scene-plan/route.ts
- writeteam/src/app/api/ai/shrink/route.ts
- writeteam/src/app/api/ai/test-connection/route.ts
- writeteam/src/app/api/ai/tone-shift/route.ts
- writeteam/src/app/api/ai/twist/route.ts
- writeteam/src/app/api/ai/visualize/route.ts
- writeteam/src/app/api/ai/write/route.ts

## Senior Developer Review (AI)

### Review Date: 2026-02-27
### Reviewer: claude-opus-4-6

### Findings Summary

| Severity | Count | Fixed |
|----------|-------|-------|
| HIGH     | 2     | 1/2   |
| MEDIUM   | 2     | 2/2   |
| LOW      | 2     | 0/2   |

### Fixed Issues

**H2 — AI 路由 401 错误消息不一致（已修复）**
- 17/21 AI routes 使用 `"未授权访问"` 而非 project-context.md 标准 `"未登录"`
- 已将全部 21 个 AI routes 统一为 `"未登录"`

**M1 — 双重包管理器锁文件（已修复）**
- 删除 `pnpm-lock.yaml`（项目使用 npm，非 pnpm）
- 更新 `project-context.md` 包管理器描述从 `pnpm` 改为 `npm`

**M2 — 工作区隔离（已标记）**
- Story 1-2 的 8 个文件变更与 Story 1-1 混在同一工作区
- 建议：提交 Story 1-1 变更后再继续 Story 1-2 开发

### Unfixed Issues (Action Required)

**H1 — Story 1-1 未创建 git commit（需手动处理）**
- Story 1-1 完成后应先提交，再开始 Story 1-2
- 建议在本次审查修复后统一提交 Story 1-1 全部变更

**L1 — 基线清单验证描述泛化** — 建议后续校验注明具体文件和行号

**L2 — `lib/supabase/middleware.ts` 命名** — 预存问题，不影响功能

### Build Verification

- `npm run lint`: 0 errors, 2 warnings (pre-existing no-img-element)
- `npm run build`: passed

## Change Log

- 2026-02-27: 完成 Story 1.1 实现基线落地与校验，补充基线清单文档并修正 README 基线约束表述，故事状态更新为 review。
- 2026-02-27: [Code Review] 统一 21 个 AI 路由 401 错误消息为 "未登录"，删除多余 pnpm-lock.yaml，更新 project-context.md 包管理器描述。Build + Lint 通过。
