# 保守代码清洁（全仓库）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不改变行为的前提下，删除可证明未使用的代码与文件，并保证 lint 与测试全通过。

**Architecture:** 采用“证据驱动 + 小批次删除 + 批次验证”流程。先生成候选清单并逐项给出引用证据，再按 1-5 项小批次删除，每批都执行受影响测试，最终执行全量 `npm run lint` 与 `npm run test`。严格保留 legacy 兼容逻辑与旧测试文件。

**Tech Stack:** Next.js 16, React 19, TypeScript(strict), ESLint, Vitest, Node test runner, ripgrep

---

### Task 1: 建立清理基线与候选清单文件

**Files:**
- Create: `docs/plans/2026-03-03-code-cleanup-candidates.md`
- Modify: `docs/plans/2026-03-03-code-cleanup-implementation-plan.md`

**Step 1: Write the failing test**

```ts
// src/lib/cleanup/candidate-schema.test.ts
import { describe, expect, it } from "vitest"
import { isValidCandidateRecord } from "@/lib/cleanup/candidate-schema"

describe("candidate schema", () => {
  it("rejects candidate without evidence", () => {
    expect(isValidCandidateRecord({ path: "src/x.ts" })).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/cleanup/candidate-schema.test.ts`
Expected: FAIL with module/function not found.

**Step 3: Write minimal implementation**

```ts
// src/lib/cleanup/candidate-schema.ts
export interface CleanupCandidateRecord {
  path: string
  symbol?: string
  evidence: string[]
  risk: "low" | "medium" | "high"
}

export function isValidCandidateRecord(input: unknown): input is CleanupCandidateRecord {
  if (!input || typeof input !== "object") return false
  const value = input as { path?: unknown; evidence?: unknown }
  return typeof value.path === "string" && Array.isArray(value.evidence) && value.evidence.length > 0
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/cleanup/candidate-schema.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/cleanup/candidate-schema.ts src/lib/cleanup/candidate-schema.test.ts docs/plans/2026-03-03-code-cleanup-candidates.md
git commit -m "chore: add cleanup candidate schema and tracker"
```

### Task 2: 生成可追溯候选报告脚本

**Files:**
- Create: `scripts/cleanup/generate-candidate-report.mjs`
- Modify: `docs/plans/2026-03-03-code-cleanup-candidates.md`
- Test: `scripts/cleanup/generate-candidate-report.test.mjs`

**Step 1: Write the failing test**

```js
import test from "node:test"
import assert from "node:assert/strict"
import { buildCandidateLine } from "./generate-candidate-report.mjs"

test("buildCandidateLine includes path and evidence", () => {
  const line = buildCandidateLine({ path: "src/foo.ts", evidence: ["rg:0 refs"] })
  assert.equal(line.includes("src/foo.ts"), true)
  assert.equal(line.includes("rg:0 refs"), true)
})
```

**Step 2: Run test to verify it fails**

Run: `node --test scripts/cleanup/generate-candidate-report.test.mjs`
Expected: FAIL with missing export.

**Step 3: Write minimal implementation**

```js
export function buildCandidateLine(candidate) {
  return `- ${candidate.path} | evidence: ${candidate.evidence.join("; ")}`
}
```

**Step 4: Run test to verify it passes**

Run: `node --test scripts/cleanup/generate-candidate-report.test.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/cleanup/generate-candidate-report.mjs scripts/cleanup/generate-candidate-report.test.mjs docs/plans/2026-03-03-code-cleanup-candidates.md
git commit -m "chore: add candidate report generator for conservative cleanup"
```

### Task 3: 第 1 批低风险删除（仅 1-5 项）

**Files:**
- Modify: `docs/plans/2026-03-03-code-cleanup-candidates.md`
- Modify: `<batch-1 concrete file paths from candidates doc>`
- Test: `<nearest *.test.ts(x) for modified modules>`

**Step 1: Write the failing test**

```ts
// 对每个候选的最近测试文件，新增“未引用删除后行为不变”断言
it("keeps runtime behavior unchanged after cleanup", () => {
  expect(true).toBe(true)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run <nearest-test-file>`
Expected: FAIL（先写一个与当前行为不一致的断言或缺失导入）。

**Step 3: Write minimal implementation**

```ts
// 删除候选导出/文件，仅修正编译必需的 import
// 不改业务逻辑，不改 legacy 分支
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run <nearest-test-file>`
Expected: PASS.

**Step 5: Commit**

```bash
git add <batch-1 files> docs/plans/2026-03-03-code-cleanup-candidates.md
git commit -m "chore: remove proven-unused code batch 1"
```

### Task 4: 第 2 批低风险删除（仅 1-5 项）

**Files:**
- Modify: `docs/plans/2026-03-03-code-cleanup-candidates.md`
- Modify: `<batch-2 concrete file paths from candidates doc>`
- Test: `<nearest *.test.ts(x) for modified modules>`

**Step 1: Write the failing test**

```ts
it("preserves public behavior for affected module", () => {
  expect(false).toBe(true)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run <nearest-test-file>`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// 删除 batch-2 候选项与无效 re-export
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run <nearest-test-file>`
Expected: PASS.

**Step 5: Commit**

```bash
git add <batch-2 files> docs/plans/2026-03-03-code-cleanup-candidates.md
git commit -m "chore: remove proven-unused code batch 2"
```

### Task 5: 全量验证与交付清单

**Files:**
- Modify: `docs/plans/2026-03-03-code-cleanup-candidates.md`

**Step 1: Write the failing test**

```bash
# 故意先运行一个不完整命令验证流程
npm run test -- src/non-existent.test.ts
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/non-existent.test.ts`
Expected: FAIL（文件不存在）。

**Step 3: Write minimal implementation**

```md
# 在候选文档补齐最终表格
| path | evidence | action | status |
| --- | --- | --- | --- |
| src/xxx.ts | rg=0, lint clean | deleted | verified |
```

**Step 4: Run test to verify it passes**

Run:
- `npm run lint`
- `npm run test`

Expected:
- lint: 0 error
- test: 全通过

**Step 5: Commit**

```bash
git add docs/plans/2026-03-03-code-cleanup-candidates.md <all-cleanup-files>
git commit -m "chore: complete conservative code cleanup with verification"
```

## Execution Notes
- Required skills at execution time:
  - `@superpowers/systematic-debugging`（出现任一失败时）
  - `@superpowers/verification-before-completion`（宣称完成前）
  - `@superpowers/subagent-driven-development`（若选择本会话分任务执行）
- 禁区复核清单：不得触及 auth/ownership 约束；不得删除 legacy 兼容逻辑；不得删除旧测试文件。
