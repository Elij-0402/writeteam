# WriteTeam 项目概览

> 生成日期：2026-03-01 | 扫描级别：Deep Scan | 工作流版本：1.2.0

## 项目简介

WriteTeam 是一款面向中文小说作者的 AI 创意写作助手，灵感来源于 Sudowrite。它提供富文本编辑器、AI 驱动的写作工具、故事世界管理和多供应商 LLM 支持。

## 技术栈总览

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 框架 | Next.js (App Router) | 16.1.6 | React 全栈框架 |
| UI 库 | React | 19.2.3 | 前端渲染引擎 |
| 语言 | TypeScript | ^5 | 类型安全 |
| 样式 | Tailwind CSS v4 + shadcn/ui (new-york) | ^4 | 原子化 CSS + 组件库 |
| 组件原语 | Radix UI | ^1.4.3 | 无障碍组件基础 |
| 图标 | Lucide React | ^0.575.0 | 图标库 |
| 数据库 | Supabase (Postgres + Auth + RLS) | ^2.97.0 | BaaS 后端 |
| 编辑器 | TipTap | ^3.20.0 | 富文本编辑器 (StarterKit + CharacterCount + Highlight + Typography + Placeholder) |
| AI | BYOK via OpenAI-compatible API | ai ^6.0.100 | 用户自带 API Key |
| 画布 | @xyflow/react | ^12.10.1 | 可视化故事规划 |
| 导入 | mammoth | ^1.11.0 | DOCX 导入 |
| 导出 | docx + file-saver | ^9.6.0 / ^2.0.5 | DOCX 导出 |
| 表单 | react-hook-form + zod | ^7.71.2 / ^4.3.6 | 表单验证 |
| 命令面板 | cmdk | ^1.1.1 | Cmd+K 命令面板 |
| 面板布局 | react-resizable-panels | ^4.6.5 | 可调整大小面板 |
| 通知 | sonner | ^2.0.7 | Toast 通知 |
| 主题 | next-themes | ^0.4.6 | 暗色/亮色模式 |
| 日期 | date-fns | ^4.1.0 | 日期格式化 (zhCN) |
| 测试 | Vitest + Node.js test runner | ^3.2.4 | 单元/契约测试 |
| Lint | ESLint + eslint-config-next | ^9 | 代码质量 |

## 架构类型

- **仓库类型**: Monolith（根 `package.json` 委托到 `writeteam/` 子目录）
- **架构模式**: Next.js App Router 分层架构（Server Components + Server Actions + Route Handlers）
- **认证**: Supabase Auth (Email/Password + OAuth)，Proxy 中间件刷新会话
- **AI 架构**: BYOK (Bring Your Own Key)，客户端 localStorage 存储配置，通过 HTTP Headers 传递到服务端
- **数据层**: Supabase Postgres + Row Level Security，所有表强制 `user_id = auth.uid()`

## 仓库结构

```
writeteam/                    # 项目根目录
├── package.json              # 根 package.json（委托到 writeteam/）
├── CLAUDE.md                 # AI 助手指令
├── _bmad/                    # BMAD 方法论工作流模板（非应用代码）
├── _bmad-output/             # BMAD 输出产物
├── docs/                     # 项目文档（本目录）
└── writeteam/                # 应用源码目录
    ├── package.json          # 应用依赖
    ├── next.config.ts        # Next.js 配置
    ├── tsconfig.json         # TypeScript 配置（@/* → src/*）
    ├── vitest.config.ts      # Vitest 测试配置
    ├── components.json       # shadcn/ui 配置
    ├── src/                  # 源代码
    ├── supabase/             # Supabase 迁移
    ├── tests/                # 契约测试
    ├── scripts/              # 构建/测试脚本
    └── public/               # 静态资源
```

## 核心功能

1. **富文本编辑器** — TipTap 编辑器，支持格式化工具栏、自动保存（1s 防抖）、字数统计
2. **22+ AI 写作工具** — 续写、改写、扩展、缩减、描写、头脑风暴、初稿生成、场景规划、情节转折、语气转换、快速编辑、连续性检查、AI 对话、灵感伙伴、可视化等
3. **故事圣经系统** — 完整的世界观管理（角色、设定、大纲、风格、AI 可见性控制）
4. **BYOK AI 配置** — 支持 DeepSeek、OpenAI、Ollama、OpenRouter、硅基流动等供应商
5. **画布可视化** — ReactFlow 画布，支持故事节拍/场景/角色/地点节点，AI 生成节拍
6. **剧集管理** — 系列级别的项目组织和共享世界观
7. **插件系统** — 用户自定义 AI 插件，支持模板变量
8. **导入/导出** — 支持 TXT 和 DOCX 格式
9. **AI 故障恢复** — 错误分类、重试、模型切换、故障分析仪表板、支持运维手册
10. **命令面板** — Cmd+K 快速导航和操作

## 相关文档

- [架构文档](./architecture.md)
- [源码树分析](./source-tree-analysis.md)
- [组件清单](./component-inventory.md)
- [API 接口文档](./api-contracts.md)
- [数据模型](./data-models.md)
- [开发指南](./development-guide.md)
