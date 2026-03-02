import { describe, expect, it } from "vitest"

import { getDocumentProgressTag } from "@/lib/editor/document-progress"
import type { Document } from "@/types/database"

function createDocument(wordCount: number): Document {
  return {
    id: "doc-1",
    project_id: "project-1",
    user_id: "user-1",
    title: "第 1 章",
    content: null,
    content_text: null,
    word_count: wordCount,
    sort_order: 0,
    document_type: "chapter",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  }
}

describe("getDocumentProgressTag", () => {
  it("returns unfinished for short drafts", () => {
    expect(getDocumentProgressTag(createDocument(299))).toBe("unfinished")
  })

  it("returns drafting for medium-length drafts", () => {
    expect(getDocumentProgressTag(createDocument(300))).toBe("drafting")
    expect(getDocumentProgressTag(createDocument(1499))).toBe("drafting")
  })

  it("returns stable for long chapters", () => {
    expect(getDocumentProgressTag(createDocument(1500))).toBe("stable")
  })

  it("treats negative or invalid counts as unfinished", () => {
    expect(getDocumentProgressTag(createDocument(-20))).toBe("unfinished")
    expect(getDocumentProgressTag(createDocument(Number.NaN))).toBe("unfinished")
  })
})
