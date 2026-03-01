# 架构模式判定

## 主架构

- **模式**：分层式 Web 应用（UI / 路由与动作 / 共享库 / 数据迁移）。
- **路由组织**：Next.js route groups：`(auth)`、`(dashboard)`、`(editor)`。
- **后端入口**：
  - API：`src/app/api/**/route.ts`
  - Server Actions：`src/app/actions/*.ts`

## 关键架构特征

- **会话链路**：`src/proxy.ts` → `src/lib/supabase/middleware.ts`。
- **AI 管线**：`src/app/api/ai/*` + `src/lib/ai/*`。
- **数据演进**：`supabase/migrations/*.sql` 顺序迁移。
- **组件分层**：`src/components/ui`（基础）与 feature 组件目录并行。
