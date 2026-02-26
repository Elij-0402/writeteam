# WriteTeam 专属工作流

## 目的

WriteTeam 特有的开发场景工作流，覆盖新 AI 功能、Story Bible 扩展、新 Prose Mode 和新组件的标准化开发流程。

---

## 场景一：新增 AI 写作功能

### 涉及角色
AI 写作专家, 架构师, 后端开发, 前端开发

### 步骤

1. **AI 写作专家** 定义功能规格：
   - 新 AIFeature type 名称
   - System prompt 和 User prompt 模板
   - Story Bible 哪些字段需要注入
   - 所属特性组（WRITING / PLANNING / CHECK）

2. **架构师** 确认技术方案：
   - 是否需要新的 API 路由（`src/app/api/ai/<feature>/route.ts`）
   - 是否需要扩展 `story-context.ts` 的 builder 函数

3. **后端开发** 实现：
   - 在 `story-context.ts` 添加新 AIFeature type
   - 更新特性组常量（如需要）
   - 创建 API 路由（遵循标准模式）
   - 确保遥测记录到 ai_history

4. **前端开发** 实现：
   - 在 AI 工具栏添加新功能入口
   - 实现前端调用和结果展示
   - 流式响应的 UI 处理

### 检查点
- `AIFeature` 类型已更新
- 特性组归类正确
- API 路由遵循标准模式
- 前端 UI 集成完毕

---

## 场景二：扩展 Story Bible

### 涉及角色
AI 写作专家, 架构师, 后端开发, 前端开发

### 步骤

1. **AI 写作专家** 定义新字段：
   - 字段名和类型
   - 该字段如何注入到 AI prompt
   - 哪些 feature 需要使用该字段

2. **架构师** 设计数据变更：
   - SQL 迁移：`ALTER TABLE story_bibles ADD COLUMN ...`
   - 更新 `database.ts` 类型定义
   - 更新 `StoryBibleData` 接口

3. **后端开发** 实现：
   - 在 `story-context.ts` 添加新的 builder 函数
   - 在 `buildStoryPromptContext()` 中集成
   - 更新 `fetchStoryContext()` 的数据映射
   - 更新相关 server actions

4. **前端开发** 实现：
   - 在 Story Bible 面板添加新字段的编辑 UI
   - 确保保存和加载正确

### 检查点
- DB 迁移文件已创建
- TypeScript 类型已更新
- Builder 函数已添加
- 前端 UI 已集成

---

## 场景三：新增 Prose Mode

### 涉及角色
AI 写作专家, 后端开发, 前端开发

### 步骤

1. **AI 写作专家** 定义新模式：
   - 模式名称（英文 kebab-case）
   - 指导文本（遵循现有格式）
   - 适用场景说明

2. **后端开发** 实现：
   - 在 `prose-mode.ts` 的 `ProseMode` 类型添加新值
   - 在 `PROSE_MODE_GUIDANCE` 添加对应指导文本

3. **前端开发** 实现：
   - 在 Prose Mode 选择器中添加新选项
   - 确保中文标签和描述

### 检查点
- `ProseMode` 类型已更新
- `PROSE_MODE_GUIDANCE` 已更新
- 前端选择器已更新

---

## 场景四：新增编辑器组件

### 涉及角色
UX 设计师, 前端开发, 中文语言专家

### 步骤

1. **UX 设计师** 输出设计方案：
   - 组件用途和交互说明
   - 在编辑器中的位置
   - 响应式行为

2. **前端开发** 实现：
   - 创建组件文件（`src/components/editor/` 或 `src/components/ai/`）
   - 遵循 kebab-case 文件名、named export
   - 集成到 `editor-shell.tsx`

3. **中文语言专家** 审查：
   - 组件中的中文文案
   - Tooltip、placeholder 等文本

### 检查点
- 组件遵循项目命名约定
- 已集成到编辑器
- 中文文案审查通过

---

## 通用注意事项

- 所有场景完成后都需要通过 QA 工程师的质量门（lint + build）
- 新增 UI 文案必须使用中文
- 新增文件遵循 `AGENTS.md` 中的命名和代码规范
