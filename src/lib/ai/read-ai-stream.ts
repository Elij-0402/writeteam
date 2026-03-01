/**
 * Shared utility for reading an AI streaming response.
 * Used by both main call flows and recovery retry callbacks to avoid duplication.
 */
export async function readAIStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (accumulated: string) => void,
  options?: {
    onFirstChunk?: () => void
    onErrorEvent?: (event: {
      error: string
      errorType?: string
      retriable?: boolean
      suggestedActions?: string[]
    }) => void
  }
): Promise<string> {
  const decoder = new TextDecoder()
  let fullText = ""
  let firstChunkSeen = false

  const parseErrorEvent = (data: string) => {
    try {
      const parsed = JSON.parse(data) as {
        error?: unknown
        errorType?: unknown
        retriable?: unknown
        suggestedActions?: unknown
      }
      if (typeof parsed.error !== "string") {
        return false
      }
      options?.onErrorEvent?.({
        error: parsed.error,
        errorType: typeof parsed.errorType === "string" ? parsed.errorType : undefined,
        retriable: typeof parsed.retriable === "boolean" ? parsed.retriable : undefined,
        suggestedActions: Array.isArray(parsed.suggestedActions)
          ? parsed.suggestedActions.filter((item): item is string => typeof item === "string")
          : undefined,
      })
      return true
    } catch {
      return false
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!firstChunkSeen) {
      firstChunkSeen = true
      options?.onFirstChunk?.()
    }
    const chunk = decoder.decode(value, { stream: true })

    if (chunk.includes("data:")) {
      const lines = chunk.split("\n")
      const plainLines: string[] = []

      for (const rawLine of lines) {
        const line = rawLine.trimStart()
        if (line.startsWith("data:")) {
          const data = line.slice(5).trim()
          if (!data || data === "[DONE]") {
            continue
          }
          const handled = parseErrorEvent(data)
          if (!handled) {
            plainLines.push(rawLine)
          }
          continue
        }
        plainLines.push(rawLine)
      }

      const plainText = plainLines.join("\n")
      if (plainText) {
        fullText += plainText
        onChunk(fullText)
      }
      continue
    }

    fullText += chunk
    onChunk(fullText)
  }
  return fullText
}
