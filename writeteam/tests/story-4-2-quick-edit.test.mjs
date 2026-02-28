import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

async function read(pathFromRoot) {
  return readFile(join(ROOT, pathFromRoot), "utf8")
}

test("quick-edit route follows fixed chain and validates required fields", async () => {
  const route = await read("src/app/api/ai/quick-edit/route.ts")

  assert.ok(route.includes("supabase.auth.getUser()"))
  assert.ok(route.includes("resolveAIConfig(request)"))
  assert.ok(route.includes("fetchStoryContext(supabase, projectId, user.id)"))
  assert.ok(route.includes("buildStoryPromptContext(storyCtx"))
  assert.ok(route.includes("createOpenAIStreamResponse("))

  assert.ok(route.includes("缺少选中文本，请重新选择文本后重试"))
  assert.ok(route.includes("缺少编辑指令，请输入编辑指令后重试"))
  assert.ok(route.includes("缺少项目ID，请返回项目后重试"))
  assert.ok(route.includes("const saliencyMap = isSaliencyMap(saliency) ? saliency : null"))
})

test("toolbar and selection menu quick-edit share 3s TTFB constant and first-byte guard", async () => {
  const toolbar = await read("src/components/ai/ai-toolbar.tsx")
  const selectionMenu = await read("src/components/editor/selection-ai-menu.tsx")
  const timing = await read("src/lib/ai/timing.ts")

  assert.ok(timing.includes("export const AI_TTFB_MS = 3000"))
  assert.ok(toolbar.includes("import { AI_TTFB_MS } from \"@/lib/ai/timing\""))
  assert.ok(selectionMenu.includes("import { AI_TTFB_MS } from \"@/lib/ai/timing\""))
  assert.ok(toolbar.includes("setTimeout(() => ttfbController.abort(), AI_TTFB_MS)"))
  assert.ok(selectionMenu.includes("setTimeout(() => ttfbController.abort(), AI_TTFB_MS)"))
  assert.ok(toolbar.includes("onFirstChunk"))
  assert.ok(selectionMenu.includes("onFirstChunk"))
  assert.ok(toolbar.includes("clearTimeout(ttfbTimer)"))
  assert.ok(selectionMenu.includes("clearTimeout(ttfbTimer)"))
})

test("selection menu quick-edit supports full action loop and recovery", async () => {
  const selectionMenu = await read("src/components/editor/selection-ai-menu.tsx")

  assert.ok(selectionMenu.includes("label=\"快编\""))
  assert.ok(selectionMenu.includes("if (e.key === \"Enter\") handleQuickEditSubmit()"))
  assert.ok(selectionMenu.includes("替换"))
  assert.ok(selectionMenu.includes("插入"))
  assert.ok(selectionMenu.includes("复制"))
  assert.ok(selectionMenu.includes("关闭"))
  assert.ok(selectionMenu.includes("<RecoveryActionBar"))
})

test("writing editor replacement path keeps structure and autosave chain", async () => {
  const editor = await read("src/components/editor/writing-editor.tsx")
  const shell = await read("src/components/editor/editor-shell.tsx")

  assert.ok(editor.includes("deleteRange({ from, to }).insertContentAt(from, actualContent)"))
  assert.ok(shell.includes("setReplaceContent(text + \"\\0\" + Date.now())"))
  assert.ok(editor.includes("}, 1000)"))
  assert.ok(editor.includes("字数"))
})
