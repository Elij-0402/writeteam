# Story Bible v3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Story Bible discoverable (icon dot indicator) and let writers see character info inline (hover cards on character names in the editor).

**Architecture:** Two independent features. Feature 1 adds a completion dot to the existing BookOpen icon button in `editor-shell.tsx`. Feature 2 creates a ProseMirror Decoration Plugin that marks character names in the TipTap editor and a floating overlay that shows character details on hover — no new dependencies needed.

**Tech Stack:** TipTap/ProseMirror (Decoration + Plugin), React (portal for overlay), Tailwind CSS, existing `@tiptap/pm` package, Vitest for tests.

---

## Codebase Context

### Key files you MUST read before starting

| File | Purpose |
|------|---------|
| `src/components/editor/editor-shell.tsx` | Main editor layout. Lines 898-950: right panel icon buttons. Lines 117-132: props include `storyBible` and `characters`. |
| `src/components/editor/writing-editor.tsx` | TipTap editor instance. Lines 165-212: `useEditor` config with 5 extensions. Accepts `saliencyData` prop. |
| `src/components/editor/editor-content.tsx` | Orchestrator. Lines 175-199: saliency computation with 5s debounce. Lines 616-630: renders WritingEditor + SaliencyIndicator. |
| `src/components/editor/editor-context.tsx` | React Context with `characters: Character[]` available globally. |
| `src/lib/ai/saliency.ts` | `computeSaliency()` — heuristic character name matching (lines 25-32). |
| `src/types/database.ts` | `Character` type: `name`, `role`, `personality`, `appearance`, `backstory`, `goals`, `relationships`, `notes` (lines 120-137). |
| `src/components/story-bible/story-bible-panel.tsx` | StoryBiblePanel component, receives `storyBible` and `characters` props. |

### Conventions

- All UI strings in Chinese (zh-CN)
- `@/*` path alias maps to `./src/*`
- Test files colocated with source (`.test.ts` / `.test.tsx`)
- Run single test: `npx vitest run src/path/to/file.test.ts`
- shadcn/ui components in `src/components/ui/`
- Lucide icons for all icons

---

## Task 1: Bible Icon Completion Dot

Add a small colored dot to the Story Bible icon button in the editor header when key bible fields are empty, so users notice the entry point.

**Files:**
- Modify: `src/components/editor/editor-shell.tsx:898-910`

**Step 1: Write the completion check logic**

In `editor-shell.tsx`, inside the `EditorShell` component body (before the return), add a `useMemo` that counts how many key story bible fields are filled:

```typescript
// Add this import at the top:
import { useMemo } from "react"

// Add this inside the component, before the return statement:
const bibleNeedsAttention = useMemo(() => {
  if (!storyBible) return true // No bible at all
  const keyFields = [
    storyBible.genre,
    storyBible.synopsis,
    storyBible.setting,
  ]
  const filled = keyFields.filter((f) => f && f.trim().length > 0).length
  return filled < 2 // Show dot if fewer than 2 of 3 key fields are filled
}, [storyBible])
```

The variable name is `storyBible` — this comes from the `EditorShellProps` (line 120: `storyBible: StoryBible | null`).

**Step 2: Add the dot indicator to the BookOpen button**

Replace lines 898-910 (the Story Bible Tooltip block) with:

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      variant={rightPanel === "bible" ? "secondary" : "ghost"}
      size="icon"
      className="relative h-8 w-8"
      onClick={() => toggleRightPanel("bible")}
    >
      <BookOpen className="h-4 w-4" />
      {bibleNeedsAttention && rightPanel !== "bible" && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500" />
      )}
    </Button>
  </TooltipTrigger>
  <TooltipContent>故事圣经</TooltipContent>
</Tooltip>
```

Key details:
- `relative` class on Button enables absolute positioning for the dot
- Dot is `h-2 w-2` (8px), `bg-amber-500` (warm amber, not red — attention, not error)
- Dot hidden when bible panel is already open (`rightPanel !== "bible"`)
- Dot hidden when key fields are filled (`bibleNeedsAttention` is false)

**Step 3: Verify visually**

Run: `npm run dev`
Expected: Open the editor for any project. The BookOpen icon should show a small amber dot in its top-right corner if the project's story bible has fewer than 2 of the 3 key fields (genre, synopsis, setting) filled.

**Step 4: Run lint**

Run: `npm run lint`
Expected: No new errors.

**Step 5: Commit**

```bash
git add src/components/editor/editor-shell.tsx
git commit -m "feat: add completion dot indicator to story bible icon button"
```

---

## Task 2: Character Name Position Finder (with TDD)

Create a pure function that finds the positions of character names within a ProseMirror document. This is the core algorithm for the decoration plugin.

**Files:**
- Create: `src/lib/editor/character-positions.ts`
- Create: `src/lib/editor/character-positions.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/editor/character-positions.test.ts
import { describe, it, expect } from "vitest"
import { findCharacterMentions, type CharacterMention } from "./character-positions"

describe("findCharacterMentions", () => {
  it("finds a single character name", () => {
    const result = findCharacterMentions("陈安走进了房间", ["陈安"])
    expect(result).toEqual([{ name: "陈安", from: 0, to: 2 }])
  })

  it("finds multiple occurrences of the same name", () => {
    const result = findCharacterMentions("陈安说：陈安来了", ["陈安"])
    expect(result).toEqual([
      { name: "陈安", from: 0, to: 2 },
      { name: "陈安", from: 4, to: 6 },
    ])
  })

  it("finds multiple different characters", () => {
    const result = findCharacterMentions("陈安和林月走在路上", ["陈安", "林月"])
    expect(result).toEqual([
      { name: "陈安", from: 0, to: 2 },
      { name: "林月", from: 3, to: 5 },
    ])
  })

  it("returns empty array when no matches", () => {
    const result = findCharacterMentions("一片寂静", ["陈安"])
    expect(result).toEqual([])
  })

  it("returns empty array for empty character list", () => {
    const result = findCharacterMentions("陈安走了", [])
    expect(result).toEqual([])
  })

  it("handles overlapping names — longer name wins", () => {
    // "陈安" is a substring of "陈安然"
    const result = findCharacterMentions("陈安然来了", ["陈安", "陈安然"])
    expect(result).toEqual([{ name: "陈安然", from: 0, to: 3 }])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/editor/character-positions.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

```typescript
// src/lib/editor/character-positions.ts
export interface CharacterMention {
  name: string
  from: number
  to: number
}

/**
 * Find all character name positions in a text string.
 * When names overlap (e.g. "陈安" inside "陈安然"), the longer name wins.
 */
export function findCharacterMentions(
  text: string,
  characterNames: string[]
): CharacterMention[] {
  if (!characterNames.length || !text) return []

  // Sort by length descending so longer names are matched first
  const sorted = [...characterNames].sort((a, b) => b.length - a.length)

  // Track which character positions are already claimed
  const claimed = new Set<number>()
  const mentions: CharacterMention[] = []

  for (const name of sorted) {
    let index = 0
    while ((index = text.indexOf(name, index)) !== -1) {
      // Check if any position in this range is already claimed
      let overlaps = false
      for (let i = index; i < index + name.length; i++) {
        if (claimed.has(i)) {
          overlaps = true
          break
        }
      }

      if (!overlaps) {
        mentions.push({ name, from: index, to: index + name.length })
        for (let i = index; i < index + name.length; i++) {
          claimed.add(i)
        }
      }
      index += name.length
    }
  }

  // Sort by position
  mentions.sort((a, b) => a.from - b.from)
  return mentions
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/editor/character-positions.test.ts`
Expected: All 6 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/editor/character-positions.ts src/lib/editor/character-positions.test.ts
git commit -m "feat: add character name position finder with overlap resolution"
```

---

## Task 3: TipTap Character Highlight Plugin

Create a ProseMirror plugin that adds inline decorations (dashed underline) to character names in the editor. The decorations are purely visual — they don't modify document content.

**Files:**
- Create: `src/lib/editor/character-highlight-plugin.ts`

**Step 1: Write the plugin**

```typescript
// src/lib/editor/character-highlight-plugin.ts
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { findCharacterMentions } from "./character-positions"

export const characterHighlightKey = new PluginKey("characterHighlight")

interface HighlightState {
  characters: string[]
  decorations: DecorationSet
}

function buildDecorations(
  doc: ProseMirrorNode,
  characterNames: string[]
): DecorationSet {
  if (!characterNames.length) return DecorationSet.empty

  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return

    const mentions = findCharacterMentions(node.text, characterNames)
    for (const m of mentions) {
      decorations.push(
        Decoration.inline(pos + m.from, pos + m.to, {
          class: "character-mention",
          "data-character-name": m.name,
        })
      )
    }
  })

  return DecorationSet.create(doc, decorations)
}

export function createCharacterHighlightPlugin(): Plugin {
  return new Plugin({
    key: characterHighlightKey,
    state: {
      init: (): HighlightState => ({
        characters: [],
        decorations: DecorationSet.empty,
      }),
      apply: (tr, value: HighlightState, _oldState, newState): HighlightState => {
        const meta = tr.getMeta(characterHighlightKey)
        if (meta?.characters !== undefined) {
          return {
            characters: meta.characters,
            decorations: buildDecorations(newState.doc, meta.characters),
          }
        }
        if (tr.docChanged) {
          return {
            characters: value.characters,
            decorations: buildDecorations(newState.doc, value.characters),
          }
        }
        return value
      },
    },
    props: {
      decorations: (state) => {
        return characterHighlightKey.getState(state)?.decorations ?? DecorationSet.empty
      },
    },
  })
}

/** Call this to update the character names used for highlighting. */
export function setHighlightCharacters(
  editor: { view: { dispatch: (tr: unknown) => void; state: { tr: { setMeta: (key: PluginKey, value: unknown) => unknown } } } },
  characters: string[]
) {
  const tr = editor.view.state.tr.setMeta(characterHighlightKey, { characters })
  editor.view.dispatch(tr)
}
```

**Step 2: Add the CSS for character-mention decoration**

In `src/app/globals.css`, add:

```css
.character-mention {
  border-bottom: 1px dashed currentColor;
  opacity: 0.7;
  cursor: help;
  transition: opacity 0.15s;
}
.character-mention:hover {
  opacity: 1;
}
```

This gives a subtle dashed underline that brightens on hover. Using `currentColor` ensures it works in both light and dark mode.

**Step 3: Run lint**

Run: `npm run lint`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/lib/editor/character-highlight-plugin.ts src/app/globals.css
git commit -m "feat: add ProseMirror character highlight decoration plugin"
```

---

## Task 4: Character Hover Card Component

Create a floating card component that shows character details when hovering over a decorated character name in the editor.

**Files:**
- Create: `src/components/editor/character-hover-card.tsx`

**Step 1: Write the component**

```tsx
// src/components/editor/character-hover-card.tsx
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import type { Character } from "@/types/database"
import { User } from "lucide-react"

function truncate(text: string | null, maxLen: number): string | null {
  if (!text) return null
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text
}

interface CharacterHoverCardProps {
  editorElement: HTMLElement | null
  characters: Character[]
  onViewCharacter?: () => void
}

export function CharacterHoverCard({
  editorElement,
  characters,
  onViewCharacter,
}: CharacterHoverCardProps) {
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const showTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const cardRef = useRef<HTMLDivElement>(null)

  const clearTimers = useCallback(() => {
    clearTimeout(showTimerRef.current)
    clearTimeout(hideTimerRef.current)
  }, [])

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setActiveCharacter(null)
      setPosition(null)
    }, 150)
  }, [])

  useEffect(() => {
    if (!editorElement) return

    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest(".character-mention") as HTMLElement | null
      if (!target) return

      const name = target.getAttribute("data-character-name")
      if (!name) return

      clearTimers()
      showTimerRef.current = setTimeout(() => {
        const char = characters.find((c) => c.name === name)
        if (!char) return

        const rect = target.getBoundingClientRect()
        setActiveCharacter(char)
        setPosition({ x: rect.left, y: rect.bottom + 6 })
      }, 300)
    }

    const handleMouseOut = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest(".character-mention")
      if (!target) return
      clearTimeout(showTimerRef.current)
      scheduleHide()
    }

    editorElement.addEventListener("mouseover", handleMouseOver)
    editorElement.addEventListener("mouseout", handleMouseOut)

    return () => {
      editorElement.removeEventListener("mouseover", handleMouseOver)
      editorElement.removeEventListener("mouseout", handleMouseOut)
      clearTimers()
    }
  }, [editorElement, characters, clearTimers, scheduleHide])

  if (!activeCharacter || !position) return null

  const personality = truncate(activeCharacter.personality, 80)
  const appearance = truncate(activeCharacter.appearance, 60)

  return createPortal(
    <div
      ref={cardRef}
      className="fixed z-50 w-[280px] rounded-lg border bg-popover p-3 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ left: position.x, top: position.y }}
      onMouseEnter={() => clearTimeout(hideTimerRef.current)}
      onMouseLeave={scheduleHide}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium leading-none">{activeCharacter.name}</p>
          {activeCharacter.role && (
            <p className="mt-0.5 text-xs text-muted-foreground">{activeCharacter.role}</p>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-1.5 text-xs text-muted-foreground">
        {personality && (
          <div>
            <span className="font-medium text-foreground">性格：</span>
            {personality}
          </div>
        )}
        {appearance && (
          <div>
            <span className="font-medium text-foreground">外貌：</span>
            {appearance}
          </div>
        )}
      </div>

      {/* Footer link */}
      {onViewCharacter && (
        <button
          type="button"
          className="mt-2 text-xs text-primary hover:underline"
          onClick={onViewCharacter}
        >
          → 查看完整资料
        </button>
      )}
    </div>,
    document.body
  )
}
```

Key design decisions:
- Uses `createPortal` to render outside the editor DOM (avoids ProseMirror layout issues)
- 300ms show delay (prevents flicker on fast mouse movement)
- 150ms hide delay (allows moving mouse from text to card)
- Card stays open when mouse enters the card itself
- Uses existing Tailwind classes for popover styling (`bg-popover`, `text-popover-foreground`)
- Shows personality + appearance only (most useful during writing)

**Step 2: Run lint**

Run: `npm run lint`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/editor/character-hover-card.tsx
git commit -m "feat: add character hover card overlay component"
```

---

## Task 5: Wire Plugin and Hover Card into the Editor

Connect the character highlight plugin to the TipTap editor and render the hover card overlay.

**Files:**
- Modify: `src/components/editor/writing-editor.tsx` (add plugin to extensions, add overlay)
- Modify: `src/components/editor/editor-content.tsx` (pass characters to WritingEditor, update highlights)

### Part A: WritingEditor changes

**Step 1: Add the plugin to TipTap extensions**

In `writing-editor.tsx`:

Add imports at the top:

```typescript
import { createCharacterHighlightPlugin, setHighlightCharacters } from "@/lib/editor/character-highlight-plugin"
import { CharacterHoverCard } from "@/components/editor/character-hover-card"
import type { Character } from "@/types/database"
```

Add `characters` and `onOpenBible` to the `WritingEditorProps` interface:

```typescript
interface WritingEditorProps {
  document: Document
  projectId: string
  onUpdate: (
    docId: string,
    updates: { content?: Json | null; content_text?: string; word_count?: number }
  ) => Promise<{ success?: boolean; error?: string }>
  onSelectionChange: (text: string) => void
  insertContent?: string
  replaceContent?: string
  retryRequestId?: number
  saliencyData?: { activeCharacters: string[]; activeLocations: string[]; activePlotlines: string[] } | null
  onAutosaveStatusChange?: (status: AutosaveStatus) => void
  characters?: Character[]          // ADD
  onOpenBible?: () => void          // ADD
}
```

In the `useEditor` config (line 167), add the plugin to the extensions array:

```typescript
extensions: [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  Placeholder.configure({
    placeholder: "开始创作你的故事...",
  }),
  CharacterCount,
  Highlight,
  Typography,
],
// ADD THIS to the useEditor options:
editorProps: {
  // ... keep existing editorProps
},
// Keep immediatelyRender, onUpdate, onSelectionUpdate as-is
```

Wait — the character highlight plugin is a ProseMirror plugin, not a TipTap Extension. We need to inject it differently. Use the approach of creating a TipTap extension wrapper:

Add a ref for the ProseMirror plugin and register it:

```typescript
// Before useEditor, create the plugin instance:
const characterPluginRef = useRef(createCharacterHighlightPlugin())

// In the useEditor extensions array, add at the end:
extensions: [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  Placeholder.configure({
    placeholder: "开始创作你的故事...",
  }),
  CharacterCount,
  Highlight,
  Typography,
],
```

Actually, TipTap doesn't accept raw ProseMirror plugins in the extensions array directly. The correct way is to use `Extension.create`:

Instead, in `character-highlight-plugin.ts`, export a TipTap Extension:

```typescript
// Add this to the bottom of character-highlight-plugin.ts:
import { Extension } from "@tiptap/core"

export const CharacterHighlightExtension = Extension.create({
  name: "characterHighlight",

  addProseMirrorPlugins() {
    return [createCharacterHighlightPlugin()]
  },
})
```

Then in `writing-editor.tsx`, simply add it to extensions:

```typescript
import { CharacterHighlightExtension, setHighlightCharacters } from "@/lib/editor/character-highlight-plugin"

// In useEditor:
extensions: [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  Placeholder.configure({
    placeholder: "开始创作你的故事...",
  }),
  CharacterCount,
  Highlight,
  Typography,
  CharacterHighlightExtension,
],
```

**Step 2: Update highlight characters when saliency data changes**

After the `useEditor` call, add an effect that updates the plugin when `saliencyData` changes:

```typescript
// Update character highlights when saliency detects active characters
useEffect(() => {
  if (!editor || !saliencyData?.activeCharacters) return
  setHighlightCharacters(editor, saliencyData.activeCharacters)
}, [editor, saliencyData?.activeCharacters])
```

**Step 3: Add a ref for the editor DOM element and render the hover card**

Add a ref to get the editor DOM element:

```typescript
const editorRef = useRef<HTMLDivElement>(null)
```

Wrap the existing `EditorContent` in a div with this ref, and add `CharacterHoverCard` below it. Find the JSX where `EditorContent` is rendered (around line 250+) and wrap it:

```tsx
<div ref={editorRef}>
  <EditorContent editor={editor} />
</div>
<CharacterHoverCard
  editorElement={editorRef.current}
  characters={characters ?? []}
  onViewCharacter={onOpenBible}
/>
```

**Step 4: Destructure new props**

In the component function signature, add destructuring for the new props:

```typescript
export const WritingEditor = memo(function WritingEditor({
  document,
  projectId,
  onUpdate,
  onSelectionChange,
  insertContent,
  replaceContent,
  retryRequestId,
  saliencyData,
  onAutosaveStatusChange,
  characters,           // ADD
  onOpenBible,          // ADD
}: WritingEditorProps) {
```

### Part B: EditorContent changes

**Step 5: Pass characters and onOpenBible to WritingEditor**

In `editor-content.tsx`, find where `WritingEditor` is rendered (around line 616) and add the new props:

```tsx
<WritingEditor
  document={activeDocument}
  projectId={project.id}
  onUpdate={handleDocumentUpdate}
  onSelectionChange={setSelectedText}
  insertContent={editorContent}
  replaceContent={replaceContent}
  saliencyData={saliencyMap}
  onAutosaveStatusChange={setAutosaveStatus}
  retryRequestId={autosaveRetryRequestId}
  characters={initialCharacters}
  onOpenBible={onOpenBible}
/>
```

The `onOpenBible` prop needs to be threaded from `EditorShell` → `EditorContent` → `WritingEditor`. Add it to `EditorContent`'s props interface and pass from `EditorShell`.

In `editor-content.tsx`, add to props:

```typescript
interface EditorContentProps {
  // ... existing props
  onOpenBible?: () => void   // ADD
}
```

In `editor-shell.tsx`, where `EditorContent` is rendered, add:

```tsx
<EditorContent
  // ... existing props
  onOpenBible={() => setRightPanel("bible")}
/>
```

Note: Find the actual EditorContent rendering location in editor-shell.tsx. It's likely inside `renderEditorArea()` around line 700+.

**Step 6: Run lint and dev server**

Run: `npm run lint`
Expected: No errors.

Run: `npm run dev`
Expected: Open editor with a project that has characters. Type a character's name in the editor. After 5 seconds (saliency debounce), the name should get a dashed underline. Hover over it to see the character card.

**Step 7: Commit**

```bash
git add src/components/editor/writing-editor.tsx src/components/editor/editor-content.tsx src/components/editor/editor-shell.tsx src/lib/editor/character-highlight-plugin.ts
git commit -m "feat: wire character highlight plugin and hover card into editor"
```

---

## Task 6: Final Verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass, including the new `character-positions.test.ts`.

**Step 2: Run lint**

Run: `npm run lint`
Expected: No errors.

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

**Step 4: Manual smoke test checklist**

1. Open editor for a project with characters and story bible data
2. Verify: BookOpen icon shows amber dot when bible has < 2 key fields filled
3. Verify: Amber dot disappears when you fill genre + synopsis + setting
4. Verify: Amber dot disappears when bible panel is open
5. Type a character name in the editor
6. Wait 5 seconds for saliency detection
7. Verify: Character name gets dashed underline
8. Hover over the underlined name
9. Verify: Card appears after 300ms with name, role, personality, appearance
10. Move mouse to the card — verify it stays open
11. Move mouse away — verify it disappears after 150ms
12. Click "查看完整资料" — verify right panel switches to story bible
13. Verify: Editor autosave still works (type, wait 1s, reload page)
14. Verify: Dark mode rendering looks correct

**Step 5: Commit final state**

If any fixes were needed during smoke testing, commit them:

```bash
git add -A
git commit -m "fix: polish character hover card and bible dot indicator"
```

---

## Summary

| Task | Description | Files Changed | Estimated Steps |
|------|-------------|---------------|----------------|
| 1 | Bible icon completion dot | editor-shell.tsx | 5 |
| 2 | Character name position finder (TDD) | character-positions.ts + test | 5 |
| 3 | ProseMirror highlight plugin + CSS | character-highlight-plugin.ts, globals.css | 4 |
| 4 | Character hover card component | character-hover-card.tsx | 3 |
| 5 | Wire everything together | writing-editor.tsx, editor-content.tsx, editor-shell.tsx, character-highlight-plugin.ts | 7 |
| 6 | Final verification | — | 5 |

**Total: 6 tasks, ~29 steps**
