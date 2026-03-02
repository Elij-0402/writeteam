# WriteTeam Documentation Index

**Type:** monolith  
**Primary Language:** TypeScript  
**Architecture:** Next.js App Router + Supabase  
**Last Updated:** 2026-03-01

## Project Overview

WriteTeam 是一个 zh-CN AI 创意写作应用，覆盖项目管理、编辑器、故事圣经、系列与画布能力，并提供多种 AI 写作与分析路由。

## Quick Reference

- **Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, Tailwind v4
- **Entry Point:** `src/app/layout.tsx` / `src/app/page.tsx`
- **Session Proxy:** `src/proxy.ts`
- **Architecture Pattern:** layered monolith

## Generated Documentation

- [Project Overview](./project-overview.md)
- [Architecture](./architecture.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Component Inventory](./component-inventory.md)
- [Development Guide](./development-guide.md)
- [Contribution Guide](./contribution-guide.md)
- [API Contracts](./api-contracts.md)
- [Data Models](./data-models.md)
- [Deployment Guide](./deployment-guide.md)

## Existing Documentation

- [README](../README.md) - 项目简介、运行方式与环境变量
- [AGENTS](../AGENTS.md) - 代码与测试工作约束

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase 项目

### Setup

```bash
npm install
npm run dev
```

### Quality Checks

```bash
npm run lint
npm run build
npm run test
```

## For AI-Assisted Development

- UI 需求优先参考：`architecture.md` + `component-inventory.md`
- API 需求优先参考：`api-contracts.md` + `data-models.md`
- 全栈需求优先参考：`project-overview.md` + `source-tree-analysis.md`
