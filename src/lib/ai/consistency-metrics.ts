interface ConflictMetricsInput {
  issues: number
  chars: number
}

export function computeConflictRate(input: ConflictMetricsInput): number {
  if (input.chars <= 0) return 0
  return (input.issues / input.chars) * 1000
}

