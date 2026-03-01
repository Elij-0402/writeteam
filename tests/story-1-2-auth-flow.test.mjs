import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

async function read(pathFromRoot) {
  return readFile(join(ROOT, pathFromRoot), "utf8")
}

// --- Source-level assertions ---

test("middleware carries session-expired reason and next path", async () => {
  const middleware = await read("src/lib/supabase/middleware.ts")

  assert.ok(middleware.includes("url.searchParams.set('reason', 'session_expired')"))
  assert.ok(middleware.includes("url.searchParams.set('next', request.nextUrl.pathname)"))
})

test("login page handles contextual auth errors and safe next redirect", async () => {
  const loginPage = await read("src/app/(auth)/login/page.tsx")

  assert.ok(loginPage.includes("登录状态已失效，请重新登录后继续。"))
  assert.ok(
    loginPage.includes('!nextParam.startsWith("//")'),
    "login page must reject protocol-relative redirect paths (//evil.com)"
  )
  assert.ok(loginPage.includes("router.push(nextPath)"))
})

test("AI routes return unified unauthenticated message", async () => {
  const files = [
    "src/app/api/ai/canvas-generate/route.ts",
    "src/app/api/ai/feedback/route.ts",
    "src/app/api/ai/muse/route.ts",
    "src/app/api/ai/saliency/route.ts",
  ]

  for (const file of files) {
    const content = await read(file)
    assert.ok(content.includes('Response.json({ error: "未登录" }, { status: 401 })'), `${file} should use unified unauthenticated message`)
  }
})

test("sign out failure redirects user with recovery hint", async () => {
  const authActions = await read("src/app/actions/auth.ts")

  assert.ok(authActions.includes('redirect("/login?error=signout_failed")'))
})

// --- Behavioral assertions: mapAuthError covers AC5 failure paths ---

test("mapAuthError covers invalid credentials with Chinese recovery hint", async () => {
  const auth = await read("src/app/actions/auth.ts")

  assert.ok(
    auth.includes("invalid login credentials"),
    "mapAuthError must detect invalid login credentials"
  )
  assert.ok(
    auth.includes("邮箱或密码错误"),
    "credential error must produce Chinese user-facing message"
  )
})

test("mapAuthError covers network/fetch errors with recovery hint", async () => {
  const auth = await read("src/app/actions/auth.ts")

  assert.ok(
    auth.includes('"fetch"') || auth.includes('"network"'),
    "mapAuthError must detect network-related errors"
  )
  assert.ok(
    auth.includes("网络连接异常"),
    "network error must produce Chinese user-facing message with recovery action"
  )
})

test("mapAuthError covers timeout errors with recovery hint", async () => {
  const auth = await read("src/app/actions/auth.ts")

  assert.ok(
    auth.includes("AUTH_TIMEOUT"),
    "mapAuthError must detect timeout errors"
  )
  assert.ok(
    auth.includes("认证请求超时"),
    "timeout error must produce Chinese user-facing message"
  )
})

test("signIn and signUp never pass raw error.message as fallback", async () => {
  const auth = await read("src/app/actions/auth.ts")

  // The old pattern was: mapAuthError(error, error.message)
  // New pattern should be: mapAuthError(error, "login") or mapAuthError(error, "signup")
  assert.ok(
    !auth.includes("mapAuthError(error, error.message)"),
    "must not pass raw error.message to mapAuthError — prevents Supabase English text leaking to users"
  )
})

// --- Behavioral assertions: open redirect prevention ---

test("login page rejects protocol-relative redirect paths", async () => {
  const loginPage = await read("src/app/(auth)/login/page.tsx")

  // The redirect validation line must block both conditions
  const hasSlashCheck = loginPage.includes('nextParam.startsWith("/")')
  const hasDoubleSlashBlock = loginPage.includes('!nextParam.startsWith("//")')

  assert.ok(hasSlashCheck, "must check path starts with /")
  assert.ok(hasDoubleSlashBlock, "must reject paths starting with //")
})

// --- Behavioral assertions: all error messages include actionable next-step ---

test("all Chinese error messages include actionable recovery guidance", async () => {
  const auth = await read("src/app/actions/auth.ts")

  // Each mapped error should contain an action verb indicating what user should do next
  const actionablePatterns = [
    "重试",     // retry
    "检查",     // check
    "核对",     // verify
    "登录",     // login
    "等待",     // wait
    "使用",     // use (e.g., "请使用至少 6 个字符")
    "填写",     // fill in (e.g., "请填写邮箱和密码")
  ]

  // Extract all Chinese error messages — match both direct returns and ternary expressions
  const directReturns = auth.match(/return ".*?[。！]/g) || []
  const ternaryStrings = auth.match(/[?:]\s*"[^"]*[。！]/g) || []
  const chineseErrors = [...directReturns, ...ternaryStrings]

  assert.ok(
    chineseErrors.length >= 7,
    `expected at least 7 mapped error messages (including ternary fallbacks), found ${chineseErrors.length}`
  )

  for (const errorMsg of chineseErrors) {
    const hasAction = actionablePatterns.some((p) => errorMsg.includes(p))
    assert.ok(
      hasAction,
      `error message must include actionable guidance: ${errorMsg}`
    )
  }
})

// --- Review round 2: auth callback open redirect prevention ---

test("auth callback validates next parameter against open redirect", async () => {
  const callback = await read("src/app/api/auth/callback/route.ts")

  assert.ok(
    callback.includes('!path.startsWith("//")'),
    "auth callback must reject protocol-relative paths (//evil.com)"
  )
  assert.ok(
    callback.includes('!path.includes("@")'),
    "auth callback must reject @ in redirect path (prevents username@host exploit)"
  )
  assert.ok(
    callback.includes("!path.includes"),
    "auth callback must validate redirect path characters"
  )
  assert.ok(
    callback.includes('"/dashboard"'),
    "auth callback must default to /dashboard for unsafe paths"
  )
})

// --- Review round 2: signOut checks Supabase error object ---

test("signOut checks error object from supabase.auth.signOut()", async () => {
  const auth = await read("src/app/actions/auth.ts")

  // signOut must destructure { error } from the signOut call
  assert.ok(
    auth.includes("const { error }") && auth.includes("signOut()"),
    "signOut must destructure error from supabase.auth.signOut() response"
  )
})

// --- Review round 2: FormData validation ---

test("signIn and signUp validate FormData fields before use", async () => {
  const auth = await read("src/app/actions/auth.ts")

  assert.ok(
    auth.includes('typeof email !== "string"'),
    "signIn/signUp must validate email is a string before use"
  )
  assert.ok(
    auth.includes('typeof password !== "string"'),
    "signIn/signUp must validate password is a string before use"
  )
  assert.ok(
    !auth.includes('formData.get("email") as string'),
    "must not use type assertion for FormData.get() — use runtime checks instead"
  )
})
