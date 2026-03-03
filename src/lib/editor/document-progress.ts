import type { Document } from "@/types/database"

export type DocumentProgressTag = "unfinished" | "drafting" | "stable"

const DRAFTING_WORD_COUNT_MIN = 300
const STABLE_WORD_COUNT_MIN = 1500

export function getDocumentProgressTag(doc: Pick<Document, "word_count">): DocumentProgressTag {
  const wordCount = Number.isFinite(doc.word_count) ? Math.max(0, doc.word_count) : 0

  if (wordCount >= STABLE_WORD_COUNT_MIN) {
    return "stable"
  }

  if (wordCount >= DRAFTING_WORD_COUNT_MIN) {
    return "drafting"
  }

  return "unfinished"
}

export function isDocumentRecentlyEdited(
  doc: Pick<Document, "updated_at">,
  now = Date.now(),
  recentWindowMs = 24 * 60 * 60 * 1000
): boolean {
  const updatedAtMs = Date.parse(doc.updated_at)
  if (!Number.isFinite(updatedAtMs)) {
    return false
  }

  const elapsedMs = now - updatedAtMs
  return elapsedMs >= 0 && elapsedMs <= recentWindowMs
}
