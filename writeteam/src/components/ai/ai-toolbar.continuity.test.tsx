/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { AIToolbar } from "./ai-toolbar"
import { TooltipProvider } from "@/components/ui/tooltip"

const { parseContinuityResultMock, setErrorMock, handleFetchErrorMock, readAIStreamMock } = vi.hoisted(() => ({
  parseContinuityResultMock: vi.fn(() => ({
    summary: "发现 1 处连续性问题",
    hasIssues: true,
    raw: "raw",
    issues: [
      {
        issue: "时间线冲突",
        type: "时间线",
        reason: "上一章写到角色尚未离开北城",
        evidence: "第12章第3段：她仍在北城",
        evidenceSource: "正文片段",
        fix: "将当前段落地点改为北城，或补一段转场",
        actionType: "replace",
        insertionText: "补充一段她从北城转场到南城的过程。",
        replacementText: "她仍停留在北城，尚未启程前往南城。",
      },
    ],
  })),
  setErrorMock: vi.fn(),
  handleFetchErrorMock: vi.fn(),
  readAIStreamMock: vi.fn(),
}))

vi.mock("@/lib/ai/continuity-result", () => ({
  parseContinuityResult: parseContinuityResultMock,
}))

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
    setError: setErrorMock,
    clearError: vi.fn(),
    storeRequestContext: vi.fn(),
    handleResponseError: vi.fn(),
    handleFetchError: handleFetchErrorMock,
    handleRetry: vi.fn(),
    handleSwitchModel: vi.fn(),
  }),
}))

vi.mock("@/lib/ai/read-ai-stream", () => ({
  readAIStream: (...args: unknown[]) =>
    readAIStreamMock(...(args as [unknown, (text: string) => void, { onFirstChunk?: () => void }])),
}))

beforeAll(() => {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserver)
})

describe("AIToolbar continuity-check", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    parseContinuityResultMock.mockClear()
    setErrorMock.mockClear()
    handleFetchErrorMock.mockClear()
    readAIStreamMock.mockImplementation(
      async (_reader: unknown, onChunk: (text: string) => void, options?: { onFirstChunk?: () => void }) => {
        options?.onFirstChunk?.()
        const structured = "{\"summary\":\"ok\",\"issues\":[]}"
        onChunk(structured)
        return structured
      }
    )
  })

  function renderToolbar() {
    return render(
      <TooltipProvider>
        <AIToolbar
          selectedText="她已到达南城。"
          documentContent="上一章说明她仍在北城。"
          projectId="p-1"
          documentId="d-1"
          onInsertText={vi.fn()}
          onReplaceSelection={vi.fn()}
        />
      </TooltipProvider>
    )
  }

  it("parses continuity structured result after streaming", async () => {
    const user = userEvent.setup()

    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    renderToolbar()

    await user.click(screen.getAllByRole("button", { name: "连贯性" })[0]!)
    await user.click(screen.getByRole("button", { name: "运行连贯性检查" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(await screen.findByRole("button", { name: "查看结果" })).not.toBeNull()
    expect(parseContinuityResultMock).toHaveBeenCalled()
  })

  it("maps stream interruption event to recovery error", async () => {
    const user = userEvent.setup()
    readAIStreamMock.mockImplementationOnce(
      async (
        _reader: unknown,
        onChunk: (text: string) => void,
        options?: {
          onFirstChunk?: () => void
          onErrorEvent?: (event: {
            error: string
            errorType?: string
            retriable?: boolean
            suggestedActions?: string[]
          }) => void
        }
      ) => {
        options?.onFirstChunk?.()
        options?.onErrorEvent?.({
          error: "流中断",
          errorType: "timeout",
          retriable: true,
          suggestedActions: ["retry", "switch_model"],
        })
        onChunk("partial")
        return "partial"
      }
    )
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })))

    renderToolbar()

    await user.click(screen.getAllByRole("button", { name: "连贯性" })[0]!)
    await user.click(screen.getByRole("button", { name: "运行连贯性检查" }))

    await waitFor(() => expect(setErrorMock).toHaveBeenCalled())
    expect(setErrorMock.mock.calls[0]?.[0]).toMatchObject({
      errorType: "timeout",
      message: "流中断",
      retriable: true,
    })
  })

  it("forwards aborted fetch errors to recovery handler", async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation was aborted", "AbortError")
      })
    )

    renderToolbar()

    await user.click(screen.getAllByRole("button", { name: "连贯性" })[0]!)
    await user.click(screen.getByRole("button", { name: "运行连贯性检查" }))

    await waitFor(() => expect(handleFetchErrorMock).toHaveBeenCalled())
  })
})
