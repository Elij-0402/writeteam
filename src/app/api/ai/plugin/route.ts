import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse, extractRetryMeta } from "@/lib/ai/openai-stream"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 })
  }

  const aiConfig = resolveAIConfig(request)
  if (!aiConfig) {
    return Response.json({ error: "AI 服务未配置" }, { status: 400 })
  }

  const body = await request.json()
  const { pluginId, projectId, documentId, selection, context, input } = body

  if (!pluginId) {
    return Response.json({ error: "缺少插件 ID" }, { status: 400 })
  }

  // Fetch plugin config from DB
  const { data: plugin, error: pluginError } = await supabase
    .from("plugins")
    .select("*")
    .eq("id", pluginId)
    .eq("user_id", user.id)
    .single()

  if (pluginError || !plugin) {
    return Response.json({ error: "插件未找到" }, { status: 404 })
  }

  // Check if selection is required but missing
  if (plugin.requires_selection && !selection) {
    return Response.json({ error: "该插件需要先选中文本" }, { status: 400 })
  }

  // Fetch story context for template variable replacement
  const storyCtx = await fetchStoryContext(supabase, projectId, user.id)
  const { fullContext: storyContext } = buildStoryPromptContext(storyCtx, {
    feature: "plugin",
  })

  // Replace template variables in user_prompt_template
  let userPrompt = plugin.user_prompt_template
  userPrompt = userPrompt.replace(/\{\{selection\}\}/g, selection || "")
  userPrompt = userPrompt.replace(/\{\{context\}\}/g, context || "")
  userPrompt = userPrompt.replace(/\{\{input\}\}/g, input || "")

  // Build system prompt with story context
  let systemPrompt = plugin.system_prompt
  if (storyContext) {
    systemPrompt += `\n\n${storyContext}`
  }

  try {
    return createOpenAIStreamResponse(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: plugin.max_tokens || 1000,
        temperature: Number(plugin.temperature) || 0.7,
        ...aiConfig,
      },
      {
        supabase,
        userId: user.id,
        projectId,
        documentId: documentId || null,
        feature: "plugin",
        promptLog: `[Plugin: ${plugin.name}] ${userPrompt.slice(0, 400)}`,
        ...extractRetryMeta(body),
      }
    )
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
