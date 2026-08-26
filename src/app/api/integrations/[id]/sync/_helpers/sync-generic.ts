// Generična sinhronizacija (ping)

import type { SyncResult } from './types'

export async function syncGeneric(integration: {
  baseUrl: string
  apiKey: string
}): Promise<SyncResult> {
  const baseUrl = integration.baseUrl
  if (!baseUrl) {
    return { success: false, statusCode: 0, responseData: '{}', error: 'URL ni nastavljen' }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(`${baseUrl}/ping`, {
      method: 'GET',
      headers: integration.apiKey ? {
        'Authorization': `Bearer ${integration.apiKey}`,
      } : {},
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    return {
      success: response.ok,
      statusCode: response.status,
      responseData: JSON.stringify({ status: response.status }),
      error: response.ok ? '' : `HTTP ${response.status}`,
    }
  } catch (err: unknown) {
    return {
      success: false,
      statusCode: 0,
      responseData: '{}',
      error: err instanceof Error ? err.message : 'Napaka pri sinhronizaciji',
    }
  }
}
