/**
 * Shared utility for reading an AI streaming response.
 * Used by both main call flows and recovery retry callbacks to avoid duplication.
 */
export async function readAIStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (accumulated: string) => void
): Promise<string> {
  const decoder = new TextDecoder()
  let fullText = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    fullText += chunk
    onChunk(fullText)
  }
  return fullText
}
