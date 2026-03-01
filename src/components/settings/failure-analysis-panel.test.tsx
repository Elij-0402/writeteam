/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FailureAnalysisPanel } from "./failure-analysis-panel"

const successPayload = {
  success: true,
  data: {
    range: "7d",
    summary: {
      totalCalls: 10,
      totalFailures: 4,
      failureRate: 40,
      affectedProjects: 2,
      affectedDocuments: 3,
      failureByDefinition: {
        recoveryStatusFailure: 3,
        errorTypeNonNull: 4,
        unionFailure: 4,
        recoveryStatusFailureRate: 40,
        errorTypeNonNullRate: 40,
      },
    },
    distributions: {
      byProvider: [{ provider: "OpenAI", count: 3 }],
      byModel: [{ model: "gpt-4o-mini", count: 3 }],
      byErrorType: [{ errorType: "timeout", count: 2 }],
    },
    topFailureCombos: [
      {
        provider: "OpenAI",
        model: "gpt-4o-mini",
        errorType: "timeout",
        count: 2,
        nextActions: ["切换模型", "检查 Base URL"],
      },
    ],
    recommendations: [],
    filters: {
      providers: ["OpenAI"],
      models: ["gpt-4o-mini"],
      errorTypes: ["timeout"],
      recoveryStatuses: ["failure", "recovered_retry"],
    },
    notes: {
      providerRule: "provider 由服务端根据模型标识归一推断，避免前端重复推断",
      failureRule: "失败口径采用 recovery_status = failure 与 error_type != null 双口径并行输出",
      truncated: "未截断",
    },
  },
}

describe("FailureAnalysisPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("shows loading state then renders data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(successPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    )

    render(<FailureAnalysisPanel />)

    expect(screen.getByText("失败类型定位与影响范围分析")).toBeTruthy()
    expect(screen.getByText("刷新数据")).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText("Top 失败组合与下一步动作")).toBeTruthy()
    })
    expect(screen.getByText((content) => content.includes("切换模型"))).toBeTruthy()
  })

  it("shows empty state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              ...successPayload.data,
              summary: {
                ...successPayload.data.summary,
                totalCalls: 0,
                totalFailures: 0,
              },
              distributions: {
                byProvider: [],
                byModel: [],
                byErrorType: [],
              },
              topFailureCombos: [],
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    )

    render(<FailureAnalysisPanel />)

    await waitFor(() => {
      expect(screen.getByText("当前筛选范围内没有失败记录")).toBeTruthy()
    })
  })

  it("shows error state when API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code: "INTERNAL_ERROR", message: "失败分析数据读取失败，请稍后重试" },
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    )

    render(<FailureAnalysisPanel />)

    await waitFor(() => {
      expect(screen.getByText("数据加载失败")).toBeTruthy()
    })
    expect(screen.getByText("失败分析数据读取失败，请稍后重试")).toBeTruthy()
  })

  it("supports filter clear and refresh actions", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(successPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const user = userEvent.setup()
    render(<FailureAnalysisPanel />)

    await waitFor(() => {
      expect(screen.getByText("Top 失败组合与下一步动作")).toBeTruthy()
    })

    await user.click(screen.getByRole("button", { name: "清空筛选" }))
    await user.click(screen.getByRole("button", { name: "刷新数据" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
  })

  it("shows next actions in top combo cards", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(successPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    )

    render(<FailureAnalysisPanel />)

    await waitFor(() => {
      expect(screen.getByText("Top 失败组合与下一步动作")).toBeTruthy()
    })
    expect(screen.getByText((content) => content.includes("检查 Base URL"))).toBeTruthy()
  })
})
