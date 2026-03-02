---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success']
classification:
  projectType: web_app
  domain: ai_creative_writing
  complexity: medium-high
  projectContext: brownfield
inputDocuments:
  - '_bmad-output/planning-artifacts/product-brief-writeteam-2026-03-02.md'
  - '_bmad-output/planning-artifacts/research/technical-opencode-writeteam-scaffold-research-2026-03-02.md'
  - '_bmad-output/brainstorming/brainstorming-session-2026-03-02-000000.md'
  - '_bmad-output/project-context.md'
  - 'docs/index.md'
  - 'docs/project-overview.md'
  - 'docs/architecture.md'
  - 'docs/technology-stack.md'
  - 'docs/data-models.md'
  - 'docs/api-contracts.md'
  - 'docs/component-inventory.md'
  - 'docs/architecture-patterns.md'
  - 'docs/state-management-patterns.md'
  - 'docs/source-tree-analysis.md'
  - 'docs/comprehensive-analysis.md'
  - 'docs/supporting-documentation.md'
  - 'docs/development-guide.md'
  - 'docs/deployment-configuration.md'
  - 'docs/deployment-guide.md'
  - 'docs/critical-folders-summary.md'
  - 'docs/contribution-guide.md'
  - 'docs/existing-documentation-inventory.md'
  - 'docs/user-context.md'
workflowType: 'prd'
documentCounts:
  briefs: 1
  research: 1
  brainstorming: 1
  projectDocs: 19
  projectContext: 1
---

# Product Requirements Document - WriteTeam

**Author:** fafa
**Date:** 2026-03-02

## Executive Summary

WriteTeam 是面向中文小说创作者的 AI 写作平台，目标是将编码助手（OpenCode/Claude Code）验证成功的 Agent Loop 范式引入创作领域。当前所有 AI 写作工具——包括 Sudowrite 等头部产品——都停留在"一次性文本生成"阶段：AI 不理解上下文、不检查一致性、不验证输出质量。WriteTeam 要解决的核心问题是：**让 AI 从"只会说"进化到"会做事"的写作搭档。**

核心用户是中文网文作者（日更 4000-6000 字、维护百万字级世界观）和纯文学创作者（对文风和质量有极高要求）。商业模式为纯 BYOK（Bring Your Own Key），不做付费订阅，用户自带 LLM API 密钥。

WriteTeam 已是一个功能完整的棕地系统：Next.js 16 全栈应用，TipTap 富文本编辑器，23 个 AI 流式端点，Story Bible/Canvas/系列管理，Supabase 后端（14 张表 + RLS）。本次 PRD 定义的是在现有基础上的**重大架构升级**——接入 OpenCode SDK 作为 AI 底座，实现工具调用、创作记忆、循环验证三大核心能力，同时确保现有功能零退化。

### What Makes This Special

**Agent Loop 范式迁移：** 这不是又一个"套壳 LLM"的写作工具。WriteTeam 将 Agent 基础设施（工具调用、记忆系统、循环验证、过程可视化）完整引入创作场景——AI 在每次生成前读取角色档案和前文上下文，生成后调用一致性检查工具自动验证，不满意则迭代修正，全过程实时可视化。

**三层递进差异化体验：**
1. **可见的思考过程** — 用户点击续写后，看到 Agent 在"读取角色档案... 检查一致性... 第 2 轮修正..."，等待变成信任
2. **真正的上下文感知** — AI 主动避开角色矛盾（上章受伤的角色不会健步如飞），用户第一次感到"AI 读了我的书"
3. **越用越懂你** — 创作记忆系统持续积累对作品和作者风格的理解，形成不可替代性

**三重时机窗口（2026）：** OpenCode 底座成熟（112K+ Stars）+ 中文 AI 写作市场空白（无 Agent 级产品）+ LLM 中文创作能力拐点。

## Project Classification

- **项目类型：** Web App（Next.js SPA，富文本编辑器）
- **领域：** AI 创意写作工具（内容创作 + AI Agent 技术）
- **复杂度：** 中高（AI Agent 集成、实时流式传输、富文本编辑、多提供商兼容；无强监管合规）
- **项目上下文：** 棕地（Brownfield）— 在功能完整的现有系统上进行 Agent 架构升级

## Success Criteria

### User Success

| 指标 | 衡量方式 | 目标 |
|------|---------|------|
| AI 输出采纳率 | 用户直接使用或轻微编辑后使用 AI 内容的比例 | 从行业 ~20% 提升到 60%+ |
| 创作效率 | 同等字数完成时间缩短比例 | 日更效率提升 30%+ |
| 一致性错误率 | AI 生成内容中角色/情节矛盾数量 | 接近零（Agent 循环验证的核心价值证明） |
| 用户留存 | 周活跃率 | 7 日留存 >50%，30 日留存 >30% |
| 信任感建立 | 用户从"手动检查 AI 输出"到"信任 AI 输出"的转变 | 使用 2 周后检查频率下降 50%+ |

### Business Success

- **北极星指标：** AI 输出采纳率 — 直接衡量 Agent Loop 是否提升了生成质量
- **DAU/MAU 比率：** 创作工具健康值 30%+，证明产品粘性
- **平均会话时长：** 每次使用 >30 分钟，证明深度创作而非浅尝辄止
- **商业模式：** 纯 BYOK，零服务端成本，不设收入目标

### Technical Success

| 指标 | 目标 |
|------|------|
| Agent 端到端响应延迟 | 首 token <3s，完整生成（含工具调用 + 验证）<30s |
| 工具调用率 | 80% 生成任务调用至少 1 个工具 |
| Agent 迭代深度 | 平均每次生成 ≥2 轮验证循环 |
| 现有功能回退 | 零回退 — 编辑器、Story Bible、Canvas、BYOK 全部正常 |
| 新旧并行切换 | 用户可一键在"传统模式"和"Agent 模式"间切换，无数据丢失 |
| OpenCode SDK 集成 | SDK 客户端模式接入，SSE 事件正常流转，工具注册/调用链路通 |
| 创作记忆容量 | 单项目支持 50 万字+上下文（通过 Compaction 策略） |

### Measurable Outcomes

**MVP 发布后 1 个月验证点：**
1. Agent Loop 跑通 — 每次生成至少 2 轮迭代验证 ✅
2. 记忆系统有效 — 跨 10 章以上保持角色/设定一致 ✅
3. 质量提升可感知 — AI 输出采纳率达到 50%+ ✅
4. 工具实际被调用 — 80% 生成任务调用至少 1 个工具 ✅
5. 过程可视化 — 用户能实时看到 Agent 每一步动作 ✅
6. 现有功能不退化 — 零功能回退 ✅

## Product Scope

### MVP - Minimum Viable Product

**1. Agent Loop 引擎**
- 接入 OpenCode SDK，实现"读取上下文 → 调用工具 → 验证 → 输出"核心循环
- 渐进式并行架构：新 Agent 通道与现有 23 个端点并行运行，用户可切换
- 分层信任模式：AI 生成内容需用户确认后才写入正文

**2. 创作记忆系统**
- 角色档案、世界观设定、伏笔追踪的持久化记忆
- 导入项目时 AI 自动分析已有内容建立初始记忆
- Compaction 策略处理长篇 token 超限

**3. 核心写作工具集（3 个 MVP 工具）**
- `character-tracker` — 角色状态追踪，防止人设矛盾
- `consistency-check` — 前后文一致性验证，检测逻辑矛盾
- `chapter-edit-tool` — 适配 TipTap JSON 格式的精准编辑

**4. Agent 过程可视化**
- 实时显示 Agent 当前动作（"正在读取角色档案..."、"正在检查一致性..."）
- 让等待变成"安心感"

**5. 现有功能保留**
- 编辑器、Story Bible、Canvas、项目管理、BYOK 配置 — 全部保留不退化

### Growth Features (Post-MVP)

**阶段二（3-6 个月）：**
- 补齐写作工具：`plot-thread-analyzer`（伏笔线索分析）、`style-matcher`（文风匹配）
- Agent 专业分工矩阵：Writer / Reviewer / Editor / Researcher 不同角色不同模型
- Skill 系统：/plot-analyze、/character-arc 等 slash 命令快捷操作
- Hook 系统：PostToolUse 自动记忆提取、PreToolUse 伏笔保护

### Vision (Future)

**阶段三（6-12 个月）：**
- 多 Agent Team 协作（场景多视角创作、并行章节创作）
- MCP 服务器（外部知识图谱、图像生成、中文语法检查）
- 插件市场（类型文学套件：武侠/推理/言情/科幻）
- 检查点分支（"如果...会怎样"平行宇宙探索）

**终极愿景：** AI 自主小说创作引擎 — 从"搭档辅助"进化到"AI 自主生成完整小说"
