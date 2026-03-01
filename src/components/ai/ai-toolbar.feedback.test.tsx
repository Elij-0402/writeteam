/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { AIToolbar } from "./ai-toolbar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { toast } from "sonner"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}))

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
    setError: vi.fn(),
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
    return "编辑后文本"
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

function renderToolbar(onInsertText = vi.fn()) {
  render(
    <TooltipProvider>
      <AIToolbar
        selectedText="原始选中文本"
        documentContent="上下文正文"
        projectId="p-1"
        documentId="d-1"
        onInsertText={onInsertText}
        onReplaceSelection={vi.fn()}
      />
    </TooltipProvider>
  )
}

function createStreamResponse() {
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({}),
    },
  } as unknown as Response
}

async function generateResult(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole("button", { name: "快编" })[0]!)
  const input = await screen.findByPlaceholderText("例：改得更悬疑、增加对话、缩短为一句话...")
  await user.type(input, "改得更紧张")
  await user.click(screen.getByRole("button", { name: "执行编辑" }))
  await screen.findByRole("button", { name: "查看结果" })
  await user.click(screen.getAllByRole("button", { name: "查看结果" })[0]!)
}

describe("AIToolbar feedback loop", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("submits positive feedback once and disables repeated submit", async () => {
    const user = userEvent.setup()

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createStreamResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    renderToolbar()
    await generateResult(user)

    const positiveButton = (await screen.findAllByRole("button", { name: "反馈有帮助", hidden: true }))[0]!
    const negativeButton = (await screen.findAllByRole("button", { name: "反馈无帮助", hidden: true }))[0]!

    await user.click(positiveButton)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect((positiveButton as HTMLButtonElement).disabled).toBe(true)
      expect((negativeButton as HTMLButtonElement).disabled).toBe(true)
      expect(toast.success).toHaveBeenCalledWith("已标记为有帮助")
    })

    const [, feedbackInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    const feedbackBody = JSON.parse(String(feedbackInit.body))
    expect(feedbackBody).toEqual(
      expect.objectContaining({
        projectId: "p-1",
        feature: "quick-edit",
        rating: 1,
      })
    )
    expect(typeof feedbackBody.responseFingerprint).toBe("string")
    expect(feedbackBody.responseFingerprint.length).toBeGreaterThan(0)
  })

  it("shows actionable error and keeps writing path available when feedback fails", async () => {
    const user = userEvent.setup()
    const onInsertText = vi.fn()

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createStreamResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            error: { code: "INTERNAL_ERROR", message: "反馈写入失败" },
          }),
          { status: 500 }
        )
      )
    vi.stubGlobal("fetch", fetchMock)

    renderToolbar(onInsertText)
    await generateResult(user)

    const positiveButton = (await screen.findAllByRole("button", { name: "反馈有帮助", hidden: true }))[0]!
    await user.click(positiveButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("反馈写入失败，请重试或稍后再试")
    })

    const insertButton = screen.getByRole("button", { name: "插入编辑器" })
    expect((insertButton as HTMLButtonElement).disabled).toBe(false)
    await user.click(insertButton)
    expect(onInsertText).toHaveBeenCalledWith("编辑后文本")
  })

  it("disables both feedback buttons while feedback request is pending", async () => {
    const user = userEvent.setup()

    let resolveFeedback: ((value: Response) => void) | null = null
    const pendingFeedback = new Promise<Response>((resolve) => {
      resolveFeedback = resolve
    })

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createStreamResponse())
      .mockImplementationOnce(() => pendingFeedback)
    vi.stubGlobal("fetch", fetchMock)

    renderToolbar()
    await generateResult(user)

    const positiveButton = (await screen.findAllByRole("button", { name: "反馈有帮助", hidden: true }))[0]!
    const negativeButton = (await screen.findAllByRole("button", { name: "反馈无帮助", hidden: true }))[0]!

    await user.click(positiveButton)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect((positiveButton as HTMLButtonElement).disabled).toBe(true)
      expect((negativeButton as HTMLButtonElement).disabled).toBe(true)
    })

    await user.click(negativeButton)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    resolveFeedback?.(new Response(JSON.stringify({ success: true }), { status: 200 }))
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("已标记为有帮助")
    })
  })

  it("uses server existingRating when response is ALREADY_RATED", async () => {
    const user = userEvent.setup()

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createStreamResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            error: { code: "ALREADY_RATED", message: "该 AI 响应已反馈过，不能重复提交" },
            existingRating: 1,
          }),
          { status: 409 }
        )
      )
    vi.stubGlobal("fetch", fetchMock)

    renderToolbar()
    await generateResult(user)

    const positiveButton = (await screen.findAllByRole("button", { name: "反馈有帮助", hidden: true }))[0]!
    const negativeButton = (await screen.findAllByRole("button", { name: "反馈无帮助", hidden: true }))[0]!

    await user.click(negativeButton)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("该结果已反馈过")
      expect((positiveButton as HTMLButtonElement).disabled).toBe(true)
      expect((negativeButton as HTMLButtonElement).disabled).toBe(true)
    })
  })
})
