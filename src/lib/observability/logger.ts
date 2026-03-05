type LogLevel = "info" | "warn" | "error"

type LogContext = {
  requestId?: string
  route?: string
  feature?: string
  status?: number
  latencyMs?: number
  userId?: string
  errorCode?: string
}

function sanitize(value: string): string {
  return value
    .replace(/(sk-[A-Za-z0-9_-]+)/g, "[REDACTED_KEY]")
    .replace(/(Bearer\s+[A-Za-z0-9._-]+)/gi, "Bearer [REDACTED]")
}

function write(level: LogLevel, message: string, context?: LogContext) {
  const payload = {
    level,
    message: sanitize(message),
    ...context,
    ts: new Date().toISOString(),
  }

  if (level === "error") {
    console.error(payload)
    return
  }

  if (level === "warn") {
    console.warn(payload)
    return
  }

  console.log(payload)
}

export const logger = {
  info(message: string, context?: LogContext) {
    write("info", message, context)
  },
  warn(message: string, context?: LogContext) {
    write("warn", message, context)
  },
  error(message: string, context?: LogContext) {
    write("error", message, context)
  },
}
