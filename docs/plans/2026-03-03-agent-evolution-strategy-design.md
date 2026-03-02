# WriteTeam Agent 演进战略设计

> 日期: 2026-03-03
> 状态: 已确认
> 范围: 产品战略 + 技术架构

## 核心结论

WriteTeam **不做自由 Agent（ReAct）**，做**智能工作流编排**。

理由：
1. 行业共识验证 — Sudowrite Story Engine 3.0、NovelCrafter、笔灵 AI 等全部竞品均采用结构化工作流，无一家使用 ReAct 自由循环
2. 写作场景需要可预测性和用户控制感，自由 Agent 的不确定行为会破坏创作信任
3. ReAct 循环 5-8 次 LLM 调用，结构化工作流只需 2-3 次，成本和延迟差距显著

## 市场定位

**中文市场的 Sudowrite** — 中文市场没有达到 Sudowrite/NovelCrafter 水平的产品。

当前中文市场现状：
- 笔灵 AI：最接近，但功能远不如 Sudowrite 精细
- 秘塔写作猫：偏通用文本，不专注小说
- 用户自行拼凑工具链（DeepSeek 写大纲 + Kimi 续写 + 文心润色）

WriteTeam 的差异化壁垒：**一致性三层防护**（preflight + 生成中约束 + 后检）— 竞品均无此能力。

## 现状评估

### WriteTeam 是什么

AI Copilot（副驾驶），不是 Agent。21 个 AI 端点，每个都是用户按按钮触发的单次调用。

### 已有优势

| 能力 | 现状 |
|------|------|
| AI 工具集 | 21 个端点，覆盖写作全流程 |
| Story Bible | 有，但结构扁平（纯文本字段） |
| 一致性检查 | 三层防护（独家优势） |
| 散文风格 | 5 种 + match-style |
| Canvas | @xyflow/react 基础 |
| 显著性感知 | saliency 检测 |
| BYOK | 5 个预设提供商 |

### 关键缺失

| 缺失 | 对标竞品 | 优先级 |
|------|---------|--------|
| Story Engine 全流程生成 | Sudowrite Story Engine 3.0 | P0 |
| 结构化 Codex 知识库 | NovelCrafter Codex | P0 |
| AI 自动注入相关 Codex 条目 | NovelCrafter 智能上下文 | P0 |
| 意图编排层（多工具串联） | 无竞品参考（超越点） | P1 |
| Canvas AI 智能关联 | Sudowrite Canvas 2.0 | P2 |
| 自定义 Prompt 模板库 | NovelCrafter | P2 |

## 技术架构决策

### SDK 选择

- 现有 21 个端点：保持 raw fetch + 手写 SSE（不动，零风险）
- 新增 Agent/编排端点：使用已安装的 Vercel AI SDK（`ai` v6 + `@ai-sdk/openai` v3）
- 选择理由：SDK 的 `streamText()` + `tools` + `maxSteps` 提供 Agent 基础设施，省去 ~1000 行自研代码

### 编排架构

```
用户输入（自然语言 / 按钮）
    │
    ▼
意图分类器（1 次轻量 LLM 调用或规则匹配）
    │
    ├─ 匹配已知工作流 → 结构化执行（快速、可预测）
    │   · 章节写作流
    │   · 润色流
    │   · 语调转换流
    │   · 一致性审查流
    │   · 灵感流
    │   · Story Bible 同步流
    │
    └─ 未匹配 → ReAct 兜底（Vercel AI SDK streamText + tools + maxSteps）
        · 仅处理跨章节/跨文档的复杂意图
```

## 三个建设优先级

### P0: Story Engine（结构化写作流）

对标 Sudowrite Story Engine 3.0，但嵌入 WriteTeam 独家的一致性检查。

用户流程：
1. 脑暴（Braindump）— 倾倒想法
2. 类型 + 风格 — 选择/生成
3. 角色 — 从 Codex 拉取或 AI 生成
4. 大纲 — AI 生成章节 Beat，用户调整
5. 逐章生成 — AI 写初稿，每章自动一致性检查
6. 用户审阅 — 接受/修改/重新生成

### P0: Codex 升级

从扁平 Story Bible 升级为结构化知识库：

```
Codex
├─ 角色（姓名/性格/关系图/弧线/约束/对话风格）
├─ 地点（描述/氛围/关联角色/出现章节）
├─ 物品（外观/功能/剧情意义）
├─ 时间线（事件/日期/因果链）
├─ 规则（硬规则/软规则/禁忌 — 已有 ai_rules 基础）
└─ 写作时 AI 自动拉取当前场景相关条目
```

### P1: 意图编排层

超越竞品的差异化功能 — 竞品的工具是割裂的，用户手动选择。WriteTeam 让用户用自然语言描述意图，系统自动串联多个工具。

示例：
- "让这段更有画面感，符合前面的氛围" → Describe(感官) + ToneShift(匹配) + ConsistencyCheck
- "润色这段并确保和第二章的伏笔吻合" → Rewrite + ConsistencyCheck(跨章)
- "我卡住了" → 分析当前位置 + Muse/Suggest

用户体验上感觉像 Agent，技术上是智能工作流编排。

## 能力分层模型

```
Level 4 · 全流程生成（Story Engine）
  用户给目标 + 设定，系统自动规划→生成→检查→迭代

Level 3 · 意图编排
  用户给复合意图，系统自动串联多个工具执行

Level 2 · 主动感知
  AI 监控写作，主动提示但不自动行动

Level 1 · 按钮式工具（当前位置）
  用户选中文字 → 选择功能 → AI 返回结果
```

每一层保留用户否决权。

## 竞品参考

### Sudowrite（英文 No.1）
- Story Engine 3.0：纯结构化工作流（braindump→genre→characters→outline→chapters）
- Canvas 2.0：空间画板 + AI Agent 读取卡片位置关系
- Muse 1.5：自研模型，在出版小说上 fine-tune
- 内置模型（Muse + Claude + GPT + DeepSeek），不需要用户配置
- 定价：$10-44/月含 AI 额度

### NovelCrafter（Power User 之选，157k 作者）
- Codex：结构化 Story Bible（角色/地点/物品/传说/支线），写作时自动拉取
- BYOK：300+ 模型 via OpenRouter（和 WriteTeam 相同架构）
- 自定义 Prompt 模板库
- 定价：$5-18/月 + 自付 API

### 中文竞品
- 笔灵 AI：网文全流程，最接近但远不如精细
- 秘塔写作猫：通用文本，不专注小说
- 笔神：素材匹配
- 无一家达到 Sudowrite/NovelCrafter 水平
