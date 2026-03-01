# API Contracts

## 概览

- API 路由总数：24
- AI 路由：23（`src/app/api/ai/**/route.ts`）
- Auth 路由：1（`src/app/api/auth/callback/route.ts`）

## 主要 AI 端点分组

### 写作与改写

- `POST /api/ai/write`
- `POST /api/ai/rewrite`
- `POST /api/ai/expand`
- `POST /api/ai/shrink`
- `POST /api/ai/tone-shift`
- `POST /api/ai/first-draft`

### 创意与分析

- `POST /api/ai/brainstorm`
- `POST /api/ai/scene-plan`
- `POST /api/ai/twist`
- `POST /api/ai/describe`
- `POST /api/ai/saliency`
- `POST /api/ai/continuity-check`
- `POST /api/ai/failure-analysis`
- `POST /api/ai/support-runbook`

### 交互与工具

- `POST /api/ai/chat`
- `POST /api/ai/muse`
- `POST /api/ai/plugin`
- `POST /api/ai/feedback`
- `POST /api/ai/canvas-generate`
- `POST /api/ai/visualize`
- `POST /api/ai/quick-edit`
- `GET/POST /api/ai/models`（以实现为准）
- `POST /api/ai/test-connection`

### 认证

- `GET /api/auth/callback`

## 通用约束

- 统一使用 `NextRequest` 与结构化 JSON 响应。
- 鉴权依赖 Supabase 服务端客户端（`createClient()`）。
- 错误信息对外为安全中文提示，避免泄露内部细节。

## 证据路径

- `src/app/api/ai/**/route.ts`
- `src/app/api/auth/callback/route.ts`
- `src/app/api/ai/**/*.test.ts`
