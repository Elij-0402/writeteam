---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - '_bmad-output/brainstorming/brainstorming-session-2026-03-02-000000.md'
  - '_bmad-output/planning-artifacts/research/technical-opencode-writeteam-scaffold-research-2026-03-02.md'
  - '_bmad-output/project-context.md'
  - 'docs/index.md'
  - 'docs/project-overview.md'
  - 'docs/architecture.md'
  - 'docs/comprehensive-analysis.md'
  - 'docs/technology-stack.md'
  - 'docs/data-models.md'
  - 'docs/api-contracts.md'
  - 'docs/user-context.md'
  - 'docs/component-inventory.md'
  - 'docs/architecture-patterns.md'
  - 'docs/state-management-patterns.md'
  - 'docs/source-tree-analysis.md'
  - 'docs/supporting-documentation.md'
  - 'docs/development-guide.md'
  - 'docs/deployment-configuration.md'
  - 'docs/deployment-guide.md'
  - 'docs/critical-folders-summary.md'
  - 'docs/contribution-guide.md'
  - 'docs/existing-documentation-inventory.md'
date: 2026-03-02
author: fafa
---

# Product Brief: WriteTeam

## Executive Summary

WriteTeam 是一个面向中文小说创作者的 AI 写作平台，它将彻底改变"AI 辅助写作"的范式。不同于市场上所有"点击生成"式的 AI 写作工具，WriteTeam 将编码助手（Agent Loop）的核心原理引入创作领域——AI 不再是一个只会"说"的模型，而是一个会"做"的写作搭档：它能读取上下文、调用工具、检查一致性、循环验证，最终交付高质量的创作内容。终极目标是实现 AI 自主生成完整小说的能力。

---

## Core Vision

### Problem Statement

当前所有 AI 写作工具（包括 Sudowrite 等头部产品）都停留在"一次性文本生成"的范式：用户点击按钮，LLM 生成一段文字，结束。这种模式存在根本性缺陷——AI 不理解上下文、不检查一致性、不验证输出质量，导致生成内容充斥着角色矛盾、情节断裂和文风偏差。创作者被迫在"反复重新生成"和"干脆自己写"之间挣扎。

### Problem Impact

- 创作者浪费大量时间在筛选和修正低质量 AI 输出上
- AI 写作工具沦为"灵感草稿机"，无法真正参与深度创作
- 长篇小说创作中，AI 完全无法维持跨章节的一致性和记忆
- 创作者对 AI 辅助写作的信任度持续走低

### Why Existing Solutions Fall Short

现有产品本质上都是"传统应用接入 LLM 模型"——只有知识库和单次调用，没有工具能力、没有记忆系统、没有自我验证循环。即使是 Sudowrite 这样的头部产品，其 Story Engine 也只是在单次生成的基础上做了流程编排，并未实现真正的 Agent 智能。所有竞品共享同一个技术天花板：**LLM 只会"说"，不会"做"。**

### Proposed Solution

将编码助手（OpenCode/Claude Code）的 Agent Loop 范式引入创作领域，构建一个真正的"AI 写作 Agent"平台：

1. **上下文感知** — AI 自动读取当前章节、角色档案、故事设定，而非盲目生成
2. **工具调用** — AI 主动调用一致性检查、角色追踪、情节分析等工具
3. **循环验证** — 生成后自动检查质量，不满意则迭代优化，而非一次交付
4. **创作记忆** — AI 随着使用积累对作品和作者风格的理解，越用越懂你
5. **自主推进** — 从"搭档辅助"逐步进化到"AI 自主生成完整小说"

### Key Differentiators

1. **Agent Loop 范式** — 业界首个将编码助手原理应用于创作的产品，从"一次生成"升级到"循环迭代"
2. **工具调用能力** — AI 不只是生成文字，还能调用工具检查一致性、追踪角色、分析情节
3. **创作记忆系统** — 不是无状态的聊天，而是持续积累的创作伙伴
4. **OpenCode 技术底座** — 站在成熟的 Agent 基础设施上，聚焦写作体验而非重复造轮子
5. **中文原生** — 从一开始就为中文小说创作场景设计，而非英文产品的汉化版

---

## Target Users

### Primary Users

**P0 — 网文作者（核心用户）**

**画像：陈磊，28 岁，全职网文写手**

陈磊在起点中文网连载一部都市玄幻小说，已写到 150 万字。他每天需要更新 4000-6000 字，维持稳定的更新频率来保住读者订阅。他最大的痛苦是：写到后期，角色越来越多、伏笔线索越来越复杂，经常出现前后矛盾，被读者在评论区"捉虫"。他试过好几款 AI 写作工具，但生成的内容完全不考虑前面已经写过的设定，基本不能用。

- **核心需求：** 高产出 + 跨章节一致性 + 减少低级错误
- **当前痛点：** 日更压力下无暇回顾前文，AI 工具生成的内容与已有情节脱节
- **成功标志：** AI 能记住他的 150 万字世界观，续写时自动保持人设和伏笔一致

### Secondary Users

**P1 — 纯文学作者**

**画像：林婉清，35 岁，业余纯文学创作者**

白天在出版社工作，晚上写自己的长篇小说。她对文风要求极高，追求细腻的心理描写和独特的叙事节奏。她不需要 AI 替她写，但希望 AI 能理解她的风格，在她卡壳时提供符合她文风的灵感和建议。

- **核心需求：** 风格匹配 + 高质量建议 + 创作记忆
- **当前痛点：** 所有 AI 输出都是"AI 味"，与她的文风格格不入
- **成功标志：** AI 生成的内容读起来像她自己写的

**P1 — 写作新手 / 业余爱好者**

**画像：张小明，22 岁，大学生，想写自己的第一部小说**

有很多故事想法但不知道如何组织和推进。他需要的不是单纯的文字生成，而是一个能引导他完成从大纲到成稿全流程的写作伙伴。

- **核心需求：** 创作引导 + 结构规划 + 学习成长
- **当前痛点：** 不知道怎么从"想法"变成"完整的故事"
- **成功标志：** 在 AI 辅助下完成人生第一部完整小说

**P2 — 网文编辑**

**画像：周敏，30 岁，网文平台责任编辑**

负责审阅多部签约作品，需要快速发现剧情漏洞、人设矛盾，给作者提修改意见。

- **核心需求：** 批量审稿 + 一致性检查 + 质量分析
- **成功标志：** 一键生成审稿报告，标出所有矛盾和漏洞

**P2 — 影视改编方**

**画像：李浩，38 岁，影视公司开发经理**

负责评估网文 IP 的改编潜力，需要快速提取角色关系、核心冲突、场景可视化等信息。

- **核心需求：** 角色关系图 + 剧情提炼 + 改编可行性分析
- **成功标志：** 快速生成 IP 评估报告

### User Journey

**以核心用户陈磊为例：**

1. **发现** — 在写作群里听说"有个 AI 工具能记住你的整部小说"，被这个概念打动
2. **上手** — 导入已有的小说项目，AI 自动分析角色、设定、伏笔，建立创作记忆
3. **日常使用** — 每天开始写作时，AI 已经了解前文所有上下文；点击续写，AI 调用角色追踪和一致性检查工具，循环验证后输出与前文衔接的内容
4. **价值时刻** — 第一次发现 AI 续写的内容主动回扣了 50 章前埋的伏笔，"这才是我想要的 AI"
5. **长期依赖** — AI 越用越懂他的写作习惯和故事世界，成为不可替代的创作搭档

---

## Success Metrics

### 用户成功指标

| 指标 | 衡量方式 | 目标 |
|------|---------|------|
| AI 输出采纳率 | 用户直接使用或轻微编辑后使用 AI 内容的比例 | 从行业平均 ~20% 提升到 60%+ |
| 创作效率提升 | 同样字数完成时间的缩短 | 日更效率提升 30%+ |
| 一致性错误率 | AI 生成内容中的角色/情节矛盾数量 | 接近零矛盾（Agent 循环验证的核心价值） |
| 用户留存 | 周活跃率（每周至少使用一次） | 7 日留存 >50%，30 日留存 >30% |

### Business Objectives

**商业模式：纯 BYOK（Bring Your Own Key）**

- 不做付费订阅或商业化变现
- 用户自带 LLM API 密钥，WriteTeam 不承担 LLM 调用成本
- 专注于产品体验和技术创新，不设收入目标

### Key Performance Indicators

1. **北极星指标：AI 输出采纳率** — 衡量 Agent Loop 是否真正提升了生成质量的最核心指标
2. **DAU/MAU 比率** — 衡量产品粘性，创作工具的健康值应在 30%+
3. **平均会话时长** — 创作者每次使用的深度
4. **Agent 循环次数** — 每次生成任务中 Agent 平均迭代次数，衡量 Agent Loop 的实际运作深度

---

## MVP Scope

### Core Features

**1. Agent Loop 引擎**
- 接入 OpenCode SDK，实现"读取上下文 → 调用工具 → 验证 → 输出"核心循环
- **渐进式并行架构**：新 Agent 通道与现有 21 个端点并行运行，用户可切换"传统模式"和"Agent 模式"
- 分层信任模式：AI 生成内容需用户确认后才写入正文

**2. 创作记忆系统**
- 角色档案、世界观设定、伏笔追踪、时间线的持久化记忆
- 导入项目时 AI 自动分析已有内容，建立初始记忆
- Compaction 策略处理长篇 token 超限

**3. 核心写作工具集（3 个 MVP 工具）**
- `character-tracker` — 角色状态追踪，防止人设矛盾
- `consistency-check` — 前后文一致性验证，检测逻辑矛盾
- `chapter-edit-tool` — 适配 TipTap JSON 格式的精准编辑

**4. Agent 过程可视化**
- 实时显示 Agent 当前动作（"正在读取角色档案..."、"正在检查一致性..."、"第 2 轮验证中..."）
- 让等待变成"安心感"而非"焦虑感"

**5. 现有功能保留**
- 编辑器、Story Bible、项目管理、Canvas — 全部保留不退化
- BYOK 配置保留并升级

### Out of Scope for MVP

| 功能 | 推迟原因 |
|------|---------|
| `plot-thread-analyzer`、`style-matcher` 工具 | 先用 3 个核心工具验证假设 |
| Agent 专业分工矩阵 | 先跑通单 Agent |
| 多 Agent Team 协作 | 需 Agent 底座稳定后扩展 |
| Plugin Marketplace / 类型文学套件 | 生态建设属于规模期 |
| Skill 系统（slash 命令） | 先验证核心工具，再包装 |
| 手机端 / 语音创作 / 多作者协作 | 先做好 Web 端单用户体验 |
| 检查点 / 平行宇宙分支 | 需底层 worktree 支持 |
| 自主生成完整小说 | Agent 能力需逐步积累 |

### MVP Success Criteria

| 验证点 | 通过条件 |
|--------|---------|
| Agent Loop 跑通 | 每次生成至少 2 轮迭代验证 |
| 记忆系统有效 | 跨 10 章以上仍保持角色/设定一致 |
| 质量提升可感知 | AI 输出采纳率达到 50%+ |
| 工具实际被调用 | 80% 生成任务调用至少 1 个工具 |
| 过程可视化 | 用户能实时看到 Agent 每一步动作 |
| 现有功能不退化 | 零功能回退 |

### Future Vision

**阶段二（3-6 个月）：** 补齐工具（`plot-thread-analyzer`、`style-matcher`）+ Agent 分工矩阵 + Skill 系统 + Hook 系统

**阶段三（6-12 个月）：** 多 Agent Team + MCP 服务器 + 插件市场 + 检查点分支

**终极愿景：** AI 自主小说创作引擎
