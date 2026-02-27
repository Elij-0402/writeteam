# WriteTeam — API 合约文档

> 生成日期: 2026-02-27 | 扫描级别: Exhaustive | 总端点: 22

## 通用模式

### 认证

所有 API 路由需要 Supabase cookie 认证:
```
supabase.auth.getUser() → 401 if unauthenticated
```

### BYOK 头 (AI 路由)

AI 路由需要 3 个自定义 HTTP 头:
```
X-AI-Base-URL: https://api.deepseek.com/v1
X-AI-API-Key: sk-xxx
X-AI-Model-ID: deepseek-chat
```

缺少 `baseUrl` 或 `modelId` → 400 错误。

### 流式响应

除特别标注外，AI 路由返回纯文本流 (`text/plain`):
```
Content-Type: text/plain; charset=utf-8
Transfer-Encoding: chunked
```

### 遥测

每次流式 AI 调用自动记录到 `ai_history`:
- `latency_ms`, `output_chars`, `response_fingerprint` (SHA-256), estimated `tokens_used`

---

## 1. 认证 API

### `GET /api/auth/callback`

OAuth 回调处理。

| 参数 | 来源 | 必需 | 说明 |
|------|------|------|------|
| `code` | query | ✓ | OAuth 授权码 |
| `next` | query | — | 成功后跳转 URL (默认 `/dashboard`) |

**成功**: redirect → `next` 或 `/dashboard`
**失败**: redirect → `/login?error=auth_callback_error`

---

## 2. AI 写作工具

### `POST /api/ai/write`

续写/智能续写。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `context` | string | — | 当前上下文文本 |
| `mode` | string | — | `auto` (默认), `guided`, `tone-ominous`, `tone-romantic`, `tone-fast`, `tone-humorous` |
| `guidance` | string | — | guided 模式的用户指导 |
| `projectId` | string | ✓ | 项目 ID |
| `documentId` | string | — | 文档 ID |
| `proseMode` | string | — | 散文模式覆盖 |

**配置**: maxTokens=1000, temperature=0.8

### `POST /api/ai/rewrite`

改写选中文本。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `text` | string | ✓ | 要改写的文本 |
| `mode` | string | — | `rephrase`, `shorter`, `longer`, `show-not-tell`, `more-intense`, `more-lyrical`, `custom` |
| `customInstructions` | string | — | custom 模式的自定义指令 |
| `projectId` | string | ✓ | 项目 ID |
| `documentId` | string | — | 文档 ID |
| `proseMode` | string | — | 散文模式覆盖 |

**配置**: maxTokens=1500, temperature=0.7

### `POST /api/ai/expand`

扩写段落（目标 2-3 倍长度）。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `text` | string | ✓ | 要扩写的文本 |
| `context` | string | — | 上下文 |
| `projectId` | string | ✓ | 项目 ID |
| `documentId` | string | — | 文档 ID |
| `proseMode` | string | — | 散文模式覆盖 |

**配置**: maxTokens=1500, temperature=0.8

### `POST /api/ai/shrink`

缩写文本（目标 50% 长度）。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `text` | string | ✓ | 要缩写的文本 |
| `projectId` | string | ✓ | 项目 ID |
| `documentId` | string | — | 文档 ID |
| `proseMode` | string | — | 散文模式覆盖 |

**配置**: maxTokens=1000, temperature=0.5

### `POST /api/ai/quick-edit`

自然语言指令编辑。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `text` | string | ✓ | 要编辑的文本 |
| `instruction` | string | ✓ | 编辑指令 |
| `context` | string | — | 上下文 |
| `projectId` | string | ✓ | 项目 ID |
| `documentId` | string | — | 文档 ID |
| `proseMode` | string | — | 散文模式覆盖 |

**配置**: maxTokens=1500, temperature=0.7

### `POST /api/ai/first-draft`

从大纲生成初稿（800-1200 词）。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `outline` | string | ✓ | 大纲/节拍 |
| `context` | string | — | 上下文 |
| `projectId` | string | ✓ | 项目 ID |
| `documentId` | string | — | 文档 ID |
| `proseMode` | string | — | 散文模式覆盖 |

**配置**: maxTokens=2500, temperature=0.85

### `POST /api/ai/describe`

生成感官描述（视觉/听觉/嗅觉/触觉/味觉/隐喻）。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `text` | string | ✓ | 要描述的词/短语 |
| `projectId` | string | ✓ | 项目 ID |
| `documentId` | string | — | 文档 ID |

**配置**: maxTokens=800, temperature=0.9

### `POST /api/ai/tone-shift`

语气转换。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `text` | string | ✓ | 要转换的文本 |
| `tone` | string | ✓ | `tense`(紧张), `tender`(温柔), `humorous`(幽默), `melancholic`(悲伤), `angry`(愤怒), `mysterious`(神秘) |
| `projectId` | string | ✓ | 项目 ID |
| `documentId` | string | — | 文档 ID |
| `proseMode` | string | — | 散文模式覆盖 |

**配置**: maxTokens=1000, temperature=0.7

---

## 3. AI 规划工具

### `POST /api/ai/brainstorm`

头脑风暴（8-10 个创意）。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `topic` | string | ✓ | 头脑风暴主题 |
| `context` | string | — | 上下文 |
| `projectId` | string | ✓ | 项目 ID |
| `documentId` | string | — | 文档 ID |

**配置**: maxTokens=1000, temperature=1.0

### `POST /api/ai/scene-plan`

场景规划 (结构化场景拆分)。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `goal` | string | ✓ | 章节目标 |
| `context` | string | — | 上下文 |
| `projectId` | string | ✓ | 项目 ID |
| `documentId` | string | — | 文档 ID |
| `proseMode` | string | — | 散文模式覆盖 |

**配置**: maxTokens=1800, temperature=0.7

### `POST /api/ai/twist`

反转建议（3-5 个）。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `context` | string | — | 上下文 |
| `projectId` | string | ✓ | 项目 ID |
| `documentId` | string | — | 文档 ID |

**配置**: maxTokens=1500, temperature=0.9

### `POST /api/ai/muse`

灵感伙伴（3 种模式）。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `mode` | string | ✓ | `what-if`, `random-prompt`, `suggest` |
| `context` | string | — | 上下文 |
| `input` | string | — | what-if 模式的用户输入 |
| `projectId` | string | ✓ | 项目 ID |
| `documentId` | string | — | 文档 ID |

**配置**: maxTokens=1200, temperature=0.85-0.95 (按模式)

---

## 4. AI 分析工具

### `POST /api/ai/chat`

多轮 AI 对话。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `messages` | array | ✓ | `[{role: "user"|"assistant", content: string}]` |
| `context` | string | — | 上下文 |
| `projectId` | string | ✓ | 项目 ID |
| `documentId` | string | — | 文档 ID |
| `proseMode` | string | — | 散文模式覆盖 |

**配置**: maxTokens=1000, temperature=0.7

### `POST /api/ai/continuity-check`

连续性检查。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `passage` | string | ✓ | 要检查的段落 |
| `context` | string | — | 上下文 |
| `projectId` | string | ✓ | 项目 ID |
| `documentId` | string | — | 文档 ID |

**配置**: maxTokens=1200, temperature=0.3

---

## 5. AI 自定义/插件

### `POST /api/ai/plugin`

执行用户自定义插件。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `pluginId` | string | ✓ | 插件 ID |
| `projectId` | string | ✓ | 项目 ID |
| `documentId` | string | — | 文档 ID |
| `selection` | string | — | 选中文本 (requires_selection 时必需) |
| `context` | string | — | 上下文 |
| `input` | string | — | 额外输入 |

**模板变量**: `{{selection}}`, `{{context}}`, `{{input}}`
**配置**: 从 DB 插件记录读取 (max_tokens, temperature)

---

## 6. AI 视觉化

### `POST /api/ai/visualize`

文本生成图像 (DALL-E 3)。**非流式**, 返回 JSON。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `text` | string | ✓ | 描述文本 |
| `projectId` | string | ✓ | 项目 ID |
| `style` | string | — | `realistic`, `watercolor`, `anime`, `oil-painting`, `sketch` |

**响应**: `{ imageUrl: string, prompt: string }`
**流程**: LLM 优化 prompt → DALL-E 3 生成 (1024x1024) → 存入 images 表

### `POST /api/ai/canvas-generate`

画布 AI 生成节拍节点。**非流式**, 返回 JSON。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `outline` | string | ✓ | 大纲描述 |
| `projectId` | string | ✓ | 项目 ID |

---

## 7. AI 基础设施

### `GET /api/ai/models`

查询用户 Provider 可用模型列表。

**请求**: 仅需 BYOK 头 (无 body)
**响应**: `{ models: [{ id, name, owned_by }] }`
**说明**: 兼容 OpenAI `{ data: [...] }`, `{ models: [...] }`, 和裸数组格式

### `POST /api/ai/test-connection`

测试 Provider 连接。

**请求**: 仅需 BYOK 头 (无 body)
**响应**: `{ success: boolean, model?: string, error?: string, latency_ms: number }`
**说明**: 发送最小化 "Hi" 消息，max_tokens=5

### `POST /api/ai/feedback`

记录用户反馈（👍/👎）。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `projectId` | string | ✓ | 项目 ID |
| `feature` | string | ✓ | AI 功能名称 |
| `responseFingerprint` | string | ✓ | SHA-256 指纹 |
| `rating` | number | ✓ | `1` (👍) 或 `-1` (👎) |

**说明**: 不需要 BYOK 头。UPDATE ai_history SET user_rating, rated_at WHERE fingerprint match AND unrated.

---

## 8. Server Actions 总览

| 模块 | 函数数 | 操作表 |
|------|--------|--------|
| `auth.ts` | 3 | auth (signIn, signUp, signOut) |
| `projects.ts` | 4 | projects, story_bibles, documents |
| `documents.ts` | 5 | documents |
| `series.ts` | 8 | series, series_bibles, projects |
| `canvas.ts` | 8 | canvas_nodes, canvas_edges |
| `images.ts` | 2 | images |
| `plugins.ts` | 4 | plugins |
| `story-bible.ts` | 6 | story_bibles, characters |
| **合计** | **39** | **12 张表** |
