---
stepsCompleted:
  - 'step-01-validate-prerequisites'
  - 'step-02-design-epics'
  - 'step-03-create-stories'
  - 'step-04-final-validation'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
---

# writeteam - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for writeteam, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: 访客用户可以注册并登录个人账号进入创作工作区。
FR2: 已登录用户可以安全退出并在后续会话中恢复身份状态。
FR3: 已登录用户可以仅访问自己创建或有权限访问的项目数据。
FR4: 用户可以创建、查看、重命名和删除写作项目。
FR5: 用户可以在项目下创建、排序、重命名和删除文档。
FR6: 用户可以在编辑器中持续编辑长文本并保留历史内容状态。
FR7: 用户可以导入外部文档并将内容纳入当前项目继续创作。
FR8: 用户可以导出单篇或项目内容用于外部发布与归档。
FR9: 用户可以维护故事圣经并编辑核心创作字段（题材、设定、主题、语气等）。
FR10: 用户可以管理角色资料并在写作过程中复用角色设定。
FR11: 用户可以控制哪些故事信息可供 AI 调用使用。
FR12: 用户可以在系列层级维护共享设定并将其应用到关联项目。
FR13: 用户可以基于上下文触发续写、改写、扩写、缩写等核心写作能力。
FR14: 用户可以对选中文本发起快速编辑并获得可替换结果。
FR15: 用户可以对章节进行连续性检查并获得可执行修正建议。
FR16: 用户可以发起头脑风暴、场景规划和反转建议以推进剧情构思。
FR17: 用户可以在对话面板中与 AI 多轮交互并围绕当前项目上下文提问。
FR18: 用户可以切换散文风格模式以调整生成文本风格方向。
FR19: 用户可以配置并保存 BYOK 连接信息（Base URL、API Key、Model ID）。
FR20: 用户可以测试当前 AI 连接并获得明确的成功或失败反馈。
FR21: 用户在 AI 调用失败时可以获得恢复路径并快速重试或切换模型。
FR22: 系统可以在兼容模型范围内为用户提供可用模型选择能力。
FR23: 用户可以在可视化画布中创建和编辑故事节点与连接关系。
FR24: 用户可以使用 AI 生成规划节点并在画布中调整与补充。
FR25: 用户可以在画布与正文创作流程之间往返并保持上下文一致。
FR26: 用户可以对 AI 结果进行正负反馈以形成质量闭环。
FR27: 运营/支持角色可以基于调用记录定位常见失败类型与影响范围。
FR28: 支持角色可以基于错误上下文向用户提供可执行排障建议。

### NonFunctional Requirements

NFR1: 常规编辑操作（输入、光标移动、基础格式应用）在主流桌面设备上的交互延迟 P95 <= 100ms。
NFR2: AI 请求发起后首段流式内容返回时间 TTFB P95 <= 3s。
NFR3: 在 5 万字长文档场景下，侧边面板切换导致的可感知卡顿持续时间 <= 200ms。
NFR4: 平台不得持久化存储用户 BYOK 密钥，且日志与遥测中不得记录明文密钥。
NFR5: 用户创作数据在传输与存储过程中必须采用行业标准加密保护机制。
NFR6: 用户仅可访问自身数据范围内的项目、文档与故事设定信息。
NFR7: 系统架构在峰值并发提升 3 倍时仍可横向扩展，核心写作链路可用性 >= 99.5%。
NFR8: 在调用量增长场景下，AI 能力层具备限流、重试与降级策略，故障场景下核心写作链路可用性 >= 99.0%。
NFR9: 核心创作与设置流程满足 WCAG 2.1 AA，键盘可达覆盖率达到 100%。
NFR10: 关键交互与状态反馈具备可感知文本提示，关键页面颜色对比度满足 WCAG 2.1 AA（普通文本 >= 4.5:1）。
NFR11: 系统应兼容 OpenAI-compatible 接口范式，支持多 Provider 差异化适配。
NFR12: 对外部模型连接异常应输出可解释错误信息，便于用户与支持角色快速定位问题。

### Additional Requirements

- [Architecture] **Starter Template 已明确**：以官方 `create-next-app` 作为架构基线参考；对应初始化命令 `npm create next-app@latest writeteam-foundation --yes --ts --tailwind --eslint --app --src-dir --import-alias "@/*"`；并且应作为实现阶段的第一个实施故事输入（影响 Epic 1 Story 1）。
- [Architecture] 基础设施与部署要求：Web 层以 Vercel 为目标部署平台，数据与认证使用 Supabase 托管服务。
- [Architecture] 安全与密钥要求：BYOK 密钥只允许经 `X-AI-*` 请求头瞬时传递，禁止持久化和日志泄露。
- [Architecture] 认证与权限要求：所有 Route Handlers 与 Server Actions 必须经过 `supabase.auth.getUser()` 门禁；数据库使用 RLS 且 `user_id = auth.uid()`。
- [Architecture] 集成与兼容要求：AI 路由统一遵循 OpenAI-compatible 适配，固定调用链为 `auth -> resolveAIConfig -> fetchStoryContext -> buildStoryPromptContext -> createOpenAIStreamResponse`。
- [Architecture] 可观测与恢复要求：必须记录 AI 调用遥测（成功率、失败类型、延迟、恢复结果），并提供失败后的重试/切换模型/保留上下文恢复路径。
- [Architecture] 数据与迁移要求：采用追加式 SQL migration 策略，禁止破坏性越权 schema 修改。
- [Architecture] API 一致性要求：非流式接口返回 JSON 错误包络；流式成功返回文本流，失败返回 JSON 错误与状态码。
- [UX] 响应式要求：Desktop-first + Mobile-usable；移动端必须可完成写作、AI 调用、连接检测与失败恢复闭环。
- [UX] 可访问性要求：核心流程满足 WCAG 2.1 AA（键盘可达、焦点可见、对比度达标、错误提示可读且可执行）。
- [UX] 浏览器/设备兼容：至少覆盖 Chrome/Safari/Edge（必要时 Firefox）及 iOS/Android 真机关键流程验证。
- [UX] 交互模式要求：写作主链路优先，AI 操作贴近文本上下文；错误反馈必须包含明确下一步动作，禁止“只报错不指路”。
- [UX] 状态与反馈要求：连接状态、模型健康、加载进度、失败原因需分层可见，且反馈语义在全局保持一致。
- [UX] 恢复流程要求：失败恢复优先流（重试/切换模型/保留上下文继续）属于主流程而非边角流程。
- [UX] 组件实现约束：优先落地 `ModelHealthPanel`、`RecoveryActionBar`、`SessionContinuityBanner` 支撑恢复主线；`OutputDiffReview` 作为质量增强能力。

### FR Coverage Map

### FR Coverage Map

FR1: Epic 1 - 访客注册并登录进入创作区
FR2: Epic 1 - 安全退出与会话恢复
FR3: Epic 1 - 基于用户边界的数据访问控制
FR4: Epic 2 - 写作项目的创建与管理
FR5: Epic 2 - 项目内文档的创建与管理
FR6: Epic 2 - 长文本持续编辑与状态保留
FR7: Epic 2 - 外部文档导入并纳入创作流
FR8: Epic 2 - 文档/项目导出发布与归档
FR9: Epic 3 - 故事圣经核心字段维护
FR10: Epic 3 - 角色资料管理与复用
FR11: Epic 3 - 故事信息 AI 可见性控制
FR12: Epic 3 - 系列共享设定与项目应用
FR13: Epic 4 - 上下文驱动续写/改写/扩写/缩写
FR14: Epic 4 - 选中文本快速编辑与替换
FR15: Epic 4 - 连续性检查与修正建议
FR16: Epic 4 - 头脑风暴/场景规划/反转建议
FR17: Epic 4 - 对话面板多轮 AI 协作
FR18: Epic 4 - 散文风格模式切换
FR19: Epic 1 - BYOK 基础配置（Base URL/API Key/Model）
FR20: Epic 1 - 连接测试与可解释反馈
FR21: Epic 1 - AI 失败恢复与快速重试/切换
FR22: Epic 1 - 兼容模型可用选择能力
FR23: Epic 5 - Canvas 节点与连线创建编辑
FR24: Epic 5 - AI 生成规划节点并可调整
FR25: Epic 5 - 画布与正文上下文一致往返
FR26: Epic 6 - AI 结果正负反馈闭环
FR27: Epic 6 - 运营/支持失败类型定位
FR28: Epic 6 - 支持角色可执行排障建议

## Epic List

### Epic 1: 账户接入与可用 AI 基线
用户可以完成登录并建立稳定可用的 BYOK 写作链路（含连接测试与失败恢复入口）。
**FRs covered:** FR1, FR2, FR3, FR19, FR20, FR21, FR22

### Epic 2: 项目与文档创作工作区
用户可以完成项目/文档全生命周期管理，并在编辑器中持续写作、导入导出。
**FRs covered:** FR4, FR5, FR6, FR7, FR8

### Epic 3: 故事知识库与设定治理
用户可以维护故事圣经、角色和系列设定，并控制 AI 可见性，实现长期一致创作。
**FRs covered:** FR9, FR10, FR11, FR12

### Epic 4: AI 写作与改写主流程
用户可以在正文上下文中完成续写、改写、扩写、缩写、灵感规划、对话协作与风格控制。
**FRs covered:** FR13, FR14, FR15, FR16, FR17, FR18

### Epic 5: 可视化规划与正文联动
用户可以在 Canvas 进行结构化故事规划，并与正文创作来回切换且保持上下文一致。
**FRs covered:** FR23, FR24, FR25

### Epic 6: 质量反馈与支持排障闭环
用户与运营/支持角色可以形成结果反馈、失败定位与可执行修复建议闭环。
**FRs covered:** FR26, FR27, FR28

## Epic 1: 账户接入与可用 AI 基线

用户可以完成登录并建立稳定可用的 BYOK 写作链路（含连接测试与失败恢复入口）。

### Story 1.1: 基于 Starter Template 建立实现基线

As a 开发团队成员,
I want 基于官方 create-next-app 基线建立并校验项目初始化规范,
So that 后续功能故事在一致的工程基线下可稳定实现。

**Acceptance Criteria:**

**Given** 架构文档已指定 starter template 约束
**When** 团队按既定命令完成基线校验并确认核心配置（TS、Tailwind、App Router、@/* 别名）
**Then** 项目基线与当前仓库架构约束保持一致并可用于后续故事实现
**And** 仅建立实现基线规范，不提前创建与后续故事无关的实体或功能（Additional Requirements, NFR11）。

### Story 1.2: 用户注册登录与访问隔离

As a 创作者用户,
I want 完成注册/登录并仅访问自己的项目数据,
So that 我能安全进入个人创作空间。

**Acceptance Criteria:**

**Given** 用户未登录访问受保护页面
**When** 用户完成注册或登录流程
**Then** 系统创建或恢复会话并跳转到个人工作区
**And** 所有数据访问遵循 `user_id = auth.uid()` 的权限边界（FR1, FR2, FR3, NFR6）。

### Story 1.3: BYOK 配置、连接测试与模型选择

As a 创作者用户,
I want 配置 BYOK 并测试连通性后选择可用模型,
So that 我可以确认当前 AI 链路可用后开始创作。

**Acceptance Criteria:**

**Given** 用户在设置页填写 Base URL、API Key、Model ID
**When** 用户保存配置并发起连接测试或模型查询
**Then** 系统返回成功/失败及可解释结果并提供可用模型列表
**And** API Key 仅经 `X-AI-*` 头传递且不落库不入日志（FR19, FR20, FR22, NFR4, NFR12）。

### Story 1.4: AI 失败恢复闭环

As a 创作者用户,
I want 在 AI 调用失败时立即获得重试、切换模型和保留上下文继续的动作,
So that 我的写作不会因异常被中断。

**Acceptance Criteria:**

**Given** AI 调用因兼容、网络或配置问题失败
**When** 系统识别失败类型并展示恢复动作
**Then** 用户可一键重试或切换推荐模型并复用原上下文继续生成
**And** 失败类型与恢复结果被记录到遥测用于后续运营与支持分析（FR21, NFR8, NFR12）。

## Epic 2: 项目与文档创作工作区

用户可以完成项目/文档全生命周期管理，并在编辑器中持续写作、导入导出。

### Story 2.1: 写作项目管理

As a 创作者用户,
I want 创建、查看、重命名和删除写作项目,
So that 我可以按作品组织创作工作。

**Acceptance Criteria:**

**Given** 用户已登录并进入工作区
**When** 用户执行项目新增、重命名或删除操作
**Then** 项目列表实时反映变更并保持权限隔离
**And** 删除操作具备明确确认与错误反馈以避免误操作（FR4）。

### Story 2.2: 项目内文档管理与排序

As a 创作者用户,
I want 在项目下管理文档并调整顺序,
So that 我能按章节结构推进写作。

**Acceptance Criteria:**

**Given** 用户位于某个项目详情页
**When** 用户创建、重命名、删除或排序文档
**Then** 文档列表按最新顺序与状态持久化保存
**And** 所有变更仅作用于当前项目且无越权数据泄露（FR5, NFR6）。

### Story 2.3: 长文本编辑与自动保存

As a 创作者用户,
I want 在编辑器中稳定编辑长文本并自动保存,
So that 我不会因刷新或中断而丢失写作进度。

**Acceptance Criteria:**

**Given** 用户正在编辑文档正文
**When** 用户持续输入、格式化和切换面板
**Then** 系统按节流策略自动保存并保持编辑状态一致
**And** 常规编辑交互满足性能目标并在异常时提示保存状态（FR6, NFR1, NFR3）。

### Story 2.4: 文档导入与导出

As a 创作者用户,
I want 导入外部文档并导出当前成果,
So that 我可以复用已有内容并用于发布归档。

**Acceptance Criteria:**

**Given** 用户在项目文档上下文中
**When** 用户执行导入或导出操作
**Then** 导入内容可进入编辑流程，导出文件可被外部工具正确识别
**And** 导入导出失败时提供可执行修复提示且不破坏原文档内容（FR7, FR8）。

## Epic 3: 故事知识库与设定治理

用户可以维护故事圣经、角色和系列设定，并控制 AI 可见性，实现长期一致创作。

### Story 3.1: 故事圣经核心字段管理

As a 创作者用户,
I want 维护题材、主题、语气和规则等故事圣经字段,
So that AI 生成更贴合我的创作目标。

**Acceptance Criteria:**

**Given** 用户进入故事圣经面板
**When** 用户编辑并保存核心字段
**Then** 字段变更持久化并可被后续 AI 调用读取
**And** 字段变更具备版本化感知或修改反馈以避免误覆盖（FR9）。

### Story 3.2: 角色资料管理与写作复用

As a 创作者用户,
I want 管理角色资料并在写作中复用,
So that 人物行为和语气保持一致。

**Acceptance Criteria:**

**Given** 用户在项目内维护角色档案
**When** 用户新增、编辑或删除角色信息
**Then** 角色信息可在 AI 上下文中被正确注入
**And** 当角色冲突或缺失时系统提供可理解提示与修复建议（FR10, NFR12）。

### Story 3.3: 可见性控制与系列共享设定

As a 创作者用户,
I want 控制设定可见性并在系列中共享核心设定,
So that 多项目创作时保持世界观一致且可控。

**Acceptance Criteria:**

**Given** 用户维护项目与系列层设定
**When** 用户设置可见性并关联到指定项目
**Then** AI 仅使用被允许的设定数据
**And** 系列共享设定可被关联项目继承且权限边界不被突破（FR11, FR12, NFR6）。

## Epic 4: AI 写作与改写主流程

用户可以在正文上下文中完成续写、改写、扩写、缩写、灵感规划、对话协作与风格控制。

### Story 4.1: 上下文写作能力（续写/改写/扩写/缩写）

As a 创作者用户,
I want 在当前文档上下文中直接调用核心写作能力,
So that 我能快速推进章节内容。

**Acceptance Criteria:**

**Given** 用户在编辑器中定位光标或选中段落
**When** 用户触发续写、改写、扩写或缩写
**Then** 系统基于故事上下文流式返回结果并支持插入/替换
**And** 首字返回与流式体验满足目标阈值并在超时时提供恢复动作（FR13, NFR2, NFR8）。

### Story 4.2: 选区快速编辑

As a 创作者用户,
I want 对选中文本进行快速编辑并立即决定采纳,
So that 我能在不中断节奏下完成局部优化。

**Acceptance Criteria:**

**Given** 用户选中一段文本
**When** 用户触发快速编辑并输入修改意图
**Then** 系统返回可替换结果并支持一键应用
**And** 取消或失败不会破坏原文并保留继续编辑能力（FR14）。

### Story 4.3: 连续性检查与修正建议

As a 创作者用户,
I want 检查章节连续性并获得可执行修正建议,
So that 我能提前修复逻辑冲突和设定偏差。

**Acceptance Criteria:**

**Given** 用户选择某章节执行连续性检查
**When** 系统分析正文与故事设定
**Then** 返回结构化问题清单和建议修正动作
**And** 建议可追溯到触发文本或设定来源并支持快速应用（FR15, FR9, FR10）。

### Story 4.4: 构思协作与风格控制

As a 创作者用户,
I want 通过头脑风暴、场景规划、反转建议、对话协作与风格模式控制创作方向,
So that 我能持续获得高质量且风格一致的文本。

**Acceptance Criteria:**

**Given** 用户在当前项目上下文中打开 AI 对话与构思工具
**When** 用户发起 brainstorm/scene-plan/twist/chat 并切换 prose mode
**Then** 系统返回与当前项目一致的建议和文本输出
**And** 风格控制对结果有可感知影响且状态在会话内可追踪（FR16, FR17, FR18）。

## Epic 5: 可视化规划与正文联动

用户可以在 Canvas 进行结构化故事规划，并与正文创作来回切换且保持上下文一致。

### Story 5.1: Canvas 节点与连接管理

As a 创作者用户,
I want 在画布中创建并编辑故事节点与关系连接,
So that 我能在动笔前可视化剧情结构。

**Acceptance Criteria:**

**Given** 用户进入项目对应的 Canvas 页面
**When** 用户新增、编辑、删除节点及连线
**Then** 画布状态被持久化并可再次打开继续编辑
**And** 关键操作在桌面与移动可用范围内均可达（FR23, NFR9）。

### Story 5.2: AI 规划生成与正文上下文往返

As a 创作者用户,
I want 让 AI 生成规划节点并与正文创作双向联动,
So that 我可以从规划快速进入成文并保持上下文一致。

**Acceptance Criteria:**

**Given** 用户在 Canvas 中选择生成规划
**When** AI 返回节点建议并被用户采纳
**Then** 新节点可在画布中编辑并与正文创作入口关联
**And** 从画布跳转到编辑器时保留必要上下文，返回画布时状态不丢失（FR24, FR25）。

## Epic 6: 质量反馈与支持排障闭环

用户与运营/支持角色可以形成结果反馈、失败定位与可执行修复建议闭环。

### Story 6.1: AI 结果正负反馈闭环

As a 创作者用户,
I want 对 AI 输出进行正负反馈,
So that 系统和团队能持续优化生成质量与推荐策略。

**Acceptance Criteria:**

**Given** 用户收到 AI 生成结果
**When** 用户提交正向或负向反馈
**Then** 反馈与上下文调用记录关联存储
**And** 反馈提交不阻塞用户继续写作（FR26）。

### Story 6.2: 失败类型定位与影响范围分析

As a 运营/支持角色,
I want 查看调用失败类型与影响范围,
So that 我可以快速识别高优先级问题并制定干预策略。

**Acceptance Criteria:**

**Given** 系统已积累 AI 调用遥测
**When** 运营/支持查看失败分析视图
**Then** 可按 provider、model、错误类型和时间维度查看分布
**And** 可定位高失败组合并输出可执行优化建议（FR27, NFR12）。

### Story 6.3: 支持排障建议与恢复 Runbook

As a 支持角色,
I want 基于错误上下文获得标准化排障建议,
So that 我能指导用户在最短路径恢复创作。

**Acceptance Criteria:**

**Given** 用户提交错误信息或工单上下文
**When** 支持角色触发排障建议流程
**Then** 系统返回分步骤、可执行且与错误类型匹配的恢复动作
**And** 建议流程覆盖检查配置、切换模型、重试与上下文保留（FR28, FR21）。
