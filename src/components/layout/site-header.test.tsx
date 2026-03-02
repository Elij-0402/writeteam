/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SiteHeader } from "./site-header"

// Mock SidebarTrigger to avoid needing SidebarProvider context
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: (props: React.ComponentProps<"button">) => (
    <button data-testid="sidebar-trigger" {...props} />
  ),
}))

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

afterEach(() => {
  cleanup()
})

describe("SiteHeader", () => {
  it("renders sidebar trigger", () => {
    render(<SiteHeader />)
    expect(screen.getByTestId("sidebar-trigger")).toBeTruthy()
  })

  it("renders default breadcrumb when no project provided", () => {
    render(<SiteHeader />)
    expect(screen.getByText("WriteTeam")).toBeTruthy()
  })

  it("renders breadcrumb with project name", () => {
    render(<SiteHeader projectTitle="奇幻世界" projectId="proj-1" />)
    expect(screen.getByText("奇幻世界")).toBeTruthy()
  })

  it("renders breadcrumb with project and document names", () => {
    render(
      <SiteHeader
        projectTitle="奇幻世界"
        projectId="proj-1"
        documentTitle="第一章"
      />
    )
    expect(screen.getByText("奇幻世界")).toBeTruthy()
    expect(screen.getByText("第一章")).toBeTruthy()
  })

  it("renders word count when provided", () => {
    render(<SiteHeader wordCount={12345} />)
    expect(screen.getByText("12,345 字")).toBeTruthy()
  })

  it("does not render word count when not provided", () => {
    render(<SiteHeader />)
    expect(screen.queryByText(/字$/)).toBeNull()
  })

  it("renders canvas link when projectId provided", () => {
    render(<SiteHeader projectId="proj-1" />)
    const canvasLink = screen.getByRole("link", { name: "故事画布" })
    expect(canvasLink).toBeTruthy()
    expect(canvasLink.getAttribute("href")).toBe("/canvas/proj-1")
  })

  it("does not render canvas link when projectId not provided", () => {
    render(<SiteHeader />)
    expect(screen.queryByRole("link", { name: "故事画布" })).toBeNull()
  })

  it("renders focus mode toggle when callback provided", () => {
    const onToggle = vi.fn()
    render(<SiteHeader onToggleFocusMode={onToggle} />)
    const button = screen.getByLabelText("专注模式")
    expect(button).toBeTruthy()
  })

  it("calls onToggleFocusMode when focus button clicked", async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<SiteHeader onToggleFocusMode={onToggle} />)
    await user.click(screen.getByLabelText("专注模式"))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it("does not render focus mode toggle when callback not provided", () => {
    render(<SiteHeader />)
    expect(screen.queryByLabelText("专注模式")).toBeNull()
  })

  it("renders AI sidebar toggle when callback provided", () => {
    const onToggle = vi.fn()
    render(<SiteHeader onToggleAISidebar={onToggle} />)
    const button = screen.getByLabelText("切换 AI 助手")
    expect(button).toBeTruthy()
  })

  it("calls onToggleAISidebar when AI button clicked", async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<SiteHeader onToggleAISidebar={onToggle} />)
    await user.click(screen.getByLabelText("切换 AI 助手"))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it("does not render AI sidebar toggle when callback not provided", () => {
    render(<SiteHeader />)
    expect(screen.queryByLabelText("切换 AI 助手")).toBeNull()
  })

  it("applies active variant to focus button when focusMode is true", () => {
    render(
      <SiteHeader focusMode={true} onToggleFocusMode={() => {}} />
    )
    const button = screen.getByLabelText("专注模式")
    expect(button.getAttribute("data-variant")).toBe("secondary")
  })

  it("applies active variant to AI sidebar button when aiSidebarOpen is true", () => {
    render(
      <SiteHeader aiSidebarOpen={true} onToggleAISidebar={() => {}} />
    )
    const button = screen.getByLabelText("切换 AI 助手")
    expect(button.getAttribute("data-variant")).toBe("secondary")
  })
})
