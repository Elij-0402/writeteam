import { createHash } from "node:crypto"

export function createTextFingerprint(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}
