"use client"

import { useRef } from "react"
import type { Project, Document, StoryBible, Character, Plugin } from "@/types/database"
import { EditorContent } from "@/components/editor/editor-content"

interface EditorPageClientProps {
  project: Project
  documents: Document[]
  initialDocumentId?: string
  storyBible: StoryBible | null
  characters: Character[]
  plugins: Plugin[]
  entryContext?: {
    source: "canvas"
    nodeId: string
    nodeLabel: string
    nodeType: string
    nodeSummary: string
  } | null
}

export function EditorPageClient({
  project,
  documents,
  initialDocumentId,
  storyBible,
  characters,
  plugins,
  entryContext,
}: EditorPageClientProps) {
  const insertTextRef = useRef<((text: string) => void) | null>(null)

  return (
    <EditorContent
      project={project}
      documents={documents}
      initialDocumentId={initialDocumentId}
      storyBible={storyBible}
      characters={characters}
      plugins={plugins}
      entryContext={entryContext}
      onInsertTextRef={insertTextRef}
    />
  )
}
