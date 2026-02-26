# Phase 3: 架构设计

## 目的

将规划转化为具体的技术设计：数据模型、API 设计、组件架构和 Story 分解。

## 涉及角色

- **架构师** — 主导技术设计
- **后端开发** — API 和数据层细节
- **前端开发** — 组件架构细节
- **AI 写作专家** — AI 管线设计（如适用）

## 步骤

### 1. 数据模型设计

架构师输出：
- 新表/字段的 SQL 定义
- RLS 策略（按 user_id 过滤）
- 迁移文件（`writeteam/supabase/migrations/`）
- 类型定义更新（`writeteam/src/types/database.ts`）

### 2. API 设计

后端开发确认：
- 路由结构（遵循 `src/app/api/ai/*/route.ts` 模式）
- 请求/响应格式
- 错误处理（中文错误消息）
- 是否需要新的 server actions

### 3. 组件架构

前端开发确认：
- 组件树和层级关系
- Props 接口定义
- 状态管理方案
- 与现有组件的集成点

### 4. AI 管线设计（如适用）

AI 写作专家确认：
- 新 AIFeature type
- System prompt 和 User prompt 模板
- Story Context 字段使用方案
- Prose Mode 影响

### 5. Story 分解

架构师将整个功能分解为可独立开发的 Stories：
- 每个 Story 有明确的范围和依赖
- 标注 Story 之间的依赖关系
- 估算并行度

## 产出物

- 数据模型设计文档
- API 设计文档
- 组件架构图
- Story 列表（含依赖关系）

## 完成标准

- [ ] 数据模型包含 RLS 策略
- [ ] API 遵循现有路由模式
- [ ] 组件架构遵循项目命名约定
- [ ] Stories 可独立开发、有明确依赖
