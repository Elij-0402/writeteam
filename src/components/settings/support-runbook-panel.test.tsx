/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SupportRunbookPanel } from "./support-runbook-panel"

vi.mock("@/components/providers/ai-config-provider", () => ({
  useAIConfigContext: () => ({
    config: {
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
      modelId: "gpt-4o-mini",
      modelName: "gpt-4o-mini",
      configuredAt: 0,
    },
    isConfigured: true,
    updateConfig: vi.fn(),
    clearConfig: vi.fn(),
    getHeaders: () => ({
      "X-AI-Base-URL": "https://api.openai.com/v1",
      "X-AI-API-Key": "test-key",
      "X-AI-Model-ID": "gpt-4o-mini",
    }),
  }),
}))

describe("SupportRunbookPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("shows loading then renders runbook steps", async () => {
    const fetchMock = vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              primaryErrorType: "timeout",
              errorTypes: ["timeout"],
              template: {
                precheck: ["确认 Base URL 与 API Key"],
                diagnosis: ["读取最近失败事件并确认错误类型"],
                recovery_actions: [
                  {
                    id: "a1",
                    kind: "config_check",
                    title: "检查配置",
                    action: "核对配置后重试",
                    expected: "配置无误",
                    onFailure: "转向模型切换",
                    fallback: "使用已验证的默认配置",
                  },
                ],
                verify: ["执行测试连接并确认成功"],
                escalation: ["连续失败 3 次后升级人工"],
              },
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    vi.stubGlobal("fetch", fetchMock)

    render(<SupportRunbookPanel />)

    await userEvent.type(screen.getByPlaceholderText("输入工单错误文本或失败上下文"), "连接超时")
    await userEvent.click(screen.getByRole("button", { name: "生成 Runbook" }))

    await waitFor(() => {
      expect(screen.getByText("检查配置")).toBeTruthy()
    })
    expect(screen.getByText((content) => content.includes("执行测试连接"))).toBeTruthy()
    expect(fetchMock).toHaveBeenCalled()
    const firstCallInit = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(firstCallInit.headers).toEqual({ "Content-Type": "application/json" })
  })

  it("allows generating runbook without ticket text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              primaryErrorType: "timeout",
              errorTypes: ["timeout"],
              input: { contextRef: "project:project-a" },
              template: {
                precheck: [],
                diagnosis: [],
                recovery_actions: [],
                verify: [],
                escalation: [],
              },
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    )

    render(<SupportRunbookPanel />)

    await userEvent.click(screen.getByRole("button", { name: "生成 Runbook" }))

    await waitFor(() => {
      expect(screen.getByText("错误类型：")).toBeTruthy()
    })
  })

  it("executes action and updates execution status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              primaryErrorType: "timeout",
              errorTypes: ["timeout"],
              template: {
                precheck: [],
                diagnosis: [],
                recovery_actions: [
                  {
                    id: "a1",
                    kind: "retry",
                    title: "重试请求",
                    action: "重新发起一次请求",
                    expected: "请求成功",
                    onFailure: "切换模型",
                    fallback: "保留上下文后重试",
                  },
                ],
                verify: [],
                escalation: [],
              },
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    )

    render(<SupportRunbookPanel />)

    await userEvent.type(screen.getByPlaceholderText("输入工单错误文本或失败上下文"), "连接超时")
    await userEvent.click(screen.getByRole("button", { name: "生成 Runbook" }))

    await waitFor(() => {
      expect(screen.getByText("重试请求")).toBeTruthy()
    })

    await userEvent.click(screen.getByRole("button", { name: "执行建议动作" }))
    expect(screen.getByText("已执行")).toBeTruthy()

    await userEvent.click(screen.getByRole("button", { name: "标记执行失败" }))
    expect(screen.getByText("执行失败")).toBeTruthy()
  })

  it("shows error state when API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code: "INTERNAL_ERROR", message: "Runbook 生成失败" },
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    )

    render(<SupportRunbookPanel />)

    await userEvent.type(screen.getByPlaceholderText("输入工单错误文本或失败上下文"), "连接超时")
    await userEvent.click(screen.getByRole("button", { name: "生成 Runbook" }))

    await waitFor(() => {
      expect(screen.getByText("Runbook 生成失败")).toBeTruthy()
    })
  })
})
