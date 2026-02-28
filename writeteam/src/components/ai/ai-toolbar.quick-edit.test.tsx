/* @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { AIToolbar } from "./ai-toolbar"
import { TooltipProvider } from "@/components/ui/tooltip"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}))

vi.mock("@/components/providers/ai-config-provider", () => ({
  useAIConfigContext: () => ({
    isConfigured: true,
    getHeaders: () => ({ "X-AI-Base-URL": "https://example.com/v1", "X-AI-Model-ID": "test-model" }),
    config: {
      baseUrl: "https://example.com/v1",
      apiKey: "k",
      modelId: "test-model",
      modelName: "test-model",
      configuredAt: Date.now(),
    },
  }),
}))

vi.mock("@/hooks/use-ai-recovery", () => ({
  useAIRecovery: () => ({
    error: null,
    isRetrying: false,
    clearError: vi.fn(),
    storeRequestContext: vi.fn(),
    handleResponseError: vi.fn(),
    handleFetchError: vi.fn(),
    handleRetry: vi.fn(),
    handleSwitchModel: vi.fn(),
  }),
}))

vi.mock("@/lib/ai/read-ai-stream", () => ({
  readAIStream: vi.fn(async (_reader: unknown, onChunk: (text: string) => void, options?: { onFirstChunk?: () => void }) => {
    options?.onFirstChunk?.()
    onChunk("编辑后文本")
    return ""
  }),
}))

beforeAll(() => {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserver)
})

describe("AIToolbar quick-edit", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("submits quick-edit request and allows replacing selection", async () => {
    const user = userEvent.setup()
    const onReplaceSelection = vi.fn()

    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    render(
      <TooltipProvider>
        <AIToolbar
          selectedText="原始选中文本"
          documentContent="上下文正文"
          projectId="p-1"
          documentId="d-1"
          onInsertText={vi.fn()}
          onReplaceSelection={onReplaceSelection}
        />
      </TooltipProvider>
    )

    await user.click(screen.getByRole("button", { name: "快编" }))
    const instructionInput = await screen.findByPlaceholderText("例：改得更悬疑、增加对话、缩短为一句话...")
    await user.type(instructionInput, "改得更紧张{enter}")

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/ai/quick-edit")
    const body = JSON.parse(String(init.body))
    expect(body.text).toBe("原始选中文本")
    expect(body.instruction).toBe("改得更紧张")
    expect(body.projectId).toBe("p-1")
    expect(body.documentId).toBe("d-1")

    expect(await screen.findByRole("button", { name: "查看结果" })).not.toBeNull()
    expect(onReplaceSelection).not.toHaveBeenCalled()
  })
})
