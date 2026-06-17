import { describe, it, expect, beforeEach } from 'vitest'
import { t, getLocale, setLocale, formatDate, formatTime, formatNumber, formatCurrency } from './i18n'

describe('Internationalization (i18n) Engine', () => {
  beforeEach(() => {
    setLocale('en')
  })

  it('should default to English locale', () => {
    expect(getLocale()).toBe('en')
  })

  it('should translate keys correctly in English', () => {
    expect(t('Dashboard')).toBe('Dashboard')
    expect(t('Cancel')).toBe('Cancel')
  })

  it('should change active locale reactively', () => {
    setLocale('hi')
    expect(getLocale()).toBe('hi')
    expect(t('Dashboard')).toBe('डैशबोर्ड')
    expect(t('Cancel')).toBe('रद्द करें')
  })

  it('should fall back to English if key is missing in another language', () => {
    setLocale('hi')
    // A key that exists in English but not translated in Hindi should fall back to English/key
    const unknownKey = 'Some Non-Existent Key'
    expect(t(unknownKey)).toBe(unknownKey)
  })

  it('should interpolate replacements correctly', () => {
    // If we have replacements, it should format them
    const template = 'Are you sure you want to delete {name}?'
    const translated = t(template, { name: 'Video.mp4' })
    expect(translated).toBe('Are you sure you want to delete Video.mp4?')
  })

  it('should format dates based on locale', () => {
    const testDate = new Date('2026-06-17T12:00:00Z')
    
    setLocale('en')
    const formattedEn = formatDate(testDate)
    expect(formattedEn).toContain('Jun')
    expect(formattedEn).toContain('17')
    expect(formattedEn).toContain('2026')

    setLocale('ja')
    const formattedJa = formatDate(testDate)
    expect(formattedJa).toContain('2026')
    expect(formattedJa).toContain('17')
  })

  it('should format numbers based on locale', () => {
    const num = 1234567.89

    setLocale('en')
    expect(formatNumber(num)).toBe('1,234,567.89')

    setLocale('de')
    // German uses comma as decimal separator
    const formattedDe = formatNumber(num)
    expect(formattedDe).toContain(',')
    expect(formattedDe).toContain('89')
  })

  it('should format currencies based on locale', () => {
    const amount = 99.99

    setLocale('en')
    expect(formatCurrency(amount, 'USD')).toContain('$')
    expect(formatCurrency(amount, 'USD')).toContain('99.99')

    setLocale('ja')
    // Yen has no decimal places
    expect(formatCurrency(amount, 'JPY')).toContain('100')
  })
})
