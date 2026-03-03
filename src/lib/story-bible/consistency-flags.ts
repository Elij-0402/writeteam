interface ConsistencyFlagEnv {
  [key: string]: string | undefined
  NEXT_PUBLIC_CONSISTENCY_PREFLIGHT?: string
  NEXT_PUBLIC_STRUCTURED_CONTEXT?: string
  NEXT_PUBLIC_POST_CHECK_ENHANCED?: string
}

interface ConsistencyFeatureFlags {
  consistencyPreflight: boolean
  structuredContext: boolean
  postCheckEnhanced: boolean
}

const TRUE_VALUES = new Set(["1", "true", "yes", "on", "enabled"])
const FALSE_VALUES = new Set(["0", "false", "no", "off", "disabled"])

function resolveFlag(value: string | undefined, defaultValue = true): boolean {
  if (value === undefined) {
    return defaultValue
  }

  const normalized = value.trim().toLowerCase()
  if (normalized.length === 0) {
    return defaultValue
  }

  if (TRUE_VALUES.has(normalized)) {
    return true
  }

  if (FALSE_VALUES.has(normalized)) {
    return false
  }

  return defaultValue
}

export function isConsistencyPreflightEnabled(
  env: ConsistencyFlagEnv = process.env
): boolean {
  return resolveFlag(env.NEXT_PUBLIC_CONSISTENCY_PREFLIGHT)
}

export function isStructuredContextEnabled(
  env: ConsistencyFlagEnv = process.env
): boolean {
  return resolveFlag(env.NEXT_PUBLIC_STRUCTURED_CONTEXT)
}

export function isPostCheckEnhancedEnabled(
  env: ConsistencyFlagEnv = process.env
): boolean {
  return resolveFlag(env.NEXT_PUBLIC_POST_CHECK_ENHANCED)
}

export function getConsistencyFeatureFlags(
  env: ConsistencyFlagEnv = process.env
): ConsistencyFeatureFlags {
  return {
    consistencyPreflight: isConsistencyPreflightEnabled(env),
    structuredContext: isStructuredContextEnabled(env),
    postCheckEnhanced: isPostCheckEnhancedEnabled(env),
  }
}
