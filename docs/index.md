# WriteTeam — 项目文档索引

> 生成日期: 2026-02-27 | 扫描级别: Exhaustive | 工作流版本: 1.2.0

## 项目概览

- **类型:** Monolith (Next.js 全栈单体应用)
- **主语言:** TypeScript
- **框架:** Next.js 16 (App Router) + React 19
- **数据库:** Supabase (Postgres + Auth + RLS)
- **AI 架构:** BYOK (Bring Your Own Key) — 多 Provider 兼容
- **UI:** shadcn/ui (new-york) + Tailwind CSS v4 + TipTap 编辑器

## 快速参考

- **技术栈:** Next.js 16, React 19, TypeScript, Supabase, TipTap, @xyflow/react
- **入口点:** `src/proxy.ts` (请求代理), `src/app/layout.tsx` (根布局)
- **架构模式:** App Router 全栈 + Server Actions + BYOK AI Streaming
- **数据库:** 12 张表, 10 个迁移, 全表 RLS
- **API:** 22 个端点 (21 AI + 1 Auth)
- **组件:** 55 个文件 (27 UI 原语 + 28 功能组件)

## 生成的文档

### 核心文档

- [项目概览](./project-overview.md) — 项目简介、技术栈总览、核心功能模块
- [架构文档](./architecture.md) — 系统架构、请求生命周期、AI 管道、Provider 链、安全架构
- [源码树分析](./source-tree-analysis.md) — 完整目录结构、关键入口点、目录说明

### 实现细节

- [组件清单](./component-inventory.md) — 55 个组件分类、Props、状态、AI 集成点
- [API 合约](./api-contracts.md) — 22 个 API 端点详细规格、参数、配置
- [数据模型](./data-models.md) — 12 张表完整 schema、RLS 策略、迁移历史、ER 关系

### 开发指南

- [开发指南](./development-guide.md) — 环境搭建、常见任务、代码约定、部署

## 现有文档

- [README.md](../writeteam/README.md) — 原始项目 README (英文, 基础设置说明)
- [CLAUDE.md](../CLAUDE.md) — AI 助手指令文件 (项目架构详述)

## 快速开始

### 本地开发

```bash
git clone <repo-url>
cd writeteam
npm install

# 配置环境变量
cd writeteam
cp .env.local.example .env.local
# 编辑 .env.local 添加 Supabase URL 和 Key

# 执行数据库迁移 (在 Supabase SQL Editor 或 CLI)
# 按顺序执行 supabase/migrations/001-010

# 启动开发服务器
npm run dev
# 打开 http://localhost:3000
```

### AI 功能配置

1. 打开应用 → 设置页面
2. 选择 Provider 预设 (DeepSeek/OpenAI/Ollama/OpenRouter/硅基流动)
3. 输入 API Key 和模型 ID
4. 测试连接 → 保存

### 验证

```bash
npm run lint    # ESLint
npm run build   # 生产构建
```

## AI 辅助开发指南

本文档集专为 AI 辅助开发优化:

1. **理解现有系统**: 从 [项目概览](./project-overview.md) 和 [架构文档](./architecture.md) 开始
2. **添加新功能**: 参考 [开发指南](./development-guide.md) 的「常见开发任务」章节
3. **理解数据流**: 查看 [架构文档](./architecture.md) 的「AI 请求管道」章节
4. **数据库扩展**: 查看 [数据模型](./data-models.md) 的表结构和迁移历史
5. **API 集成**: 查看 [API 合约](./api-contracts.md) 的端点规格
6. **UI 开发**: 查看 [组件清单](./component-inventory.md) 的组件分类和接口

## 文档状态

| 文档 | 状态 | 说明 |
|------|------|------|
| project-overview.md | ✅ 完成 | — |
| architecture.md | ✅ 完成 | — |
| source-tree-analysis.md | ✅ 完成 | — |
| component-inventory.md | ✅ 完成 | — |
| api-contracts.md | ✅ 完成 | — |
| data-models.md | ✅ 完成 | — |
| development-guide.md | ✅ 完成 | — |
| index.md | ✅ 完成 | 本文件 |
