# Canvas AI JSON 解析健壮性修复

## 问题

故事画布的 AI 生成功能（`canvas-generate` intent）在解析 AI 返回的 JSON 时过于脆弱。当前 `cleanAIJson` 只去除 `` ```json `` 代码围栏，无法处理不同 LLM 的多样化输出格式，导致 `JSON.parse` 失败并报错"AI 返回格式错误，请重试"。

作为 BYOK 平台，用户会使用各种 LLM（DeepSeek、OpenAI、Ollama、OpenRouter 等），必须兼容所有常见的输出格式变体。

## 方案

在 `src/app/api/ai/plan/route.ts` 中增强 `cleanAIJson` 和 `parseBeats` 函数，实现多策略分层解析。

### 解析策略（按顺序）

1. 去除 code fences（覆盖所有变体：```json、```JSON、```js 等）
2. 去除尾随逗号
3. trim 后直接 JSON.parse
4. 失败则正则提取最外层 `[...]` 子串再解析
5. 失败则正则提取最外层 `{...}` 子串再解析
6. 如果解析结果是对象而非数组，查找第一个数组类型的属性值
7. 最终走 normalizeBeat 逐个校验

### 修改范围

- 只改 `src/app/api/ai/plan/route.ts` 中的 `cleanAIJson` 和 `parseBeats`
- `normalizeBeat`、客户端代码、`callOpenAIJson`、系统 prompt 均不变
