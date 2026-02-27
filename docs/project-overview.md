# WriteTeam — 项目概览

> 生成日期: 2026-02-27 | 项目类型: Web (全栈) | 仓库类型: Monolith

## 项目简介

WriteTeam 是一个面向中文小说作者的 AI 创意写作助手，灵感源自 Sudowrite。它提供富文本编辑器、AI 驱动的写作工具、故事世界管理和多 LLM Provider 支持（BYOK 模式）。

## 执行摘要

| 属性 | 值 |
|------|-----|
| **项目名称** | WriteTeam |
| **定位** | AI 辅助创意写作平台 |
| **目标用户** | 中文小说作者 |
| **语言** | 中文 (zh-CN) |
| **当前版本** | 0.1.0 |
| **仓库结构** | 根目录代理 + `writeteam/` 子目录（所有源码） |

## 技术栈总览

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **框架** | Next.js (App Router) | 16.1.6 | 全栈 Web 框架 |
| **前端** | React | 19.2.3 | UI 渲染引擎 |
| **语言** | TypeScript | 5.x | 类型安全 |
| **UI 库** | shadcn/ui (new-york) | latest | 设计系统 (27 个组件) |
| **CSS** | Tailwind CSS v4 | 4.x | 样式系统 |
| **图标** | Lucide React | 0.575.0 | 图标库 |
| **编辑器** | TipTap | 3.20.0 | 富文本编辑 |
| **数据库** | Supabase (Postgres) | 2.98.0 | 后端即服务 + Auth + RLS |
| **AI** | BYOK (OpenAI-compatible) | — | 多 Provider 流式 AI |
| **画布** | @xyflow/react | 12.10.1 | 可视化故事规划 |
| **导入/导出** | mammoth + docx + file-saver | — | DOCX/TXT 文件处理 |
| **表单** | react-hook-form + zod | 7.71.2 / 4.3.6 | 表单验证 |
| **主题** | next-themes | 0.4.6 | 暗色/亮色模式 |
| **通知** | sonner | 2.0.7 | Toast 通知 |

## 架构分类

- **架构模式**: Next.js App Router 全栈单体应用
- **渲染策略**: 混合 RSC (Server Components) + Client Components
- **认证方式**: Supabase Auth (Email/Password + OAuth)
- **AI 架构**: BYOK (Bring Your Own Key) — 用户自带 API Key，无服务端密钥
- **数据访问**: Server Actions + API Route Handlers
- **状态管理**: React Context (Auth, AI Config, Theme) + 组件级 useState

## 核心功能模块

### 1. 编辑器系统
- TipTap 富文本编辑器（StarterKit + 扩展）
- 自动保存（1 秒 debounce）
- 文字统计
- 文档导入/导出（TXT, DOCX）

### 2. AI 写作工具 (21 个 API endpoints)
- **写作工具**: Write, Rewrite, Expand, Shrink, Quick Edit, First Draft
- **规划工具**: Brainstorm, Scene Plan, Twist, Muse (灵感伙伴)
- **分析工具**: Continuity Check, Describe, Chat, Saliency
- **风格工具**: Tone Shift (6 种语气)
- **自定义**: Plugin 系统
- **视觉化**: Visualize (DALL-E 3 图像生成)
- **基础设施**: Models, Test Connection, Feedback

### 3. 故事世界管理
- Story Bible (故事圣经) — 14+ 个创作字段
- 角色管理 — 8 个角色属性字段
- 散文风格系统 — 5 种模式 (balanced, cinematic, lyrical, minimal, match-style)
- AI 可见性控制 — 按字段切换 AI 可见内容
- 系列支持 — 跨项目共享世界观

### 4. 可视化规划
- React Flow 画布
- 5 种节点类型（节拍、场景、角色、地点、笔记）
- AI 批量生成节拍节点

### 5. 客户端 Saliency 分析
- 无 AI 调用的启发式文本分析
- 实时识别活跃角色/地点
- 中文位置模式识别（正则 regex）

## 数据库概览

- **12 张表**: profiles, projects, documents, characters, story_bibles, ai_history, plugins, series, series_bibles, canvas_nodes, canvas_edges, images
- **10 个迁移**: 001-010
- **全表 RLS**: 所有表启用行级安全，强制 `user_id = auth.uid()`
- **21 个索引**, **44 条 RLS 策略**, **4 个 CHECK 约束**

## 文件统计

| 类别 | 数量 |
|------|------|
| **源码文件总数** | ~115 |
| **App 路由/Action 文件** | 43 |
| **组件文件** | 55 |
| **库/工具文件** | 17 |
| **API Routes** | 21 |
| **Server Actions** | 8 文件, 39 个导出函数 |
| **DB Migrations** | 10 |

## 相关文档

- [源码树分析](./source-tree-analysis.md)
- [架构文档](./architecture.md)
- [组件清单](./component-inventory.md)
- [开发指南](./development-guide.md)
- [API 合约](./api-contracts.md)
- [数据模型](./data-models.md)
- [文档索引](./index.md)
