/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { NodeDetailPanel } from "./node-detail-panel"

afterEach(() => {
  cleanup()
})

describe("NodeDetailPanel", () => {
  it("updates node payload on save", async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn(async () => undefined)
    const onDelete = vi.fn(async () => undefined)

    render(
      <NodeDetailPanel
        node={{
          id: "node-1",
          label: "旧标题",
          content: "旧内容",
          nodeType: "beat",
          color: null,
        }}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onClose={() => undefined}
      />
    )

    const titleInput = screen.getByPlaceholderText("节点标题")
    await user.clear(titleInput)
    await user.type(titleInput, "新标题")

    const contentInput = screen.getByPlaceholderText("节点描述内容...")
    await user.clear(contentInput)
    await user.type(contentInput, "新内容")

    await user.click(screen.getByRole("button", { name: "保存修改" }))

    expect(onUpdate).toHaveBeenCalledWith("node-1", {
      label: "新标题",
      content: "新内容",
      node_type: "beat",
      color: null,
    })
  })

  it("calls delete handler when delete button clicked", async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn(async () => undefined)
    const onDelete = vi.fn(async () => undefined)

    render(
      <NodeDetailPanel
        node={{
          id: "node-2",
          label: "标题",
          content: null,
          nodeType: "scene",
          color: null,
        }}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onClose={() => undefined}
      />
    )

    const deleteButtons = screen.getAllByRole("button", { name: "删除节点" })
    await user.click(deleteButtons[0])
    expect(onDelete).toHaveBeenCalledWith("node-2")
  })
})
