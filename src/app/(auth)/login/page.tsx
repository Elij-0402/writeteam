"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PenLine, Loader2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [nextPath, setNextPath] = useState("/dashboard")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const nextParam = params.get("next")

    setReason(params.get("reason"))
    setAuthError(params.get("error"))
    if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
      setNextPath(nextParam)
    }
  }, [])

  const contextualError =
    error ||
    (reason === "session_expired"
      ? "登录状态已失效，请重新登录后继续。"
      : authError === "auth_callback_error"
        ? "登录回调失败，请重试或重新登录。"
        : authError === "signout_failed"
          ? "退出时网络异常，请重新登录后再试。"
          : null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    try {
      const result = await signIn(formData)

      if (result?.error) {
        setError(result.error)
        return
      }

      if (result?.success) {
        router.push(nextPath)
        return
      }

      setError("当前无法登录，请稍后重试。")
    } catch {
      setError("认证请求失败，请稍后重试。")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_0%,hsl(var(--primary)/0.18),transparent)]" />
      <Card className="relative w-full max-w-md border-border/60 bg-card/95 shadow-2xl backdrop-blur-sm">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg ring-4 ring-primary/15">
            <PenLine className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-semibold tracking-tight">欢迎回来</CardTitle>
          <CardDescription className="text-sm text-muted-foreground/90">
            登录你的 WriteTeam 账号
          </CardDescription>
        </CardHeader>
        <form action={handleSubmit}>
          <CardContent className="space-y-5">
            {contextualError && (
              <div className="rounded-md border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {contextualError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                required
                autoComplete="email"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="请输入密码"
                required
                autoComplete="current-password"
                className="h-11"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-3">
            <Button type="submit" className="h-11 w-full font-medium" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              登录
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              还没有账号？{" "}
              <Link
                href="/signup"
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                去注册
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
