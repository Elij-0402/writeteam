/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { MusePanel } from "./muse-panel"

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
      data-testid="muse-prose-mode-select"
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

describe("MusePanel", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    storeRequestContextMock.mockClear()
    setErrorMock.mockClear()
    readAIStreamMock.mockImplementation(async (_reader: unknown, onChunk: (text: string) => void) => {
      onChunk("灵感结果")
      return "灵感结果"
    })
  })

  it("sends balanced proseMode when match-style has no sample", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    render(
      <MusePanel
        projectId="p-1"
        documentId="d-1"
        documentContent="最近内容"
        onUseAsDirection={vi.fn()}
        hasStyleSample={false}
      />
    )

    await user.selectOptions(screen.getByTestId("muse-prose-mode-select"), "match-style")
    await user.click(screen.getByRole("button", { name: "随机灵感" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)
    expect(body).toMatchObject({
      projectId: "p-1",
      documentId: "d-1",
      proseMode: "balanced",
    })
  })

  it("marks no-stream response as recoverable error on mobile viewport", async () => {
    vi.stubGlobal("innerWidth", 390)
    window.dispatchEvent(new Event("resize"))

    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    render(
      <MusePanel
        projectId="p-1"
        documentId="d-1"
        documentContent="最近内容"
        onUseAsDirection={vi.fn()}
        hasStyleSample
      />
    )

    await user.click(screen.getByRole("button", { name: "随机灵感" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(setErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        errorType: "format_incompatible",
        retriable: true,
      })
    )
  })
})
