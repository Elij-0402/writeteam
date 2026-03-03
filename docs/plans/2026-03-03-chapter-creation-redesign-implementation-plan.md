# Chapter Creation Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix chapter naming bug (duplicate "第 N 章" after delete) and redesign chapter creation to use free-form naming with dynamic positional numbering.

**Architecture:** Replace hardcoded auto-naming with a dialog-based creation flow. Sequence numbers become purely visual (computed from array index at render time, never stored in the title). Both dashboard sidebar and editor sidebar share the same UX pattern.

**Tech Stack:** React 19, shadcn/ui Dialog/Input components, Next.js App Router navigation (`useRouter`)

---

### Task 1: Change default chapter title in `createProject`

**Files:**
- Modify: `src/app/actions/projects.ts:41-48`

**Step 1: Update the default title**

In `src/app/actions/projects.ts`, change line 45 from `"第 1 章"` to `"未命名章节"`:

```typescript
// line 41-48, change title on line 45
// Create a default first chapter
await supabase.from("documents").insert({
  project_id: project.id,
  user_id: user.id,
  title: "未命名章节",
  document_type: "chapter",
  sort_order: 0,
})
```

**Step 2: Run build to verify no errors**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/actions/projects.ts
git commit -m "fix: change default chapter title to '未命名章节'"
```

---

### Task 2: Add "Create Document" dialog to `AppSidebar`

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx`

**Step 1: Add dialog state variables**

After line 76 (`const [editDialogOpen, setEditDialogOpen] = useState(false)`), add:

```typescript
// New document dialog state
const [newDocOpen, setNewDocOpen] = useState(false)
const [newDocTitle, setNewDocTitle] = useState("")
const [newDocProjectId, setNewDocProjectId] = useState<string | null>(null)
```

**Step 2: Replace `handleCreateDocument` with dialog-based flow**

Replace the entire `handleCreateDocument` function (lines 137-149) with:

```typescript
function openCreateDocumentDialog(projectId: string) {
  setNewDocProjectId(projectId)
  setNewDocTitle("")
  setNewDocOpen(true)
}

function handleCreateDocument(e: React.FormEvent) {
  e.preventDefault()
  if (!newDocProjectId) return

  const title = newDocTitle.trim() || "未命名章节"
  const formData = new FormData()
  formData.append("title", title)
  formData.append("documentType", "chapter")

  startTransition(async () => {
    const result = await createDocument(newDocProjectId, formData)
    setNewDocOpen(false)
    setNewDocTitle("")
    setNewDocProjectId(null)
    onDocumentsChange?.()
    // Navigate to editor with the new document
    if (result.data) {
      window.location.href = `/editor/${newDocProjectId}?doc=${result.data.id}`
    }
  })
}
```

**Step 3: Update `ProjectTree` callback to use dialog opener**

Change line 224 from:
```typescript
onCreateDocument={handleCreateDocument}
```
to:
```typescript
onCreateDocument={openCreateDocumentDialog}
```

Note: The `ProjectTree` prop signature (`onCreateDocument?: (projectId: string) => void`) remains unchanged — `openCreateDocumentDialog` has the same signature as the old `handleCreateDocument`.

**Step 4: Add the New Document Dialog JSX**

After the `ProjectEditDialog` component (after line 322), add a new dialog:

```tsx
{/* New Document Dialog */}
<Dialog open={newDocOpen} onOpenChange={(open) => {
  if (isPending) return
  setNewDocOpen(open)
  if (!open) {
    setNewDocTitle("")
    setNewDocProjectId(null)
  }
}}>
  <DialogContent>
    <form onSubmit={handleCreateDocument}>
      <DialogHeader>
        <DialogTitle>新建文档</DialogTitle>
        <DialogDescription>
          为章节起一个标题，留空将使用"未命名章节"。
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <Input
          value={newDocTitle}
          onChange={(e) => setNewDocTitle(e.target.value)}
          placeholder="请输入章节标题"
          maxLength={120}
          autoFocus
        />
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setNewDocOpen(false)
            setNewDocTitle("")
            setNewDocProjectId(null)
          }}
          disabled={isPending}
        >
          取消
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          创建
        </Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

**Step 5: Update `createDocument` import**

The `createDocument` action already returns `{ data }` with the created document. Verify the import on line 16 already includes it:
```typescript
import { createDocument, deleteDocument } from "@/app/actions/documents"
```
No change needed — it's already imported.

**Step 6: Run build to verify**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

**Step 7: Commit**

```bash
git add src/components/layout/app-sidebar.tsx
git commit -m "feat: add naming dialog for chapter creation in dashboard sidebar"
```

---

### Task 3: Add "Create Document" dialog to editor sidebar

**Files:**
- Modify: `src/components/editor/editor-shell.tsx`

**Step 1: Add dialog state variables**

Find the existing rename dialog state (around line 176-179):
```typescript
const [renameOpen, setRenameOpen] = useState(false)
```

After it, add:
```typescript
const [createDocOpen, setCreateDocOpen] = useState(false)
const [createDocTitle, setCreateDocTitle] = useState("")
```

**Step 2: Replace `handleCreateDocument` with dialog-based flow**

Replace the existing `handleCreateDocument` callback (lines 413-432) with:

```typescript
const openCreateDocumentDialog = useCallback(() => {
  setCreateDocTitle("")
  setCreateDocOpen(true)
}, [])

const handleCreateDocument = useCallback(async () => {
  setCreatingDoc(true)
  try {
    const title = createDocTitle.trim() || "未命名章节"
    const formData = new FormData()
    formData.set("title", title)
    formData.set("documentType", "chapter")
    const result = await createDocument(project.id, formData)
    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      setDocuments((prev) => [...prev, result.data!])
      setActiveDocId(result.data.id)
      setCreateDocOpen(false)
      setCreateDocTitle("")
      toast.success("章节已创建")
    }
  } catch (error) {
    toast.error(getActionErrorMessage(error, "创建失败，请检查网络后重试"))
  } finally {
    setCreatingDoc(false)
  }
}, [createDocTitle, getActionErrorMessage, project.id])
```

**Step 3: Update the "新建文档" button**

Find the button around lines 1111-1124. Change its `onClick` from `handleCreateDocument` to `openCreateDocumentDialog`:

```tsx
<Button
  variant="ghost"
  size="sm"
  className="w-full justify-start"
  onClick={openCreateDocumentDialog}
  disabled={creatingDoc}
>
  {creatingDoc ? (
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  ) : (
    <Plus className="mr-2 h-4 w-4" />
  )}
  新建文档
</Button>
```

**Step 4: Add the Create Document Dialog JSX**

After the existing rename dialog (after line 1249 `</DialogFooter>`... find the closing `</DialogContent>` and `</Dialog>`), add a new dialog:

```tsx
{/* Create Document Dialog */}
<Dialog open={createDocOpen} onOpenChange={(open) => {
  if (creatingDoc) return
  setCreateDocOpen(open)
  if (!open) setCreateDocTitle("")
}}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>新建文档</DialogTitle>
      <DialogDescription>为章节起一个标题，留空将使用"未命名章节"。</DialogDescription>
    </DialogHeader>
    <Input
      value={createDocTitle}
      onChange={(e) => setCreateDocTitle(e.target.value)}
      maxLength={120}
      placeholder="请输入章节标题"
      disabled={creatingDoc}
      autoFocus
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          handleCreateDocument()
        }
      }}
    />
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setCreateDocOpen(false)
          setCreateDocTitle("")
        }}
        disabled={creatingDoc}
      >
        取消
      </Button>
      <Button type="button" onClick={handleCreateDocument} disabled={creatingDoc}>
        {creatingDoc ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        创建
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Step 5: Run build to verify**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/components/editor/editor-shell.tsx
git commit -m "feat: add naming dialog for chapter creation in editor sidebar"
```

---

### Task 4: Add dynamic sequence numbers in `ProjectTree`

**Files:**
- Modify: `src/components/layout/project-tree.tsx:181-204`

**Step 1: Add index to the docs.map() call**

Find line 181:
```tsx
{docs.map((doc) => (
```

Change to:
```tsx
{docs.map((doc, docIndex) => (
```

**Step 2: Add sequence number to document display**

Find line 190:
```tsx
<span>{doc.title}</span>
```

Change to:
```tsx
<span>{docIndex + 1}. {doc.title}</span>
```

**Step 3: Run build to verify**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/layout/project-tree.tsx
git commit -m "feat: add dynamic sequence numbers to document list in project tree"
```

---

### Task 5: Add dynamic sequence numbers in editor sidebar

**Files:**
- Modify: `src/components/editor/editor-shell.tsx`

**Step 1: Update the document title display**

Find in the editor sidebar document list (around line 1025-1028):
```tsx
<div className="flex items-center gap-2 truncate">
  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
  <span className="truncate">{doc.title}</span>
</div>
```

The documents are rendered inside a `.map()` that already has an `index` variable (used for reorder disabled checks on line 1071). Change the title display to:

```tsx
<div className="flex items-center gap-2 truncate">
  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
  <span className="truncate">{index + 1}. {doc.title}</span>
</div>
```

**Step 2: Run build to verify**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/editor/editor-shell.tsx
git commit -m "feat: add dynamic sequence numbers to editor sidebar document list"
```

---

### Task 6: Add rename capability to `ProjectTree`

**Files:**
- Modify: `src/components/layout/project-tree.tsx`
- Modify: `src/components/layout/app-sidebar.tsx`

**Step 1: Extend `ProjectTreeProps` with rename callback**

In `project-tree.tsx`, add to the `ProjectTreeProps` interface (after line 48):
```typescript
onRenameDocument?: (document: Document) => void
```

Add to the component destructuring (after line 62):
```typescript
onRenameDocument,
```

**Step 2: Add rename menu item to document context**

Currently, each document only has a delete button (hover trash icon, lines 192-203). We need to change this to a dropdown menu to accommodate both rename and delete.

Replace the delete button block (lines 192-203):
```tsx
{onDeleteDocument && (
  <button
    onClick={(e) => {
      e.stopPropagation()
      onDeleteDocument(doc.id, project.id)
    }}
    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/doc:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
    aria-label={`删除 ${doc.title}`}
  >
    <Trash2 className="h-3 w-3" />
  </button>
)}
```

With a dropdown menu:
```tsx
{(onRenameDocument || onDeleteDocument) && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        onClick={(e) => e.stopPropagation()}
        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/doc:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent text-muted-foreground"
        aria-label={`文档菜单 ${doc.title}`}
      >
        <MoreHorizontal className="h-3 w-3" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" side="right">
      {onRenameDocument && (
        <DropdownMenuItem onClick={() => onRenameDocument(doc)}>
          <Pencil className="mr-2 h-4 w-4" />
          重命名
        </DropdownMenuItem>
      )}
      {onDeleteDocument && (
        <DropdownMenuItem
          onClick={() => onDeleteDocument(doc.id, project.id)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          删除
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

**Step 3: Add rename dialog state and handler to `AppSidebar`**

In `app-sidebar.tsx`, add state variables (after the new doc dialog state):

```typescript
// Rename document dialog state
const [renameDocOpen, setRenameDocOpen] = useState(false)
const [renameDocId, setRenameDocId] = useState<string | null>(null)
const [renameDocTitle, setRenameDocTitle] = useState("")
const [renameDocProjectId, setRenameDocProjectId] = useState<string | null>(null)
```

Add the handler functions:

```typescript
function openRenameDocumentDialog(doc: Document) {
  // Find the project this document belongs to
  const projectId = Object.entries(documentsByProject).find(
    ([, docs]) => docs.some((d) => d.id === doc.id)
  )?.[0]
  setRenameDocId(doc.id)
  setRenameDocTitle(doc.title)
  setRenameDocProjectId(projectId || null)
  setRenameDocOpen(true)
}

function handleRenameDocument(e: React.FormEvent) {
  e.preventDefault()
  if (!renameDocId) return

  const trimmedTitle = renameDocTitle.trim()
  if (!trimmedTitle) return

  startTransition(async () => {
    await updateDocument(renameDocId, { title: trimmedTitle })
    setRenameDocOpen(false)
    setRenameDocId(null)
    setRenameDocTitle("")
    setRenameDocProjectId(null)
    onDocumentsChange?.()
  })
}
```

**Step 4: Add `updateDocument` import**

Update the import on line 16 to include `updateDocument`:

```typescript
import { createDocument, deleteDocument } from "@/app/actions/documents"
```
becomes:
```typescript
import { createDocument, deleteDocument, updateDocument } from "@/app/actions/documents"
```

**Step 5: Pass `onRenameDocument` to `ProjectTree`**

In the `ProjectTree` JSX (around line 219-230), add the new prop:

```tsx
onRenameDocument={openRenameDocumentDialog}
```

**Step 6: Add Rename Document Dialog JSX**

After the New Document Dialog in `app-sidebar.tsx`, add:

```tsx
{/* Rename Document Dialog */}
<Dialog open={renameDocOpen} onOpenChange={(open) => {
  if (isPending) return
  setRenameDocOpen(open)
  if (!open) {
    setRenameDocId(null)
    setRenameDocTitle("")
    setRenameDocProjectId(null)
  }
}}>
  <DialogContent>
    <form onSubmit={handleRenameDocument}>
      <DialogHeader>
        <DialogTitle>重命名文档</DialogTitle>
        <DialogDescription>
          输入新的文档标题，保存后立即生效。
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <Input
          value={renameDocTitle}
          onChange={(e) => setRenameDocTitle(e.target.value)}
          placeholder="请输入文档标题"
          maxLength={120}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              const form = e.currentTarget.closest("form")
              form?.requestSubmit()
            }
          }}
        />
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setRenameDocOpen(false)
            setRenameDocId(null)
            setRenameDocTitle("")
            setRenameDocProjectId(null)
          }}
          disabled={isPending}
        >
          取消
        </Button>
        <Button type="submit" disabled={isPending || !renameDocTitle.trim()}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          保存
        </Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

**Step 7: Run build to verify**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

**Step 8: Commit**

```bash
git add src/components/layout/project-tree.tsx src/components/layout/app-sidebar.tsx
git commit -m "feat: add rename capability to documents in dashboard sidebar"
```

---

### Task 7: Final verification

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Run lint**

Run: `npm run lint`
Expected: No new lint errors

**Step 3: Run tests**

Run: `npm run test`
Expected: All existing tests pass

**Step 4: Final commit (if any lint fixes needed)**

```bash
git add -A
git commit -m "fix: address lint issues from chapter creation redesign"
```
