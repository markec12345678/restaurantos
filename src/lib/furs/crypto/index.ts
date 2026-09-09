// ============================================
// FURS KRIPTOGRAFIJA IN CERTIFIKATI — Barrel re-export
// ZOI generacija, nalaganje certifikatov, digitalno podpisovanje
// ============================================

export { generateZOI } from './zoi'
export { loadCertificatePrivateKey, clearCertificateCache, extractCertificateFromPKCS12 } from './certificates'
export { extractCertIdentity, buildFursJws, verifyFursJws, formatDn, identityFromPem, b64url, b64urlDecode } from './jws'
export type { CertIdentity } from './jws'
