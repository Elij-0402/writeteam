/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { CompletionIndicator } from "./completion-indicator"

describe("CompletionIndicator", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders filled and total counts", () => {
    render(<CompletionIndicator filled={5} total={15} />)
    expect(screen.getByText("5/15 已填写")).toBeTruthy()
  })

  it("renders zero state", () => {
    render(<CompletionIndicator filled={0} total={15} />)
    expect(screen.getByText("0/15 已填写")).toBeTruthy()
  })

  it("renders full state", () => {
    render(<CompletionIndicator filled={15} total={15} />)
    expect(screen.getByText("15/15 已填写")).toBeTruthy()
  })
})
