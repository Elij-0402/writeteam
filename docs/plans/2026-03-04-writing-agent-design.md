# WriteTeam 写作智能体架构设计

> 日期：2026-03-04
> 状态：草案
> 前置：基于「架构精简与演进设计」(2026-03-04) 的端点合并和能力模板系统
> 核心依赖：Vercel AI SDK v6（已安装未使用）、Supabase pgvector

## 一、现状诊断

### 当前 AI 调用链路

```
客户端点击 → HTTP POST（BYOK headers）→ raw fetch /chat/completions → SSE 流式 → 纯文本输出
```

每次调用都是**无状态的单次生成**：
- `openai-stream.ts` 用 raw `fetch()` 直接调用 OpenAI 兼容 API
- `ai` (^6.0.100) 和 `@ai-sdk/openai` (^3.0.33) 已安装但**零使用**
- 无 tool calling、无多步推理、无生成后验证
- 对话历史仅存客户端 `useState([])`，刷新即丢失
- AI 只能看到当前文档最后 2000-3000 字，跨章节完全失明

### 核心问题

| 问题 | 根因 | 用户感受 |
|------|------|---------|
| 角色性格漂移 | 15 个角色平铺注入，注意力被稀释 | "AI 忘记了李明是沉默寡言的" |
| 情节断裂 | 无跨章节上下文 | "续写完全不接前面的伏笔" |
| 无自我修正 | 单次生成无验证 | "AI 写出了时间线矛盾但自己不知道" |
| 工作流碎片化 | 用户手动选择 18 个意图 | "我只想说'帮我把这段写好'，不想选菜单" |
| 无学习能力 | 每次调用无状态 | "改了 100 次它还是用我不喜欢的风格" |

## 二、设计目标

从**参数化 prompt 框架**演进为**具备记忆和推理能力的写作智能体**，分三个阶段：

```
Phase 1: 智能上下文层（Smart Context）
         → 让每次 LLM 调用拿到最精准的信息

Phase 2: 验证-修正循环（Agent Loop）
         → 生成后自动验证一致性，发现问题自动修正

Phase 3: 工具驱动的自主 Agent（Tool-Use Agent）
         → AI 主动搜索信息、规划步骤、自主完成复杂任务
```

每一层构建在前一层之上，无废弃工作。

## 三、基础设施：迁移到 Vercel AI SDK

### 3.1 为什么迁移

| 维度 | raw fetch（现在） | Vercel AI SDK（迁移后） |
|------|-------------------|----------------------|
| 流式处理 | 手动解析 SSE data: 帧 | `streamText()` 自动处理 |
| Tool Calling | 不支持 | `tools` + `maxSteps` 原生支持 |
| Structured Output | 不支持 | `generateObject()` + zod schema |
| 多 Provider | 仅 OpenAI 兼容 | 30+ provider 统一接口 |
| 错误处理 | 手动分类 | SDK 标准化异常 |
| Token 计算 | `Math.ceil(text.length / 4)` 估算 | SDK 返回精确 usage |

### 3.2 迁移方案

**改动范围极小** — 仅替换 `openai-stream.ts` 的内部实现，外部接口不变。

#### 改动文件清单

| 文件 | 改动 | 说明 |
|------|------|------|
| `src/lib/ai/openai-stream.ts` | **重写** | raw fetch → AI SDK |
| `src/lib/ai/ai-provider.ts` | **新建** | BYOK provider 工厂函数 |
| `src/lib/ai/tool-support.ts` | **新建** | Tool calling 能力检测与降级 |
| `src/lib/ai/shared-pipeline.ts` | **微调** | Step 5 调用方式调整 |
| 各 route handler | **不变** | buildMessages 接口不变 |
| 全部客户端代码 | **不变** | 无感知 |

#### 3.2.1 BYOK Provider 工厂

```typescript
// src/lib/ai/ai-provider.ts
import { createOpenAI } from "@ai-sdk/openai"

interface BYOKConfig {
  baseUrl: string
  apiKey: string
  modelId: string
}

/**
 * 从用户的 BYOK 配置创建 AI SDK provider。
 * 所有 5 个预设 provider 都兼容 OpenAI 格式，
 * 因此统一使用 createOpenAI。
 */
export function createBYOKProvider(config: BYOKConfig) {
  const openai = createOpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey || undefined,  // Ollama 无需 key
  })
  return openai(config.modelId)
}
```

#### 3.2.2 流式生成（替代 raw fetch）

```typescript
// src/lib/ai/openai-stream.ts（重写后核心逻辑）
import { streamText } from "ai"
import { createBYOKProvider } from "./ai-provider"

export async function createOpenAIStreamResponse(
  options: OpenAIStreamOptions,
  telemetry: TelemetryOptions
): Promise<Response> {
  const model = createBYOKProvider({
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    modelId: options.modelId,
  })

  const result = streamText({
    model,
    messages: options.messages,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
  })

  // AI SDK 原生支持 toTextStreamResponse()
  // 但我们需要写遥测，所以用手动消费
  const startedAt = Date.now()
  let fullText = ""

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const chunk of result.textStream) {
          fullText += chunk
          controller.enqueue(encoder.encode(chunk))
        }
      } catch (error) {
        // 复用现有错误分类逻辑
        const classification = classifyAIError(null, error, "ai-stream")
        controller.enqueue(encoder.encode(`\n\ndata: ${JSON.stringify(classification)}\n\n`))
      } finally {
        // 写遥测（复用现有逻辑）
        await writeTelemetry(telemetry, fullText, startedAt)
        controller.close()
      }
    }
  })

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
```

#### 3.2.3 Tool Calling 能力检测

```typescript
// src/lib/ai/tool-support.ts
import type { AIProviderConfig } from "./ai-config"

// 已知支持 tool calling 的 provider
const KNOWN_TOOL_SUPPORT: Record<string, boolean> = {
  "DeepSeek": true,
  "OpenAI": true,
  "OpenRouter": true,
}

/**
 * 检测用户配置的 provider/model 是否支持 tool calling。
 * 优先用已知列表，未知时做一次探测调用并缓存结果。
 */
export async function supportsToolCalling(
  config: AIProviderConfig
): Promise<boolean> {
  const provider = resolveProviderNameByBaseUrl(config.baseUrl)

  // 已知 provider 直接返回
  if (provider in KNOWN_TOOL_SUPPORT) {
    return KNOWN_TOOL_SUPPORT[provider]
  }

  // 未知 provider：检查客户端缓存
  const cacheKey = `tool-support:${config.baseUrl}:${config.modelId}`
  const cached = typeof window !== "undefined"
    ? localStorage.getItem(cacheKey)
    : null
  if (cached !== null) return cached === "true"

  // 探测：发送一个最小化的 tool calling 请求
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.modelId,
        messages: [{ role: "user", content: "test" }],
        tools: [{
          type: "function",
          function: {
            name: "test",
            description: "test",
            parameters: { type: "object", properties: {} },
          },
        }],
        max_tokens: 1,
      }),
    })
    const supported = response.ok
    if (typeof window !== "undefined") {
      localStorage.setItem(cacheKey, String(supported))
    }
    return supported
  } catch {
    return false
  }
}
```

### 3.3 迁移策略

```
Week 1:
  1. 新建 ai-provider.ts 和 tool-support.ts
  2. 重写 openai-stream.ts（保持外部接口不变）
  3. 跑全部现有测试，确保零回归

Week 1 结束时的状态：
  - 所有 18 个意图正常工作（行为无变化）
  - 内部从 raw fetch 切换到 AI SDK
  - 获得 tool calling 能力（暂不启用）
```

## 四、Phase 1：智能上下文层

### 4.1 章节摘要系统

#### 数据模型

```sql
-- 新表：document_summaries
CREATE TABLE document_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,          -- 文档内容的 hash，用于判断是否过期
  summary JSONB NOT NULL,              -- 结构化摘要
  token_count INTEGER,                 -- 摘要的 token 数
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE document_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户只能访问自己的摘要"
  ON document_summaries FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX idx_summaries_project ON document_summaries(project_id);
```

#### 摘要结构

```typescript
interface ChapterSummary {
  // 核心叙事
  synopsis: string              // 本章发生了什么（100-200 字）
  emotionalArc: string          // 情感走向（如 "平静 → 紧张 → 爆发 → 沉默"）

  // 元素追踪
  charactersPresent: string[]   // 出场角色
  locations: string[]           // 涉及地点
  timelinePosition: string      // 时间点（如 "第3天晚上"）

  // 伏笔与线索
  plotAdvances: string[]        // 推进了哪些情节线
  foreshadowsPlanted: string[]  // 新埋的伏笔
  foreshadowsResolved: string[] // 回收的伏笔
  unresolvedThreads: string[]   // 未解决的悬念

  // 写作特征
  dominantTone: string          // 主基调
  sceneCount: number            // 场景数量
  wordCount: number             // 字数
}
```

#### 生成时机

```
触发条件：
  1. 文档 autosave 时，比较 content_hash
  2. 如果 hash 不同且距上次更新 > 5 分钟 → 标记为待更新
  3. 用户切换到其他文档时 → 后台触发摘要生成
  4. AI 续写/编辑调用时 → 检查前序章节摘要是否存在

不触发：
  - 正在编辑的当前文档（避免干扰）
  - 字数 < 200 的文档（内容太少）
```

#### 摘要生成 prompt

```
你是一个小说分析助手。请阅读以下章节内容，生成结构化摘要。

要求：
- synopsis 控制在 100-200 字，只保留关键情节点
- 精确列出出场角色（用全名）
- 标记伏笔时区分"新埋设"和"回收了之前的"
- 时间线要具体到"第几天"或"几小时后"

章节内容：
{document_content}

输出 JSON 格式（严格遵守结构）。
```

使用 AI SDK 的 `generateObject()` + zod schema 保证输出格式：

```typescript
import { generateObject } from "ai"
import { z } from "zod"

const ChapterSummarySchema = z.object({
  synopsis: z.string(),
  emotionalArc: z.string(),
  charactersPresent: z.array(z.string()),
  locations: z.array(z.string()),
  timelinePosition: z.string(),
  plotAdvances: z.array(z.string()),
  foreshadowsPlanted: z.array(z.string()),
  foreshadowsResolved: z.array(z.string()),
  unresolvedThreads: z.array(z.string()),
  dominantTone: z.string(),
  sceneCount: z.number(),
  wordCount: z.number(),
})

async function generateChapterSummary(
  content: string,
  config: BYOKConfig
): Promise<ChapterSummary> {
  const model = createBYOKProvider(config)

  const { object } = await generateObject({
    model,
    schema: ChapterSummarySchema,
    prompt: `分析以下章节内容，生成结构化摘要...\n\n${content}`,
    temperature: 0.3,
  })

  return object
}
```

### 4.2 动态角色聚焦

改造 `story-context.ts` 中的 `buildCharacterGuidance()`：

```
当前行为：
  加载全部角色（最多 15 个）→ 全部写入 system prompt

改造后：
  1. 从 saliencyMap 获取当前文本中活跃的角色名
  2. 从前序章节摘要获取 charactersPresent
  3. 分三级注入：

  Tier 1（完整信息）：当前文本中直接出现的角色
    → 全部 9 个字段（描述、外貌、性格、对话风格、背景、目标、关系、备注）
    → 最多 3 个角色

  Tier 2（核心信息）：前 2 章出现过但当前不在场的角色
    → 4 个字段（描述、性格、目标、关系）
    → 最多 5 个角色

  Tier 3（仅名字）：其他所有角色
    → 一行列表："其他角色：王五、赵六、孙七"
```

改造代码位置：`src/lib/ai/story-context.ts` 的 `buildCharacterGuidance()` 函数。

### 4.3 大纲进度感知

改造 `buildOutlineGuidance()`：

```
当前：outline.slice(0, 2000) — 盲目截断

改造：
  1. 将大纲解析为节拍列表（按换行符/编号分割）
  2. 根据章节摘要匹配已完成的节拍
  3. 标记当前位置
  4. 只展开当前节拍和下一个节拍的详情

输出格式：
  [故事大纲进度]
  ✅ 第1章 开篇：李明抵达北京
  ✅ 第2章 引入：酒吧遇到张花
  📍 第3章 发展：追踪信封线索
     当前节拍：李明独自分析信封上的暗号
     下一节拍：发现指向废弃仓库的地址
  ⬜ 第4章 转折：第一次对峙
  ⬜ 第5章 高潮：真相揭示
```

### 4.4 语义检索（RAG）

#### 数据模型

```sql
-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 新表：document_chunks
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  chunk_index INTEGER NOT NULL,        -- 在文档中的位置序号
  chunk_text TEXT NOT NULL,            -- 原始文本（约 500 字/段）
  embedding VECTOR(1536),              -- 向量嵌入
  content_hash TEXT NOT NULL,          -- 用于增量更新
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户只能访问自己的分块"
  ON document_chunks FOR ALL
  USING (user_id = auth.uid());

-- 向量搜索索引
CREATE INDEX idx_chunks_embedding ON document_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_chunks_project ON document_chunks(project_id);
```

#### Embedding 生成

```
方案选择：
  A) 用户的 BYOK 模型生成 embedding
     → 问题：不是所有模型都有 /embeddings 端点

  B) 客户端本地 embedding（推荐）
     → 使用 Transformers.js 在浏览器中运行轻量 embedding 模型
     → 推荐模型：all-MiniLM-L6-v2（22MB，384维）
     → 或 bge-small-zh-v1.5（93MB，512维，中文优化）
     → 无需额外 API 调用，无 BYOK 兼容性问题

  C) Supabase Edge Function 生成
     → 使用 Supabase 内置的 embedding 函数
     → 需要额外配置

推荐方案 B：客户端 embedding
  - 零额外成本
  - 零 BYOK 兼容性问题
  - 中文场景下 bge-small-zh 效果好
  - 首次加载 93MB，之后缓存
```

#### 检索流程

```typescript
async function retrieveRelevantChunks(
  projectId: string,
  queryText: string,
  topK: number = 5
): Promise<string[]> {
  // 1. 对 query 文本做 embedding
  const queryEmbedding = await embedText(queryText.slice(-200))

  // 2. 向量相似度搜索（Supabase RPC）
  const { data } = await supabase.rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_project_id: projectId,
    match_threshold: 0.7,
    match_count: topK,
  })

  // 3. 返回相关段落（附带来源标注）
  return data.map(chunk =>
    `[${chunk.document_title} · 第${chunk.chunk_index}段]\n${chunk.chunk_text}`
  )
}
```

#### 注入方式

在 `buildStoryPromptContext()` 中新增一段：

```
[相关参考段落]
以下是故事中与当前场景相关的段落，供保持连贯性参考（勿复制重复）：

[第1章 · 第3段]
李明第一次看到那个信封时，手指微微颤抖。信封上没有寄件人，
只有用红墨水写的一行地址...

[第2章 · 第7段]
"有些东西比生命更重要。"张花说这话时眼神闪烁，
仿佛在衡量该告诉他多少...
```

### 4.5 Phase 1 对 pipeline 的改造

```
当前 5 步 pipeline（shared-pipeline.ts）：

  Step 1: validateAndResolve()        — 不变
  Step 2: getIntentConfig()           — 不变
  Step 3: fetchStoryContext()         — 改造：加载章节摘要
  Step 3.5: consistencyPreflight()    — 不变
  Step 4: buildStoryPromptContext()   — 改造：动态角色 + 大纲进度 + RAG
  Step 4.5: buildMessages()           — 不变
  Step 5: createOpenAIStreamResponse()— 改造：AI SDK

改造后 pipeline：

  Step 1: validateAndResolve()
  Step 2: getIntentConfig()
  Step 3: fetchStoryContext()
      ↓ 新增
      Step 3a: fetchChapterSummaries()    — 加载前序章节摘要
      Step 3b: retrieveRelevantChunks()   — 语义检索相关段落
  Step 3.5: consistencyPreflight()
  Step 4: buildStoryPromptContext()       — 使用摘要+角色聚焦+大纲进度+RAG
  Step 4.5: buildMessages()
  Step 5: streamWithAISDK()               — AI SDK 流式
```

### 4.6 Phase 1 预期效果

| 功能 | 之前 | 之后 |
|------|------|------|
| 角色一致性 | 15 个角色平铺，注意力稀释 | 3 个核心角色完整信息，注意力集中 |
| 跨章节连贯 | 完全失明 | 前 3 章摘要 + RAG 检索相关段落 |
| 大纲感知 | 盲目截断 2000 字 | 知道"在哪、往哪走" |
| 伏笔追踪 | 无 | 章节摘要中标记 planted/resolved |

## 五、Phase 2：验证-修正 Agent Loop

### 5.1 架构

在 Phase 1 的精准上下文基础上，给关键意图加上生成后验证。

```
Phase 1 输出 → 初稿
                ↓
        Verification Agent（独立 LLM 调用）
                ↓
        通过？── 是 → 输出给用户
                └─ 否 → Revision Agent 修正 → 再验证（最多 2 轮）
```

### 5.2 适用意图

不是所有意图都需要 agent loop。按收益/成本比选择：

| 意图 | 启用 Loop | 原因 |
|------|-----------|------|
| write | **是** | 续写最容易出现角色漂移和情节矛盾 |
| first-draft | **是** | 长文本（800-1200字）风险更高 |
| expand | 否 | 扩写基于选中文本，范围小 |
| quick-edit | **是** | 编辑可能引入新矛盾 |
| rewrite | 否 | 改写保持原意，风险低 |
| continuity-check | 否 | 本身就是检查功能 |
| chat | 否 | 对话场景，不修改文本 |
| scene-plan | 否 | 规划是草稿性质 |

### 5.3 验证维度

```typescript
interface VerificationCheck {
  dimension: string
  prompt: string
  severity: "high" | "medium" | "low"
}

const VERIFICATION_CHECKS: VerificationCheck[] = [
  {
    dimension: "character_consistency",
    prompt: `检查生成文本中的角色言行是否与设定一致。
      重点：说话风格、性格特征、已知信息边界。
      只报告确定的冲突，不猜测。`,
    severity: "high",
  },
  {
    dimension: "timeline_logic",
    prompt: `检查时间线是否合理。
      重点：时间流逝、地点转换、因果顺序。
      参考前文和章节摘要中的时间标记。`,
    severity: "high",
  },
  {
    dimension: "continuity",
    prompt: `检查与前文的衔接是否自然。
      重点：情绪连贯、场景过渡、对话上下文。
      不要求完美，只标记明显断裂。`,
    severity: "medium",
  },
  {
    dimension: "foreshadow",
    prompt: `检查是否遗漏了应当呼应的伏笔。
      参考章节摘要中的 unresolvedThreads。
      仅在伏笔与当前场景直接相关时才报告。`,
    severity: "low",
  },
]
```

### 5.4 验证实现

```typescript
// src/lib/ai/agent-loop.ts
import { generateObject } from "ai"
import { z } from "zod"

const VerificationResultSchema = z.object({
  passed: z.boolean(),
  issues: z.array(z.object({
    dimension: z.string(),
    description: z.string(),
    location: z.string(),
    suggestion: z.string(),
    severity: z.enum(["high", "medium", "low"]),
  })),
})

async function verifyDraft(
  draft: string,
  context: AgentContext
): Promise<VerificationResult> {
  const model = createBYOKProvider(context.config)

  const { object } = await generateObject({
    model,
    schema: VerificationResultSchema,
    system: `你是一名严格的小说连贯性审校员。
审查 AI 生成的续写文本，对照角色设定和前文检查一致性。
只报告确定存在的问题，不猜测、不吹毛求疵。`,
    prompt: `
【角色设定】
${context.activeCharacters.map(c => `${c.name}：${c.personality}，${c.dialogueStyle}`).join("\n")}

【前文摘要】
${context.previousChapterSummary}

【前文最后 500 字】
${context.precedingText.slice(-500)}

【生成的续写】
${draft}

请检查角色一致性、时间线逻辑、前文衔接、伏笔遗漏。`,
    temperature: 0.2,
    maxTokens: 500,
  })

  return object
}
```

### 5.5 修正实现

```typescript
async function reviseDraft(
  draft: string,
  issues: VerificationIssue[],
  context: AgentContext
): Promise<string> {
  const model = createBYOKProvider(context.config)

  const issueList = issues
    .filter(i => i.severity === "high")
    .map(i => `- ${i.description}（位置：${i.location}，建议：${i.suggestion}）`)
    .join("\n")

  const result = await generateText({
    model,
    system: context.originalSystemPrompt,  // 复用原始 system prompt
    prompt: `
以下续写文本存在一致性问题，请修正这些问题后重新输出完整文本。
仅修改有问题的部分，保持其余内容不变。

【问题清单】
${issueList}

【原始续写】
${draft}

请输出修正后的完整文本（不要输出解释，只输出修正后的正文）。`,
    temperature: 0.5,
    maxTokens: context.intentConfig.maxTokens,
  })

  return result.text
}
```

### 5.6 Agent Loop 主循环

```typescript
export async function agentGenerateWithVerification(options: {
  generateFn: () => Promise<ReadableStream>  // 现有的流式生成
  context: AgentContext
  maxRevisions: number                        // 建议 2
  onStreamChunk: (chunk: string) => void
  onVerificationStatus: (status: string) => void
}): Promise<{ text: string; revised: boolean; issues?: VerificationIssue[] }> {

  // Step 1: 生成初稿（流式输出给用户看）
  let draft = ""
  const stream = await options.generateFn()
  for await (const chunk of stream) {
    draft += chunk
    options.onStreamChunk(chunk)
  }

  // Step 2: 后台验证（用户已经看到初稿了）
  options.onVerificationStatus("verifying")
  const verification = await verifyDraft(draft, options.context)

  if (verification.passed) {
    return { text: draft, revised: false }
  }

  // Step 3: 筛选需要修正的问题
  const criticalIssues = verification.issues.filter(i => i.severity === "high")
  if (criticalIssues.length === 0) {
    // 只有低优先级问题，提示但不自动修正
    return { text: draft, revised: false, issues: verification.issues }
  }

  // Step 4: 修正（最多 maxRevisions 轮）
  options.onVerificationStatus("revising")
  let revised = draft
  for (let i = 0; i < options.maxRevisions; i++) {
    revised = await reviseDraft(revised, criticalIssues, options.context)

    const recheck = await verifyDraft(revised, options.context)
    if (recheck.passed || recheck.issues.filter(i => i.severity === "high").length === 0) {
      break
    }
  }

  return { text: revised, revised: true, issues: verification.issues }
}
```

### 5.7 用户体验设计

```
推荐 UX：先流式展示初稿，发现问题后替换

时间线：
  0s     用户点击续写
  0-3s   初稿流式输出（用户开始阅读）
  3-5s   后台验证中（底部状态栏显示 "🔍 正在验证一致性..."）
  5s     验证通过 → 状态栏消失
         验证失败 → 状态栏显示 "🔧 发现 1 个问题，正在修正..."
  5-8s   修正完成 → 文本平滑替换 + 提示 "已自动修正 1 处角色不一致 [查看详情]"

客户端实现：
  - AI 输出区域底部新增 VerificationStatusBar 组件
  - 修正后的文本用 diff 高亮显示变更部分（可选）
  - 用户可展开查看具体修正了什么
```

### 5.8 成本分析

```
单次续写的 LLM 调用次数：
  - 最少：2 次（生成 + 验证通过）
  - 最多：4 次（生成 + 验证 + 修正 + 再验证）
  - 平均预估：2.3 次（约 70% 一次验证通过）

Token 消耗对比：
  当前：~3000 input + ~500 output = 3500 tokens
  Phase 2：
    生成：~3000 input + ~500 output = 3500
    验证：~1500 input + ~200 output = 1700（更短的 context，JSON 输出）
    合计：~5200 tokens（+49%）
    如需修正：~7500 tokens（+114%）

优化措施：
  1. 验证调用使用 temperature=0.2, maxTokens=500（控制输出）
  2. 仅传递与验证相关的最小上下文（不需要完整故事圣经）
  3. 可配置开关：用户可在设置中关闭自动验证
```

## 六、Phase 3：工具驱动的自主 Agent

### 6.1 工具定义

```typescript
// src/lib/ai/agent-tools.ts
import { tool } from "ai"
import { z } from "zod"

export function createWritingAgentTools(context: {
  projectId: string
  supabase: SupabaseClient
  userId: string
}) {
  return {
    // 搜索全部章节中与 query 相关的段落
    searchChapters: tool({
      description: "在全部章节中搜索与关键词相关的段落，用于查找伏笔、角色历史、地点描写等",
      parameters: z.object({
        query: z.string().describe("搜索关键词或描述"),
        topK: z.number().optional().default(5).describe("返回结果数量"),
      }),
      execute: async ({ query, topK }) => {
        return await retrieveRelevantChunks(context.projectId, query, topK)
      },
    }),

    // 读取指定章节的结构化摘要
    readChapterSummary: tool({
      description: "读取指定章节的摘要，包括情节、角色、时间线、伏笔等信息",
      parameters: z.object({
        chapterIndex: z.number().describe("章节序号，从 1 开始"),
      }),
      execute: async ({ chapterIndex }) => {
        const { data } = await context.supabase
          .from("documents")
          .select("id, title, sort_order")
          .eq("project_id", context.projectId)
          .order("sort_order")

        const doc = data?.[chapterIndex - 1]
        if (!doc) return { error: `第 ${chapterIndex} 章不存在` }

        const { data: summary } = await context.supabase
          .from("document_summaries")
          .select("summary")
          .eq("document_id", doc.id)
          .single()

        return summary?.summary ?? { error: "该章节尚未生成摘要" }
      },
    }),

    // 获取角色的完整信息和当前弧线状态
    getCharacterDetails: tool({
      description: "获取指定角色的完整信息，包括性格、背景、目标、关系、对话风格等",
      parameters: z.object({
        characterName: z.string().describe("角色名字"),
      }),
      execute: async ({ characterName }) => {
        const { data } = await context.supabase
          .from("characters")
          .select("*")
          .eq("project_id", context.projectId)
          .ilike("name", `%${characterName}%`)
          .limit(1)
          .single()

        return data ?? { error: `未找到角色：${characterName}` }
      },
    }),

    // 获取大纲节拍及完成进度
    getOutlineProgress: tool({
      description: "获取故事大纲的节拍列表及各节拍的完成状态",
      parameters: z.object({}),
      execute: async () => {
        const { data: bible } = await context.supabase
          .from("story_bibles")
          .select("outline")
          .eq("project_id", context.projectId)
          .single()

        const { data: summaries } = await context.supabase
          .from("document_summaries")
          .select("summary")
          .eq("project_id", context.projectId)

        return {
          outline: bible?.outline ?? "无大纲",
          completedChapters: summaries?.length ?? 0,
          chapterSynopses: summaries?.map(s => s.summary?.synopsis) ?? [],
        }
      },
    }),

    // 检查一致性
    verifyConsistency: tool({
      description: "验证一段文本与故事设定的一致性，检查角色、时间线、情节矛盾",
      parameters: z.object({
        text: z.string().describe("要验证的文本"),
        checkTypes: z.array(z.enum([
          "character", "timeline", "continuity", "foreshadow"
        ])).optional().default(["character", "timeline"]),
      }),
      execute: async ({ text, checkTypes }) => {
        // 复用 Phase 2 的验证逻辑
        return await verifyDraft(text, { ...context, checkTypes })
      },
    }),
  }
}
```

### 6.2 Agent 调用方式

```typescript
// src/lib/ai/writing-agent.ts
import { generateText } from "ai"
import { createBYOKProvider } from "./ai-provider"
import { createWritingAgentTools } from "./agent-tools"

export async function runWritingAgent(options: {
  config: BYOKConfig
  instruction: string          // 用户的自然语言指令
  context: AgentContext
  maxSteps: number             // 最大工具调用轮数
}): Promise<AgentResult> {
  const model = createBYOKProvider(options.config)
  const tools = createWritingAgentTools(options.context)

  const result = await generateText({
    model,
    system: `你是一位专业的小说写作助手。你可以使用工具来搜索故事内容、
查阅角色信息、检查一致性。在生成创作内容之前，先用工具收集必要的信息，
确保输出与已有故事保持一致。

${options.context.storyBibleContext}`,

    prompt: options.instruction,
    tools,
    maxSteps: options.maxSteps,   // AI SDK 自动处理多轮工具调用
    temperature: 0.8,
  })

  return {
    text: result.text,
    toolCalls: result.steps.flatMap(s => s.toolCalls),
    totalSteps: result.steps.length,
  }
}
```

### 6.3 降级策略

当用户的模型不支持 tool calling 时，优雅降级：

```typescript
export async function executeAIRequest(
  intent: string,
  body: RequestBody,
  config: BYOKConfig,
  context: PipelineContext
): Promise<Response> {
  // Phase 3 意图（自然语言驱动）需要 tool calling
  const needsTools = intent === "agent" || intent === "auto-complete"

  if (needsTools && !(await supportsToolCalling(config))) {
    // 降级到 Phase 2：预收集上下文 + 验证循环
    const preCollectedContext = await preCollectContext(body, context)
    return await agentGenerateWithVerification({
      generateFn: () => streamWithContext(preCollectedContext, config),
      context,
      maxRevisions: 2,
    })
  }

  if (needsTools) {
    // Phase 3：完整 agent
    return await runWritingAgent({ config, instruction: body.instruction, context })
  }

  // Phase 2 意图（write, first-draft, quick-edit）
  const needsVerification = ["write", "first-draft", "quick-edit"].includes(intent)

  if (needsVerification) {
    return await agentGenerateWithVerification({
      generateFn: () => generateWithPipeline(intent, body, config, context),
      context,
      maxRevisions: 2,
    })
  }

  // Phase 1 / 基础意图：智能上下文 + 单次生成
  return await generateWithPipeline(intent, body, config, context)
}
```

### 6.4 降级层级图

```
用户请求
  │
  ├─ 模型支持 tool calling?
  │   ├─ 是 → Phase 3: Agent + Tools + Verification
  │   └─ 否 → 降级
  │            │
  │            ├─ 需要多步推理？
  │            │   ├─ 是 → Phase 2: 预收集上下文 + 验证循环
  │            │   └─ 否 → Phase 1: 智能上下文 + 单次生成
  │            │
  │            └─ （用户在设置中会看到提示：
  │                 "当前模型不支持高级 Agent 功能，
  │                  建议切换到 DeepSeek/OpenAI 以获得最佳体验"）
  │
  └─ 所有路径都使用 Phase 1 的智能上下文层
     （章节摘要 + 动态角色 + 大纲进度 + RAG）
```

## 七、数据库变更汇总

### 新增表

| 表名 | 用途 | Phase |
|------|------|-------|
| `document_summaries` | 章节结构化摘要 | Phase 1 |
| `document_chunks` | 文档分段 + 向量嵌入 | Phase 1 |

### 新增字段

| 表 | 字段 | 类型 | 用途 | Phase |
|----|------|------|------|-------|
| `story_bibles` | `ai_memory` | JSONB | 写作偏好记忆 | Phase 2 |

### 新增 RPC

| 函数名 | 用途 | Phase |
|--------|------|-------|
| `match_document_chunks` | 向量相似度搜索 | Phase 1 |

```sql
-- 向量搜索 RPC
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding VECTOR(1536),
  match_project_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  document_title TEXT,
  chunk_index INTEGER,
  chunk_text TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    d.title AS document_title,
    dc.chunk_index,
    dc.chunk_text,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE dc.project_id = match_project_id
    AND dc.user_id = auth.uid()
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

## 八、新增文件清单

```
src/lib/ai/
  ├─ ai-provider.ts          Phase 0: BYOK → AI SDK provider 工厂
  ├─ tool-support.ts         Phase 0: Tool calling 能力检测
  ├─ chapter-summary.ts      Phase 1: 章节摘要生成与管理
  ├─ document-chunker.ts     Phase 1: 文档分段与 embedding
  ├─ semantic-search.ts      Phase 1: 语义检索（RAG）
  ├─ agent-loop.ts           Phase 2: 验证-修正循环
  ├─ agent-tools.ts          Phase 3: Agent 工具定义
  └─ writing-agent.ts        Phase 3: Agent 主循环

src/components/ai/
  └─ verification-status.tsx  Phase 2: 验证状态栏组件

supabase/migrations/
  ├─ 015_document_summaries.sql   Phase 1
  ├─ 016_document_chunks.sql      Phase 1
  └─ 017_ai_memory.sql            Phase 2
```

## 九、实施路线图

```
Phase 0: AI SDK 迁移（1 周）
  ├─ 新建 ai-provider.ts, tool-support.ts
  ├─ 重写 openai-stream.ts 内部实现
  ├─ 全部测试通过，行为零变化
  └─ 交付物：AI SDK 替代 raw fetch，获得 tool calling 基础能力

Phase 1: 智能上下文层（2-3 周）
  ├─ Week 1: 章节摘要系统（DB + 生成逻辑 + 自动触发）
  ├─ Week 2: 动态角色聚焦 + 大纲进度感知
  ├─ Week 3: RAG（embedding + 向量搜索 + 注入）
  └─ 交付物：续写质量显著提升，跨章节连贯

Phase 2: 验证-修正循环（2 周）
  ├─ Week 1: agent-loop.ts + 验证逻辑 + 修正逻辑
  ├─ Week 2: 前端 VerificationStatus 组件 + 集成测试
  └─ 交付物：write/first-draft/quick-edit 自动验证修正

Phase 3: 工具驱动 Agent（3-4 周）
  ├─ Week 1-2: agent-tools.ts + writing-agent.ts
  ├─ Week 3: 降级策略 + 能力检测
  ├─ Week 4: 前端 Agent 交互界面
  └─ 交付物：自然语言驱动的写作 agent

总计：8-10 周
```

## 十、风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| AI SDK 与某些 BYOK provider 不兼容 | 部分用户无法使用 | 保留 raw fetch 作为 fallback |
| 章节摘要消耗额外 token | 增加用户 API 成本 | 摘要仅在文档变更时生成，结果缓存 |
| RAG embedding 模型下载体积大 | 首次加载慢 | 使用轻量模型（22MB）、CDN 加速 |
| Agent loop 增加响应延迟 | 用户等待更久 | 先流式输出初稿，后台验证 |
| 验证误报导致过度修正 | 修改了不该改的内容 | 仅修正 high severity，用户可关闭 |
| 模型不支持 generateObject() | 无法获得结构化输出 | 降级到文本输出 + 正则解析 |
| Supabase pgvector 性能 | 大量文档时搜索变慢 | IVFFlat 索引 + 项目级分区 |

## 十一、不做的事情

- **不做自有模型训练/微调** — 保持 BYOK 纯粹性
- **不做 OAuth 认证** — 所有 provider 都用 API Key，无需 OAuth
- **不做多模型路由** — 用户选一个模型，全部意图共用
- **不做实时协作编辑** — 单用户场景
- **不做 GPT Store / Plugin 协议适配** — 专注 OpenAI 兼容 API 格式
