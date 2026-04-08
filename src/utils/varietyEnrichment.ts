import type { TreeSeedRecord } from '../types'

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
    rootstock: 'Semi-dwarf',
    sizeClass: 'large',
  }
}

/**
 * Normalizes bundled and imported inventory rows (spreadsheet-derived display fields + variety fixes).
 */
export function enrichInventoryRecords(records: TreeSeedRecord[]): TreeSeedRecord[] {
  return records.map((record) =>
    applyEnterpriseAppleDefaults({
      ...record,
      orchardSectionSpreadsheet: record.orchardSectionSpreadsheet ?? record.orchardSection,
      ciderFlavorProfile:
        record.ciderFlavorProfile ??
        (record.orchardSection === 'Cider apples' ? record.orchardRoleCategory : undefined),
    }),
  )
}

/** @alias enrichInventoryRecords — kept for existing imports */
export const enrichBundledInventoryRecords = enrichInventoryRecords
