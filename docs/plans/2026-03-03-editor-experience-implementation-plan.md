# Editor Experience Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve long-form writing flow by reducing interruptions while preserving current layout, AI entry points, and BYOK privacy behavior.

**Architecture:** Keep `EditorShell` as the main container and add focused enhancements in modular layers: local session state, focused-mode UI controls, unified autosave signal, chapter navigation metadata, and AI last-action shortcut. Keep existing TipTap -> autosave -> Supabase and AI BYOK header paths unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript, TipTap, Vitest, Testing Library, shadcn/ui.

---

### Task 1: Editor Session State Module

**Files:**
- Create: `src/components/editor/editor-session-state.ts`
- Create: `src/components/editor/editor-session-state.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import {
  createDefaultEditorSessionState,
  readEditorSessionState,
  writeEditorSessionState,
} from "./editor-session-state"

describe("editor session state", () => {
  it("returns defaults when storage is missing", () => {
    expect(readEditorSessionState("p-1")).toEqual(createDefaultEditorSessionState())
  })

  it("writes and reads focus + sidebar + anchor", () => {
    writeEditorSessionState("p-1", {
      focusMode: true,
      sidebarCollapsed: true,
      activeDocId: "doc-1",
      lastQuickEditInstruction: "改得更紧张",
    })
    expect(readEditorSessionState("p-1")).toMatchObject({
      focusMode: true,
      sidebarCollapsed: true,
      activeDocId: "doc-1",
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/editor/editor-session-state.test.ts`
Expected: FAIL with module not found.

**Step 3: Write minimal implementation**

```ts
export interface EditorSessionState {
  focusMode: boolean
  sidebarCollapsed: boolean
  activeDocId: string | null
  lastQuickEditInstruction: string
}

export function createDefaultEditorSessionState(): EditorSessionState {
  return { focusMode: false, sidebarCollapsed: false, activeDocId: null, lastQuickEditInstruction: "" }
}
```

Include safe `localStorage` read/write with JSON parse fallback and corrupt-value cleanup.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/editor/editor-session-state.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/editor/editor-session-state.ts src/components/editor/editor-session-state.test.ts
git commit -m "feat(editor): add persisted session state helpers"
```

### Task 2: Focus Mode in EditorShell

**Files:**
- Modify: `src/components/editor/editor-shell.tsx`
- Create: `src/components/editor/editor-shell.focus-mode.test.tsx`

**Step 1: Write the failing test**

```tsx
it("toggles focus mode and keeps quick restore controls", async () => {
  render(<EditorShell {...baseProps} />)
  await user.click(screen.getByRole("button", { name: "专注模式" }))
  expect(screen.getByTestId("editor-focus-mode")).toHaveAttribute("data-active", "true")
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/editor/editor-shell.focus-mode.test.tsx`
Expected: FAIL because button/test id does not exist.

**Step 3: Write minimal implementation**

```tsx
const [focusMode, setFocusMode] = useState(false)

<Button onClick={() => setFocusMode((v) => !v)} aria-label="专注模式">专注</Button>
<div data-testid="editor-focus-mode" data-active={focusMode ? "true" : "false"} />
```

Then wire behavior: collapse side distractions, keep one-click restore, persist state via `editor-session-state`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/editor/editor-shell.focus-mode.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/editor/editor-shell.tsx src/components/editor/editor-shell.focus-mode.test.tsx
git commit -m "feat(editor): add focus mode toggle and restore behavior"
```

### Task 3: Unified Autosave Signal Contract

**Files:**
- Create: `src/components/editor/autosave-status.ts`
- Modify: `src/components/editor/writing-editor.tsx`
- Create: `src/components/editor/writing-editor.autosave.test.tsx`

**Step 1: Write the failing test**

```tsx
it("emits saving then saved status for current doc", async () => {
  const onAutosaveStatusChange = vi.fn()
  render(<WritingEditor {...baseProps} onAutosaveStatusChange={onAutosaveStatusChange} />)
  await user.type(screen.getByRole("textbox"), "a")
  expect(onAutosaveStatusChange).toHaveBeenCalledWith(expect.objectContaining({ status: "saving" }))
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/editor/writing-editor.autosave.test.tsx`
Expected: FAIL due to missing prop/type.

**Step 3: Write minimal implementation**

```ts
export type AutosaveStatus =
  | { status: "idle" }
  | { status: "saving"; docId: string }
  | { status: "saved"; docId: string; savedAt: string }
  | { status: "retrying"; docId: string }
  | { status: "error"; docId: string; message: string }
```

Add `onAutosaveStatusChange?: (status: AutosaveStatus) => void` to `WritingEditor` props and emit status updates where autosave state changes.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/editor/writing-editor.autosave.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/editor/autosave-status.ts src/components/editor/writing-editor.tsx src/components/editor/writing-editor.autosave.test.tsx
git commit -m "refactor(editor): expose unified autosave status events"
```

### Task 4: Save Status Banner in EditorShell

**Files:**
- Create: `src/components/editor/save-status-banner.tsx`
- Create: `src/components/editor/save-status-banner.test.tsx`
- Modify: `src/components/editor/editor-shell.tsx`

**Step 1: Write the failing test**

```tsx
it("shows saving and retry actions in top hint bar", () => {
  render(<SaveStatusBanner status={{ status: "retrying", docId: "d-1" }} onRetry={vi.fn()} />)
  expect(screen.getByText("正在重试保存..."))
  expect(screen.getByRole("button", { name: "立即重试" }))
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/editor/save-status-banner.test.tsx`
Expected: FAIL because component does not exist.

**Step 3: Write minimal implementation**

```tsx
export function SaveStatusBanner({ status, onRetry }: Props) {
  if (status.status === "saved") return <p>已保存 {status.savedAt}</p>
  if (status.status === "saving") return <p>正在保存...</p>
  if (status.status === "retrying") return <button onClick={onRetry}>立即重试</button>
  if (status.status === "error") return <p>{status.message}</p>
  return null
}
```

Mount banner near top of editor area; keep existing inline status as backward-compatible during migration, then remove duplication in same task.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/editor/save-status-banner.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/editor/save-status-banner.tsx src/components/editor/save-status-banner.test.tsx src/components/editor/editor-shell.tsx
git commit -m "feat(editor): add unified save status hint banner"
```

### Task 5: Chapter Navigation Metadata Enhancements

**Files:**
- Create: `src/lib/editor/document-progress.ts`
- Create: `src/lib/editor/document-progress.test.ts`
- Modify: `src/components/editor/editor-shell.tsx`

**Step 1: Write the failing test**

```ts
it("marks unfinished chapters by low word count threshold", () => {
  expect(getDocumentProgressTag({ word_count: 120 })).toBe("unfinished")
  expect(getDocumentProgressTag({ word_count: 1800 })).toBe("drafting")
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/editor/document-progress.test.ts`
Expected: FAIL because helper module does not exist.

**Step 3: Write minimal implementation**

```ts
export function getDocumentProgressTag(doc: { word_count: number | null }): "unfinished" | "drafting" | "stable" {
  const words = doc.word_count ?? 0
  if (words < 300) return "unfinished"
  if (words < 2000) return "drafting"
  return "stable"
}
```

Integrate into left document list: show word count, progress tag badge, and "最近编辑" marker for active/recent docs.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/editor/document-progress.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/editor/document-progress.ts src/lib/editor/document-progress.test.ts src/components/editor/editor-shell.tsx
git commit -m "feat(editor): enrich chapter navigation with progress metadata"
```

### Task 6: AI Last-Action Quick Reuse

**Files:**
- Create: `src/components/ai/ai-last-action.ts`
- Create: `src/components/ai/ai-last-action.test.ts`
- Modify: `src/components/ai/ai-toolbar.tsx`
- Modify: `src/components/ai/ai-toolbar.quick-edit.test.tsx`

**Step 1: Write the failing test**

```ts
it("stores and restores last quick-edit instruction", () => {
  writeLastAIAction("p-1", { feature: "quick-edit", payload: { instruction: "改得更紧张" } })
  expect(readLastAIAction("p-1")?.payload.instruction).toBe("改得更紧张")
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ai/ai-last-action.test.ts`
Expected: FAIL because module is missing.

**Step 3: Write minimal implementation**

```ts
export interface LastAIAction {
  feature: "quick-edit"
  payload: { instruction: string }
  updatedAt: number
}
```

Persist last action in localStorage by `projectId`; add a `复用上次快编` button in `AIToolbar` that replays instruction with current selection.

**Step 4: Run tests to verify it passes**

Run: `npx vitest run src/components/ai/ai-last-action.test.ts src/components/ai/ai-toolbar.quick-edit.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/ai/ai-last-action.ts src/components/ai/ai-last-action.test.ts src/components/ai/ai-toolbar.tsx src/components/ai/ai-toolbar.quick-edit.test.tsx
git commit -m "feat(ai): add last quick-edit reuse shortcut"
```

### Task 7: Soft-Fail Guards and Feature Flags

**Files:**
- Create: `src/lib/editor/editor-experience-flags.ts`
- Modify: `src/components/editor/editor-shell.tsx`
- Modify: `src/components/ai/ai-toolbar.tsx`

**Step 1: Write the failing test**

```ts
it("disables focus enhancements when flag is off", () => {
  expect(isEditorFocusEnhancementEnabled({ NEXT_PUBLIC_EDITOR_FOCUS: "0" })).toBe(false)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/editor/editor-experience-flags.test.ts`
Expected: FAIL because helper file does not exist.

**Step 3: Write minimal implementation**

```ts
export function isEditorFocusEnhancementEnabled(env = process.env): boolean {
  return env.NEXT_PUBLIC_EDITOR_FOCUS !== "0"
}
```

Gate new enhancements and keep fallback to previous behavior if helpers fail or flag is disabled.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/editor/editor-experience-flags.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/editor/editor-experience-flags.ts src/lib/editor/editor-experience-flags.test.ts src/components/editor/editor-shell.tsx src/components/ai/ai-toolbar.tsx
git commit -m "chore(editor): add feature flags and soft-fail guards"
```

### Task 8: End-to-End Verification and Documentation

**Files:**
- Modify: `README.md` (only if user-facing behavior/flags need note)
- Modify: `docs/plans/2026-03-03-editor-experience-iteration-design.md` (optional status notes)

**Step 1: Run focused test suite**

Run: `npx vitest run src/components/editor/editor-session-state.test.ts src/components/editor/editor-shell.focus-mode.test.tsx src/components/editor/writing-editor.autosave.test.tsx src/components/editor/save-status-banner.test.tsx src/lib/editor/document-progress.test.ts src/components/ai/ai-last-action.test.ts src/components/ai/ai-toolbar.quick-edit.test.tsx src/lib/editor/editor-experience-flags.test.ts`
Expected: PASS.

**Step 2: Run regression tests for touched AI/editor paths**

Run: `npm run test -- src/components/ai/ai-toolbar.feedback.test.tsx`
Expected: PASS.

**Step 3: Run quality gates**

Run: `npm run lint && npm run build`
Expected: both PASS.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(editor): improve focus flow, save clarity, and quick AI reuse"
```

**Step 5: Prepare rollout notes**

Document feature flags, fallback behavior, and metrics to monitor in PR description.
