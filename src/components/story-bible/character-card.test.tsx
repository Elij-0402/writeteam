/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CharacterCard } from "./character-card"

const mockCharacter = {
  id: "char-1",
  name: "林晚",
  role: "主角",
  description: "一个年轻的侦探",
  personality: "冷静但内心温柔",
  appearance: "黑发，戴眼镜",
  backstory: null,
  goals: "找到真相",
  relationships: null,
  notes: null,
  dialogue_style: null,
}

describe("CharacterCard", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders character name and role in collapsed state", () => {
    render(
      <CharacterCard
        character={mockCharacter}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText("林晚")).toBeTruthy()
    expect(screen.getByText("主角")).toBeTruthy()
  })

  it("does not show field labels when collapsed", () => {
    render(
      <CharacterCard
        character={mockCharacter}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.queryByText("描述")).toBeNull()
    expect(screen.queryByText("性格")).toBeNull()
  })

  it("shows fields when defaultOpen is true", () => {
    render(
      <CharacterCard
        character={mockCharacter}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        defaultOpen
      />
    )
    expect(screen.getByText("描述")).toBeTruthy()
    expect(screen.getByText("性格")).toBeTruthy()
    expect(screen.getByText("对话风格")).toBeTruthy()
  })

  it("toggles open when header is clicked", async () => {
    const user = userEvent.setup()
    render(
      <CharacterCard
        character={mockCharacter}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    // Initially collapsed — no field labels
    expect(screen.queryByText("描述")).toBeNull()

    // Click the header to expand
    await user.click(screen.getByText("林晚"))
    expect(screen.getByText("描述")).toBeTruthy()

    // Click again to collapse
    await user.click(screen.getByText("林晚"))
    expect(screen.queryByText("描述")).toBeNull()
  })

  it("calls onDelete when delete button clicked", async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(
      <CharacterCard
        character={mockCharacter}
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />
    )
    const deleteBtn = screen.getByRole("button", { name: /删除角色/ })
    await user.click(deleteBtn)
    expect(onDelete).toHaveBeenCalledWith("char-1")
  })

  it("delete button does not toggle open state", async () => {
    const user = userEvent.setup()
    render(
      <CharacterCard
        character={mockCharacter}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    // Collapsed initially
    expect(screen.queryByText("描述")).toBeNull()

    // Click delete — should NOT open the card
    const deleteBtn = screen.getByRole("button", { name: /删除角色/ })
    await user.click(deleteBtn)
    expect(screen.queryByText("描述")).toBeNull()
  })

  it("calls onUpdate on blur when field is dirty", async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(
      <CharacterCard
        character={mockCharacter}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
        defaultOpen
      />
    )

    // Find the description textarea by its displayed value
    const descField = screen.getByDisplayValue("一个年轻的侦探")
    await user.clear(descField)
    await user.type(descField, "资深老探长")
    // Blur the field
    await user.tab()

    expect(onUpdate).toHaveBeenCalledWith("char-1", "description", "资深老探长")
  })

  it("does not call onUpdate on blur when field is not dirty", async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(
      <CharacterCard
        character={mockCharacter}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
        defaultOpen
      />
    )

    // Focus and immediately blur — no changes
    const descField = screen.getByDisplayValue("一个年轻的侦探")
    await user.click(descField)
    await user.tab()

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it("does not show role badge when role is null", () => {
    const charNoRole = { ...mockCharacter, role: null }
    render(
      <CharacterCard
        character={charNoRole}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText("林晚")).toBeTruthy()
    expect(screen.queryByText("主角")).toBeNull()
  })
})
