---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-01b-continue', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete', 'step-11-complete', 'step-11-complete.md']
inputDocuments:
  - '_bmad-output/project-context.md'
  - 'docs/index.md'
  - 'docs/project-overview.md'
  - 'docs/source-tree-analysis.md'
  - 'docs/architecture.md'
  - 'docs/api-contracts.md'
  - 'docs/data-models.md'
  - 'docs/component-inventory.md'
  - 'docs/development-guide.md'
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 8
  projectContext: 1
classification:
  projectType: web_app
  domain: creative_writing_tool
  complexity: medium
  projectContext: brownfield
workflowType: 'prd'
date: '2026-02-27'
---

# Product Requirements Document - writeteam

**Author:** Elij
**Date:** 2026-02-27

## Executive Summary

WriteTeam 是一个面向中文创作者的 AI 创意写作平台，目标是以 **BYOK（自带密钥）** 模式实现与 Sudowrite 的功能对齐。与 Sudowrite 依赖自研 Muse 模型并收取 $19-29/月订阅费不同，WriteTeam 允许用户接入自己已有的任何 AI 服务——包括第三方中转站 API Key、DeepSeek/OpenAI 官方 API、Claude Pro 订阅、ChatGPT Plus/Business 会员等——即可获得同等级别的专业创意写作体验，且无需额外付费。

当前系统已具备编辑器核心（TipTap 富文本 + 自动保存）、21 个 AI 写作工具、Story Bible 故事世界管理、角色系统、Canvas 可视化规划、系列管理、插件系统和文档导入导出。本次大版本迭代的核心任务为：(1) 通过竞品调研 Sudowrite 进行差距分析并补齐缺失功能；(2) 解决当前多 Provider/中转站场景下的模型兼容性问题——部分模型因流式响应格式差异无法正常工作；(3) 探索订阅套餐用户（Claude Pro、ChatGPT Plus/Business）的接入方案，扩大用户覆盖面。

### What Makes This Special

WriteTeam 的核心差异化建立在三个不可分割的支柱上：

- **免费** — 打破 Sudowrite 的付费墙，用户无需为写作工具本身付费
- **万能接入** — 不仅支持传统 API Key，还要覆盖订阅制 AI 服务用户，让"已经在为 AI 付费"的用户直接将已有额度释放到专业写作场景中
- **中文优先** — 全中文 UI 和 prompt 工程，为中文创作者量身优化

核心洞察：AI 创意写作能力不应被锁定在单一平台的订阅中。用户已经为 AI 服务付费，WriteTeam 的价值是将这些分散的 AI 能力统一释放到专业级创作工具体验中。

## Project Classification

| 维度 | 分类 |
|------|------|
| **项目类型** | Web App（Next.js 16 全栈单体应用） |
| **领域** | 创意写作工具（Creative Writing Tool） |
| **复杂度** | Medium（多 Provider AI 集成复杂度高，非受监管行业） |
| **项目上下文** | Brownfield（已有完整代码库，12 张数据库表，55 个组件，22 个 API 端点） |
| **对标产品** | Sudowrite |
| **核心差异** | 免费 + BYOK 万能接入 + 中文优先 |

## Success Criteria

### User Success
- 新用户在首次会话内完成 BYOK 配置并产出首段可用文本的成功率达到 >= 75%。
- 主用户在连续创作会话中的 AI 中断率 <= 10%，且故障后可在 10 分钟内恢复创作。
- 支持与运营角色对主要失败类型的定位平均耗时 <= 15 分钟，并可提供标准化恢复路径。

### Business Success
- 通过免费 + BYOK 路径提升首日激活率（D1 Activation）到 >= 40%，并将 7 日留存提升到 >= 25%。
- 在不承担模型推理成本前提下，实现月活用户（MAU）连续 3 个月环比正增长。
- 在用户调研中，“中文优先/低成本/开放接入”三项差异化认知合计提及率 >= 60%。

### Technical Success
- 主流 Provider/模型组合在核心写作功能中的调用成功率 >= 95%。
- 模型兼容异常具备可诊断、可降级、可恢复能力，失败恢复成功率 >= 85%。
- 关键创作数据满足权限隔离与密钥保护基线，BYOK 密钥明文落库次数为 0。

### Measurable Outcomes
- 首次配置到首次有效产出中位时间（P50）<= 8 分钟，并持续按月优化。
- AI 调用失败后的恢复时间（MTTR）与恢复成功率可被追踪，MTTR <= 10 分钟。
- 连续创作会话中的中断率、完稿率、功能复用率可被度量，其中章节完稿率 >= 60%。

## Product Scope

### MVP - Minimum Viable Product
- 编辑器主链路稳定可用（写作、保存、导入导出、字数统计）。
- BYOK 配置、连接测试、基础模型切换与错误恢复闭环。
- 核心 AI 能力（续写、改写、扩写、缩写、连续性检查）与故事设定注入。

### Growth Features (Post-MVP)
- 创作规划能力增强（Muse、Scene Plan、Twist）与可视化协同深化。
- 运营与支持仪表能力增强（失败分布、恢复效率、质量趋势）。
- 模型能力路由、推荐与兼容矩阵持续扩展。

### Vision (Future)
- 订阅账户场景的低摩擦接入深化（Claude Pro、ChatGPT Plus/Business）。
- 插件生态、模板生态与协作能力扩展。
- 系列级智能创作工作流与跨项目设定治理能力成熟。

## User Journeys

### 旅程 1：主用户（成功路径）—「连载作者 林舟」
**Opening Scene**  
林舟是中文网文作者，每天要在工作后挤时间更新。她最大的痛点不是“不会写”，而是“写得慢、容易卡、风格不稳”。

**Rising Action**  
她创建项目，导入已有章节，配置自己常用的 AI Provider（BYOK），在编辑器里用续写、改写、扩写、语气转换和场景规划工具推进章节；同时把角色与世界观维护在 Story Bible，保证设定一致。

**Climax**  
在关键高潮章节前，她用 continuity-check + saliency 提前发现人物动机冲突，并用 quick-edit 在不中断创作节奏的情况下完成修复。

**Resolution**  
她的更新从“断断续续”变成“稳定周更”，并且读者反馈“文风更统一、剧情更紧凑”。她把 WriteTeam 视为长期创作工作台，而不是一次性工具。

### 旅程 2：主用户（边界/异常路径）—「卡顿与模型兼容问题」
**Opening Scene**  
林舟切换到新的中转站模型后，发现流式输出异常（断流、格式不一致、结果不可用），创作节奏被打断。

**Rising Action**  
她进入设置页测试连接、切换模型、调整 base URL 与 model ID；在同一段文本上反复验证输出稳定性。

**Climax**  
系统需要明确告诉她“问题出在模型响应格式不兼容还是配置错误”，并提供可恢复路径（推荐可用模型、保留上下文、快速重试）。

**Resolution**  
她在 10 分钟内恢复可用链路并继续写作，且不丢失当前章节上下文。她对“可恢复性”建立信任，减少流失风险。

### 旅程 3：运营/管理员用户 —「产品运营 乔宁」
**Opening Scene**  
乔宁负责观察平台功能使用情况和用户留存信号，重点关注 AI 功能是否真正提高创作效率。

**Rising Action**  
她查看功能使用分布（哪些 AI 工具高频）、反馈数据（点赞/点踩）、常见失败路径（连接失败、响应质量差）。

**Climax**  
当发现某类模型配置导致失败率升高时，她需要快速定位“哪个 Provider/模型组合问题最严重”，并形成干预策略（引导文案、默认推荐、FAQ）。

**Resolution**  
运营决策从“拍脑袋”变成“数据驱动”，新用户首日可用率和 7 日留存提升，产品迭代优先级更清晰。

### 旅程 4：支持/排障用户 —「客服支持 周岚」
**Opening Scene**  
周岚接到用户工单：AI 工具“有时可用有时不可用”，用户情绪焦躁且担心内容丢失。

**Rising Action**  
她需要复盘用户路径：配置状态、模型信息、报错类型、最近调用结果与反馈记录，判断是账号认证、网络、Provider 限流还是协议兼容问题。

**Climax**  
她快速给出可执行修复步骤（检查 Header 配置、切换兼容模型、复测连接），并能让用户“一键回到继续写作”的状态。

**Resolution**  
工单处理时间缩短，重复问题比例下降，支持体验从“解释问题”升级为“恢复创作能力”。

### Journey Requirements Summary

- 创作主线能力：低摩擦写作流（续写/改写/扩写/检查）+ Story Bible 一致性约束。
- 稳定性与恢复：模型兼容检测、连接诊断、失败可恢复路径、不中断上下文。
- 运营可观测性：功能使用、成功率、反馈闭环、失败分布与优先级信号。
- 支持排障能力：可定位、可解释、可执行的修复流程与用户引导。
- （可选）技术集成能力：接口一致性、错误可判别性、对自动化友好。

## Domain-Specific Requirements

### Compliance & Regulatory
- 用户自带密钥（BYOK）必须确保平台侧不持久化、不日志化 API Key，符合最小化数据处理原则。
- 面向中文创作者需明确内容合规边界（违规内容生成、敏感主题处理、输出责任归属）与用户可见提示策略。
- 若支持第三方中转站，应提供透明披露：平台仅做代理调用编排，不对第三方模型策略与可用性作担保。

### Technical Constraints
- 多 Provider/多模型兼容是核心约束：需统一处理流式协议差异、字段不一致、断流/半包等异常。
- 高可用创作体验优先：失败后必须可恢复（重试、回退模型、保留上下文），避免用户创作中断和文本丢失。
- 性能约束围绕“写作连续性”：常用 AI 操作应维持可感知低延迟，超时需有明确反馈与补救路径。
- 隐私约束：创作内容、角色设定、故事圣经属于高敏感个人创作资产，需最小暴露与访问隔离。

### Integration Requirements
- 与 OpenAI-compatible 生态兼容：支持官方 Provider、本地部署（如 Ollama）、中转站场景。
- 统一连接诊断能力：对 base URL、model ID、认证状态、响应格式提供可解释错误。
- 与现有系统深度联动：编辑器、Story Bible、Saliency、AI History 之间保持一致数据流与追踪能力。

### Risk Mitigations
- 风险：模型兼容性导致不可用 → 建立模型能力探测、兼容性白名单/降级路径、用户侧推荐模型。
- 风险：创作数据泄露或误传 → 严格脱敏日志、最小采集、明确边界提示。
- 风险：用户信任受损（结果不稳定） → 增加失败解释、可恢复流程、质量反馈闭环（👍/👎+遥测）。
- 风险：中转站不稳定 → 提供快速切换 Provider 与连接测试，减少单点依赖。

## Innovation & Novel Patterns

### Detected Innovation Areas
- 价值创新组合：将“免费产品层 + 用户既有 AI 订阅/密钥 + 中文创作工作流”整合为统一体验，降低专业写作 AI 门槛。
- 交互创新（web_app 信号）：在同一编辑流里把写作、设定管理、一致性检查、灵感生成与可视化规划串成连续创作回路，而非分散工具切换。
- 生态创新：兼容官方 API、本地模型与中转站，目标是让“已为 AI 付费的人”无需重复订阅即可获得专业写作能力。

### Market Context & Competitive Landscape
- 对标 Sudowrite：其优势在写作体验深度与产品成熟度，劣势在订阅成本与生态封闭。
- WriteTeam 机会窗口：通过 BYOK + 中文优先覆盖价格敏感且创作频繁的中文作者群体，形成差异化切入。
- 竞争核心将从“单次生成质量”转向“长周期创作可持续性”（稳定性、可恢复性、设定一致性、创作节奏维护）。

### Validation Approach
- 价值验证：跟踪“从首次配置到首次有效 AI 产出”的时间与成功率，验证低门槛承诺是否成立。
- 体验验证：跟踪连续创作会话中断率、故障恢复时间、章节完稿率，验证“不中断创作”是否兑现。
- 差异化验证：通过用户反馈与留存对比，验证“免费 + 万能接入 + 中文优先”是否显著提升转化与复用。

### Risk Mitigation
- 创新假设不成立风险：若用户对“万能接入”感知弱，则增强模板化配置、首启引导和模型推荐，先放大可感知价值。
- 兼容性复杂度失控风险：建立模型能力基线与降级策略，优先保证主路径稳定，再扩展长尾兼容。
- 同质化竞争风险：强化写作工作流闭环（创作-检查-修复-规划）和中文场景深度，避免退化为通用聊天壳层。

## Web App Specific Requirements

### Project-Type Overview
WriteTeam 作为 web_app，需要在浏览器内提供长时写作体验与 AI 实时协作，核心不是单页展示，而是持续创作会话的稳定性、可恢复性与多端可达性。

### Technical Architecture Considerations
- 架构模式：采用 App Router 全栈模式，Server Actions 负责数据写入，AI Route 负责流式能力编排。
- 浏览器支持：优先现代浏览器（Chrome/Edge/Safari/Firefox）最近两个主版本，保证中文输入法与富文本操作稳定。
- 响应式：桌面优先，同时保证移动端可完成基础创作与设置流程（非全量专业编辑操作）。
- 可访问性：核心编辑和设置流程需满足 WCAG 2.1 AA 级别（键盘可达、语义标签、可见焦点、对比度与状态反馈）。

### Accessibility Level
- 目标等级：WCAG 2.1 AA（适用于核心创作、设置与故障恢复流程）。
- 验收基线：
  - 键盘全流程可达，主要操作不依赖鼠标。
  - 可见焦点与状态反馈清晰，不仅依赖颜色区分。
  - 正文与关键控件满足 AA 对比度要求。
  - 主要表单与错误提示具备可读标签与语义关联。

### Browser Matrix & Responsive Design
- Desktop: 1920/1440/1366 主流分辨率完整体验。
- Tablet: 至少支持阅读、轻编辑、设置与基础 AI 调用。
- Mobile: 支持阅读、快速编辑、连接测试与故障恢复，不强制承载复杂多面板编辑流。

### Performance Targets
- 首屏可交互时间（TTI）目标：常规网络下维持可感知快速进入。
- AI 交互感知目标：提交后尽快出现流式首字反馈，减少“无响应”心理落差。
- 编辑稳定性目标：长文档下滚动、输入和光标操作保持平滑，不因侧边面板切换明显卡顿。

### SEO Strategy
- 对公开页面（如着陆页）进行基础 SEO 优化；编辑器与用户私有内容页面不以搜索引擎曝光为目标。
- 面向增长的关键是口碑与转化漏斗，而非私有创作内容收录。

### Implementation Considerations
- 跳过项（按 web_app 配置）：不展开原生平台特性与 CLI 命令体系需求，聚焦浏览器体验。
- 关键实现优先级：
  1) AI 流式兼容与故障恢复
  2) 编辑会话稳定性与自动保存可靠性
  3) BYOK 配置可用性与连接诊断
  4) 响应式与可访问性收敛

## Project Scoping & Phased Development

### MVP Strategy & Philosophy
**MVP Approach:** Problem-solving MVP（先证明“持续写作不中断且明显提效”）  
**Resource Requirements:** 最小可行团队建议 4-6 人：1 产品/PM、2 全栈工程、1 前端偏交互、1 QA（可兼职）、0.5 设计支持。

### MVP Feature Set (Phase 1)
**Core User Journeys Supported:**
- 主用户成功路径（创建项目→配置 BYOK→写作与改写→一致性检查→完稿）
- 主用户异常恢复路径（连接失败/模型不兼容→诊断→切换→恢复写作）
- 支持角色基础排障路径（定位问题并给出可执行恢复建议）

**Must-Have Capabilities:**
- 稳定的编辑器主流程（自动保存、字数统计、基本格式能力）
- BYOK 配置与连接测试（含错误提示与推荐恢复动作）
- 核心 AI 工具闭环（写作、改写、扩写、缩写、连续性检查）
- Story Bible 与角色信息在 AI 调用中的稳定注入
- 失败可恢复机制（重试、模型切换、上下文保留）
- 基础遥测与反馈闭环（调用记录、质量反馈）

### Post-MVP Features
**Phase 2 (Post-MVP):**
- 高级规划与创作辅助（Muse 深化、Twist 强化、Scene Plan 自动化增强）
- Canvas 与正文协同增强（从规划到成文的一键流转）
- 更细粒度的模型能力路由与自动推荐
- 支持/运营视角仪表盘（失败分布、恢复率、功能留存）

**Phase 3 (Expansion):**
- 订阅型账户接入深化（Claude Pro、ChatGPT Plus/Business 的低摩擦接入）
- 更完整的生态能力（插件市场、模板市场、团队协作）
- 跨项目与系列级智能工作流（统一设定治理与冲突自动修复）

### Risk Mitigation Strategy
**Technical Risks:** 先收敛兼容矩阵与主流模型路径，提供标准化降级和可观测错误分类。  
**Market Risks:** 以“首次配置成功率、首次有效产出时间、7日留存”做快速验证，持续迭代上手体验。  
**Resource Risks:** 若资源不足，优先保留“写作主链路 + 连接诊断 + 恢复机制”，推迟高级规划与生态化能力。

## Functional Requirements

### Account & Access Management
- FR1: 访客用户可以注册并登录个人账号进入创作工作区。
- FR2: 已登录用户可以安全退出并在后续会话中恢复身份状态。
- FR3: 已登录用户可以仅访问自己创建或有权限访问的项目数据。

### Project & Document Workspace
- FR4: 用户可以创建、查看、重命名和删除写作项目。
- FR5: 用户可以在项目下创建、排序、重命名和删除文档。
- FR6: 用户可以在编辑器中持续编辑长文本并保留历史内容状态。
- FR7: 用户可以导入外部文档并将内容纳入当前项目继续创作。
- FR8: 用户可以导出单篇或项目内容用于外部发布与归档。

### Story Intelligence Management
- FR9: 用户可以维护故事圣经并编辑核心创作字段（题材、设定、主题、语气等）。
- FR10: 用户可以管理角色资料并在写作过程中复用角色设定。
- FR11: 用户可以控制哪些故事信息可供 AI 调用使用。
- FR12: 用户可以在系列层级维护共享设定并将其应用到关联项目。

### AI-Assisted Writing Capabilities
- FR13: 用户可以基于上下文触发续写、改写、扩写、缩写等核心写作能力。
- FR14: 用户可以对选中文本发起快速编辑并获得可替换结果。
- FR15: 用户可以对章节进行连续性检查并获得可执行修正建议。
- FR16: 用户可以发起头脑风暴、场景规划和反转建议以推进剧情构思。
- FR17: 用户可以在对话面板中与 AI 多轮交互并围绕当前项目上下文提问。
- FR18: 用户可以切换散文风格模式以调整生成文本风格方向。

### AI Configuration & Reliability
- FR19: 用户可以配置并保存 BYOK 连接信息（Base URL、API Key、Model ID）。
- FR20: 用户可以测试当前 AI 连接并获得明确的成功或失败反馈。
- FR21: 用户在 AI 调用失败时可以获得恢复路径并快速重试或切换模型。
- FR22: 系统可以在兼容模型范围内为用户提供可用模型选择能力。

### Visualization & Planning Flow
- FR23: 用户可以在可视化画布中创建和编辑故事节点与连接关系。
- FR24: 用户可以使用 AI 生成规划节点并在画布中调整与补充。
- FR25: 用户可以在画布与正文创作流程之间往返并保持上下文一致。

### Quality, Feedback & Operations
- FR26: 用户可以对 AI 结果进行正负反馈以形成质量闭环。
- FR27: 运营/支持角色可以基于调用记录定位常见失败类型与影响范围。
- FR28: 支持角色可以基于错误上下文向用户提供可执行排障建议。

## Non-Functional Requirements

### Performance
- NFR1: 常规编辑操作（输入、光标移动、基础格式应用）在主流桌面设备上的交互延迟 P95 <= 100ms。
- NFR2: AI 请求发起后首段流式内容返回时间 TTFB P95 <= 3s。
- NFR3: 在 5 万字长文档场景下，侧边面板切换导致的可感知卡顿持续时间 <= 200ms。

### Security
- NFR4: 平台不得持久化存储用户 BYOK 密钥，且日志与遥测中不得记录明文密钥。
- NFR5: 用户创作数据在传输与存储过程中必须采用行业标准加密保护机制。
- NFR6: 用户仅可访问自身数据范围内的项目、文档与故事设定信息。

### Scalability
- NFR7: 系统架构在峰值并发提升 3 倍时仍可横向扩展，核心写作链路可用性 >= 99.5%。
- NFR8: 在调用量增长场景下，AI 能力层具备限流、重试与降级策略，故障场景下核心写作链路可用性 >= 99.0%。

### Accessibility
- NFR9: 核心创作与设置流程满足 WCAG 2.1 AA，键盘可达覆盖率达到 100%。
- NFR10: 关键交互与状态反馈具备可感知文本提示，关键页面颜色对比度满足 WCAG 2.1 AA（普通文本 >= 4.5:1）。

### Integration
- NFR11: 系统应兼容 OpenAI-compatible 接口范式，支持多 Provider 差异化适配。
- NFR12: 对外部模型连接异常应输出可解释错误信息，便于用户与支持角色快速定位问题。
