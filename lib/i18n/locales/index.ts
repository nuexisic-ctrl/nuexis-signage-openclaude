import { en } from './en'
import { hi } from './hi'
import { de } from './de'
import { es } from './es'
import { fr } from './fr'
import { it } from './it'
import { nl } from './nl'
import { pt } from './pt'
import { sv } from './sv'
import { ja } from './ja'

export const translations: Record<string, Record<string, string>> = {
  en,
  hi,
  de,
  es,
  fr,
  it,
  nl,
  pt,
  sv,
  ja
}
export type LocaleType = keyof typeof translations
