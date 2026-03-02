/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ProjectCard } from "./project-card"
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
  title: "奇幻世界",
  description: "一个关于魔法的故事",
  genre: "奇幻",
  cover_image_url: null,
  word_count_goal: null,
  preferred_model: null,
  series_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
}

describe("ProjectCard", () => {
  it("renders project title and description", () => {
    render(
      <ProjectCard
        project={mockProject}
        documentCount={5}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        loading={false}
      />
    )

    expect(screen.getByText("奇幻世界")).toBeTruthy()
    expect(screen.getByText("一个关于魔法的故事")).toBeTruthy()
  })

  it("renders genre badge and chapter count", () => {
    render(
      <ProjectCard
        project={mockProject}
        documentCount={5}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        loading={false}
      />
    )

    expect(screen.getByText(/奇幻 · 5 章/)).toBeTruthy()
  })

  it("shows '暂无简介' when description is null", () => {
    const noDescProject = { ...mockProject, description: null }
    render(
      <ProjectCard
        project={noDescProject}
        documentCount={0}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        loading={false}
      />
    )

    expect(screen.getByText("暂无简介")).toBeTruthy()
  })

  it("renders gradient cover area", () => {
    const { container } = render(
      <ProjectCard
        project={mockProject}
        documentCount={3}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        loading={false}
      />
    )

    const gradientDiv = container.querySelector("[data-testid='card-cover']")
    expect(gradientDiv).toBeTruthy()
  })

  it("links to editor page", () => {
    render(
      <ProjectCard
        project={mockProject}
        documentCount={3}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        loading={false}
      />
    )

    const link = screen.getByRole("link")
    expect(link.getAttribute("href")).toBe("/editor/proj-1")
  })
})
