/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { ProseModeSelector } from "./prose-mode-selector"

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string
    onValueChange: (v: string) => void
    children: unknown
  }) => (
    <select
      data-testid="prose-select"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: unknown }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: unknown }) => <>{children}</>,
  SelectItem: ({
    value,
    disabled,
    children,
  }: {
    value: string
    disabled?: boolean
    children: unknown
  }) => (
    <option value={value} disabled={disabled}>
      {children}
    </option>
  ),
}))

beforeAll(() => {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserver)
})

describe("ProseModeSelector", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders with default value selected", () => {
    render(<ProseModeSelector value="default" onChange={() => {}} />)
    const select = screen.getByTestId("prose-select") as HTMLSelectElement
    expect(select).toBeTruthy()
    expect(select.value).toBe("default")
  })

  it("renders all six prose mode options", () => {
    render(<ProseModeSelector value="default" onChange={() => {}} />)
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(6)
    expect(screen.getByText("跟随故事圣经")).toBeTruthy()
    expect(screen.getByText("均衡")).toBeTruthy()
    expect(screen.getByText("电影感")).toBeTruthy()
    expect(screen.getByText("抒情")).toBeTruthy()
    expect(screen.getByText("简洁")).toBeTruthy()
    expect(screen.getByText("匹配风格")).toBeTruthy()
  })

  it("calls onChange when selection changes", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ProseModeSelector value="default" onChange={onChange} />)
    await user.selectOptions(screen.getByTestId("prose-select"), "cinematic")
    expect(onChange).toHaveBeenCalledWith("cinematic")
  })

  it("disables match-style when hasStyleSample is false", () => {
    render(
      <ProseModeSelector value="default" onChange={() => {}} hasStyleSample={false} />
    )
    const matchStyleOption = screen.getByText("匹配风格").closest("option") as HTMLOptionElement
    expect(matchStyleOption.disabled).toBe(true)
  })

  it("enables match-style when hasStyleSample is true", () => {
    render(
      <ProseModeSelector value="default" onChange={() => {}} hasStyleSample={true} />
    )
    const matchStyleOption = screen.getByText("匹配风格").closest("option") as HTMLOptionElement
    expect(matchStyleOption.disabled).toBeFalsy()
  })
})
