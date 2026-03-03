# WriteTeam 架构精简与演进设计

> 日期：2026-03-04
> 状态：已批准
> 定位：个人工具，AI 写作 + 人类导演

## 一、诊断总结

| 维度 | 现状 | 问题 | 严重度 |
|------|------|------|--------|
| AI 端点 | 22 个独立路由 | 大量重复代码（认证/配置/流处理），维护成本高 | 高 |
| 一致性系统 | 5 个模块，3 层抽象 | 企业级设计密度，个人工具场景不需要 | 中 |
| 上下文编排 | ~700 行，17 特性分化 | 认知复杂度过高，特性间差异实际很小 | 高 |
| 交互模式 | 工具箱（用户手选工具） | 不符合「导演模式」定位，2023 年范式 | 高 |
| 知识管理 | 静态 Story Bible | 缺少 AI 自适应学习，每次从零理解用户偏好 | 中 |

### 行业对标

- **Sudowrite**（行业标杆）：Story Bible 自动更新、创意滑块、Guided vs Auto 模式、专有微调模型
- **Claude Code Skills**：渐进式披露（元数据 → 指令 → 资源），声明式能力定义
- **Claude Code Auto Memory**：三层记忆（全局/项目/动态），200 行索引限制，自动学习模式

## 二、设计方案

### 阶段 1：端点合并与一致性精简（立即可做）

#### 1a. AI 端点合并 22 → 5+3

| 新端点 | 合并来源 | intent 参数值 |
|--------|---------|--------------|
| `/api/ai/write` | write, first-draft, expand, describe | `"write"`, `"first-draft"`, `"expand"`, `"describe"` |
| `/api/ai/edit` | quick-edit, rewrite, shrink, tone-shift | `"quick-edit"`, `"rewrite"`, `"shrink"`, `"tone-shift"` |
| `/api/ai/check` | continuity-check, feedback, saliency | `"continuity-check"`, `"feedback"`, `"saliency"` |
| `/api/ai/chat` | chat, brainstorm, twist, muse, bible-assist | `"chat"`, `"brainstorm"`, `"twist"`, `"muse"`, `"bible-assist"` |
| `/api/ai/plan` | scene-plan, canvas-generate, visualize | `"scene-plan"`, `"canvas-generate"`, `"visualize"` |

保留独立：`models`（配置）、`test-connection`（配置）、`plugin`（扩展）

实现方式：每个合并端点接收 `intent` 参数，内部路由到对应 prompt 模板。5 步管道（认证 → 配置 → 上下文 → 编排 → 流式）复用一次。

预期：22 个路由文件 → 8 个，代码量减少约 60%。

#### 1b. 一致性系统 5 → 2 文件

| 操作 | 文件 | 原因 |
|------|------|------|
| 删除 | `consistency-extractor.ts` | 置信度标记在个人工具场景下无消费者 |
| 删除 | `consistency-metrics.ts` | 冲突率计算对个人用户无意义 |
| 合并 | `consistency-types.ts` + `consistency-flags.ts` → `consistency.ts` | 类型和开关放一起即可 |
| 简化 | `consistency-preflight.ts` | 去掉结构化提取，直接传 Story Bible 原始文本给 AI |

#### 1c. 上下文编排简化

`story-context.ts` 从 ~700 行精简到 ~200 行：

- **3 个上下文层级**替代 17 种特性分化：
  - `"full"` — 完整上下文（write、edit 类操作）
  - `"summary"` — 精简上下文（chat、plan 类操作）
  - `"minimal"` — 最小上下文（check 等轻量操作）
- **Prompt 模板集中**到 `src/lib/ai/prompts.ts`，每个 intent 一个模板
- 上下文构建函数统一为 `buildContext(contextLevel)`

### 阶段 2：能力模板系统（中期）

借鉴 Claude Code Skills 的声明式定义 + 渐进式披露模式。

#### 2a. 能力模板结构

```ts
// src/lib/ai/capabilities/expand.ts
export const expandCapability: AICapability = {
  name: 'expand',
  displayName: '扩写',
  description: '扩展选中文本，增加描写细节和感官体验',
  category: 'edit',           // → 路由到 /api/ai/edit
  contextLevel: 'full',       // full | summary | minimal
  promptTemplate: `你是一位经验丰富的小说编辑。用户选中了一段文本，需要你...`,
  uiHint: 'toolbar-button',   // toolbar-button | menu-item | chat-command
}
```

#### 2b. 能力注册表

```ts
// src/lib/ai/capabilities/registry.ts
import { expandCapability } from './expand'
import { rewriteCapability } from './rewrite'
// ...

export const capabilities = [
  expandCapability,
  rewriteCapability,
  shrinkCapability,
  // ...
] as const

export function getCapability(name: string) {
  return capabilities.find(c => c.name === name)
}

export function getCapabilitiesByCategory(category: string) {
  return capabilities.filter(c => c.category === category)
}
```

#### 2c. 收益

- 新增 AI 能力 = 新增模板文件 + 注册，零路由代码变更
- 模板未来可存储在数据库 → 用户自定义 AI 能力
- UI 层根据 `uiHint` 自动生成按钮/菜单项

### 阶段 3：写作记忆系统（远期）

借鉴 Claude Code Auto Memory 的自动学习 + 200 条限制 + 语义组织模式。

#### 3a. 数据模型

`story_bibles` 表新增 `ai_memory` JSONB 字段：

```json
{
  "style_preferences": [
    {
      "pattern": "用户倾向短句，平均 15 字以内",
      "confidence": 0.8,
      "learned_at": "2026-03-04T10:00:00Z",
      "source": "edit-diff-analysis"
    }
  ],
  "vocabulary_notes": [
    "避免使用'仿佛'，偏好'好像'",
    "对话中不加'他说道'等修饰标签"
  ],
  "max_entries": 200
}
```

#### 3b. 学习触发

当用户对 AI 生成的内容做大幅修改（diff 超过 30%）时：
1. 后台比较 AI 输出与用户最终版本
2. 提取修改模式（句子长度变化、词汇替换模式、结构调整）
3. 写入 `ai_memory`，附带置信度
4. 超过 200 条时，合并相似记忆、淘汰低置信度条目

#### 3c. 上下文注入

`buildContext()` 自动读取 `ai_memory`，注入 system prompt：

```
[写作偏好记忆]
- 用户倾向使用短句（置信度 80%）
- 对话场景不加修饰标签（置信度 60%）
- 避免使用"仿佛"，偏好"好像"
```

## 三、不做的事情

- **不做 Agent 架构重设计** — 渐进精简优先，Agent 方向留给未来评估
- **不做多模型路由** — BYOK 模式下用户自己选模型，不需要服务端路由
- **不做 Story Bible 自动更新** — 有价值但实现复杂，不在本轮范围
- **不新增 UI 组件** — 本轮是减法，不是加法
- **不做多代理角色模拟** — 学术前沿但工程复杂度过高

## 四、预期收益

| 指标 | 现状 | 阶段 1 后 | 全部完成后 |
|------|------|----------|-----------|
| AI 路由文件数 | 22 | 8 | 8 |
| 一致性模块数 | 5 | 2 | 2 |
| story-context.ts 行数 | ~700 | ~200 | ~200 |
| 新增 AI 能力成本 | 新建 route.ts + 重复管道 | 新建 route.ts | 新建模板文件 |
| AI 自适应学习 | 无 | 无 | 有（写作记忆） |
| 代码重复率 | 高（22 路由重复管道） | 低 | 极低 |

## 五、风险与缓解

| 风险 | 缓解 |
|------|------|
| 端点合并可能破坏前端调用 | 逐端点迁移，旧端点暂时保留为重定向 |
| 一致性简化可能丢失功能 | 确认哪些一致性功能实际被使用后再删 |
| 能力模板增加间接层 | 保持模板结构极简，避免过度抽象 |
| 写作记忆学习不准确 | 置信度机制 + 用户可查看/编辑记忆 |
