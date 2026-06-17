// ============================================
// STRUKTURIRANI LOGGER ZA RESTAURANTOS
// V2: Popravljen dvojnik logiranja, strukturiran JSON, nastavljivi nivoji
// ============================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// Nivoji po pomembnosti (nižji = bolj pomembno)
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// FIX: Nastavljiv nivo logiranja — privzeto 'info' v produkciji, 'debug' v razvoju
function getDefaultLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL as LogLevel | undefined
  if (envLevel && envLevel in LOG_LEVEL_PRIORITY) return envLevel
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}

const currentLogLevel = getDefaultLogLevel()

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLogLevel]
}

// FIX: Strukturiran JSON format za log agregacijo (Datadog, CloudWatch)
interface LogEntry {
  timestamp: string
  level: LogLevel
  context: string
  message: string
  requestId?: string
  data?: unknown
}

// FIX VERCEL: Popolnoma odstranjen async_hooks — Vercel webpack ne more resolvarat
// Uporabljamo simple fallback (requestId shranjen v globalno spremenljivko)
// To je dovolj za logiranje — AsyncLocalStorage je bil uporabljen samo za request ID tracking
let currentRequestId: string | null = null

const requestIdStorage: { run: (_id: string, _fn: () => void) => void; getStore: () => string | undefined } | null = {
  run: (id: string, fn: () => void) => { currentRequestId = id; fn(); currentRequestId = null },
  getStore: () => currentRequestId ?? undefined,
}

/** Generiraj enoličen ID zahtevka (8 znakov, dovolj za tracing) */
export function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36).slice(-4)
}

/** Zaženi callback z request ID kontekstom (uporablja se v middleware ali API ruti) */
export function withRequestId(id: string, fn: () => void): void {
  if (requestIdStorage) {
    requestIdStorage.run(id, fn)
  } else {
    fn() // Fallback brez konteksta (Edge Runtime)
  }
}

/** Pridobi trenutni request ID (ali undefined, če ni v kontekstu) */
export function getRequestId(): string | undefined {
  return requestIdStorage?.getStore()
}

function createLogEntry(level: LogLevel, context: string, message: string, data?: unknown): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
  }
  // FIX: Samodejno dodaj requestId, če je na voljo v AsyncLocalStorage
  const rid = getRequestId()
  if (rid) entry.requestId = rid
  if (data !== undefined) {
    entry.data = data instanceof Error
      ? { name: data.name, message: data.message, stack: data.stack }
      : data
  }
  return entry
}

// FIX: Format za človeško branje (razvoj)
function formatHuman(entry: LogEntry): string {
  const rid = entry.requestId ? `[${entry.requestId}] ` : ''
  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.context}] ${rid}`
  if (entry.data !== undefined) {
    const dataStr = typeof entry.data === 'object' ? JSON.stringify(entry.data) : String(entry.data)
    return `${prefix}${entry.message} ${dataStr}`
  }
  return `${prefix}${entry.message}`
}

// FIX: JSON format za produkcijo (log agregacija)
function formatJson(entry: LogEntry): string {
  return JSON.stringify(entry)
}

// FIX: Omogoči JSON logiranje z LOG_FORMAT=json
const useJsonFormat = process.env.LOG_FORMAT === 'json'

function formatEntry(entry: LogEntry): string {
  return useJsonFormat ? formatJson(entry) : formatHuman(entry)
}

export const logger = {
  debug(context: string, message: string, data?: unknown) {
    if (!shouldLog('debug')) return
    const entry = createLogEntry('debug', context, message, data)
    // FIX: Ne pošiljaj data dvakrat — prej se je data pojavil v formatMessage() IN kot drugi argument
    console.log(formatEntry(entry))
  },
  info(context: string, message: string, data?: unknown) {
    if (!shouldLog('info')) return
    const entry = createLogEntry('info', context, message, data)
    console.info(formatEntry(entry))
  },
  warn(context: string, message: string, data?: unknown) {
    if (!shouldLog('warn')) return
    const entry = createLogEntry('warn', context, message, data)
    console.warn(formatEntry(entry))
  },
  error(context: string, message: string, data?: unknown) {
    if (!shouldLog('error')) return
    const entry = createLogEntry('error', context, message, data)
    console.error(formatEntry(entry))
  },

  // FIX: Ustvari pod-logger s prednastavljenim kontektom — manj ponavljanja
  child(context: string) {
    return {
      debug: (message: string, data?: unknown) => logger.debug(context, message, data),
      info: (message: string, data?: unknown) => logger.info(context, message, data),
      warn: (message: string, data?: unknown) => logger.warn(context, message, data),
      error: (message: string, data?: unknown) => logger.error(context, message, data),
    }
  },
}
