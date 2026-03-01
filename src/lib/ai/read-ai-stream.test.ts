import { describe, expect, it, vi } from "vitest"
import { readAIStream } from "./read-ai-stream"

function createReader(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
  return stream.getReader()
}

describe("readAIStream", () => {
  it("emits error events without swallowing plain text", async () => {
    const onChunk = vi.fn()
    const onErrorEvent = vi.fn()

    const reader = createReader([
      'data: {"error":"流中断","errorType":"timeout","retriable":true}\n正文补丁',
    ])

    const text = await readAIStream(reader, onChunk, { onErrorEvent })

    expect(onErrorEvent).toHaveBeenCalledTimes(1)
    expect(text).toContain("正文补丁")
    expect(onChunk).toHaveBeenCalled()
  })

  it("treats invalid data lines as plain text", async () => {
    const onChunk = vi.fn()
    const onErrorEvent = vi.fn()

    const reader = createReader(["data: not-json\n继续输出文本"])
    const text = await readAIStream(reader, onChunk, { onErrorEvent })

    expect(onErrorEvent).not.toHaveBeenCalled()
    expect(text).toContain("data: not-json")
    expect(text).toContain("继续输出文本")
  })
})
