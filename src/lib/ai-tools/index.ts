// ============================================
// AI TOOL FRAMEWORK — Formalen sistem za AI agenta
// ============================================
// Po POSR vzoru (definitions + executor + select-tools).
// Omogoča AI agent-u, da kliče različne "tools" (funkcije)
// za pridobivanje podatkov glede na uporabnikov prompt.
//
// Prednosti:
//   - Bolj strukturano kot preprost NL query
//   - Enostavno dodajanje novih tool-ov
//   - Permissions per tool
//   - Select-tools hevristika (izbere prave tool-e glede na prompt)
// ============================================

// --- Tipi ---
export interface ToolDefinition {
  name: string
  description: string
  // Kdaj uporabiti ta tool (keywords za select-tools hevristiko)
  keywords: string[]
  // Ali zahteva admin pravice
  adminOnly?: boolean
  // Parametri (JSON schema)
  parameters?: Record<string, {
    type: 'string' | 'number' | 'date' | 'boolean'
    required?: boolean
    description?: string
    default?: unknown
  }>
}

export interface ToolExecutionContext {
  userId?: string
  employeeId?: string
  permissions: string[]
  // Datumski razpon (parsed iz prompt-a)
  dateFrom?: Date
  dateTo?: Date
}

export interface ToolExecutionResult {
  success: boolean
  data?: unknown
  error?: string
  // Format za AI (kako naj predstavi rezultat)
  format?: 'table' | 'chart' | 'number' | 'text'
  metadata?: {
    rowCount?: number
    executionTimeMs?: number
  }
}

export type ToolHandler = (
  params: Record<string, unknown>,
  context: ToolExecutionContext,
) => Promise<ToolExecutionResult>

// --- Registry tool-ov ---
const toolRegistry = new Map<string, { definition: ToolDefinition; handler: ToolHandler }>()

export function registerTool(definition: ToolDefinition, handler: ToolHandler): void {
  toolRegistry.set(definition.name, { definition, handler })
}

export function getTool(name: string): { definition: ToolDefinition; handler: ToolHandler } | undefined {
  return toolRegistry.get(name)
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(toolRegistry.values()).map((t) => t.definition)
}

export function isToolRegistered(name: string): boolean {
  return toolRegistry.has(name)
}

// --- Select-tools hevristika ---
// Glede na uporabnikov prompt izbere katere tool-e naj AI uporabi
export function selectToolsForPrompt(prompt: string): ToolDefinition[] {
  const normalizedPrompt = prompt.toLowerCase()
  const selected: ToolDefinition[] = []

  for (const { definition } of toolRegistry.values()) {
    // Preveri ali kateri keyword match-a
    const matches = definition.keywords.some((keyword) =>
      normalizedPrompt.includes(keyword.toLowerCase()),
    )
    if (matches) {
      selected.push(definition)
    }
  }

  return selected
}

// --- Tool executor ---
export async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const tool = toolRegistry.get(toolName)
  if (!tool) {
    return {
      success: false,
      error: `Tool ${toolName} ni registriran`,
    }
  }

  // Preveri admin pravice
  if (tool.definition.adminOnly && !context.permissions.includes('admin')) {
    return {
      success: false,
      error: `Tool ${toolName} zahteva admin pravice`,
    }
  }

  // Validiraj obvezne parametre
  if (tool.definition.parameters) {
    for (const [paramName, paramDef] of Object.entries(tool.definition.parameters)) {
      if (paramDef.required && !(paramName in params)) {
        // Uporabi default če je podan
        if (paramDef.default !== undefined) {
          params[paramName] = paramDef.default
        } else {
          return {
            success: false,
            error: `Manjka obvezen parameter: ${paramName}`,
          }
        }
      }
    }
  }

  const startTime = Date.now()
  try {
    const result = await tool.handler(params, context)
    result.metadata = {
      ...result.metadata,
      executionTimeMs: Date.now() - startTime,
    }
    return result
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Neznana napaka',
      metadata: { executionTimeMs: Date.now() - startTime },
    }
  }
}

// --- Helper: parse datumski razmen iz prompt-a ---
export function parseDateRangeFromPrompt(prompt: string): { dateFrom?: Date; dateTo?: Date } {
  const now = new Date()
  const normalized = prompt.toLowerCase()

  if (normalized.includes('danes')) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return { dateFrom: today, dateTo: now }
  }

  if (normalized.includes('včeraj') || normalized.includes('vceraj')) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const yesterdayEnd = new Date(yesterday)
    yesterdayEnd.setHours(23, 59, 59, 999)
    return { dateFrom: yesterday, dateTo: yesterdayEnd }
  }

  if (normalized.includes('ta teden')) {
    const monday = new Date()
    const dayOfWeek = monday.getDay()
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    monday.setDate(monday.getDate() + diffToMonday)
    monday.setHours(0, 0, 0, 0)
    return { dateFrom: monday, dateTo: now }
  }

  if (normalized.includes('ta mesec')) {
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    return { dateFrom: firstOfMonth, dateTo: now }
  }

  if (normalized.includes('zadnji teden') || normalized.includes('prejšnji teden')) {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return { dateFrom: weekAgo, dateTo: now }
  }

  if (normalized.includes('zadnji mesec') || normalized.includes('prejšnji mesec')) {
    const monthAgo = new Date()
    monthAgo.setMonth(monthAgo.getMonth() - 1)
    return { dateFrom: monthAgo, dateTo: now }
  }

  // Default: zadnjih 30 dni
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  return { dateFrom: thirtyDaysAgo, dateTo: now }
}
