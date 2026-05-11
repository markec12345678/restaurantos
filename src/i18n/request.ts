import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'

export const locales = ['sl', 'en', 'it', 'de', 'hr'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'sl'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !hasLocale(locales, locale)) {
    locale = defaultLocale
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
