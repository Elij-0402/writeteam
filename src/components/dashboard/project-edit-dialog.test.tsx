/* @vitest-environment jsdom */

import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ProjectEditDialog } from "./project-edit-dialog"
import type { Project } from "@/types/database"

afterEach(cleanup)

const mockProject: Project = {
  id: "proj-1",
  user_id: "user-1",
  title: "测试小说",
  description: "这是一个测试项目",
  genre: "奇幻",
  cover_image_url: null,
  word_count_goal: null,
  preferred_model: null,
  series_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

describe("ProjectEditDialog", () => {
  it("renders form fields pre-filled with project data when open", () => {
    render(
      <ProjectEditDialog
        project={mockProject}
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />
    )

    const titleInput = screen.getByLabelText("标题") as HTMLInputElement
    const descInput = screen.getByLabelText("简介") as HTMLTextAreaElement
    expect(titleInput.value).toBe("测试小说")
    expect(descInput.value).toBe("这是一个测试项目")
  })

  it("does not render dialog content when closed", () => {
    render(
      <ProjectEditDialog
        project={null}
        open={false}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />
    )

    expect(screen.queryByText("编辑项目信息")).toBeNull()
  })

  it("calls onSave with project id and form data on submit", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <ProjectEditDialog
        project={mockProject}
        open={true}
        onOpenChange={vi.fn()}
        onSave={onSave}
      />
    )

    const titleInput = screen.getByLabelText("标题")
    await user.clear(titleInput)
    await user.type(titleInput, "新标题")
    await user.click(screen.getByRole("button", { name: "保存" }))

    expect(onSave).toHaveBeenCalledWith("proj-1", expect.any(FormData))
  })
})
