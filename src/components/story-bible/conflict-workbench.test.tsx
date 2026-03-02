/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ConflictWorkbench } from "./conflict-workbench"

describe("ConflictWorkbench", () => {
  afterEach(() => {
    cleanup()
  })

  it("does not render panel when no conflicts", () => {
    render(<ConflictWorkbench conflicts={[]} onApplyConflict={vi.fn()} />)

    expect(screen.queryByText("冲突工作台")).toBeNull()
  })

  it("renders severity and evidence source for a conflict", () => {
    render(
      <ConflictWorkbench
        conflicts={[
          {
            id: "conf-1",
            title: "角色年龄与时间线不一致",
            severity: "high",
            evidenceSource: "时间线校验",
          },
        ]}
        onApplyConflict={vi.fn()}
      />
    )

    expect(screen.getByText("冲突工作台")).toBeTruthy()
    expect(screen.getByText("严重程度：高")).toBeTruthy()
    expect(screen.getByText("证据来源：时间线校验")).toBeTruthy()
    expect(screen.getByRole("button", { name: /一键应用：角色年龄与时间线不一致/ })).toBeTruthy()
  })

  it("calls apply callback when clicking apply", async () => {
    const user = userEvent.setup()
    const onApplyConflict = vi.fn()

    render(
      <ConflictWorkbench
        conflicts={[
          {
            id: "conf-2",
            title: "世界规则冲突",
            severity: "medium",
            evidenceSource: "规则比对",
          },
        ]}
        onApplyConflict={onApplyConflict}
      />
    )

    await user.click(screen.getByRole("button", { name: /一键应用：世界规则冲突/ }))

    expect(onApplyConflict).toHaveBeenCalledTimes(1)
    expect(onApplyConflict).toHaveBeenCalledWith("conf-2")
  })
})
