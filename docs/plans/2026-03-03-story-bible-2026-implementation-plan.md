# Story Bible 2026 Consistency Core Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a compatibility-safe, end-to-end consistency system that reduces story conflicts across generation, checking, and Story Bible maintenance.

**Architecture:** Keep existing editor and AI route flow intact, then layer in a new Consistency Core with structured canon entities, task-aware context assembly, preflight checks, and enhanced post-check repair actions. Roll out in two phases with feature flags, soft-fail fallback, and compatibility-first read/write behavior.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, TipTap, Vitest, Testing Library.

---

### Task 1: Define Consistency Domain Types

**Files:**
- Create: `src/lib/story-bible/consistency-types.ts`
- Create: `src/lib/story-bible/consistency-types.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { createEmptyConsistencyState } from "./consistency-types"

describe("consistency types", () => {
  it("creates default empty consistency state", () => {
    expect(createEmptyConsistencyState()).toEqual({
      canonFacts: [],
      timelineEvents: [],
      characterArcStates: [],
      constraintRules: [],
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/story-bible/consistency-types.test.ts`
Expected: FAIL (module not found).

**Step 3: Write minimal implementation**

Create typed interfaces: `CanonFact`, `TimelineEvent`, `CharacterArcState`, `ConstraintRule`, `ConsistencyState`, plus `createEmptyConsistencyState()`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/story-bible/consistency-types.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/story-bible/consistency-types.ts src/lib/story-bible/consistency-types.test.ts
git commit -m "feat(story-bible): add consistency core domain types"
```

### Task 2: Add Compatibility-Safe Extractor From Existing Fields

**Files:**
- Create: `src/lib/story-bible/consistency-extractor.ts`
- Create: `src/lib/story-bible/consistency-extractor.test.ts`
- Modify: `src/lib/ai/story-context.ts`

**Step 1: Write the failing test**

```ts
it("extracts baseline canon facts from legacy story bible + characters", () => {
  const result = extractConsistencyState({
    storyBible: { ai_rules: "主角不能杀人", worldbuilding: "魔法有代价" },
    characters: [{ name: "林夏", role: "主角", description: "医生" }],
  })
  expect(result.constraintRules.length).toBeGreaterThan(0)
  expect(result.characterArcStates.length).toBe(1)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/story-bible/consistency-extractor.test.ts`
Expected: FAIL (module not found).

**Step 3: Write minimal implementation**

Implement `extractConsistencyState()` with safe parsing, empty fallback, and `pendingConfirmation` markers for low-confidence extraction.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/story-bible/consistency-extractor.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/story-bible/consistency-extractor.ts src/lib/story-bible/consistency-extractor.test.ts src/lib/ai/story-context.ts
git commit -m "feat(story-bible): add compatibility extractor for consistency state"
```

### Task 3: Introduce Task-Aware Structured Context Assembler

**Files:**
- Create: `src/lib/ai/structured-context.ts`
- Create: `src/lib/ai/structured-context.test.ts`
- Modify: `src/lib/ai/story-context.ts`

**Step 1: Write the failing test**

```ts
it("injects minimal required structured context for writing features", () => {
  const result = buildStructuredContext({
    feature: "write",
    consistencyState: sampleState,
  })
  expect(result).toContain("CANON FACTS")
  expect(result).not.toContain("FULL TIMELINE DUMP")
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/structured-context.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement `buildStructuredContext()` with feature-specific selection rules and deterministic ordering.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/structured-context.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/structured-context.ts src/lib/ai/structured-context.test.ts src/lib/ai/story-context.ts
git commit -m "feat(ai): add task-aware structured context assembly"
```

### Task 4: Add Preflight Consistency Check Before Generation

**Files:**
- Create: `src/lib/ai/consistency-preflight.ts`
- Create: `src/lib/ai/consistency-preflight.test.ts`
- Modify: `src/app/api/ai/quick-edit/route.ts`
- Modify: `src/app/api/ai/write/route.ts`

**Step 1: Write the failing test**

```ts
it("returns high severity when hard rule is violated", () => {
  const result = runConsistencyPreflight({
    draft: "主角亲手杀死了俘虏",
    constraints: [{ id: "r1", rule: "主角不能杀人", severity: "high" }],
  })
  expect(result.highlights[0]?.severity).toBe("high")
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/consistency-preflight.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement severity classification (`high`/`medium`/`low`) and soft-fail behavior for runtime errors.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/consistency-preflight.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/consistency-preflight.ts src/lib/ai/consistency-preflight.test.ts src/app/api/ai/quick-edit/route.ts src/app/api/ai/write/route.ts
git commit -m "feat(ai): add preflight consistency guard before generation"
```

### Task 5: Enhance Continuity Check Output Contract

**Files:**
- Modify: `src/app/api/ai/continuity-check/route.ts`
- Modify: `src/lib/ai/continuity-result.ts`
- Create: `src/app/api/ai/continuity-check/route.contract.test.ts`

**Step 1: Write the failing test**

```ts
it("returns issue with evidence chain and actionable repair fields", async () => {
  const result = await postContinuityCheck(samplePayload)
  expect(result.issues[0]).toMatchObject({
    evidenceSource: "故事圣经",
    actionType: "replace",
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/ai/continuity-check/route.contract.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

Extend response schema to carry stable evidence fields and deterministic action payload.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/ai/continuity-check/route.contract.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/api/ai/continuity-check/route.ts src/lib/ai/continuity-result.ts src/app/api/ai/continuity-check/route.contract.test.ts
git commit -m "feat(ai): enhance continuity-check contract for actionable repairs"
```

### Task 6: Build Story Bible Conflict Workbench UI

**Files:**
- Create: `src/components/story-bible/conflict-workbench.tsx`
- Create: `src/components/story-bible/conflict-workbench.test.tsx`
- Modify: `src/components/story-bible/story-bible-panel.tsx`

**Step 1: Write the failing test**

```tsx
it("shows conflict issue and supports one-click apply", async () => {
  render(<ConflictWorkbench issues={[sampleIssue]} onApply={vi.fn()} />)
  expect(screen.getByText("时间线冲突"))
  expect(screen.getByRole("button", { name: "应用修复" }))
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/story-bible/conflict-workbench.test.tsx`
Expected: FAIL.

**Step 3: Write minimal implementation**

Add a compact conflict panel with severity badge, evidence source, and apply action callback.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/story-bible/conflict-workbench.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/story-bible/conflict-workbench.tsx src/components/story-bible/conflict-workbench.test.tsx src/components/story-bible/story-bible-panel.tsx
git commit -m "feat(story-bible): add conflict workbench with one-click apply"
```

### Task 7: Add Feature Flags and Compatibility Read/Write Guardrails

**Files:**
- Create: `src/lib/story-bible/consistency-flags.ts`
- Create: `src/lib/story-bible/consistency-flags.test.ts`
- Modify: `src/app/actions/story-bible.ts`
- Modify: `src/lib/ai/story-context.ts`

**Step 1: Write the failing test**

```ts
it("disables structured context when flag is set to 0", () => {
  expect(isStructuredContextEnabled({ NEXT_PUBLIC_STRUCTURED_CONTEXT: "0" })).toBe(false)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/story-bible/consistency-flags.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement explicit flag helpers for preflight, structured context, and post-check enhancement.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/story-bible/consistency-flags.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/story-bible/consistency-flags.ts src/lib/story-bible/consistency-flags.test.ts src/app/actions/story-bible.ts src/lib/ai/story-context.ts
git commit -m "chore(story-bible): add flags and compatibility guardrails"
```

### Task 8: Observability and Metrics Baseline

**Files:**
- Create: `src/lib/ai/consistency-metrics.ts`
- Create: `src/lib/ai/consistency-metrics.test.ts`
- Modify: `src/lib/ai/openai-stream.ts`

**Step 1: Write the failing test**

```ts
it("computes conflict rate per 1000 chars", () => {
  const rate = computeConflictRate({ issues: 3, chars: 2500 })
  expect(rate).toBe(1.2)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/consistency-metrics.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement metric utilities and non-sensitive telemetry fields for conflict count, accepted repairs, and fallback events.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/consistency-metrics.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/consistency-metrics.ts src/lib/ai/consistency-metrics.test.ts src/lib/ai/openai-stream.ts
git commit -m "feat(ai): add consistency metrics baseline"
```

### Task 9: Final Verification and Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-03-03-story-bible-2026-design.md`

**Step 1: Run focused tests**

Run: `npx vitest run src/lib/story-bible/consistency-types.test.ts src/lib/story-bible/consistency-extractor.test.ts src/lib/ai/structured-context.test.ts src/lib/ai/consistency-preflight.test.ts src/app/api/ai/continuity-check/route.contract.test.ts src/components/story-bible/conflict-workbench.test.tsx src/lib/story-bible/consistency-flags.test.ts src/lib/ai/consistency-metrics.test.ts`
Expected: PASS.

**Step 2: Run regression tests for touched flows**

Run: `npm run test -- src/app/api/ai/continuity-check/route.test.ts`
Expected: PASS.

**Step 3: Run quality gates**

Run: `npm run lint && npm run build`
Expected: PASS.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(story-bible): deliver consistency core phase-1 capabilities"
```

**Step 5: Prepare rollout notes**

Document flags, fallback behavior, risk thresholds, and phase-2 follow-up metrics in PR description.
