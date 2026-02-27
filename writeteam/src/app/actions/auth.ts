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

function mapAuthError(error: unknown, context: "login" | "signup"): string {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()

  if (message.includes("AUTH_TIMEOUT")) {
    return "认证请求超时，请检查网络后重试。"
  }

  if (lower.includes("rate limit")) {
    return "当前尝试次数过多，请等待几分钟后再试。"
  }

  if (lower.includes("invalid login credentials")) {
    return "邮箱或密码错误，请核对后重试。如忘记密码，请联系管理员。"
  }

  if (lower.includes("email not confirmed")) {
    return "邮箱尚未验证，请检查收件箱中的确认链接后重试。"
  }

  if (lower.includes("user already registered")) {
    return "该邮箱已注册，请直接登录或使用其他邮箱注册。"
  }

  if (lower.includes("password") && lower.includes("characters")) {
    return "密码长度不符合要求，请使用至少 6 个字符。"
  }

  if (lower.includes("fetch") || lower.includes("network") || lower.includes("failed to fetch")) {
    return "网络连接异常，请检查网络状态后重试。"
  }

  return context === "login"
    ? "当前无法登录，请稍后重试。"
    : "当前无法注册，请稍后重试。"
}

export async function signIn(formData: FormData) {
  const email = formData.get("email")
  const password = formData.get("password")

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "请填写邮箱和密码。" }
  }
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
      return { error: mapAuthError(error, "login") }
    }
  } catch (error) {
    return { error: mapAuthError(error, "login") }
  }

  revalidatePath("/", "layout")
  return { success: true }
}

export async function signUp(formData: FormData) {
  const email = formData.get("email")
  const password = formData.get("password")
  const fullName = formData.get("fullName")

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "请填写邮箱和密码。" }
  }
  const supabase = await createClient()

  try {
    const { error } = await withTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: typeof fullName === "string" ? fullName : "",
          },
        },
      }),
      AUTH_TIMEOUT_MS
    )

    if (error) {
      return { error: mapAuthError(error, "signup") }
    }
  } catch (error) {
    return { error: mapAuthError(error, "signup") }
  }

  revalidatePath("/", "layout")
  return { success: true }
}

export async function signOut() {
  const supabase = await createClient()

  try {
    const { error } = await withTimeout(supabase.auth.signOut(), AUTH_TIMEOUT_MS)
    if (error) {
      revalidatePath("/", "layout")
      redirect("/login?error=signout_failed")
    }
  } catch {
    revalidatePath("/", "layout")
    redirect("/login?error=signout_failed")
  }

  revalidatePath("/", "layout")
  redirect("/login")
}
