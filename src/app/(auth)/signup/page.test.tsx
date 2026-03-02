/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import SignUpPage from "./page"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock("@/app/actions/auth", () => ({
  signUp: vi.fn(),
}))

describe("SignUpPage", () => {
  it("renders only email and password inputs without name field", () => {
    const { container } = render(<SignUpPage />)

    const inputNames = Array.from(container.querySelectorAll("input")).map((input) => input.name)

    expect(inputNames).toEqual(["email", "password"])
    expect(screen.getByLabelText("邮箱")).toBeTruthy()
    expect(screen.getByLabelText("密码")).toBeTruthy()
    expect(screen.queryByLabelText("姓名")).toBeNull()
  })
})
