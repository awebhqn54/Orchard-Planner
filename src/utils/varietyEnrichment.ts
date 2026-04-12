import type { TreeSeedRecord } from '../types'
import { MATURE_SIZE_RESEARCH_OVERRIDES } from '../data/matureSizeResearchOverrides'

function isEnterpriseApple(record: TreeSeedRecord): boolean {
  return record.species === 'Apple' && record.varietyName.trim() === 'Enterprise'
}

/** User-confirmed defaults for Enterprise (cider apple). */
function applyEnterpriseAppleDefaults(record: TreeSeedRecord): TreeSeedRecord {
  if (!isEnterpriseApple(record)) {
    return record
  }

  return {
    ...record,
    matureHeightFt: 20,
    matureSizeText: 'Semi-dwarf',
    sizeClass: 'large',
  }
}

export function normalizeComparableText(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.,;:()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
}

export function rootstockIdentityKey(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/** When extract/import did not set a code, treat as explicit unknown (not blank). */
function ensureRootstockCodeUnknown(record: TreeSeedRecord): TreeSeedRecord {
  if (!String(record.rootstockCode ?? '').trim()) {
    return { ...record, rootstockCode: 'Unknown' }
  }
  return record
}

function sanitizeRootstockFields(record: TreeSeedRecord): TreeSeedRecord {
  const rootstock = record.rootstock?.trim()
  if (!rootstock) {
    return { ...record, rootstock: undefined }
  }
  const rootstockNorm = normalizeComparableText(rootstock)
  const matureSizeNorm = normalizeComparableText(record.matureSizeText)
  const sameAsCode =
    record.rootstockCode &&
    rootstockIdentityKey(rootstock) &&
    rootstockIdentityKey(rootstock) === rootstockIdentityKey(record.rootstockCode)
  if (sameAsCode || (rootstockNorm && rootstockNorm === matureSizeNorm)) {
    return { ...record, rootstock: undefined }
  }
  return rootstock === record.rootstock ? record : { ...record, rootstock }
}

function chooseMatureSizeResearch(record: TreeSeedRecord) {
  const candidates = MATURE_SIZE_RESEARCH_OVERRIDES.filter((override) => override.recordId === record.id)
  if (candidates.length === 0) {
    return undefined
  }

  const identityMatches = candidates.filter((candidate) => {
    const codeMatch =
      candidate.rootstockCode &&
      record.rootstockCode &&
      rootstockIdentityKey(candidate.rootstockCode) === rootstockIdentityKey(record.rootstockCode)
    const rootstockMatch =
      candidate.rootstock &&
      record.rootstock &&
      rootstockIdentityKey(candidate.rootstock) === rootstockIdentityKey(record.rootstock)
    return Boolean(codeMatch || rootstockMatch)
  })

  const preferred = identityMatches[0] ?? candidates.find((candidate) => !candidate.rootstockCode && !candidate.rootstock)
  const selected = preferred ?? candidates[0]
  if (!selected?.matureSizeResearch?.researchApproved) {
    return undefined
  }
  return selected.matureSizeResearch
}

/**
 * Normalizes bundled and imported inventory rows (spreadsheet-derived display fields + variety fixes).
 */
export function enrichInventoryRecords(records: TreeSeedRecord[]): TreeSeedRecord[] {
  return records.map((record) => {
    const withDefaults = applyEnterpriseAppleDefaults({
      ...record,
      orchardSectionSpreadsheet: record.orchardSectionSpreadsheet ?? record.orchardSection,
      ciderFlavorProfile:
        record.ciderFlavorProfile ??
        (record.orchardSection === 'Cider apples' ? record.orchardRoleCategory : undefined),
    })
    const normalized = ensureRootstockCodeUnknown(sanitizeRootstockFields(withDefaults))
    return {
      ...normalized,
      matureSizeResearch: chooseMatureSizeResearch(normalized),
    }
  })
}

/** @alias enrichInventoryRecords — kept for existing imports */
export const enrichBundledInventoryRecords = enrichInventoryRecords
