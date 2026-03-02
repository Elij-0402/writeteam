export interface ConflictMetricsInput {
  issues: number
  chars: number
}

export function computeConflictRate(input: ConflictMetricsInput): number {
  if (input.chars <= 0) return 0
  return (input.issues / input.chars) * 1000
}

export interface ConsistencyTelemetry {
  conflictCount: number
  acceptedRepairs: number
  fallbackCount: number
  latencyMs?: number
}

export function createConsistencyTelemetry(): ConsistencyTelemetry {
  return {
    conflictCount: 0,
    acceptedRepairs: 0,
    fallbackCount: 0,
  }
}

export function recordConflict(telemetry: ConsistencyTelemetry): ConsistencyTelemetry {
  return {
    ...telemetry,
    conflictCount: telemetry.conflictCount + 1,
  }
}

export function recordAcceptedRepair(telemetry: ConsistencyTelemetry): ConsistencyTelemetry {
  return {
    ...telemetry,
    acceptedRepairs: telemetry.acceptedRepairs + 1,
  }
}

export function recordFallback(telemetry: ConsistencyTelemetry): ConsistencyTelemetry {
  return {
    ...telemetry,
    fallbackCount: telemetry.fallbackCount + 1,
  }
}
