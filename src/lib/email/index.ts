// ============================================
// EMAIL SERVICE — nodemailer + templates za scheduled reports
// ============================================

import { createTransport, type Transporter } from 'nodemailer'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ensureDecrypted } from '@/lib/crypto/secrets'

import { formatEUR } from '@/lib/safe-format'
interface EmailConfig {
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPassword: string
  fromAddress: string
}

interface SendEmailOptions {
  to: string | string[]
  subject: string
  text?: string
  html?: string
  attachments?: Array<{
    filename: string
    content: Buffer
    contentType?: string
  }>
}

let cachedTransporter: Transporter | null = null
let cachedConfigKey = ''

/** Pridobi email konfiguracijo iz RestaurantSettings */
async function getEmailConfig(): Promise<EmailConfig | null> {
  const settings = await db.restaurantSettings.findFirst()
  if (!settings || !settings.emailEnabled) return null
  return {
    smtpHost: settings.emailSmtpHost,
    smtpPort: settings.emailSmtpPort,
    smtpUser: settings.emailSmtpUser,
    smtpPassword: ensureDecrypted(settings.emailSmtpPassword || ''),
    fromAddress: settings.emailFromAddress || settings.email || 'noreply@restaurant.com',
  }
}

/** Ustvari ali pridobi cached SMTP transporter */
async function getTransporter(): Promise<{ transporter: Transporter; config: EmailConfig } | null> {
  const config = await getEmailConfig()
  if (!config || !config.smtpHost || !config.smtpUser) return null

  const configKey = `${config.smtpHost}:${config.smtpPort}:${config.smtpUser}`
  if (cachedTransporter && cachedConfigKey === configKey) {
    return { transporter: cachedTransporter, config }
  }

  cachedTransporter = createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword,
    },
  })
  cachedConfigKey = configKey
  return { transporter: cachedTransporter, config }
}

/** Pošlji email (z optional attachments) */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await getTransporter()
    if (!result) {
      return { success: false, error: 'Email ni konfiguriran (manjkajo SMTP nastavitve ali emailEnabled=false)' }
    }

    const { transporter, config } = result
    const to = Array.isArray(options.to) ? options.to.join(', ') : options.to

    await transporter.sendMail({
      from: config.fromAddress,
      to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    })

    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Neznana napaka'
    logger.error('EMAIL', 'Napaka pri pošiljanju emaila:', msg)
    return { success: false, error: msg }
  }
}

/** Pošlji Z-report email (z PDF priponko) */
export async function sendZReportEmail(
  recipients: string[],
  reportDate: string,
  pdfBuffer: Buffer,
  summary: { totalSales: number; totalTax: number; totalOrders: number }
): Promise<{ success: boolean; error?: string }> {
  const subject = `Z-report ${reportDate} — RestaurantOS`
  const text = `Dnevni Z-report za ${reportDate}

Povzetek:
- Skupni promet: ${formatEUR(summary.totalSales)}
- DDV skupaj: ${formatEUR(summary.totalTax)}
- Število naročil: ${summary.totalOrders}

Podroben poročilo je v priponki (PDF).

RestaurantOS — Avtomatsko generirano`

  const html = `
<h2>Z-report ${reportDate}</h2>
<p>Dnevni zaključek blagajne:</p>
<table style="border-collapse: collapse; margin: 16px 0;">
  <tr><td style="padding: 8px; border: 1px solid #ddd;">Skupni promet:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${formatEUR(summary.totalSales)}</strong></td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;">DDV skupaj:</td><td style="padding: 8px; border: 1px solid #ddd;">${formatEUR(summary.totalTax)}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;">Število naročil:</td><td style="padding: 8px; border: 1px solid #ddd;">${summary.totalOrders}</td></tr>
</table>
<p>Podroben poročilo je v priponki (PDF).</p>
<hr>
<p style="color: #666; font-size: 12px;">RestaurantOS — Avtomatsko generirano sporočilo</p>
`

  return await sendEmail({
    to: recipients,
    subject,
    text,
    html,
    attachments: [{
      filename: `Z-report_${reportDate}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }],
  })
}

/** Ali je email servis omogočen? */
export async function isEmailEnabled(): Promise<boolean> {
  const config = await getEmailConfig()
  return config !== null
}

/**
 * Pridobi seznam prejemnikov iz nastavitev.
 *
 * FIX P0-C4 Phase 3: Location.emailReportRecipients je sedaj v shemi — aktiviran!
 * Strategy:
 *   1. Če je locationId podan: preberi iz Location (per-lokacija recipients)
 *   2. Fallback: RestaurantSettings (global) za single-tenant backward compat
 *
 * @param locationId - ID lokacije za per-location recipients (pravilno vedno podati)
 */
export async function getReportRecipients(_locationId?: string | null): Promise<string[]> {
  // FIX P0-C4 Phase 3: Location.emailReportRecipients je sedaj v shemi — aktiviraj!
  // Strategy: če je locationId podan, preberi iz Location (per-lokacija recipients).
  // Fallback: RestaurantSettings (global) za single-tenant backward compat.
  if (_locationId) {
    const location = await db.location.findUnique({
      where: { id: _locationId },
      select: { emailReportRecipients: true },
    })
    if (location?.emailReportRecipients) {
      try {
        const recipients = JSON.parse(location.emailReportRecipients)
        if (Array.isArray(recipients) && recipients.length > 0) {
          return recipients
        }
      } catch {
        // Neveljaven JSON — fallthrough na global
      }
    }
  }
  // Fallback: RestaurantSettings (global)
  const settings = await db.restaurantSettings.findFirst()
  if (!settings) return []
  try {
    const recipients = JSON.parse(settings.emailReportRecipients || '[]')
    return Array.isArray(recipients) ? recipients : []
  } catch {
    return []
  }
}

// ============================================
// SCHEDULED EMAIL LOG — internal creator (uporablja se iz EOD + API route)
// AUD-12: Da se ScheduledEmailLog sproži ob EOD completed
// ============================================

export type ScheduledReportType = 'z_report' | 'daily_summary' | 'weekly_summary' | 'vat_report'

export interface CreateScheduledEmailResult {
  success: boolean
  created: number
  recipients: string[]
  reportDate: string
  reportType: ScheduledReportType
  skipped?: boolean
  reason?: string
}

/**
 * Ustvari ScheduledEmailLog za vsakega konfiguriranega prejemnika.
 *
 * Uporablja se:
 *   1. Iz POST /api/scheduled-emails/create (administrativni endpoint)
 *   2. Iz closeShift() ob EOD completed (avtomatski z_report)
 *
 * Vedenje:
 *   - Če email NI omogočen (isEmailEnabled=false) → vrne {success:false, reason}
 *   - Če ni prejemnikov → vrne {success:false, reason}
 *   - Če že obstaja pending/sent log za ta reportType+datum → vrne {success:true, skipped:true}
 *   - Sicer: ustvari en ScheduledEmailLog na prejemnika (status='pending')
 *
 * Non-throwing: nikoli ne vrže — klicalec naj handle-a rezultat.
 */
export async function createScheduledEmailLog(
  reportType: ScheduledReportType = 'z_report',
  reportDate: Date = new Date(),
): Promise<CreateScheduledEmailResult> {
  try {
    const emailEnabled = await isEmailEnabled()
    if (!emailEnabled) {
      return {
        success: false,
        created: 0,
        recipients: [],
        reportDate: reportDate.toISOString().split('T')[0],
        reportType,
        reason: 'Email ni konfiguriran (emailEnabled=false ali manjkajo SMTP nastavitve)',
      }
    }

    const recipients = await getReportRecipients()
    if (recipients.length === 0) {
      return {
        success: false,
        created: 0,
        recipients: [],
        reportDate: reportDate.toISOString().split('T')[0],
        reportType,
        reason: 'Ni konfiguriranih prejemnikov (emailReportRecipients prazen)',
      }
    }

    const dateStr = reportDate.toISOString().split('T')[0]

    // Preveri ali že obstaja pending/sent email za ta datum in tip
    const existing = await db.scheduledEmailLog.findFirst({
      where: {
        reportType,
        reportDate: {
          gte: new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate(), 0, 0, 0),
          lte: new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate(), 23, 59, 59),
        } as never,
        status: { in: ['pending', 'sent'] },
      },
    })

    if (existing) {
      return {
        success: true,
        created: 0,
        recipients,
        reportDate: dateStr,
        reportType,
        skipped: true,
        reason: `Email za ${reportType} ${dateStr} je že ${existing.status}`,
      }
    }

    // Ustvari ScheduledEmailLog za vsakega prejemnika
    const subject = `${reportType === 'z_report' ? 'Z-poročilo' : 'Poročilo'} — ${dateStr}`
    const body = `Avtomatsko generirano ${reportType} poročilo za ${dateStr}.`
    const attachmentName = `${reportType}_${dateStr}.pdf`

    for (const recipient of recipients) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db.scheduledEmailLog as any).create({
        data: {
          reportType,
          recipient,
          subject,
          body,
          attachmentName,
          status: 'pending',
          reportDate,
        },
      })
    }

    logger.info('EMAIL', `Ustvarjenih ${recipients.length} scheduled emailov za ${dateStr} (${reportType})`)

    return {
      success: true,
      created: recipients.length,
      recipients,
      reportDate: dateStr,
      reportType,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Neznana napaka'
    logger.error('EMAIL', `Napaka pri createScheduledEmailLog:`, msg)
    return {
      success: false,
      created: 0,
      recipients: [],
      reportDate: reportDate.toISOString().split('T')[0],
      reportType,
      reason: msg,
    }
  }
}

// ============================================
// TEST EMAIL — realni SMTP test iz admin nastavitev
// ============================================
// FIX Task 21: EmailTab je prej imel lažni test (samo setTimeout + "uspeh").
// Ta funkcija naredi REALNO pošiljanje prek SMTP, da admin preveri konfiguracijo.
//
// Namerna razlika od sendEmail(): NE preverja emailEnabled flaga — admin želi
// testirati SMTP konfiguracijo PREDEN jo omogoči. Zahteva pa vseeno host+user.
// ============================================

export interface TestEmailResult {
  success: boolean
  to: string
  from?: string
  host?: string
  error?: string
}

/** Zgradi HTML vsebino testnega emaila (email-safe, inline stili). */
export function buildTestEmailHtml(timestamp: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!DOCTYPE html>
<html lang="sl">
<body style="margin:0;padding:24px;background:#f6f7f8;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1c2430;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e6e8;border-radius:8px;padding:24px;">
    <h1 style="font-size:18px;margin:0 0 8px;color:#0f766e;">✓ Testni email — RestaurantOS</h1>
    <p style="margin:0 0 12px;font-size:14px;">Če to sporočilo vidite, je vaša SMTP konfiguracija pravilna in email poročila (Z-report, dnevni povzetek) bodo prihajala na nastavljene naslove.</p>
    <p style="margin:0;font-size:13px;color:#6b7480;">Poslano: ${esc(timestamp)}<br/>RestaurantOS — avtomatsko generirano sporočilo</p>
  </div>
</body>
</html>`
}

/**
 * Pošlji testni email prek shranjenih SMTP nastavitev.
 *
 * Namerno NE preverja emailEnabled (admin testira pred omogočitvijo),
 * ampak zahteva emailSmtpHost + emailSmtpUser. Non-throwing.
 */
export async function sendTestEmail(to: string): Promise<TestEmailResult> {
  const base: TestEmailResult = { success: false, to }
  try {
    const settings = await db.restaurantSettings.findFirst()
    if (!settings) return { ...base, error: 'Nastavitve restavracije ne obstajajo' }
    if (!settings.emailSmtpHost || !settings.emailSmtpUser) {
      return { ...base, error: 'SMTP host ali uporabniško ime ni nastavljen — izpolni Email zavihek' }
    }

    const from = settings.emailFromAddress || settings.email || 'noreply@restaurant.com'
    const transporter = createTransport({
      host: settings.emailSmtpHost,
      port: settings.emailSmtpPort,
      secure: settings.emailSmtpPort === 465,
      auth: {
        user: settings.emailSmtpUser,
        pass: ensureDecrypted(settings.emailSmtpPassword || ''),
      },
    })

    const now = new Date().toLocaleString('sl-SI', { timeZone: 'Europe/Ljubljana' })
    await transporter.sendMail({
      from,
      to,
      subject: `Testni email — RestaurantOS (${now})`,
      text: `Testni email — RestaurantOS\n\nPoslano: ${now}\n\nČe to sporočilo vidite, je SMTP konfiguracija pravilna.\n`,
      html: buildTestEmailHtml(now),
    })

    logger.info('EMAIL', `Testni email uspešno poslan na ${to} (host=${settings.emailSmtpHost})`)
    return { success: true, to, from, host: settings.emailSmtpHost }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Neznana napaka'
    logger.error('EMAIL', `Testni email NA ${to} NI uspel:`, msg)
    return { ...base, error: msg }
  }
}
