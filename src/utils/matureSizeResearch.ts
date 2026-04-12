import type { MatureSizeResearchLabel } from '../types'

const SIZE_LABEL_PATTERNS: Array<{ label: MatureSizeResearchLabel; pattern: RegExp }> = [
  { label: 'semi-dwarf', pattern: /\bsemi[\s-]?dwarf\b/i },
  { label: 'dwarf', pattern: /\bdwarf\b/i },
  { label: 'columnar', pattern: /\bcolumnar\b/i },
  { label: 'standard', pattern: /\bstandard\b/i },
]

export function normalizeRootstockKey(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function normalizeVendorFromUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined
  }
  try {
    const { hostname } = new URL(url)
    return hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

export function normalizeMatureSizeLabel(value: string | undefined): MatureSizeResearchLabel {
  const text = value ?? ''
  for (const { label, pattern } of SIZE_LABEL_PATTERNS) {
    if (pattern.test(text)) {
      return label
    }
  }
  return 'unknown'
}

function parseRangeOrSingleFeet(value: string): number | undefined {
  const range = value.match(/(\d+(?:\.\d+)?)\s*(?:to|[-–])\s*(\d+(?:\.\d+)?)/i)
  if (range) {
    const low = Number(range[1])
    const high = Number(range[2])
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return Math.round((low + high) / 2)
    }
  }
  const single = value.match(/(\d+(?:\.\d+)?)/)
  if (!single) {
    return undefined
  }
  const n = Number(single[1])
  return Number.isFinite(n) ? Math.round(n) : undefined
}

export function parseHeightFeetFromResearchText(value: string | undefined): number | undefined {
  if (!value) {
    return undefined
  }
  const explicitHeight = value.match(
    /(mature\s+height|height)\s*[:\-]?\s*(\d+(?:\.\d+)?(?:\s*(?:to|[-–])\s*\d+(?:\.\d+)?)?)/i,
  )
  if (explicitHeight) {
    return parseRangeOrSingleFeet(explicitHeight[2] ?? '')
  }
  const feetHint = value.match(
    /(\d+(?:\.\d+)?(?:\s*(?:to|[-–])\s*\d+(?:\.\d+)?)?)\s*(?:ft|feet|foot)\b/i,
  )
  if (feetHint) {
    return parseRangeOrSingleFeet(feetHint[1] ?? '')
  }
  return undefined
}

export function parseWidthFeetFromResearchText(value: string | undefined): number | undefined {
  if (!value) {
    return undefined
  }
  const explicitWidth = value.match(
    /(mature\s+(?:width|spread|canopy)|spread|canopy)\s*[:\-]?\s*(\d+(?:\.\d+)?(?:\s*(?:to|[-–])\s*\d+(?:\.\d+)?)?)/i,
  )
  if (explicitWidth) {
    return parseRangeOrSingleFeet(explicitWidth[2] ?? '')
  }
  return undefined
}
