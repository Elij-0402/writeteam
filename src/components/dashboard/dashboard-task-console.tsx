"use client"

import { Button } from "@/components/ui/button"
import type {
  ShellUXDocument,
  ShellUXRecommendedNextAction,
  ShellUXState,
} from "@/lib/dashboard/shell-ux-state"

interface DashboardTaskConsoleProps {
  state: ShellUXState
  recentDocuments: ShellUXDocument[]
  onResumeLastDoc: () => void
  onCreateProject: () => void
  onCreateFirstDoc: () => void
}

interface SuggestionContent {
  message: string
  actionLabel: string
  onAction: () => void
}

function assertNever(action: never): never {
  throw new Error(`Unhandled recommended next action: ${action}`)
}

function getSuggestionContent(
  state: ShellUXState,
  onResumeLastDoc: () => void,
  onCreateProject: () => void,
  onCreateFirstDoc: () => void,
): SuggestionContent {
  const action: ShellUXRecommendedNextAction = state.recommendedNextAction

  switch (action) {
    case "create_project":
      return {
        message: "下一步建议：先创建一个项目。",
        actionLabel: "创建项目",
        onAction: onCreateProject,
      }
    case "create_first_document":
      return {
        message: "下一步建议：先创建首个文档。",
        actionLabel: "创建首个文档",
        onAction: onCreateFirstDoc,
      }
    case "continue_current_document":
      return {
        message: "下一步建议：继续当前文档写作。",
        actionLabel: "继续当前文档",
        onAction: onResumeLastDoc,
      }
    case "resume_last_document":
      return {
        message: "下一步建议：回到最近编辑的文档继续写作。",
        actionLabel: "继续最近文档",
        onAction: onResumeLastDoc,
      }
    default:
      return assertNever(action)
  }
}

export function DashboardTaskConsole({
  state,
  recentDocuments,
  onResumeLastDoc,
  onCreateProject,
  onCreateFirstDoc,
}: DashboardTaskConsoleProps) {
  const suggestion = getSuggestionContent(state, onResumeLastDoc, onCreateProject, onCreateFirstDoc)
  const topRecentDocuments = recentDocuments.slice(0, 5)

  return (
    <div className="space-y-6 p-6">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">继续写作</h2>
        <Button onClick={onResumeLastDoc} disabled={!state.lastEditedDocument}>
          继续写作
        </Button>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-medium">最近文档</h3>
        {topRecentDocuments.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无最近文档</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {topRecentDocuments.map((document) => (
              <li key={document.id}>{document.title}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-medium">下一步建议</h3>
        <p className="text-sm text-muted-foreground">{suggestion.message}</p>
        <Button variant="outline" onClick={suggestion.onAction}>
          {suggestion.actionLabel}
        </Button>
      </section>
    </div>
  )
}
