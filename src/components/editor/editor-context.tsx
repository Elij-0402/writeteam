"use client"

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react"
import type { Character } from "@/types/database"

interface EditorContextValue {
  // State from EditorContent -> consumed by SiteHeader
  activeProjectId: string | null
  activeProjectTitle: string | null
  activeDocumentId: string | null
  activeDocumentTitle: string | null
  wordCount: number

  // State from EditorContent -> consumed by AISidebar
  documentContent: string
  hasStyleSample: boolean
  characters: Character[]

  // Function ref for AISidebar -> EditorContent
  insertTextRef: React.MutableRefObject<((text: string) => void) | null>

  // Setters (called by EditorContent)
  setActiveProject: (id: string | null, title: string | null) => void
  setActiveDocument: (id: string | null, title: string | null) => void
  setWordCount: (count: number) => void
  setDocumentContent: (content: string) => void
  setHasStyleSample: (has: boolean) => void
  setCharacters: (characters: Character[]) => void
}

const EditorContext = createContext<EditorContextValue | null>(null)

export function EditorProvider({ children }: { children: ReactNode }) {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeProjectTitle, setActiveProjectTitle] = useState<string | null>(null)
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)
  const [activeDocumentTitle, setActiveDocumentTitle] = useState<string | null>(null)
  const [wordCount, setWordCount] = useState(0)
  const [documentContent, setDocumentContent] = useState("")
  const [hasStyleSample, setHasStyleSample] = useState(false)
  const [characters, setCharacters] = useState<Character[]>([])
  const insertTextRef = useRef<((text: string) => void) | null>(null)

  const setActiveProject = useCallback((id: string | null, title: string | null) => {
    setActiveProjectId(id)
    setActiveProjectTitle(title)
  }, [])

  const setActiveDocument = useCallback((id: string | null, title: string | null) => {
    setActiveDocumentId(id)
    setActiveDocumentTitle(title)
  }, [])

  return (
    <EditorContext.Provider
      value={{
        activeProjectId,
        activeProjectTitle,
        activeDocumentId,
        activeDocumentTitle,
        wordCount,
        documentContent,
        hasStyleSample,
        characters,
        insertTextRef,
        setActiveProject,
        setActiveDocument,
        setWordCount,
        setDocumentContent,
        setHasStyleSample,
        setCharacters,
      }}
    >
      {children}
    </EditorContext.Provider>
  )
}

export function useEditorContext() {
  return useContext(EditorContext)
}
