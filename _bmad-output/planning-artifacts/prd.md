---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success']
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
