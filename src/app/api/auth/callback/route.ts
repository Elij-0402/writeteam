import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

function sanitizeRedirectPath(path: string): string {
  if (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("@") &&
    !path.includes("\\")
  ) {
    return path
  }
  return "/dashboard"
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = sanitizeRedirectPath(searchParams.get("next") ?? "/dashboard")

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
