// ============================================
// EMAIL SERVICE — nodemailer + templates za scheduled reports
// ============================================

import nodemailer from 'nodemailer'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

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

let cachedTransporter: nodemailer.Transporter | null = null
let cachedConfigKey = ''

/** Pridobi email konfiguracijo iz RestaurantSettings */
async function getEmailConfig(): Promise<EmailConfig | null> {
  const settings = await db.restaurantSettings.findFirst()
  if (!settings || !settings.emailEnabled) return null
  return {
    smtpHost: settings.emailSmtpHost,
    smtpPort: settings.emailSmtpPort,
    smtpUser: settings.emailSmtpUser,
    smtpPassword: settings.emailSmtpPassword,
    fromAddress: settings.emailFromAddress || settings.email || 'noreply@restaurant.com',
  }
}

/** Ustvari ali pridobi cached SMTP transporter */
async function getTransporter(): Promise<{ transporter: nodemailer.Transporter; config: EmailConfig } | null> {
  const config = await getEmailConfig()
  if (!config || !config.smtpHost || !config.smtpUser) return null

  const configKey = `${config.smtpHost}:${config.smtpPort}:${config.smtpUser}`
  if (cachedTransporter && cachedConfigKey === configKey) {
    return { transporter: cachedTransporter, config }
  }

  cachedTransporter = nodemailer.createTransport({
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
- Skupni promet: €${summary.totalSales.toFixed(2)}
- DDV skupaj: €${summary.totalTax.toFixed(2)}
- Število naročil: ${summary.totalOrders}

Podroben poročilo je v priponki (PDF).

RestaurantOS — Avtomatsko generirano`

  const html = `
<h2>Z-report ${reportDate}</h2>
<p>Dnevni zaključek blagajne:</p>
<table style="border-collapse: collapse; margin: 16px 0;">
  <tr><td style="padding: 8px; border: 1px solid #ddd;">Skupni promet:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>€${summary.totalSales.toFixed(2)}</strong></td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;">DDV skupaj:</td><td style="padding: 8px; border: 1px solid #ddd;">€${summary.totalTax.toFixed(2)}</td></tr>
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

/** Pridobi seznam prejemnikov iz nastavitev */
export async function getReportRecipients(): Promise<string[]> {
  const settings = await db.restaurantSettings.findFirst()
  if (!settings) return []
  try {
    const recipients = JSON.parse(settings.emailReportRecipients || '[]')
    return Array.isArray(recipients) ? recipients : []
  } catch {
    return []
  }
}
