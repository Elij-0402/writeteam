import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse } from "@/lib/ai/openai-stream"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "未授权访问" }, { status: 401 })
  }

  const { text, mode, customInstructions, projectId, documentId, proseMode, modelId } = await request.json()

  if (!text) {
    return Response.json({ error: "未选择文本" }, { status: 400 })
  }

  const storyCtx = await fetchStoryContext(supabase, projectId)
  const { fullContext } = buildStoryPromptContext(storyCtx, { feature: "rewrite", proseMode })

  let systemPrompt = `You are a skilled fiction editor. Rewrite the given text according to the instructions. Return ONLY the rewritten text — no explanations, no meta-commentary.`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  let instruction = ""
  switch (mode) {
    case "rephrase":
      instruction = "Rephrase this passage while keeping the same meaning and narrative intent. Vary the sentence structure and word choice."
      break
    case "shorter":
      instruction = "Make this passage more concise. Remove unnecessary words and tighten the prose while preserving the essential meaning."
      break
    case "longer":
      instruction = "Expand this passage with more detail, description, and nuance. Add sensory details and deepen the emotional resonance."
      break
    case "show-not-tell":
      instruction = "Rewrite this passage using 'show, don't tell' techniques. Replace abstract statements with concrete actions, sensory details, and dialogue."
      break
    case "more-intense":
      instruction = "Rewrite this passage to be more emotionally intense and dramatic. Heighten the tension, urgency, or emotional impact."
      break
    case "more-lyrical":
      instruction = "Rewrite this passage in a more lyrical, poetic style. Use rhythm, metaphor, and evocative language."
      break
    case "custom":
      instruction = customInstructions || "Improve this passage."
      break
    default:
      instruction = "Rephrase this passage while keeping the same meaning."
  }

  const userPrompt = `${instruction}\n\nOriginal text:\n"${text}"\n\nRewritten text:`

  try {
    return createOpenAIStreamResponse(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 1500,
        temperature: 0.7,
        modelId,
      },
      {
        supabase,
        userId: user.id,
        projectId,
        documentId: documentId || null,
        feature: "rewrite",
        promptLog: userPrompt.slice(0, 500),
      }
    )
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
