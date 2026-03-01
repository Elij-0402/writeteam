/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { AIChatPanel } from "./ai-chat-panel"

const { storeRequestContextMock, readAIStreamMock, setErrorMock } = vi.hoisted(() => ({
  storeRequestContextMock: vi.fn(),
  readAIStreamMock: vi.fn(),
  setErrorMock: vi.fn(),
}))

vi.mock("@/components/providers/ai-config-provider", () => ({
  useAIConfigContext: () => ({
    getHeaders: () => ({ "X-AI-Model-ID": "test-model" }),
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
    setError: setErrorMock,
    clearError: vi.fn(),
    handleResponseError: vi.fn(),
    handleFetchError: vi.fn(),
    storeRequestContext: storeRequestContextMock,
    handleRetry: vi.fn(),
    handleSwitchModel: vi.fn(),
  }),
}))

vi.mock("@/lib/ai/read-ai-stream", () => ({
  readAIStream: (...args: unknown[]) =>
    readAIStreamMock(...(args as [unknown, (text: string) => void])),
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: unknown }) => (
    <select
      data-testid="prose-mode-select"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: unknown }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: unknown }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: unknown }) => (
    <option value={value}>{children}</option>
  ),
}))

beforeAll(() => {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserver)
})

describe("AIChatPanel", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    storeRequestContextMock.mockClear()
    setErrorMock.mockClear()
    readAIStreamMock.mockImplementation(async (_reader: unknown, onChunk: (text: string) => void) => {
      onChunk("AI 建议内容")
      return "AI 建议内容"
    })
  })

  it("falls back match-style to balanced and keeps chat continuity payload", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    render(
      <AIChatPanel
        projectId="p-1"
        documentId="d-1"
        documentContent="当前文档内容"
        onInsertToEditor={vi.fn()}
        hasStyleSample={false}
      />
    )

    await user.selectOptions(screen.getByTestId("prose-mode-select"), "match-style")

    await user.type(screen.getByPlaceholderText("问问你的故事..."), "下一章怎么写？")
    await user.click(screen.getByRole("button", { name: "发送" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)
    expect(body).toMatchObject({
      projectId: "p-1",
      documentId: "d-1",
      proseMode: "balanced",
    })
    expect(body.messages).toHaveLength(1)
  })

  it("allows inserting assistant suggestion into editor", async () => {
    const user = userEvent.setup()
    const onInsertToEditor = vi.fn()
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })))

    render(
      <AIChatPanel
        projectId="p-1"
        documentId={null}
        documentContent="当前文档内容"
        onInsertToEditor={onInsertToEditor}
        hasStyleSample
      />
    )

    await user.type(screen.getByPlaceholderText("问问你的故事..."), "给我一个反转")
    await user.click(screen.getByRole("button", { name: "发送" }))

    const insertButton = await screen.findByRole("button", { name: "插入正文" })
    await user.click(insertButton)

    expect(onInsertToEditor).toHaveBeenCalledWith("AI 建议内容")
  })

  it("marks no-stream response as recoverable error on mobile viewport", async () => {
    vi.stubGlobal("innerWidth", 375)
    window.dispatchEvent(new Event("resize"))

    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    render(
      <AIChatPanel
        projectId="p-1"
        documentId="d-1"
        documentContent="当前文档内容"
        onInsertToEditor={vi.fn()}
        hasStyleSample
      />
    )

    await user.type(screen.getByPlaceholderText("问问你的故事..."), "继续写下去")
    await user.click(screen.getByRole("button", { name: "发送" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(setErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        errorType: "format_incompatible",
        retriable: true,
      })
    )
  })
})
