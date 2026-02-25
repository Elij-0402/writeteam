"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

const AUTH_TIMEOUT_MS = 15000

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("AUTH_TIMEOUT")), ms)
    }),
  ])
}

function mapAuthError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes("AUTH_TIMEOUT")) {
    return "认证请求超时，请稍后重试。"
  }

  if (message.toLowerCase().includes("rate limit")) {
    return "当前尝试次数过多，请稍后再试。"
  }

  return fallback
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const supabase = await createClient()

  try {
    const { error } = await withTimeout(
      supabase.auth.signInWithPassword({
        email,
        password,
      }),
      AUTH_TIMEOUT_MS
    )

    if (error) {
      return { error: mapAuthError(error, error.message) }
    }
  } catch (error) {
    return { error: mapAuthError(error, "当前无法登录，请稍后重试。") }
  }

  revalidatePath("/", "layout")
  return { success: true }
}

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const fullName = formData.get("fullName") as string
  const supabase = await createClient()

  try {
    const { error } = await withTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      }),
      AUTH_TIMEOUT_MS
    )

    if (error) {
      return { error: mapAuthError(error, error.message) }
    }
  } catch (error) {
    return { error: mapAuthError(error, "当前无法注册，请稍后重试。") }
  }

  revalidatePath("/", "layout")
  return { success: true }
}

export async function signOut() {
  const supabase = await createClient()

  try {
    await withTimeout(supabase.auth.signOut(), AUTH_TIMEOUT_MS)
  } catch {}

  revalidatePath("/", "layout")
  redirect("/login")
}
