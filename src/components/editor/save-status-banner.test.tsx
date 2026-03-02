/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { SaveStatusBanner } from "./save-status-banner"

describe("SaveStatusBanner", () => {
  it("shows idle hint copy by default", () => {
    render(<SaveStatusBanner status="idle" />)

    expect(screen.getByText("自动保存已开启（1 秒）")).not.toBeNull()
  })

  it("shows saving and retrying states", () => {
    const { rerender } = render(<SaveStatusBanner status="saving" />)
    expect(screen.getByText("正在自动保存..."))

    rerender(<SaveStatusBanner status="retrying" />)
    expect(screen.getByText("正在重试保存..."))
  })

  it("shows saved state text", () => {
    render(<SaveStatusBanner status="saved" />)

    expect(screen.getByText("内容已自动保存")).not.toBeNull()
  })

  it("hides retry action for non-error states", () => {
    const { rerender } = render(<SaveStatusBanner status="idle" onRetry={vi.fn()} />)

    expect(screen.queryByRole("button", { name: "立即重试" })).toBeNull()

    rerender(<SaveStatusBanner status="saving" onRetry={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "立即重试" })).toBeNull()

    rerender(<SaveStatusBanner status="retrying" onRetry={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "立即重试" })).toBeNull()

    rerender(<SaveStatusBanner status="saved" onRetry={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "立即重试" })).toBeNull()
  })

  it("shows error state with retry action", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()

    render(<SaveStatusBanner status="error" onRetry={onRetry} />)

    expect(screen.getByText("自动保存失败，可继续编辑")).not.toBeNull()
    await user.click(screen.getByRole("button", { name: "立即重试" }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
