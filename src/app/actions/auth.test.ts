import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { signUp } from "./auth"

describe("auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls supabase signup without full_name metadata", async () => {
    const signUpMock = vi.fn(async () => ({ error: null }))

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signUp: signUpMock,
      },
    } as never)

    const formData = new FormData()
    formData.append("email", "writer@example.com")
    formData.append("password", "secret123")
    formData.append("fullName", "Writer Name")

    const result = await signUp(formData)

    expect(result).toEqual({ success: true })
    expect(signUpMock).toHaveBeenCalledWith({
      email: "writer@example.com",
      password: "secret123",
    })
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout")
  })
})
