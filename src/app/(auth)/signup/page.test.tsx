/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import SignUpPage from "./page"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

describe("SignUpPage", () => {
  it("renders only email and password inputs without name field", () => {
    render(<SignUpPage />)

    const emailInput = screen.getByLabelText("邮箱") as HTMLInputElement
    const passwordInput = screen.getByLabelText("密码") as HTMLInputElement

    expect(emailInput.required).toBe(true)
    expect(passwordInput.required).toBe(true)
    expect(screen.queryByLabelText("姓名")).toBeNull()
  })
})
