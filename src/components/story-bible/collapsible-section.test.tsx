/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { CollapsibleSection } from "./collapsible-section"

describe("CollapsibleSection", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders title and children when defaultOpen is true", () => {
    render(
      <CollapsibleSection title="核心设定" defaultOpen>
        <div>child content</div>
      </CollapsibleSection>
    )
    expect(screen.getByText("核心设定")).toBeTruthy()
    expect(screen.getByText("child content")).toBeTruthy()
    // The region should not have the hidden class when open
    const region = screen.getByRole("region", { name: "核心设定" })
    expect(region.classList.contains("hidden")).toBe(false)
  })

  it("hides children when defaultOpen is false", () => {
    render(
      <CollapsibleSection title="创作指导" defaultOpen={false}>
        <div>hidden content</div>
      </CollapsibleSection>
    )
    expect(screen.getByText("创作指导")).toBeTruthy()
    // The region should have the hidden class when closed
    const region = screen.getByRole("region", { name: "创作指导", hidden: true })
    expect(region.classList.contains("hidden")).toBe(true)
  })

  it("shows completion badge when completionText provided", () => {
    render(
      <CollapsibleSection title="核心设定" completionText="3/5" defaultOpen>
        <div>content</div>
      </CollapsibleSection>
    )
    expect(screen.getByText("3/5")).toBeTruthy()
  })

  it("toggles open/closed on click", async () => {
    const user = userEvent.setup()
    render(
      <CollapsibleSection title="测试" defaultOpen>
        <div>toggle me</div>
      </CollapsibleSection>
    )
    const trigger = screen.getByRole("button")
    expect(trigger.getAttribute("aria-expanded")).toBe("true")

    await user.click(trigger)

    // After clicking, the region should be hidden
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    const region = screen.getByRole("region", { name: "测试", hidden: true })
    expect(region.classList.contains("hidden")).toBe(true)
  })
})
