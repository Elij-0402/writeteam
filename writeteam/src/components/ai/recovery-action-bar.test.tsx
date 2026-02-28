/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { RecoveryActionBar } from "./recovery-action-bar"

beforeAll(() => {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserver)
})

describe("RecoveryActionBar", () => {
  it("triggers retry, switch-model, and dismiss actions", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const onSwitchModel = vi.fn()
    const onDismiss = vi.fn()

    render(
      <RecoveryActionBar
        error={{
          errorType: "timeout",
          message: "连接超时",
          retriable: true,
          suggestedActions: ["retry", "switch_model"],
          severity: "low",
        }}
        onRetry={onRetry}
        onSwitchModel={onSwitchModel}
        onDismiss={onDismiss}
        isRetrying={false}
      />
    )

    await user.click(screen.getByRole("button", { name: "重试" }))
    expect(onRetry).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole("button", { name: "切换模型" }))
    await user.type(screen.getByPlaceholderText("输入 Model ID，如 deepseek-chat"), "gpt-4o")
    await user.click(screen.getByRole("button", { name: "OpenAI" }))

    expect(onSwitchModel).toHaveBeenCalledWith("gpt-4o", "https://api.openai.com/v1")

    await user.keyboard("{Escape}")
    expect(onDismiss).toHaveBeenCalled()
  })
})
