// ============================================
// VEČJEZIČNI PREVODI - Barrel re-export
// ============================================

import { sl } from './sl';
import { en } from './en';
import { it } from './it';
import { de } from './de';
import { hr } from './hr';

const translations = {
  sl,
  en,
  it,
  de,
  hr,
} as const;

export type Locale = keyof typeof translations;

// Pretvorimo stroge literale v string — komponente ne rabijo literalnih tipov
export type TranslationValue = {
  [_K in keyof typeof translations['sl']]: string;
};

export { translations };
