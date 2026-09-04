// ============================================
// WEBAUTHN DB HELPERS
// ============================================

import { db } from '@/lib/db'
import { base64urlEncode } from './index'
import type { VerifiedRegistrationResponse } from '@simplewebauthn/server'
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types'

export interface StoredCredentialRow {
  id: string
  credentialId: string
  employeeId: string
  publicKey: string
  counter: number
  transports: string
  deviceType: string
  backed: boolean
  nickname: string
  lastUsedAt: Date | null
  createdAt: Date
}

/**
 * Shrani nov credential iz verified registration response-a.
 */
export async function storeCredential(
  employeeId: string,
  registrationInfo: NonNullable<VerifiedRegistrationResponse['registrationInfo']>,
  nickname: string = '',
): Promise<StoredCredentialRow> {
  const publicKeyB64url = base64urlEncode(registrationInfo.credential.publicKey)
  const transportsJson = JSON.stringify(registrationInfo.credential.transports || [])
  const deviceType = registrationInfo.credentialDeviceType

  const created = await db.biometricCredential.create({
    data: {
      credentialId: registrationInfo.credential.id,
      employeeId,
      publicKey: publicKeyB64url,
      counter: registrationInfo.credential.counter,
      transports: transportsJson,
      deviceType,
      backed: registrationInfo.credentialBackedUp,
      nickname,
    },
  })

  return created as unknown as StoredCredentialRow
}

/**
 * Poišči credential po credentialId (za verifyAssertion).
 */
export async function findCredential(credentialId: string): Promise<StoredCredentialRow | null> {
  const row = await db.biometricCredential.findUnique({
    where: { credentialId },
  })
  if (!row) return null
  return row as unknown as StoredCredentialRow
}

/**
 * Posodobi counter po uspešni verifikaciji (FIDO2 §6.1).
 */
export async function updateCounterAfterUse(
  credentialId: string,
  newCounter: number,
): Promise<void> {
  await db.biometricCredential.update({
    where: { credentialId },
    data: {
      counter: newCounter,
      lastUsedAt: new Date(),
    },
  })
}

/**
 * Seznam vseh credential-ov za zaposlenega.
 */
export async function listEmployeeCredentials(employeeId: string): Promise<StoredCredentialRow[]> {
  const rows = await db.biometricCredential.findMany({
    where: { employeeId },
    orderBy: { createdAt: 'desc' },
  })
  return rows as unknown as StoredCredentialRow[]
}

/**
 * Izbriši credential (za upravljanje UI).
 * Preveri lastništvo — ne dovoli da uporabnik izbriše credential drugega.
 */
export async function deleteCredential(credentialId: string, employeeId: string): Promise<boolean> {
  const result = await db.biometricCredential.deleteMany({
    where: { credentialId, employeeId },
  })
  return result.count > 0
}

/**
 * Preštej credential-e za zaposlenega.
 */
export async function countEmployeeCredentials(employeeId: string): Promise<number> {
  return await db.biometricCredential.count({
    where: { employeeId },
  })
}

/**
 * Ali zaposleni ima sploh registriran kakšen credential?
 */
export async function hasAnyCredential(employeeId: string): Promise<boolean> {
  const count = await countEmployeeCredentials(employeeId)
  return count > 0
}

/**
 * Parse transports from DB JSON string.
 */
export function parseTransportsFromDb(transportsJson: string): AuthenticatorTransportFuture[] {
  try {
    const parsed = JSON.parse(transportsJson)
    if (Array.isArray(parsed)) {
      const valid: AuthenticatorTransportFuture[] = ['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb']
      return parsed.filter(
        (t): t is AuthenticatorTransportFuture =>
          typeof t === 'string' && valid.includes(t as AuthenticatorTransportFuture)
      )
    }
  } catch {
    // ignore
  }
  return []
}
