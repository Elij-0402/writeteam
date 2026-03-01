import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

async function read(pathFromRoot) {
  return readFile(join(ROOT, pathFromRoot), "utf8")
}

// ═══════════════════════════════════════════════════════════════
// Shared error classification module (extracted by code review)
// ═══════════════════════════════════════════════════════════════

test("error-classification module defines all error categories", async () => {
  const mod = await read("src/lib/ai/error-classification.ts")

  // HTTP error classifications
  assert.ok(mod.includes("401") && mod.includes("403"), "must classify auth errors (401/403)")
  assert.ok(mod.includes("404"), "must classify not-found errors (404)")
  assert.ok(mod.includes("429"), "must classify rate-limit errors (429)")
  assert.ok(mod.includes(">= 500"), "must classify server errors (500+)")

  // Network error classifications
  assert.ok(mod.includes("timeout") && mod.includes("abort"), "must classify timeout/abort errors")
  assert.ok(mod.includes("econnrefused") && mod.includes("enotfound"), "must classify DNS/connection errors")

  // Timeout constant
  assert.ok(mod.includes("AI_FETCH_TIMEOUT_MS"), "must export fetch timeout constant")
})

test("error-classification includes Chinese actionable hints for all categories", async () => {
  const mod = await read("src/lib/ai/error-classification.ts")

  const requiredHints = [
    "检查 API Key 是否有效",       // auth failure
    "检查模型 ID 是否正确",        // model not found (connection-test context)
    "检查 Base URL 是否正确",      // endpoint not found / network unreachable
    "稍后重试",                    // rate limit / server error
    "检查网络连接",                // timeout
    "更换 Provider",               // timeout alternative
  ]

  for (const hint of requiredHints) {
    assert.ok(
      mod.includes(hint),
      `error-classification must include actionable hint: "${hint}"`
    )
  }
})

test("error-classification supports context-aware 404 messages", async () => {
  const mod = await read("src/lib/ai/error-classification.ts")
  assert.ok(mod.includes("connection-test"), "must support connection-test context")
  assert.ok(mod.includes("model-list"), "must support model-list context")
  assert.ok(mod.includes("ai-stream"), "must support ai-stream context")
})

// ═══════════════════════════════════════════════════════════════
// Task 1: 验证 BYOK 配置完整性 (AC: 1)
// ═══════════════════════════════════════════════════════════════

test("AIProviderConfig type includes all required fields", async () => {
  const config = await read("src/lib/ai/ai-config.ts")
  assert.ok(config.includes("baseUrl: string"), "must include baseUrl field")
  assert.ok(config.includes("apiKey: string"), "must include apiKey field")
  assert.ok(config.includes("modelId: string"), "must include modelId field")
  assert.ok(config.includes("modelName: string"), "must include modelName field")
  assert.ok(config.includes("configuredAt: number"), "must include configuredAt timestamp")
})

test("PROVIDER_PRESETS contains 5 preset providers", async () => {
  const config = await read("src/lib/ai/ai-config.ts")
  assert.ok(config.includes('"DeepSeek"'), "must include DeepSeek preset")
  assert.ok(config.includes('"OpenAI"'), "must include OpenAI preset")
  assert.ok(config.includes('"Ollama"'), "must include Ollama preset")
  assert.ok(config.includes('"OpenRouter"'), "must include OpenRouter preset")
  assert.ok(config.includes('"硅基流动"'), "must include SiliconFlow preset")
})

test("AI_CONFIG_HEADERS defines X-AI-* custom headers", async () => {
  const config = await read("src/lib/ai/ai-config.ts")
  assert.ok(config.includes('"X-AI-Base-URL"'), "must define X-AI-Base-URL header")
  assert.ok(config.includes('"X-AI-API-Key"'), "must define X-AI-API-Key header")
  assert.ok(config.includes('"X-AI-Model-ID"'), "must define X-AI-Model-ID header")
})

test("normalizeBaseUrl adds https:// and /v1 suffix", async () => {
  const form = await read("src/components/settings/ai-provider-form.tsx")
  // Must add https:// for URLs without protocol
  assert.ok(
    form.includes("https://"),
    "normalizeBaseUrl must add https:// prefix"
  )
  // Must append /v1 if no version suffix
  assert.ok(
    form.includes("/v1"),
    "normalizeBaseUrl must append /v1 suffix"
  )
  // Must remove trailing slashes
  assert.ok(
    form.includes("replace(/\\/+$/, \"\")"),
    "normalizeBaseUrl must remove trailing slashes"
  )
})

test("AI config persists to localStorage via AI_CONFIG_STORAGE_KEY", async () => {
  const hook = await read("src/lib/ai/use-ai-config.ts")
  assert.ok(
    hook.includes("AI_CONFIG_STORAGE_KEY"),
    "must use AI_CONFIG_STORAGE_KEY constant"
  )
  assert.ok(
    hook.includes("localStorage.setItem"),
    "updateConfig must save to localStorage"
  )
  assert.ok(
    hook.includes("localStorage.getItem"),
    "readStoredConfig must read from localStorage"
  )
  assert.ok(
    hook.includes("JSON.parse"),
    "must parse stored config as JSON"
  )
  assert.ok(
    hook.includes("JSON.stringify"),
    "must stringify config for localStorage"
  )
})

test("useAIConfig provides clearConfig that removes localStorage entry", async () => {
  const hook = await read("src/lib/ai/use-ai-config.ts")
  assert.ok(
    hook.includes("localStorage.removeItem"),
    "clearConfig must remove localStorage entry"
  )
})

test("Config summary displays Base URL, model name, and configured time", async () => {
  const form = await read("src/components/settings/ai-provider-form.tsx")
  assert.ok(form.includes("config.baseUrl"), "summary must display Base URL")
  assert.ok(
    form.includes("config.modelName") || form.includes("config.modelId"),
    "summary must display model name/ID"
  )
  assert.ok(
    form.includes("config.configuredAt"),
    "summary must display configured time"
  )
  assert.ok(
    form.includes('toLocaleString("zh-CN")'),
    "configured time must be formatted in Chinese locale"
  )
})

test("Settings form includes provider preset buttons", async () => {
  const form = await read("src/components/settings/ai-provider-form.tsx")
  assert.ok(
    form.includes("PROVIDER_PRESETS.map"),
    "form must render provider preset buttons from PROVIDER_PRESETS array"
  )
  assert.ok(
    form.includes("handlePresetClick"),
    "preset buttons must trigger handlePresetClick"
  )
})

test("API Key input supports password toggle visibility", async () => {
  const form = await read("src/components/settings/ai-provider-form.tsx")
  assert.ok(
    form.includes("showApiKey"),
    "form must track API Key visibility state"
  )
  assert.ok(
    form.includes('type={showApiKey ? "text" : "password"}'),
    "API Key input must toggle between text and password types"
  )
  assert.ok(
    form.includes("Eye") && form.includes("EyeOff"),
    "must use Eye/EyeOff icons for toggle"
  )
})

test("Ollama scenario: empty API Key is correctly accepted", async () => {
  const resolveConfig = await read("src/lib/ai/resolve-config.ts")
  // resolveAIConfig must default apiKey to empty string, not null
  assert.ok(
    resolveConfig.includes('|| ""'),
    "resolveAIConfig must default apiKey to empty string for Ollama"
  )
  // Comment or code should document this behavior
  assert.ok(
    resolveConfig.includes("API key may be empty"),
    "must document that API key can be empty (e.g., for Ollama)"
  )

  const testConn = await read("src/app/api/ai/test-connection/route.ts")
  assert.ok(
    testConn.includes("if (aiConfig.apiKey)"),
    "test-connection must conditionally set Authorization header (skip for empty key)"
  )

  const models = await read("src/app/api/ai/models/route.ts")
  assert.ok(
    models.includes("if (aiConfig.apiKey)"),
    "models endpoint must conditionally set Authorization header (skip for empty key)"
  )
})

// ═══════════════════════════════════════════════════════════════
// Task 2: 验证连接测试链路 (AC: 2, 5)
// ═══════════════════════════════════════════════════════════════

test("test-connection endpoint has auth guard", async () => {
  const route = await read("src/app/api/ai/test-connection/route.ts")
  assert.ok(route.includes("supabase.auth.getUser()"), "must verify user authentication")
  assert.ok(
    route.includes('Response.json({ error: "未登录" }, { status: 401 })'),
    "must return Chinese 401 error for unauthenticated"
  )
})

test("test-connection endpoint has BYOK config guard", async () => {
  const route = await read("src/app/api/ai/test-connection/route.ts")
  assert.ok(route.includes("resolveAIConfig(request)"), "must resolve BYOK config from headers")
  assert.ok(
    route.includes("AI 服务未配置") || route.includes("未配置"),
    "must return Chinese error when config missing"
  )
})

test("test-connection returns structured success result", async () => {
  const route = await read("src/app/api/ai/test-connection/route.ts")
  assert.ok(route.includes("success: true"), "must return success: true on success")
  assert.ok(route.includes("latency_ms"), "must return latency_ms measurement")
  assert.ok(route.includes("model"), "must return model identifier")
})

test("test-connection uses shared error classification module", async () => {
  const route = await read("src/app/api/ai/test-connection/route.ts")
  assert.ok(
    route.includes('from "@/lib/ai/error-classification"'),
    "must import from shared error-classification module"
  )
  assert.ok(
    route.includes("classifyHttpError") && route.includes("classifyNetworkError"),
    "must use both classifyHttpError and classifyNetworkError"
  )
  assert.ok(
    route.includes('"connection-test"'),
    "must pass connection-test context to classifyHttpError"
  )
})

test("test-connection uses AbortController for fetch timeout", async () => {
  const route = await read("src/app/api/ai/test-connection/route.ts")
  assert.ok(
    route.includes("AbortController"),
    "must create AbortController for timeout"
  )
  assert.ok(
    route.includes("AI_FETCH_TIMEOUT_MS"),
    "must use shared timeout constant"
  )
  assert.ok(
    route.includes("signal: controller.signal"),
    "must pass abort signal to fetch"
  )
  assert.ok(
    route.includes("clearTimeout"),
    "must clear timeout on success"
  )
})

// ═══════════════════════════════════════════════════════════════
// Task 3: 验证模型选择链路 (AC: 3)
// ═══════════════════════════════════════════════════════════════

test("models endpoint has auth guard", async () => {
  const route = await read("src/app/api/ai/models/route.ts")
  assert.ok(route.includes("supabase.auth.getUser()"), "must verify user authentication")
  assert.ok(
    route.includes('Response.json({ error: "未登录" }, { status: 401 })'),
    "must return Chinese 401 error for unauthenticated"
  )
})

test("models endpoint handles three response formats", async () => {
  const route = await read("src/app/api/ai/models/route.ts")
  // OpenAI format: { data: [...] }
  assert.ok(route.includes("data.data"), "must handle OpenAI { data: [...] } format")
  // Ollama format: { models: [...] }
  assert.ok(route.includes("data.models"), "must handle Ollama { models: [...] } format")
  // Direct array format
  assert.ok(
    route.includes("Array.isArray(data)"),
    "must handle direct array response format"
  )
})

test("models endpoint uses shared error classification module", async () => {
  const route = await read("src/app/api/ai/models/route.ts")
  assert.ok(
    route.includes('from "@/lib/ai/error-classification"'),
    "must import from shared error-classification module"
  )
  assert.ok(
    route.includes("classifyHttpError") && route.includes("classifyNetworkError"),
    "must use both classifyHttpError and classifyNetworkError"
  )
  assert.ok(
    route.includes('"model-list"'),
    "must pass model-list context to classifyHttpError"
  )
})

test("models endpoint uses AbortController for fetch timeout", async () => {
  const route = await read("src/app/api/ai/models/route.ts")
  assert.ok(
    route.includes("AbortController"),
    "must create AbortController for timeout"
  )
  assert.ok(
    route.includes("signal: controller.signal"),
    "must pass abort signal to fetch"
  )
})

test("models endpoint filters invalid model entries at runtime", async () => {
  const route = await read("src/app/api/ai/models/route.ts")
  assert.ok(
    route.includes('.filter('),
    "must filter rawModels before mapping"
  )
  assert.ok(
    route.includes('typeof m.id === "string"'),
    "must validate model id is a string at runtime"
  )
})

test("model combobox supports search and manual input fallback", async () => {
  const form = await read("src/components/settings/ai-provider-form.tsx")
  assert.ok(form.includes("CommandInput"), "must include search input in model combobox")
  assert.ok(
    form.includes("搜索或手动输入模型"),
    "search placeholder must indicate manual input support"
  )
  // Manual input fallback when no models loaded
  assert.ok(
    form.includes("models.length === 0"),
    "must show manual input when no models available"
  )
  assert.ok(
    form.includes("手动输入模型 ID"),
    "manual input must have Chinese placeholder"
  )
})

test("empty model list shows Chinese guidance", async () => {
  const form = await read("src/components/settings/ai-provider-form.tsx")
  assert.ok(
    form.includes("未找到匹配模型"),
    "combobox empty state must show Chinese guidance message"
  )
  assert.ok(
    form.includes("未获取到任何模型") || form.includes("未找到"),
    "must show Chinese toast when no models fetched"
  )
})

// ═══════════════════════════════════════════════════════════════
// Task 4: 验证安全合规 (AC: 4)
// ═══════════════════════════════════════════════════════════════

test("openai-stream telemetry does NOT record API Key", async () => {
  const stream = await read("src/lib/ai/openai-stream.ts")

  // The ai_history insert should NOT include apiKey or api_key fields
  // Extract the insert object content
  const insertMatch = stream.match(/\.insert\(\{[\s\S]*?\}\)/)?.[0] || ""

  assert.ok(
    !insertMatch.includes("apiKey") && !insertMatch.includes("api_key"),
    "ai_history telemetry must NOT include API Key field"
  )
  assert.ok(
    !insertMatch.includes("API_KEY") && !insertMatch.includes("X-AI-API-Key"),
    "ai_history telemetry must NOT reference API Key header"
  )
})

test("openai-stream error path uses classified errors (no raw provider text leak)", async () => {
  const stream = await read("src/lib/ai/openai-stream.ts")
  assert.ok(
    stream.includes("classifyHttpError"),
    "openai-stream must use classifyHttpError for error responses"
  )
  assert.ok(
    !stream.includes("response.text()"),
    "openai-stream must NOT read raw response text for error messages"
  )
  assert.ok(
    stream.includes('"ai-stream"'),
    "openai-stream must pass ai-stream context to classifyHttpError"
  )
})

test("AI route handlers do not console.log/error API Key", async () => {
  const testConn = await read("src/app/api/ai/test-connection/route.ts")
  const models = await read("src/app/api/ai/models/route.ts")

  // Neither endpoint should have console.log/error that could leak keys
  assert.ok(
    !testConn.includes("console.log") && !testConn.includes("console.error"),
    "test-connection must not use console.log/error (risk of API Key leaking)"
  )
  assert.ok(
    !models.includes("console.log") && !models.includes("console.error"),
    "models endpoint must not use console.log/error (risk of API Key leaking)"
  )
})

test("error responses do NOT echo raw provider response (API Key safety)", async () => {
  const testConn = await read("src/app/api/ai/test-connection/route.ts")

  // The error handling must NOT directly concatenate raw response text
  assert.ok(
    !testConn.includes("response.text()"),
    "test-connection must NOT read raw response text (could contain auth info)"
  )

  const models = await read("src/app/api/ai/models/route.ts")
  assert.ok(
    !models.includes("response.text()"),
    "models endpoint must NOT read raw response text (could contain auth info)"
  )
})

// ═══════════════════════════════════════════════════════════════
// Task 5: 补齐错误语义与恢复路径 (AC: 5)
// ═══════════════════════════════════════════════════════════════

test("shared error classification covers all required Chinese recovery hints", async () => {
  const mod = await read("src/lib/ai/error-classification.ts")

  // Each error category must have a specific Chinese message
  const requiredPatterns = [
    "检查 API Key",       // auth failure hint
    "检查 Base URL",      // network/unreachable hint
    "检查网络连接",       // timeout hint
    "检查模型",           // model not found hint
  ]

  for (const pattern of requiredPatterns) {
    assert.ok(
      mod.includes(pattern),
      `error-classification must include actionable hint: "${pattern}"`
    )
  }
})

test("Provider unreachable suggests checking Base URL", async () => {
  const mod = await read("src/lib/ai/error-classification.ts")
  // Network errors (ECONNREFUSED, ENOTFOUND, fetch failed) must suggest checking Base URL
  assert.ok(
    mod.includes("检查 Base URL 是否正确"),
    "provider unreachable must suggest checking Base URL"
  )
})

test("Auth failure suggests checking API Key", async () => {
  const mod = await read("src/lib/ai/error-classification.ts")
  assert.ok(
    mod.includes("检查 API Key 是否有效"),
    "authentication failure must suggest checking API Key"
  )
})

test("Timeout suggests checking network or switching Provider", async () => {
  const mod = await read("src/lib/ai/error-classification.ts")
  assert.ok(
    mod.includes("检查网络连接") && mod.includes("更换 Provider"),
    "timeout must suggest checking network and switching provider"
  )
})
