// Tipi za sinhronizacijske konektorje

export interface IntegrationBase {
  baseUrl: string
  apiKey: string
  apiSecret?: string
  config: string
}

export interface SyncResult {
  success: boolean
  statusCode: number
  responseData: string
  error: string
}
