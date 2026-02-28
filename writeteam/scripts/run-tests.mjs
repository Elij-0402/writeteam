import { spawnSync } from "node:child_process"

const npmExecPath = process.env.npm_execpath

if (!npmExecPath) {
  throw new Error("npm_execpath is not available")
}

const vitestTargets = [
  "src/app/actions/story-bible.test.ts",
  "src/app/actions/story-bible.actions.test.ts",
  "src/app/actions/series.test.ts",
  "src/app/actions/canvas.test.ts",
  "src/lib/ai/story-context.test.ts",
  "src/lib/ai/context-writing.test.ts",
  "src/lib/ai/read-ai-stream.test.ts",
  "src/app/api/ai/quick-edit/route.test.ts",
  "src/app/api/ai/continuity-check/route.test.ts",
  "src/app/api/ai/feedback/route.test.ts",
  "src/app/api/ai/collab-routes.contract.test.ts",
  "src/components/ai/recovery-action-bar.test.tsx",
  "src/components/ai/ai-toolbar.quick-edit.test.tsx",
  "src/components/ai/ai-toolbar.continuity.test.tsx",
  "src/components/ai/ai-toolbar.feedback.test.tsx",
  "src/components/ai/ai-chat-panel.test.tsx",
  "src/components/ai/muse-panel.test.tsx",
  "src/components/canvas/node-detail-panel.test.tsx",
  "src/components/canvas/canvas-editor.test.tsx",
]

const extraArgs = process.argv.slice(2)

const vitestArgs = ["run", ...vitestTargets, ...extraArgs]
const vitestResult = spawnSync(process.execPath, [npmExecPath, "exec", "--", "vitest", ...vitestArgs], {
  stdio: "inherit",
})

if (vitestResult.error) {
  throw vitestResult.error
}

if (typeof vitestResult.status === "number" && vitestResult.status !== 0) {
  process.exit(vitestResult.status)
}

if (extraArgs.length === 0) {
  const contractsResult = spawnSync("node", ["--test", "tests/story-4-2-quick-edit.test.mjs"], {
    stdio: "inherit",
  })

  if (contractsResult.error) {
    throw contractsResult.error
  }

  if (typeof contractsResult.status === "number" && contractsResult.status !== 0) {
    process.exit(contractsResult.status)
  }
}
