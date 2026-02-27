import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

async function read(pathFromRoot) {
  return readFile(join(ROOT, pathFromRoot), "utf8")
}

test("reorderDocuments rejects duplicate ids and uses RPC", async () => {
  const actions = await read("src/app/actions/documents.ts")

  assert.ok(actions.includes("const uniqueOrderedIds = new Set(orderedDocumentIds)"))
  assert.ok(actions.includes("排序参数包含重复项，请刷新后重试"))
  assert.ok(actions.includes("supabase.rpc(\"reorder_documents\""))
  assert.ok(!actions.includes("for (let i = 0; i < orderedDocumentIds.length; i += 1)"))
})

test("document list query has stable secondary order", async () => {
  const actions = await read("src/app/actions/documents.ts")
  const page = await read("src/app/(editor)/editor/[id]/page.tsx")

  assert.ok(actions.includes('.order("sort_order", { ascending: true })'))
  assert.ok(actions.includes('.order("created_at", { ascending: true })'))
  assert.ok(page.includes('.order("sort_order", { ascending: true })'))
  assert.ok(page.includes('.order("created_at", { ascending: true })'))
})

test("import flow handles content update failure and reorder persistence", async () => {
  const shell = await read("src/components/editor/editor-shell.tsx")

  assert.ok(shell.includes("const updateResult = await updateDocument(result.data.id"))
  assert.ok(shell.includes("if (updateResult.error)"))
  assert.ok(shell.includes("文件已导入，但内容保存失败，请重试"))
  assert.ok(shell.includes("const reorderResult = await reorderDocuments("))
})

test("migration defines reorder_documents RPC function", async () => {
  const migration = await read("supabase/migrations/012_reorder_documents_rpc.sql")

  assert.ok(migration.includes("CREATE OR REPLACE FUNCTION public.reorder_documents("))
  assert.ok(migration.includes("RETURNS void"))
  assert.ok(migration.includes("duplicate_document_ids"))
})
