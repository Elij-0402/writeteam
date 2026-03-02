# Remove Signup Name Field Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 移除注册流程中的姓名字段，确保前后端注册链路只处理邮箱和密码。

**Architecture:** 采用最小改动方案：同步删除注册页面姓名输入与 `signUp` Server Action 中的姓名读取/写入逻辑，保持现有错误处理、超时保护与跳转行为不变。通过新增针对页面与动作层的测试覆盖字段移除后的关键行为，避免回归。

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Auth, Vitest, Testing Library

---

### Task 1: 注册页移除姓名字段（TDD）

**Files:**
- Create: `src/app/(auth)/signup/page.test.tsx`
- Modify: `src/app/(auth)/signup/page.tsx`
- Test: `src/app/(auth)/signup/page.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react"
import SignUpPage from "@/app/(auth)/signup/page"

describe("SignUpPage", () => {
  it("只显示邮箱和密码输入，不显示姓名输入", () => {
    render(<SignUpPage />)

    expect(screen.queryByLabelText("姓名")).toBeNull()
    expect(screen.getByLabelText("邮箱")).toBeTruthy()
    expect(screen.getByLabelText("密码")).toBeTruthy()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/(auth)/signup/page.test.tsx"`
Expected: FAIL，报出仍然存在“姓名”输入或查询断言不通过。

**Step 3: Write minimal implementation**

从 `src/app/(auth)/signup/page.tsx` 删除以下块：

```tsx
<div className="space-y-2">
  <Label htmlFor="fullName">姓名</Label>
  <Input
    id="fullName"
    name="fullName"
    type="text"
    placeholder="请输入姓名"
    required
    autoComplete="name"
    className="h-11"
  />
</div>
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/(auth)/signup/page.test.tsx"`
Expected: PASS。

**Step 5: Commit**

```bash
git add "src/app/(auth)/signup/page.tsx" "src/app/(auth)/signup/page.test.tsx"
git commit -m "test(ui): remove signup name field and cover form inputs"
```

### Task 2: 服务端注册动作移除 full_name 写入（TDD）

**Files:**
- Create: `src/app/actions/auth.test.ts`
- Modify: `src/app/actions/auth.ts`
- Test: `src/app/actions/auth.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest"
import { signUp } from "@/app/actions/auth"

const signUpMock = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signUp: signUpMock,
    },
  }),
}))

describe("signUp", () => {
  it("调用 Supabase 注册时不发送 full_name 元数据", async () => {
    signUpMock.mockResolvedValue({ error: null })

    const formData = new FormData()
    formData.set("email", "user@example.com")
    formData.set("password", "123456")

    await signUp(formData)

    expect(signUpMock).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "123456",
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/actions/auth.test.ts`
Expected: FAIL，当前实现仍包含 `options.data.full_name`。

**Step 3: Write minimal implementation**

在 `src/app/actions/auth.ts` 做最小改动：
- 删除 `const fullName = formData.get("fullName")`
- 将 `supabase.auth.signUp({...})` 调整为仅保留 `email`、`password`

目标代码：

```ts
const { error } = await withTimeout(
  supabase.auth.signUp({
    email,
    password,
  }),
  AUTH_TIMEOUT_MS
)
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/actions/auth.test.ts`
Expected: PASS。

**Step 5: Commit**

```bash
git add src/app/actions/auth.ts src/app/actions/auth.test.ts
git commit -m "refactor(auth): drop signup full_name metadata"
```

### Task 3: 回归验证与收尾

**Files:**
- Modify: `docs/plans/2026-03-03-remove-signup-name-implementation-plan.md`（仅在执行偏离计划时记录）

**Step 1: Run focused tests**

Run: `npx vitest run "src/app/(auth)/signup/page.test.tsx" src/app/actions/auth.test.ts`
Expected: PASS。

**Step 2: Run lint for changed areas**

Run: `npm run lint`
Expected: PASS（无新增 lint 错误）。

**Step 3: Optional build check (if required by release gate)**

Run: `npm run build`
Expected: PASS。

**Step 4: Final git status check**

Run: `git status --short`
Expected: 仅存在预期变更，无意外文件。

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: verify signup flow after removing name field"
```
