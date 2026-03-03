# Story Bible v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Iteratively enhance the Story Bible panel with collapsible card UI, AI-assisted field generation, structured worldbuilding sub-sections, and enhanced character management.

**Architecture:** Incremental changes within the existing right-panel StoryBiblePanel component. New `/api/ai/bible-assist` endpoint follows the existing 5-step AI pipeline. Database migration adds `dialogue_style` and `tags` columns to characters table. Worldbuilding sub-sections stored as structured text in existing `worldbuilding` column (no schema change).

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, TipTap, shadcn/ui, Tailwind CSS v4, Vitest

---

## Phase 1: Foundation — Database & Type Updates

### Task 1: Add database migration for character fields

**Files:**
- Create: `supabase/migrations/015_characters_dialogue_style_tags.sql`

**Step 1: Write the migration**

```sql
-- Add dialogue_style and tags columns to characters table
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS dialogue_style text,
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.characters.dialogue_style IS 'Character speech patterns, catchphrases, and verbal habits';
COMMENT ON COLUMN public.characters.tags IS 'Free-form tags for filtering and grouping (JSON array of strings)';
```

**Step 2: Commit**

```bash
git add supabase/migrations/015_characters_dialogue_style_tags.sql
git commit -m "feat(db): add dialogue_style and tags columns to characters table"
```

---

### Task 2: Update TypeScript database types

**Files:**
- Modify: `src/types/database.ts:121-170` (characters table types)

**Step 1: Write the failing test**

Create test in `src/types/database.type-test.ts`:

```typescript
import type { Database } from "./database"

// Type-level test: these should compile without errors
type CharRow = Database["public"]["Tables"]["characters"]["Row"]
type CharInsert = Database["public"]["Tables"]["characters"]["Insert"]
type CharUpdate = Database["public"]["Tables"]["characters"]["Update"]

// Verify new fields exist
const _dialogueStyle: CharRow["dialogue_style"] = null
const _tags: CharRow["tags"] = null
const _insertDialogue: CharInsert["dialogue_style"] = "口头禅是..."
const _insertTags: CharInsert["tags"] = ["势力A"]
const _updateDialogue: CharUpdate["dialogue_style"] = "喜欢用反问句"
const _updateTags: CharUpdate["tags"] = []
```

**Step 2: Run type check to verify it fails**

Run: `npx tsc --noEmit src/types/database.type-test.ts`
Expected: FAIL — Property 'dialogue_style' does not exist

**Step 3: Add fields to database.ts**

In `src/types/database.ts`, add to characters Row (after line 133 `notes`):

```typescript
dialogue_style: string | null
tags: Json | null
```

Add to characters Insert (after line 150 `notes`):

```typescript
dialogue_style?: string | null
tags?: Json | null
```

Add to characters Update (after line 167 `notes`):

```typescript
dialogue_style?: string | null
tags?: Json | null
```

**Step 4: Run type check to verify it passes**

Run: `npx tsc --noEmit src/types/database.type-test.ts`
Expected: PASS

**Step 5: Clean up type test file and commit**

```bash
rm src/types/database.type-test.ts
git add src/types/database.ts
git commit -m "feat(types): add dialogue_style and tags to characters type definitions"
```

---

### Task 3: Update CharacterData interface and guards

**Files:**
- Modify: `src/lib/ai/story-context.ts:48-58` (CharacterData interface)
- Modify: `src/app/actions/story-bible-guards.ts:42-52` (ALLOWED_CHARACTER_MUTATION_FIELDS)

**Step 1: Write the failing test**

Add to `src/lib/ai/story-context.test.ts`:

```typescript
describe("CharacterData interface", () => {
  it("should include dialogue_style field", () => {
    const char: CharacterData = {
      name: "测试角色",
      role: "主角",
      description: null,
      personality: null,
      appearance: null,
      backstory: null,
      goals: null,
      relationships: null,
      notes: null,
      dialogue_style: "喜欢用反问句，口头禅是「真的假的」",
    }
    expect(char.dialogue_style).toBe("喜欢用反问句，口头禅是「真的假的」")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/story-context.test.ts --reporter=verbose`
Expected: FAIL — 'dialogue_style' does not exist in type 'CharacterData'

**Step 3: Update CharacterData interface**

In `src/lib/ai/story-context.ts`, add after `notes` field (line 57):

```typescript
dialogue_style: string | null
```

Update `normalizeCharacter` function (around line 97-122) to include:

```typescript
dialogue_style: typeof raw.dialogue_style === "string" ? raw.dialogue_style : null,
```

**Step 4: Update guards**

In `src/app/actions/story-bible-guards.ts`, add to `ALLOWED_CHARACTER_MUTATION_FIELDS` array (after `notes` around line 51):

```typescript
"dialogue_style",
"tags",
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/ai/story-context.test.ts --reporter=verbose`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/ai/story-context.ts src/app/actions/story-bible-guards.ts
git commit -m "feat: add dialogue_style to CharacterData interface and guards"
```

---

## Phase 2: UI Components — Shared Building Blocks

### Task 4: Create collapsible section component

**Files:**
- Create: `src/components/story-bible/collapsible-section.tsx`
- Create: `src/components/story-bible/collapsible-section.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/story-bible/collapsible-section.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CollapsibleSection } from "./collapsible-section"

describe("CollapsibleSection", () => {
  it("renders title and children when defaultOpen is true", () => {
    render(
      <CollapsibleSection title="核心设定" defaultOpen>
        <div>child content</div>
      </CollapsibleSection>
    )
    expect(screen.getByText("核心设定")).toBeInTheDocument()
    expect(screen.getByText("child content")).toBeVisible()
  })

  it("hides children when defaultOpen is false", () => {
    render(
      <CollapsibleSection title="创作指导" defaultOpen={false}>
        <div>hidden content</div>
      </CollapsibleSection>
    )
    expect(screen.getByText("创作指导")).toBeInTheDocument()
    expect(screen.queryByText("hidden content")).not.toBeVisible()
  })

  it("shows completion badge when completionText provided", () => {
    render(
      <CollapsibleSection title="核心设定" completionText="3/5" defaultOpen>
        <div>content</div>
      </CollapsibleSection>
    )
    expect(screen.getByText("3/5")).toBeInTheDocument()
  })

  it("toggles open/closed on click", async () => {
    const user = userEvent.setup()
    render(
      <CollapsibleSection title="测试" defaultOpen>
        <div>toggle me</div>
      </CollapsibleSection>
    )
    const trigger = screen.getByRole("button", { name: /测试/ })
    await user.click(trigger)
    expect(screen.queryByText("toggle me")).not.toBeVisible()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/story-bible/collapsible-section.test.tsx`
Expected: FAIL — Cannot find module './collapsible-section'

**Step 3: Implement CollapsibleSection**

```typescript
// src/components/story-bible/collapsible-section.tsx
"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface CollapsibleSectionProps {
  title: string
  completionText?: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export function CollapsibleSection({
  title,
  completionText,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            open && "rotate-90"
          )}
        />
        <span>{title}</span>
        {completionText && (
          <Badge variant="secondary" className="ml-auto text-xs font-normal">
            {completionText}
          </Badge>
        )}
      </button>
      <div
        className={cn("space-y-3 pl-6", !open && "hidden")}
        role="region"
        aria-label={title}
      >
        {children}
      </div>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/story-bible/collapsible-section.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/story-bible/collapsible-section.tsx src/components/story-bible/collapsible-section.test.tsx
git commit -m "feat: add CollapsibleSection component for story bible UI"
```

---

### Task 5: Create completion indicator component

**Files:**
- Create: `src/components/story-bible/completion-indicator.tsx`
- Create: `src/components/story-bible/completion-indicator.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/story-bible/completion-indicator.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { CompletionIndicator } from "./completion-indicator"

describe("CompletionIndicator", () => {
  it("renders filled and total counts", () => {
    render(<CompletionIndicator filled={5} total={15} />)
    expect(screen.getByText("5/15 已填写")).toBeInTheDocument()
  })

  it("renders zero state", () => {
    render(<CompletionIndicator filled={0} total={15} />)
    expect(screen.getByText("0/15 已填写")).toBeInTheDocument()
  })

  it("renders full state", () => {
    render(<CompletionIndicator filled={15} total={15} />)
    expect(screen.getByText("15/15 已填写")).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/story-bible/completion-indicator.test.tsx`
Expected: FAIL

**Step 3: Implement CompletionIndicator**

```typescript
// src/components/story-bible/completion-indicator.tsx
"use client"

interface CompletionIndicatorProps {
  filled: number
  total: number
}

export function CompletionIndicator({ filled, total }: CompletionIndicatorProps) {
  const percentage = total > 0 ? Math.round((filled / total) * 100) : 0

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className="relative h-5 w-5">
        <svg viewBox="0 0 36 36" className="h-5 w-5 -rotate-90">
          <circle
            cx="18" cy="18" r="15.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="opacity-20"
          />
          <circle
            cx="18" cy="18" r="15.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${percentage} 100`}
            strokeLinecap="round"
            className="text-primary"
          />
        </svg>
      </div>
      <span>{filled}/{total} 已填写</span>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/story-bible/completion-indicator.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/story-bible/completion-indicator.tsx src/components/story-bible/completion-indicator.test.tsx
git commit -m "feat: add CompletionIndicator component for story bible progress"
```

---

## Phase 3: Overview Tab Restructure

### Task 6: Restructure overview tab with collapsible groups

**Files:**
- Modify: `src/components/story-bible/story-bible-panel.tsx:255-454` (overview tab)

**Step 1: Add imports**

At top of `story-bible-panel.tsx`, add:

```typescript
import { CollapsibleSection } from "./collapsible-section"
import { CompletionIndicator } from "./completion-indicator"
```

**Step 2: Add completion count computation**

After the state variables (around line 94), add:

```typescript
const overviewFields = { genre, style, pov, tense, tone, synopsis, themes }
const overviewFilled = Object.values(overviewFields).filter(v => v.trim() !== "").length
const overviewTotal = Object.keys(overviewFields).length
```

**Step 3: Restructure overview tab content**

Replace the overview `TabsContent` (lines 272-454) with two collapsible sections:

**「核心设定」group** — genre, style, pov+tense (same row), tone
**「故事内容」group** — synopsis, themes

Each text field gets placeholder text following the "template-as-prompt" pattern from the design doc (e.g., genre placeholder: "你的故事属于哪个类型？如：都市悬疑、奇幻冒险、科幻末世...").

Add `<CompletionIndicator>` at the top of the overview tab, before the collapsible sections.

**Step 4: Run existing tests**

Run: `npx vitest run src/components/story-bible/ --reporter=verbose`
Expected: All existing tests PASS (no breaking changes to exported API)

**Step 5: Manual visual verification**

Run: `npm run dev` and navigate to editor → story bible panel → overview tab.
Verify: Two collapsible sections visible, fields grouped correctly, placeholders showing.

**Step 6: Commit**

```bash
git add src/components/story-bible/story-bible-panel.tsx
git commit -m "feat: restructure overview tab with collapsible groups and completion indicator"
```

---

### Task 7: Create "创作指导" tab (extract from overview)

**Files:**
- Modify: `src/components/story-bible/story-bible-panel.tsx`

**Step 1: Add new tab to TabsList**

In the `TabsList` section (around line 255-268), add a 5th tab:

```tsx
<TabsTrigger value="guidance" className="text-xs">创作指导</TabsTrigger>
```

Adjust existing tabs to accommodate 5 tabs (may need smaller text or horizontal scroll).

**Step 2: Create new TabsContent**

After the visibility tab content, add a new `<TabsContent value="guidance">` with three collapsible sections:

**「AI 规则」**（defaultOpen=true）:
- aiRules textarea — placeholder: "给 AI 的最高优先级指令——AI 会严格遵守这些规则，覆盖其他所有设定"

**「写作素材」**（defaultOpen=false）:
- braindump textarea — placeholder: "在这里自由记录你的灵感、想法、片段——AI 会作为创意参考"
- outlineText textarea — keep existing outline logic
- notes textarea — placeholder: "任何额外的写作指导或备注"

**「风格控制」**（defaultOpen=true）:
- proseMode select — keep existing prose mode dropdown
- styleSample textarea — keep existing, only show when proseMode === "match-style"

**Step 3: Remove moved fields from overview tab**

Remove braindump, outlineText, notes, aiRules, proseMode, styleSample from the overview tab content. These fields now live exclusively in the "创作指导" tab.

**Step 4: Update completion counts**

Add guidance tab completion count:

```typescript
const guidanceFields = { aiRules, braindump, outlineText, notes }
const guidanceFilled = Object.values(guidanceFields).filter(v => v.trim() !== "").length
const guidanceTotal = Object.keys(guidanceFields).length
```

Show count on the tab trigger: `创作指导 (${guidanceFilled}/${guidanceTotal})`

**Step 5: Run existing tests and verify**

Run: `npx vitest run src/components/story-bible/ --reporter=verbose`
Expected: PASS

Run: `npm run dev` — verify fields moved correctly, save still works.

**Step 6: Commit**

```bash
git add src/components/story-bible/story-bible-panel.tsx
git commit -m "feat: extract guidance fields to new '创作指导' tab in story bible"
```

---

## Phase 4: Character Tab Enhancement

### Task 8: Create collapsible character card component

**Files:**
- Create: `src/components/story-bible/character-card.tsx`
- Create: `src/components/story-bible/character-card.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/story-bible/character-card.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CharacterCard } from "./character-card"

const mockCharacter = {
  id: "char-1",
  name: "林晚",
  role: "主角",
  description: "一个年轻的侦探",
  personality: "冷静但内心温柔",
  appearance: "黑发，戴眼镜",
  backstory: null,
  goals: "找到真相",
  relationships: null,
  notes: null,
  dialogue_style: null,
}

describe("CharacterCard", () => {
  it("renders character name and role in collapsed state", () => {
    render(
      <CharacterCard
        character={mockCharacter}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText("林晚")).toBeInTheDocument()
    expect(screen.getByText("主角")).toBeInTheDocument()
  })

  it("expands to show all fields on click", async () => {
    const user = userEvent.setup()
    render(
      <CharacterCard
        character={mockCharacter}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    const trigger = screen.getByRole("button", { name: /林晚/ })
    await user.click(trigger)
    expect(screen.getByDisplayValue("一个年轻的侦探")).toBeVisible()
    expect(screen.getByDisplayValue("冷静但内心温柔")).toBeVisible()
  })

  it("calls onUpdate when a field is edited and blurred", async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(
      <CharacterCard
        character={mockCharacter}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
        defaultOpen
      />
    )
    const descField = screen.getByDisplayValue("一个年轻的侦探")
    await user.clear(descField)
    await user.type(descField, "资深侦探")
    await user.tab()
    expect(onUpdate).toHaveBeenCalledWith("char-1", "description", "资深侦探")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/story-bible/character-card.test.tsx`
Expected: FAIL

**Step 3: Implement CharacterCard**

```typescript
// src/components/story-bible/character-card.tsx
"use client"

import { useState } from "react"
import { ChevronRight, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface CharacterCardCharacter {
  id: string
  name: string
  role: string | null
  description: string | null
  personality: string | null
  appearance: string | null
  backstory: string | null
  goals: string | null
  relationships: string | null
  notes: string | null
  dialogue_style: string | null
}

interface CharacterCardProps {
  character: CharacterCardCharacter
  onUpdate: (charId: string, field: string, value: string) => void
  onDelete: (charId: string) => void
  defaultOpen?: boolean
}

const FIELD_CONFIG = [
  { key: "role", label: "角色定位", placeholder: "主角、配角、反派...", type: "input" },
  { key: "description", label: "描述", placeholder: "用一两句话概括这个角色...", type: "textarea" },
  { key: "personality", label: "性格", placeholder: "这个角色的核心性格特征是什么？驱动他们行为的内在动力...", type: "textarea" },
  { key: "appearance", label: "外貌", placeholder: "这个角色的外貌特征、标志性穿着或配饰...", type: "textarea" },
  { key: "backstory", label: "背景", placeholder: "什么过去的经历塑造了这个角色？他们带着什么创伤或信念...", type: "textarea" },
  { key: "goals", label: "目标", placeholder: "这个角色在故事中想要实现什么？短期目标和终极追求...", type: "textarea" },
  { key: "relationships", label: "关系", placeholder: "与其他角色的关系，如：师徒 — 张三，宿敌 — 李四...", type: "textarea" },
  { key: "dialogue_style", label: "对话风格", placeholder: "这个角色说话有什么特点？口头禅、语气、措辞偏好...", type: "textarea" },
  { key: "notes", label: "备注", placeholder: "关于这个角色的其他备注...", type: "textarea" },
] as const

export function CharacterCard({
  character,
  onUpdate,
  onDelete,
  defaultOpen = false,
}: CharacterCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
        aria-expanded={open}
        aria-label={character.name}
      >
        <ChevronRight
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-90")}
        />
        <span className="font-semibold">{character.name}</span>
        {character.role && (
          <Badge variant="outline" className="text-xs font-normal">
            {character.role}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(character.id)
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </button>

      {open && (
        <div className="space-y-3 border-t px-3 pb-3 pt-2">
          {FIELD_CONFIG.map(({ key, label, placeholder, type }) => (
            <CharacterField
              key={key}
              label={label}
              value={(character as Record<string, unknown>)[key] as string ?? ""}
              placeholder={placeholder}
              type={type}
              onSave={(value) => onUpdate(character.id, key, value)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CharacterField({
  label,
  value,
  placeholder,
  type,
  onSave,
}: {
  label: string
  value: string
  placeholder: string
  type: "input" | "textarea"
  onSave: (value: string) => void
}) {
  const [localValue, setLocalValue] = useState(value)
  const [dirty, setDirty] = useState(false)

  const handleBlur = () => {
    if (dirty && localValue !== value) {
      onSave(localValue)
      setDirty(false)
    }
  }

  const Component = type === "input" ? Input : Textarea

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Component
        value={localValue}
        placeholder={placeholder}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          setLocalValue(e.target.value)
          setDirty(true)
        }}
        onBlur={handleBlur}
        className="text-sm"
        {...(type === "textarea" ? { rows: 2 } : {})}
      />
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/story-bible/character-card.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/story-bible/character-card.tsx src/components/story-bible/character-card.test.tsx
git commit -m "feat: add CollapsibleCharacterCard component with dialogue_style field"
```

---

### Task 9: Integrate character cards into story bible panel

**Files:**
- Modify: `src/components/story-bible/story-bible-panel.tsx:457-616` (characters tab)

**Step 1: Add import**

```typescript
import { CharacterCard } from "./character-card"
```

**Step 2: Replace character list with CharacterCard components**

Replace the existing character rendering in the characters tab (approximately lines 457-616) with a list of `<CharacterCard>` components. Keep the existing "新建角色" dialog and `handleCreateCharacter` / `handleDeleteCharacter` / `handleUpdateCharacter` functions. Wire them to CharacterCard's `onUpdate` and `onDelete` props.

Also add `dialogue_style` to the character creation dialog as an optional field.

**Step 3: Run existing tests**

Run: `npx vitest run src/components/story-bible/ --reporter=verbose`
Expected: PASS

**Step 4: Manual visual verification**

Run: `npm run dev` — navigate to editor → story bible → characters tab.
Verify: Characters render as collapsible cards, expand to show all fields including dialogue_style, create/delete still work.

**Step 5: Commit**

```bash
git add src/components/story-bible/story-bible-panel.tsx
git commit -m "feat: integrate collapsible character cards into story bible panel"
```

---

## Phase 5: World Tab Restructure

### Task 10: Create worldbuilding sub-section parser/serializer

**Files:**
- Create: `src/lib/story-bible/worldbuilding-sections.ts`
- Create: `src/lib/story-bible/worldbuilding-sections.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/story-bible/worldbuilding-sections.test.ts
import { describe, it, expect } from "vitest"
import {
  parseWorldbuildingSections,
  serializeWorldbuildingSections,
  type WorldbuildingSection,
} from "./worldbuilding-sections"

describe("parseWorldbuildingSections", () => {
  it("parses structured worldbuilding text into sections", () => {
    const text = `[地理环境]
山脉和河流纵横交错
气候四季分明

[势力与阵营]
皇室和反叛军对峙

[能力体系]
内力修炼体系，分九重境界`

    const sections = parseWorldbuildingSections(text)
    expect(sections).toHaveLength(3)
    expect(sections[0].title).toBe("地理环境")
    expect(sections[0].content).toBe("山脉和河流纵横交错\n气候四季分明")
    expect(sections[1].title).toBe("势力与阵营")
    expect(sections[2].title).toBe("能力体系")
  })

  it("handles legacy plain text (no sections)", () => {
    const text = "这是一个奇幻世界，有魔法和龙"
    const sections = parseWorldbuildingSections(text)
    expect(sections).toHaveLength(1)
    expect(sections[0].title).toBe("通用")
    expect(sections[0].content).toBe("这是一个奇幻世界，有魔法和龙")
  })

  it("handles empty input", () => {
    expect(parseWorldbuildingSections("")).toEqual([])
    expect(parseWorldbuildingSections(null)).toEqual([])
  })
})

describe("serializeWorldbuildingSections", () => {
  it("serializes sections back to text", () => {
    const sections: WorldbuildingSection[] = [
      { title: "地理环境", content: "山脉和河流" },
      { title: "能力体系", content: "内力修炼" },
    ]
    const text = serializeWorldbuildingSections(sections)
    expect(text).toBe("[地理环境]\n山脉和河流\n\n[能力体系]\n内力修炼")
  })

  it("omits empty sections", () => {
    const sections: WorldbuildingSection[] = [
      { title: "地理环境", content: "山脉" },
      { title: "势力与阵营", content: "" },
    ]
    const text = serializeWorldbuildingSections(sections)
    expect(text).toBe("[地理环境]\n山脉")
  })

  it("serializes single general section without header", () => {
    const sections: WorldbuildingSection[] = [
      { title: "通用", content: "奇幻世界" },
    ]
    const text = serializeWorldbuildingSections(sections)
    expect(text).toBe("奇幻世界")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/story-bible/worldbuilding-sections.test.ts`
Expected: FAIL

**Step 3: Implement parser/serializer**

```typescript
// src/lib/story-bible/worldbuilding-sections.ts
export interface WorldbuildingSection {
  title: string
  content: string
}

export const DEFAULT_SECTION_TITLES = [
  "地理环境",
  "势力与阵营",
  "能力体系",
  "社会与文化",
] as const

const SECTION_HEADER_RE = /^\[(.+?)\]\s*$/

export function parseWorldbuildingSections(
  text: string | null | undefined
): WorldbuildingSection[] {
  if (!text || text.trim() === "") return []

  const lines = text.split("\n")
  const sections: WorldbuildingSection[] = []
  let currentTitle: string | null = null
  let currentLines: string[] = []

  for (const line of lines) {
    const match = SECTION_HEADER_RE.exec(line)
    if (match) {
      if (currentTitle !== null) {
        sections.push({ title: currentTitle, content: currentLines.join("\n").trim() })
      }
      currentTitle = match[1]
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }

  if (currentTitle !== null) {
    sections.push({ title: currentTitle, content: currentLines.join("\n").trim() })
  } else if (currentLines.join("\n").trim()) {
    sections.push({ title: "通用", content: currentLines.join("\n").trim() })
  }

  return sections
}

export function serializeWorldbuildingSections(
  sections: WorldbuildingSection[]
): string {
  const nonEmpty = sections.filter((s) => s.content.trim() !== "")
  if (nonEmpty.length === 0) return ""
  if (nonEmpty.length === 1 && nonEmpty[0].title === "通用") {
    return nonEmpty[0].content
  }
  return nonEmpty.map((s) => `[${s.title}]\n${s.content}`).join("\n\n")
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/story-bible/worldbuilding-sections.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/story-bible/worldbuilding-sections.ts src/lib/story-bible/worldbuilding-sections.test.ts
git commit -m "feat: add worldbuilding sub-section parser and serializer"
```

---

### Task 11: Restructure world tab with sub-sections UI

**Files:**
- Modify: `src/components/story-bible/story-bible-panel.tsx:619-650` (world tab)

**Step 1: Add imports**

```typescript
import {
  parseWorldbuildingSections,
  serializeWorldbuildingSections,
  DEFAULT_SECTION_TITLES,
  type WorldbuildingSection,
} from "@/lib/story-bible/worldbuilding-sections"
```

**Step 2: Replace worldbuilding state**

Replace the single `worldbuilding` string state with a sections-based state:

```typescript
const [worldSections, setWorldSections] = useState<WorldbuildingSection[]>(
  () => {
    const parsed = parseWorldbuildingSections(initialBible?.worldbuilding || "")
    if (parsed.length === 0) {
      return DEFAULT_SECTION_TITLES.map(title => ({ title, content: "" }))
    }
    return parsed
  }
)
```

Update `handleSaveBible` to serialize sections:

```typescript
worldbuilding: serializeWorldbuildingSections(worldSections),
```

**Step 3: Build world tab UI**

Replace the world tab content with:
- `setting` field at top (unchanged from current) with placeholder: "故事发生的主要场景、时代和地点..."
- List of collapsible sub-section cards, each with:
  - Title (editable for custom sections)
  - Textarea content
  - Placeholder text from design doc
- "添加自定义分区" button at bottom

**Step 4: Run existing tests**

Run: `npx vitest run src/components/story-bible/ --reporter=verbose`
Expected: PASS

**Step 5: Manual verification**

Run: `npm run dev` — verify world tab shows sub-sections, legacy data loads into "通用", new sections work.

**Step 6: Commit**

```bash
git add src/components/story-bible/story-bible-panel.tsx
git commit -m "feat: restructure world tab with collapsible sub-sections"
```

---

## Phase 6: AI Assist System

### Task 12: Create bible-assist API route

**Files:**
- Create: `src/app/api/ai/bible-assist/route.ts`
- Create: `src/app/api/ai/bible-assist/route.test.ts`

**Step 1: Write the failing test**

```typescript
// src/app/api/ai/bible-assist/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))
vi.mock("@/lib/ai/resolve-config", () => ({
  resolveAIConfig: vi.fn(),
}))
vi.mock("@/lib/ai/openai-stream", () => ({
  createOpenAIStreamResponse: vi.fn(),
}))
vi.mock("@/lib/ai/story-context", () => ({
  fetchStoryContext: vi.fn(),
  buildStoryPromptContext: vi.fn(),
}))

import { POST } from "./route"
import { createClient } from "@/lib/supabase/server"
import { resolveAIConfig } from "@/lib/ai/resolve-config"

describe("POST /api/ai/bible-assist", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when user is not authenticated", async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const request = new Request("http://localhost/api/ai/bible-assist", {
      method: "POST",
      body: JSON.stringify({ projectId: "p-1", mode: "field-generate", targetField: "synopsis" }),
    })

    const response = await POST(request as never)
    expect(response.status).toBe(401)
  })

  it("returns 400 when mode is missing", async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u-1" } } })) },
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "http://test", apiKey: "key", modelId: "model" })

    const request = new Request("http://localhost/api/ai/bible-assist", {
      method: "POST",
      body: JSON.stringify({ projectId: "p-1" }),
    })

    const response = await POST(request as never)
    expect(response.status).toBe(400)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/ai/bible-assist/route.test.ts`
Expected: FAIL

**Step 3: Implement the route**

```typescript
// src/app/api/ai/bible-assist/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { createOpenAIStreamResponse } from "@/lib/ai/openai-stream"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"

type BibleAssistMode = "field-generate" | "braindump-expand" | "document-extract" | "character-generate"

const VALID_MODES: BibleAssistMode[] = ["field-generate", "braindump-expand", "document-extract", "character-generate"]

const FIELD_PROMPTS: Record<string, string> = {
  genre: "根据已有的故事信息，推荐最适合的文体类型（如都市悬疑、奇幻冒险等），用简短的词组回答。",
  style: "根据故事类型和内容，建议合适的写作风格（如紧凑明快、细腻文学等），用简短描述回答。",
  synopsis: "根据已有的角色、世界观和其他信息，写一段 200-400 字的故事梗概。",
  themes: "根据故事内容，提炼 2-4 个核心主题，每个主题用一个短语描述。",
  setting: "根据故事类型和世界观，描述故事的主要场景、时代和地理环境，150-300 字。",
  tone: "根据故事类型和内容，建议整体情绪基调（如压抑、温暖、紧张等），用简短词组回答。",
  worldbuilding: "根据已有信息，构建世界设定，包括地理环境、势力关系、能力体系和社会规则。300-500 字。",
  personality: "根据角色的描述和背景，生成这个角色的核心性格特征描述。",
  backstory: "根据角色信息和故事背景，为这个角色编写合理的背景故事。",
  goals: "根据角色的性格和故事情节，描述这个角色的短期目标和终极追求。",
  dialogue_style: "根据角色的性格和背景，描述这个角色的说话特点、口头禅和语气风格。",
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "未授权" }, { status: 401 })

  const aiConfig = resolveAIConfig(request)
  if (!aiConfig) return NextResponse.json({ error: "缺少 AI 配置" }, { status: 400 })

  const body = await request.json()
  const { projectId, mode, targetField, currentBible, documentTexts } = body

  if (!projectId || !mode || !VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: "缺少必要参数 (projectId, mode)" }, { status: 400 })
  }

  const storyCtx = await fetchStoryContext(supabase, projectId, user.id)
  const promptCtx = buildStoryPromptContext(storyCtx, { feature: "bible-assist" as never })

  let systemPrompt: string
  let userPrompt: string

  switch (mode as BibleAssistMode) {
    case "field-generate": {
      if (!targetField) {
        return NextResponse.json({ error: "field-generate 需要 targetField" }, { status: 400 })
      }
      const fieldInstruction = FIELD_PROMPTS[targetField] || `为「${targetField}」字段生成合适的内容。`
      systemPrompt = `你是一个专业的小说创作助手。根据已有的故事圣经信息，为作者生成指定字段的建议内容。\n\n${promptCtx.fullContext}\n\n注意：直接输出建议内容，不要解释。用中文回答。`
      userPrompt = fieldInstruction
      if (currentBible) {
        const filledFields = Object.entries(currentBible)
          .filter(([, v]) => v && String(v).trim())
          .map(([k, v]) => `${k}: ${String(v).slice(0, 500)}`)
          .join("\n")
        if (filledFields) userPrompt += `\n\n已有信息：\n${filledFields}`
      }
      break
    }
    case "braindump-expand": {
      systemPrompt = `你是一个专业的小说创作助手。作者在灵感池中写下了自由文本，你需要将这些灵感整理并拆解到各个结构化字段中。\n\n${promptCtx.fullContext}\n\n以 JSON 格式返回，每个字段为建议内容。只包含能从灵感池中提取的字段。格式：{"genre":"...","synopsis":"...","themes":"...","setting":"...","tone":"...","worldbuilding":"..."}`
      userPrompt = `灵感池内容：\n${currentBible?.braindump || ""}`
      break
    }
    case "document-extract": {
      const texts = (documentTexts || []).slice(0, 5).map((t: string) => t.slice(0, 3000)).join("\n---\n")
      systemPrompt = `你是一个专业的小说创作助手。分析作者的已写文本，从中提取故事圣经信息。\n\n以 JSON 格式返回提取结果：{"characters":[{"name":"...","role":"...","description":"...","personality":"..."}],"setting":"...","themes":"...","worldbuilding":"..."}`
      userPrompt = `请分析以下文本并提取故事信息：\n${texts}`
      break
    }
    case "character-generate": {
      systemPrompt = `你是一个专业的小说创作助手。根据故事梗概生成角色列表。\n\n${promptCtx.fullContext}\n\n以 JSON 数组格式返回：[{"name":"...","role":"主角/配角/反派","description":"...","personality":"...","goals":"..."}]。生成 3-6 个核心角色。`
      userPrompt = `故事梗概：\n${currentBible?.synopsis || storyCtx.bible?.synopsis || "请根据已有信息生成角色"}`
      break
    }
  }

  return createOpenAIStreamResponse(
    {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens: 2000,
      temperature: 0.7,
      ...aiConfig,
    },
    {
      supabase,
      userId: user.id,
      projectId,
      documentId: null,
      feature: `bible-assist-${mode}`,
      promptLog: userPrompt.slice(0, 500),
    }
  )
}
```

**Step 4: Add "bible-assist" to AIFeature type**

In `src/lib/ai/feature-groups.ts`, add `"bible-assist"` to the AIFeature type union.

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/app/api/ai/bible-assist/route.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/app/api/ai/bible-assist/ src/lib/ai/feature-groups.ts
git commit -m "feat: add /api/ai/bible-assist endpoint for AI-assisted story bible generation"
```

---

### Task 13: Add AI generate buttons to story bible panel

**Files:**
- Create: `src/components/story-bible/ai-field-button.tsx`
- Modify: `src/components/story-bible/story-bible-panel.tsx`

**Step 1: Create AI field button component**

```typescript
// src/components/story-bible/ai-field-button.tsx
"use client"

import { useState } from "react"
import { Sparkles, Check, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAIConfig } from "@/components/providers/ai-config-provider"

interface AIFieldButtonProps {
  projectId: string
  targetField: string
  currentBible: Record<string, unknown>
  onAccept: (value: string) => void
}

export function AIFieldButton({
  projectId,
  targetField,
  currentBible,
  onAccept,
}: AIFieldButtonProps) {
  const { config } = useAIConfig()
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!config?.apiKey || !config?.baseUrl) return
    setLoading(true)
    setPreview(null)

    try {
      const response = await fetch("/api/ai/bible-assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Base-URL": config.baseUrl,
          "X-AI-API-Key": config.apiKey,
          "X-AI-Model-ID": config.modelId || "",
        },
        body: JSON.stringify({
          projectId,
          mode: "field-generate",
          targetField,
          currentBible,
        }),
      })

      if (!response.ok || !response.body) throw new Error("请求失败")

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let result = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        result += decoder.decode(value, { stream: true })
      }
      setPreview(result.trim())
    } catch {
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }

  if (preview !== null) {
    return (
      <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-2">
        <p className="text-xs text-muted-foreground">AI 建议：</p>
        <p className="text-sm whitespace-pre-wrap">{preview}</p>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="default"
            className="h-6 text-xs"
            onClick={() => {
              onAccept(preview)
              setPreview(null)
            }}
          >
            <Check className="mr-1 h-3 w-3" />
            采纳
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs"
            onClick={() => setPreview(null)}
          >
            <X className="mr-1 h-3 w-3" />
            丢弃
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 gap-1 text-xs text-muted-foreground hover:text-primary"
      onClick={handleGenerate}
      disabled={loading || !config?.apiKey}
      title={!config?.apiKey ? "请先配置 AI 密钥" : "AI 生成建议"}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Sparkles className="h-3 w-3" />
      )}
      AI 生成
    </Button>
  )
}
```

**Step 2: Integrate into story bible panel**

In `story-bible-panel.tsx`, add `<AIFieldButton>` next to each text field (genre, style, synopsis, themes, setting, tone, worldbuilding, ai_rules, notes). Place it as a sibling of the `<Label>` in each field group.

Build the `currentBible` object from current state values to pass to each button.

Wire `onAccept` to update the corresponding state setter (e.g., for synopsis: `onAccept={(v) => { setSynopsis(v); markDirty() }}`).

**Step 3: Manual verification**

Run: `npm run dev` — verify ✨ buttons appear, click one to test AI generation flow (requires BYOK config).

**Step 4: Commit**

```bash
git add src/components/story-bible/ai-field-button.tsx src/components/story-bible/story-bible-panel.tsx
git commit -m "feat: add AI generate buttons to story bible fields"
```

---

### Task 14: Add braindump expand and document extract buttons

**Files:**
- Modify: `src/components/story-bible/story-bible-panel.tsx`

**Step 1: Add braindump expand button**

In the "创作指导" tab, above the braindump textarea, add a button:

```tsx
<Button
  variant="outline"
  size="sm"
  className="gap-1.5"
  onClick={handleBraindumpExpand}
  disabled={!braindump.trim() || braindumpExpanding}
>
  <Sparkles className="h-3.5 w-3.5" />
  从灵感池一键生成
</Button>
```

Implement `handleBraindumpExpand`:
- POST to `/api/ai/bible-assist` with mode `"braindump-expand"`
- Parse JSON response
- Show a confirmation dialog listing suggested fields
- On confirm, apply selected suggestions to state

**Step 2: Add document extract button**

In the overview tab top area, add:

```tsx
<Button
  variant="outline"
  size="sm"
  className="gap-1.5"
  onClick={handleDocumentExtract}
  disabled={documentExtracting}
>
  <FileSearch className="h-3.5 w-3.5" />
  从文档提取
</Button>
```

Implement `handleDocumentExtract`:
- Fetch project documents via existing server action
- POST to `/api/ai/bible-assist` with mode `"document-extract"` and document texts
- Parse JSON response
- Show confirmation dialog with extracted info
- On confirm, apply to state

**Step 3: Manual verification**

Test both buttons with BYOK config enabled.

**Step 4: Commit**

```bash
git add src/components/story-bible/story-bible-panel.tsx
git commit -m "feat: add braindump expand and document extract AI buttons"
```

---

## Phase 7: Prompt Construction Updates

### Task 15: Update buildStoryPromptContext for dialogue_style

**Files:**
- Modify: `src/lib/ai/story-context.ts:542-609` (buildCharacterGuidance)
- Modify: `src/lib/ai/story-context.test.ts` (add test)

**Step 1: Write the failing test**

Add to `src/lib/ai/story-context.test.ts`:

```typescript
it("includes dialogue_style in character guidance for writing features", () => {
  const ctx = {
    bible: { ...minimalBible, visibility: null },
    characters: [
      {
        name: "林晚",
        role: "主角",
        description: "侦探",
        personality: "冷静",
        appearance: "黑发",
        backstory: null,
        goals: null,
        relationships: null,
        notes: null,
        dialogue_style: "喜欢用反问句，口头禅是「你确定？」",
      },
    ],
  }
  const result = buildStoryPromptContext(ctx, { feature: "write" })
  expect(result.fullContext).toContain("Dialogue style: 喜欢用反问句")
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/story-context.test.ts --reporter=verbose -t "dialogue_style"`
Expected: FAIL

**Step 3: Update buildCharacterGuidance**

In the writing features section (around line 554-562), add dialogue_style:

```typescript
if (char.dialogue_style) parts.push(`Dialogue style: ${char.dialogue_style}`)
```

Similarly add for chat feature section (around line 586-593).

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/story-context.test.ts --reporter=verbose -t "dialogue_style"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/story-context.ts src/lib/ai/story-context.test.ts
git commit -m "feat: include dialogue_style in AI character guidance prompts"
```

---

### Task 16: Update worldbuilding prompt for sub-sections

**Files:**
- Modify: `src/lib/ai/story-context.ts` (buildWorldbuildingGuidance)
- Modify: `src/lib/ai/story-context.test.ts` (add test)

**Step 1: Write the failing test**

```typescript
it("parses structured worldbuilding sections in prompt", () => {
  const ctx = {
    bible: {
      ...minimalBible,
      worldbuilding: "[地理环境]\n山脉纵横\n\n[能力体系]\n内力修炼",
      visibility: null,
    },
    characters: [],
  }
  const result = buildStoryPromptContext(ctx, { feature: "write" })
  expect(result.fullContext).toContain("地理环境")
  expect(result.fullContext).toContain("山脉纵横")
  expect(result.fullContext).toContain("能力体系")
  expect(result.fullContext).toContain("内力修炼")
})
```

**Step 2: Run test to verify it fails (or passes with current flat approach)**

Run: `npx vitest run src/lib/ai/story-context.test.ts --reporter=verbose -t "structured worldbuilding"`

**Step 3: Update buildWorldbuildingGuidance**

Import the parser and enhance the worldbuilding section to recognize structured format:

```typescript
import { parseWorldbuildingSections } from "@/lib/story-bible/worldbuilding-sections"

// In buildWorldbuildingGuidance:
const sections = parseWorldbuildingSections(bible.worldbuilding)
if (sections.length > 1 || (sections.length === 1 && sections[0].title !== "通用")) {
  // Structured format
  const sectionText = sections
    .filter(s => s.content.trim())
    .map(s => `### ${s.title}\n${s.content}`)
    .join("\n\n")
  parts.push(`WORLD RULES (hard constraints — never violate):\n${sectionText}`)
} else {
  // Legacy flat text
  parts.push(`WORLD RULES (hard constraints — never violate):\n${bible.worldbuilding}`)
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/story-context.test.ts --reporter=verbose -t "structured worldbuilding"`
Expected: PASS

**Step 5: Run all story-context tests**

Run: `npx vitest run src/lib/ai/story-context.test.ts --reporter=verbose`
Expected: All PASS

**Step 6: Commit**

```bash
git add src/lib/ai/story-context.ts src/lib/ai/story-context.test.ts
git commit -m "feat: enhance worldbuilding prompt with structured sub-sections"
```

---

## Phase 8: Integration Testing

### Task 17: Run full test suite and fix any regressions

**Files:**
- All modified files

**Step 1: Run all Vitest tests**

Run: `npx vitest run --reporter=verbose`
Expected: All PASS

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 3: Run build**

Run: `npm run build`
Expected: Successful build with no type errors

**Step 4: Fix any issues found**

Address any test failures, lint errors, or build errors.

**Step 5: Final commit**

If fixes were needed:
```bash
git add -A
git commit -m "fix: address test and lint issues from story bible v2 changes"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-3 | DB migration, type updates, guard updates |
| 2 | 4-5 | Shared UI components (CollapsibleSection, CompletionIndicator) |
| 3 | 6-7 | Overview tab restructure + new "创作指导" tab |
| 4 | 8-9 | Character card component + integration |
| 5 | 10-11 | Worldbuilding parser + world tab restructure |
| 6 | 12-14 | AI assist endpoint + UI buttons |
| 7 | 15-16 | Prompt construction updates |
| 8 | 17 | Integration testing |

**Total: 17 tasks, ~8 commits, TDD throughout**
