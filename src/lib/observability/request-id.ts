export function createRequestId(source?: string | null): string {
  if (typeof source === "string" && source.trim().length > 0) {
    return source.trim().slice(0, 100)
  }

  return crypto.randomUUID()
}
