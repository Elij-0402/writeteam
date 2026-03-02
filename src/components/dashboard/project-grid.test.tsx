/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ProjectGrid } from "./project-grid"
import type { Project } from "@/types/database"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

afterEach(() => {
  cleanup()
})

const mockProject: Project = {
  id: "proj-1",
  user_id: "user-1",
  title: "测试项目",
  description: "描述",
  genre: "奇幻",
  cover_image_url: null,
  word_count_goal: null,
  preferred_model: null,
  series_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

describe("ProjectGrid", () => {
  it("renders empty state when no projects", () => {
    render(
      <ProjectGrid
        projects={[]}
        documentCounts={{}}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onNewProject={vi.fn()}
        loading={false}
      />
    )

    expect(screen.getByText("还没有项目")).toBeTruthy()
    expect(screen.getByText("新建项目")).toBeTruthy()
  })

  it("renders project cards when projects exist", () => {
    render(
      <ProjectGrid
        projects={[mockProject]}
        documentCounts={{ "proj-1": 3 }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onNewProject={vi.fn()}
        loading={false}
      />
    )

    expect(screen.getByText("测试项目")).toBeTruthy()
    expect(screen.queryByText("还没有项目")).toBeNull()
  })
})
