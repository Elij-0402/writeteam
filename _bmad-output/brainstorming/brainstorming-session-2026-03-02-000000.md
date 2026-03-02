---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: '以 OpenCode 为底层脚手架，重构 WriteTeam 为其上层 Web 应用'
session_goals: '获得工具调用能力；利用成熟 Agent 基础设施；快速获得完善 LLM 环境；聚焦写作体验和 Web UI'
selected_approach: 'ai-recommended'
techniques_used: ['First Principles Thinking', 'Morphological Analysis', 'Reverse Brainstorming', 'Extended Ideation']
ideas_generated: 102
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** fafa
**Date:** 2026-03-02
**Total Ideas:** 102

## Session Overview

**Topic:** 以 OpenCode 为底层脚手架，重构 WriteTeam 为其上层 Web 应用

**Goals:**
1. 获得工具调用能力 — 当前架构最大缺失
2. 利用成熟的 Agent 基础设施 — 替代自维护的 21 个流式端点
3. 快速获得完善的 LLM 环境 — 多提供商、错误处理、LSP 等开箱即用
4. 聚焦核心价值 — 把精力放在写作体验和 Web UI 上

**战略定位:**
- **底座 = OpenCode** — 完整复用其基础设施
- **参考 = Claude Code** — 借鉴前沿理念和设计模式
- **产品 = WriteTeam** — 聚焦写作体验的 Web UI

---

## Technique 1: First Principles Thinking (50 ideas)

### 核心发现

WriteTeam 的 AI 层不只是"生成文字"，真正的核心使命是：
1. **工具调用能力** — 当前完全缺失
2. **创作记忆系统** — auto memory 的写作版
3. **Agent 化的专业分工** — 不同任务需要不同 Agent

### OpenCode 底座映射（#1-#15）

| # | 想法 | 来源 |
|---|---|---|
| 1 | WriteTeam 作为 OpenCode Server 的第六个客户端 | 客户端-服务器架构 |
| 2 | @opencode-ai/sdk 驱动的前端集成 | SDK |
| 3 | 写作 Agent 矩阵（writer/reviewer/editor/researcher） | Agent 系统 |
| 4 | @mention 子代理协作 | Agent 系统 |
| 5 | 自定义写作工具（consistency-check、character-tracker 等） | Tool 系统 |
| 6 | GrepTool + GlobTool 的创作应用 | Tool 系统 |
| 7 | TaskTool 嵌套会话 | Tool 系统 |
| 8 | 写作增强 Plugin（onBeforePrompt/onAfterPrompt hooks） | Plugin 系统 |
| 9 | 写作专用 MCP 服务器（知识库、图片生成等） | MCP |
| 10 | memory.md 索引 + 主题文件（characters/timeline/worldbuilding） | Memory 系统 |
| 11 | Compaction 策略处理长篇 token 超限 | Memory 系统 |
| 12 | 75+ 提供商开箱即用 | Provider 系统 |
| 13 | "写作语言服务器" — 悬浮角色档案、跳转首次出场 | LSP |
| 14 | SSE 事件驱动的实时写作体验 | HTTP API |
| 15 | Permission 系统 — AI 修改正文需确认 | Permission |

### Claude Code 理念借鉴（#16-#47）

| # | 想法 | 来源 |
|---|---|---|
| 16 | 写作 Skill 工具箱（/plot-analyze、/character-arc、/tension-map 等） | Skills |
| 17 | Skill 自动触发 + 上下文注入 | Skills |
| 18 | /batch 批量操作（全书改名、风格统一） | Skills |
| 19 | 专业写作 Agent 矩阵（增强版，含模型/权限/记忆配置） | Subagents |
| 20 | Agent 持久化记忆（memory: project），越用越聪明 | Subagents |
| 21 | Skills 预加载到 Subagent | Subagents |
| 22 | 场景多视角创作 Team | Agent Teams |
| 23 | 并行章节创作（git worktree 隔离） | Agent Teams |
| 24 | 竞争假设式剧情探索（5 Agent 辩论） | Agent Teams |
| 25 | PostToolUse Hook 自动记忆提取 | Hooks |
| 26 | PreToolUse Hook 写作安全门（伏笔保护） | Hooks |
| 27 | TaskCompleted Hook 质量门 | Hooks |
| 28 | 写作专用 MCP 服务器矩阵 | MCP |
| 29 | MCP 资源 @ 引用（@wiki:character://林晓月） | MCP |
| 30 | 写作插件分发（武侠/推理/言情套件） | Plugins |
| 31 | 写作检查点系统（自动快照 + /rewind） | Checkpointing |
| 32 | "如果…会怎样" 分支探索 | Checkpointing |
| 33 | Session Fork 平行世界分支 | Checkpointing |
| 34 | 只读大纲规划模式 | Plan Mode |
| 35 | Plan 审批机制（Agent 先出方案，用户审批） | Plan Mode |
| 36 | 深度剧情推演（Extended Thinking） | Extended Thinking |
| 37 | 批量自动化处理管道（-p headless） | Headless |
| 38 | JSON Schema 结构化输出 | Headless |
| 39 | 命名会话 + 跨天续写 | Session |
| 40 | 从"发布"恢复创作上下文 | Session |
| 41 | 多结局并行创作（worktree） | Worktree |
| 42 | Subagent Worktree 隔离 | Worktree |
| 43 | 创作中的 @ 知识引用 | @ Reference |
| 44 | AI 完成通知 | Notification |
| 45 | /polish 内置三并行审查 Skill | Built-in Skill |
| 46 | /batch 大规模批量操作 | Built-in Skill |
| 47 | 分层权限模式（Plan/Suggest/Auto/Full Trust） | Permission |

### 原创组合（#48-#50）

| # | 想法 |
|---|---|
| 48 | "写作 IDE" — 完整的创作开发环境概念 |
| 49 | 读者视角 Agent — 模拟第一次阅读感受 |
| 50 | 角色自主对话模拟 — Agent 扮演角色互动 |

---

## Technique 2: Morphological Analysis (22 new ideas)

### 四维形态矩阵

**A 写作功能域 (8类):** 内容生成/内容编辑/一致性管理/创作记忆/创作规划/知识研究/质量分析/协作管理
**B 技术实现层 (7层):** Agent/Tool/Skill/Hook/Memory/MCP/Team
**C 集成模式 (4种):** 直接复用/配置适配/扩展开发/定制Fork
**D 交互模式 (4种):** 自动触发/用户手动/后台运行/交互对话

### 关键发现

- **0 个功能需要 Fork OpenCode** — 全部通过配置和扩展实现
- **自动触发 (D1)** 是与现有 WriteTeam 最大的差异
- **最高价值 quickwin:** 记忆系统(A4×B5)、GrepTool一致性(A3×B2)、Writer Agent(A1×B1)、EditTool精准编辑(A2×B2)

### 新增想法 (#51-#72)

| # | 组合 | 想法 |
|---|---|---|
| 51 | A1×B2 | WriteTool 适配 TipTap JSON 格式 |
| 52 | A1×B6 | 风格参考 MCP — 模仿特定作家文风 |
| 53 | A2×B2 | EditTool 行级精准编辑 |
| 54 | A2×B4 | PostToolUse Hook 自动格式化 |
| 55 | A3×B4 | PreToolUse Hook 伏笔保护 |
| 56 | A3×B5 | 矛盾日志 memory（contradictions.md） |
| 57 | A3×B7 | 交叉验证 Team（两 Agent 独立审查比较） |
| 58 | A4×B2 | character-tracker Tool |
| 59 | A4×B6 | 外部知识图谱 MCP（图数据库存角色关系） |
| 60 | A4×B3 | /memory-review Skill |
| 61 | A5×B2 | plot-thread-analyzer Tool |
| 62 | A5×B5 | 大纲版本 memory |
| 63 | A5×B1+B7 | 角色自主对话模拟 Team |
| 64 | A6×B5 | 研究笔记 memory 持久化 |
| 65 | A6×B3 | /fact-check Skill |
| 66 | A7×B6 | 中文语法 MCP |
| 67 | A7×B4 | TaskCompleted Hook 质量门 |
| 68 | A7×B5 | 质量趋势 memory |
| 69 | A7×B2+B1 | 比较分析 Tool（与名著风格对比） |
| 70 | A8×B2 | export-tool 导出 epub/pdf |
| 71 | A8×B4 | SubagentStop Hook 自动报告 |
| 72 | A8×B1+B5 | 项目仪表盘 Agent |

---

## Technique 3: Reverse Brainstorming (10 defense strategies)

### P0 关键风险

| # | 必败方案 | 防御策略 |
|---|---|---|
| 73 | 忽略编码 vs 写作本质差异 | **写作领域适配层** — 封装 ChapterEditTool/CharacterSearchTool |
| 74 | 一步到位全量迁移 | **渐进式迁移** — 新旧并行，逐步切换 |
| 75 | AI 自由编辑不加控制 | **分层信任 + 必回溯** — Suggest Mode + Checkpoint |
| 76 | memory 不适配叙事结构 | **叙事感知 Memory** — 状态时间线/DAG/merge策略 |
| 78 | 直接暴露 Server 给多用户 | **Per-User 实例 + 网关层** — 容器化隔离 |
| 80 | UI 体验断裂 | **编辑器原生 AI 交互** — UI 触发，底层走 SDK |

### P1 重要风险

| # | 必败方案 | 防御策略 |
|---|---|---|
| 77 | Go vs TypeScript 语言壁垒 | **最大化配置，最小化代码修改** |
| 79 | 不考虑 token 成本 | **成本感知架构** — 分层模型+debounce |
| 81 | 上游变更破坏集成 | **松耦合 + 版本锁定 + contract test** |
| 82 | 忽略中文语境特殊性 | **中文优先领域适配** |

---

## Extended Ideation (20 new ideas)

### Plugin 生态 & Marketplace (#83-#85)

| # | 想法 |
|---|---|
| 83 | WriteTeam Plugin Marketplace — 写作插件市场 |
| 84 | 类型文学插件套件（武侠/推理/言情/科幻） |
| 85 | 社区 Agent 共享 — 创作经验变数字资产 |

### Remote & Mobile (#86-#87)

| # | 想法 |
|---|---|
| 86 | 手机端 Remote Control 远程写作 |
| 87 | 语音驱动创作 — 散步时口述灵感 |

### 端到端工作流 (#88-#89)

| # | 想法 |
|---|---|
| 88 | "从灵感到出版" 全流程自动化 |
| 89 | "晨间写作仪式" — 零准备开始写作 |

### 数据洞察 (#90-#91)

| # | 想法 |
|---|---|
| 90 | 创作仪表盘（字数趋势、AI辅助比例、角色热力图） |
| 91 | 写作习惯分析 — 主动写作教练 |

### 协作写作 (#92-#93)

| # | 想法 |
|---|---|
| 92 | 多作者协作框架（共享 memory + 冲突检测） |
| 93 | 编辑-作者协作模式 |

### 学习与成长 (#94-#95)

| # | 想法 |
|---|---|
| 94 | 写作能力诊断 |
| 95 | "大师课" 模式 — 边写边学 |

### 创新 AI 交互 (#96-#102)

| # | 想法 |
|---|---|
| 96 | 灵感触发器 — 检测停滞主动刺激 |
| 97 | 沉浸式"角色访谈" |
| 98 | 场景可视化 — MCP 图像生成倒逼描写质量 |
| 99 | 情感曲线实时可视化 |
| 100 | "时间旅行"阅读模式 — 查看文字演变过程 |
| 101 | 平行宇宙模式 — 3 worktree 并行 3 条故事线 |
| 102 | 自适应 AI 人格 — 越用越像你的写作分身 |

---

## Session Summary

### 技巧使用

| 技巧 | 产出 |
|---|---|
| First Principles Thinking | 50 个想法 + 战略定位 |
| Morphological Analysis | 22 个新想法 + 四维矩阵 + 关键洞察 |
| Reverse Brainstorming | 10 个防御策略（6 P0 + 4 P1） |
| Extended Ideation | 20 个新想法（6 个新维度） |

### 统计

- **总想法数:** 102
- **技术方案:** 72 个
- **防御策略:** 10 个
- **创新体验:** 20 个

### Next Steps

建议下一步动作：
1. **创建产品简报** (`/bmad-bmm-create-product-brief`) — 将头脑风暴成果转化为产品愿景
2. **技术研究** (`/bmad-bmm-technical-research`) — 深入研究 OpenCode 架构细节和集成可行性
3. **创建 PRD** (`/bmad-bmm-create-prd`) — 将筛选后的想法转化为产品需求文档
