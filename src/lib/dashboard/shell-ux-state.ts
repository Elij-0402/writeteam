export type ShellUXRecommendedNextAction =
  | "create_project"
  | "create_first_document"
  | "resume_last_document"
  | "continue_current_document"

export interface ShellUXDocument {
  id: string
  title: string
  updatedAt: string
}

export interface ShellUXProjectWithDocuments {
  projectId: string
  documents: ShellUXDocument[]
}

export interface ShellUXState {
  recommendedNextAction: ShellUXRecommendedNextAction
  lastEditedDocument?: ShellUXDocument
}

function getTimestamp(updatedAt: string): number {
  const parsed = Date.parse(updatedAt)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function deriveShellUXState(
  projects: ShellUXProjectWithDocuments[],
  activeDocumentId?: string,
): ShellUXState {
  if (projects.length === 0) {
    return {
      recommendedNextAction: "create_project",
    }
  }

  const allDocuments = projects.flatMap((project) => project.documents)

  if (allDocuments.length === 0) {
    return {
      recommendedNextAction: "create_first_document",
    }
  }

  const lastEditedDocument = allDocuments.reduce((latest, current) => {
    if (!latest) {
      return current
    }

    return getTimestamp(current.updatedAt) > getTimestamp(latest.updatedAt) ? current : latest
  }, allDocuments[0])

  const hasActiveDocument = activeDocumentId
    ? allDocuments.some((document) => document.id === activeDocumentId)
    : false

  return {
    recommendedNextAction: hasActiveDocument ? "continue_current_document" : "resume_last_document",
    lastEditedDocument,
  }
}
