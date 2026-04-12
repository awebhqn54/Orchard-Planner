import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { read, utils } from 'xlsx'

import {
  seedConflicts,
  seedInventoryRecords,
  seedPlacementAssumptions,
  seedSourceDocuments,
} from '../data/seedData'
import {
  tendolleConflicts,
  tendolleInactiveInventoryRecords,
  tendolleInventoryRecords,
  tendollePlacementAssumptions,
  tendolleSourceDocuments,
} from '../data/tendolleData'
import type { SourceConflict, SourceDocument, TreeSeedRecord } from '../types'
import { enrichInventoryRecords } from './varietyEnrichment'

GlobalWorkerOptions.workerSrc = pdfWorker

export interface ImportedInventoryBundle {
  inventoryRecords: TreeSeedRecord[]
  inactiveInventoryRecords: TreeSeedRecord[]
  sourceDocuments: SourceDocument[]
  sourceConflicts: SourceConflict[]
  placementAssumptions: string[]
}

export const bundledProjectImportBundle: ImportedInventoryBundle = {
  inventoryRecords: tendolleInventoryRecords,
  inactiveInventoryRecords: tendolleInactiveInventoryRecords,
  sourceDocuments: tendolleSourceDocuments,
  sourceConflicts: tendolleConflicts,
  placementAssumptions: tendollePlacementAssumptions,
}

export const fallbackImportBundle: ImportedInventoryBundle = {
  inventoryRecords: seedInventoryRecords,
  inactiveInventoryRecords: [],
  sourceDocuments: seedSourceDocuments,
  sourceConflicts: seedConflicts,
  placementAssumptions: seedPlacementAssumptions,
}

const HEADER_ALIASES: Record<string, string[]> = {
  varietyName: ['variety', 'cultivar', 'tree variety', 'name'],
  species: ['species', 'fruit', 'type'],
  supplierGroup: ['supplier group', 'vendor group'],
  supplier: ['supplier', 'nursery', 'vendor', 'source'],
  link: ['link', 'url', 'order link', 'product link'],
  /** Orchard block/section label from the sheet (distinct from supplier group). */
  orchardSection: ['orchard section', 'section', 'block', 'area', 'orchard block'],
  quantity: ['qty', 'quantity', 'count', 'number ordered', 'ordered'],
  isStandard: ['standard', 'std', 'standard tree'],
  costPerTreeUsd: ['cost per tree usd', 'cost per tree', 'cost tree', 'unit cost', 'price per tree'],
  totalUsd: ['total usd', 'total', 'line total', 'extended', 'subtotal'],
  matureHeightFt: ['mature height', 'height', 'mature height ft', 'height ft'],
  matureWidthFt: ['mature width', 'width', 'mature spread', 'spread'],
  matureSizeText: ['mature size', 'size notes', 'vigor', 'tree size'],
  shippingPlantSize: ['shipping', 'shipping plant size', 'plant size', 'shipping size'],
  rootstock: ['rootstock'],
  rootstockCode: ['rootstock code', 'rootstock_code', 'rootstockcode'],
  sizeClass: ['size class'],
  coldHardiness: ['cold hardiness', 'hardiness', 'cold hardiness f'],
  ripeningWindow: [
    'harvest',
    'harvest timing',
    'ripening window',
    'season',
    'ripening window southern wi',
    'ripening southern wi',
  ],
  pollinationNotes: ['pollination', 'pollination notes'],
  orchardRoleCategory: ['orchard role category', 'role category', 'tree role'],
  ciderFlavorProfile: ['cider', 'cider flavor profile', 'flavor profile', 'cider flavor'],
  fireBlightSusceptibility: ['fire blight', 'fire blight susceptibility'],
  appleScabSusceptibility: ['apple scab', 'apple scab susceptibility', 'scab'],
  otherDiseaseNotes: ['other disease', 'other disease notes'],
  biennialTendency: ['biennial tendency'],
  biennialManagement: ['biennial management'],
  bloomGroupTiming: ['bloom group', 'bloom timing', 'bloom group timing'],
  storagePotential: ['storage', 'storage potential'],
  diseaseNotes: ['disease', 'disease notes'],
  orchardNotes: ['notes', 'orchard notes', 'comments'],
}

const ARCHIVED_FROM_PLANNER_VARIETIES = new Set(['prairie dawn'])
const PLANTED_PERSIMMON_VARIETIES = new Set(['meader', 'prairie star'])

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function normalizeVarietyKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/®/g, '')
    .replace(/\s+/g, ' ')
}

function getCellString(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function findHeaderValue(row: Record<string, unknown>, field: keyof typeof HEADER_ALIASES) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizeHeader(key), value] as const)
  const aliases = HEADER_ALIASES[field]
  const exactAlias = normalizedEntries.find(([key]) => aliases.includes(key))
  if (exactAlias) {
    return exactAlias[1]
  }

  const partialAlias = normalizedEntries.find(([key]) => aliases.some((alias) => key.includes(alias)))
  return partialAlias?.[1]
}

/** Prefer exact spreadsheet header labels when present (handles punctuation/degree symbols). */
function getCellFromKnownHeaders(row: Record<string, unknown>, labels: string[]) {
  for (const label of labels) {
    const hit = Object.entries(row).find(([key]) => normalizeHeader(key) === normalizeHeader(label))
    if (hit && hit[1] !== undefined && hit[1] !== '') {
      return hit[1]
    }
  }
  return undefined
}

function parseStandardFlag(value: unknown): boolean | undefined {
  const raw = getCellString(value).toLowerCase()
  if (!raw) {
    return undefined
  }
  if (['y', 'yes', 'true', 'x', '1', 'std', 'standard'].includes(raw)) {
    return true
  }
  if (['n', 'no', 'false', '0'].includes(raw)) {
    return false
  }
  return undefined
}

function toUsd(value: unknown): number | undefined {
  const raw = getCellString(value).replace(/[$,]/g, '')
  if (!raw) {
    return undefined
  }
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : undefined
}

function buildDiseaseSummary(record: {
  fireBlightSusceptibility?: string
  appleScabSusceptibility?: string
  otherDiseaseNotes?: string
  diseaseNotes?: string
}): string | undefined {
  const combined = [record.fireBlightSusceptibility, record.appleScabSusceptibility, record.otherDiseaseNotes]
    .filter(Boolean)
    .join('; ')
  if (combined) {
    return combined
  }
  return record.diseaseNotes
}

function toOptionalNumber(value: unknown) {
  const raw = getCellString(value)
  if (!raw) {
    return undefined
  }

  const match = raw.match(/-?\d+(\.\d+)?/)
  return match ? Number(match[0]) : undefined
}

function toSizeClass(rawValue: unknown, height?: number): TreeSeedRecord['sizeClass'] {
  const raw = getCellString(rawValue).toLowerCase()

  if (raw.includes('small')) {
    return 'small'
  }

  if (raw.includes('large')) {
    return 'large'
  }

  if (raw.includes('medium')) {
    return 'medium'
  }

  if (height !== undefined) {
    if (height >= 17) {
      return 'large'
    }

    if (height <= 13) {
      return 'small'
    }
  }

  return 'medium'
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function normalizeSpecies(value: string) {
  const normalized = value.toLowerCase().trim()

  if (normalized.includes('persimmon')) {
    return 'Persimmon'
  }

  if (normalized === 'sweet cherry') {
    return 'Sweet Cherry'
  }

  if (normalized === 'tart cherry') {
    return 'Tart Cherry'
  }

  if (normalized) {
    return value.trim()
  }

  return 'Unknown species'
}

function deriveSection(species: string, sourceSection: string) {
  const normalizedSpecies = species.toLowerCase()
  const normalizedSection = sourceSection.toLowerCase()

  if (normalizedSection.includes('cider')) {
    return 'Cider apples'
  }

  if (normalizedSpecies === 'sweet cherry') {
    return 'Sweet cherries'
  }

  if (normalizedSpecies === 'tart cherry') {
    return 'Tart cherries'
  }

  if (normalizedSpecies === 'persimmon') {
    return 'Future persimmons'
  }

  if (normalizedSpecies === 'peach') {
    return 'Peaches'
  }

  if (normalizedSpecies === 'apple') {
    return 'Eating/Baking apples'
  }

  if (normalizedSpecies) {
    return `${species}s`
  }

  return 'Mixed orchard'
}

function normalizeQuantity(value: unknown) {
  return toOptionalNumber(value) ?? 0
}

function toWidthEstimate(height?: number) {
  if (height === undefined) {
    return undefined
  }

  return Math.max(10, Math.round(height * 0.75))
}

function parseSpreadsheetRows(rows: Record<string, unknown>[]) {
  const inventoryRecords: TreeSeedRecord[] = []
  const inactiveInventoryRecords: TreeSeedRecord[] = []

  rows.forEach((row, index) => {
    const varietyName = getCellString(findHeaderValue(row, 'varietyName'))
    const rawSpecies = getCellString(findHeaderValue(row, 'species'))
    const species = normalizeSpecies(rawSpecies)
    const rawSection =
      getCellString(getCellFromKnownHeaders(row, ['Orchard Section'])) ||
      getCellString(findHeaderValue(row, 'orchardSection'))
    const orchardSectionSpreadsheet = rawSection || undefined
    const orchardSection = deriveSection(species, rawSection)
    const supplierGroup = getCellString(findHeaderValue(row, 'supplierGroup')) || undefined
    const supplier = getCellString(findHeaderValue(row, 'supplier')) || undefined
    const link =
      getCellString(findHeaderValue(row, 'link')) ||
      getCellString(getCellFromKnownHeaders(row, ['Link'])) ||
      undefined
    const orchardRoleCategory =
      getCellString(findHeaderValue(row, 'orchardRoleCategory')) ||
      getCellString(row['Orchard Role Category']) ||
      undefined
    const orchardNotesCell = getCellString(findHeaderValue(row, 'orchardNotes')) || undefined
    const matureHeightFt =
      toOptionalNumber(findHeaderValue(row, 'matureHeightFt')) ??
      toOptionalNumber(getCellFromKnownHeaders(row, ['Mature Height (ft)', 'Mature Height']))
    const quantity = normalizeQuantity(findHeaderValue(row, 'quantity'))
    const isStandard =
      parseStandardFlag(findHeaderValue(row, 'isStandard')) ??
      parseStandardFlag(getCellFromKnownHeaders(row, ['Standard?']))
    const costPerTreeUsd =
      toUsd(findHeaderValue(row, 'costPerTreeUsd')) ??
      toUsd(getCellFromKnownHeaders(row, ['Cost/Tree (USD)', 'Cost per Tree (USD)']))
    const totalUsd = toUsd(findHeaderValue(row, 'totalUsd')) ?? toUsd(getCellFromKnownHeaders(row, ['Total (USD)']))
    const shippingPlantSize =
      getCellString(findHeaderValue(row, 'shippingPlantSize')) ||
      getCellString(getCellFromKnownHeaders(row, ['Shipping / Plant Size'])) ||
      undefined
    const ciderFlavorProfile =
      getCellString(findHeaderValue(row, 'ciderFlavorProfile')) ||
      getCellString(getCellFromKnownHeaders(row, ['Cider / Flavor Profile'])) ||
      undefined
    const fireBlightSusceptibility =
      getCellString(findHeaderValue(row, 'fireBlightSusceptibility')) ||
      getCellString(row['Fire Blight Susceptibility']) ||
      undefined
    const appleScabSusceptibility =
      getCellString(findHeaderValue(row, 'appleScabSusceptibility')) ||
      getCellString(row['Apple Scab Susceptibility']) ||
      undefined
    const otherDiseaseNotes =
      getCellString(findHeaderValue(row, 'otherDiseaseNotes')) ||
      getCellString(row['Other Disease Notes']) ||
      undefined
    const biennialTendency = getCellString(findHeaderValue(row, 'biennialTendency')) || undefined
    const biennialManagement = getCellString(findHeaderValue(row, 'biennialManagement')) || undefined
    const bloomGroupTiming =
      getCellString(findHeaderValue(row, 'bloomGroupTiming')) ||
      getCellString(getCellFromKnownHeaders(row, ['Bloom Group / Timing'])) ||
      undefined
    const storagePotential = getCellString(findHeaderValue(row, 'storagePotential')) || undefined
    const legacyDiseaseColumn = getCellString(findHeaderValue(row, 'diseaseNotes')) || undefined

    if (!varietyName || !rawSpecies) {
      return
    }

    const diseaseNotes = buildDiseaseSummary({
      fireBlightSusceptibility,
      appleScabSusceptibility,
      otherDiseaseNotes,
      diseaseNotes: legacyDiseaseColumn,
    })
    const varietyKey = normalizeVarietyKey(varietyName)
    const archivedFromPlanner = ARCHIVED_FROM_PLANNER_VARIETIES.has(varietyKey)
    const plantedPersimmon = species === 'Persimmon' && PLANTED_PERSIMMON_VARIETIES.has(varietyKey)
    const placeholderOnly = species === 'Persimmon' && !plantedPersimmon

    const record = {
      id: `${slugify(varietyName)}-${index + 1}`,
      varietyName,
      species,
      orchardSection: species === 'Persimmon' && plantedPersimmon ? 'Persimmons' : orchardSection,
      orchardSectionSpreadsheet,
      supplierGroup,
      supplier,
      link,
      orchardRoleCategory,
      isStandard,
      costPerTreeUsd,
      totalUsd,
      quantity: archivedFromPlanner ? 0 : quantity,
      matureHeightFt,
      matureWidthFt: toWidthEstimate(matureHeightFt),
      matureSizeText: getCellString(findHeaderValue(row, 'matureSizeText')) || undefined,
      shippingPlantSize,
      rootstock: getCellString(findHeaderValue(row, 'rootstock')) || undefined,
      rootstockCode: getCellString(findHeaderValue(row, 'rootstockCode')) || undefined,
      sizeClass: toSizeClass(findHeaderValue(row, 'sizeClass'), matureHeightFt),
      coldHardiness:
        getCellString(findHeaderValue(row, 'coldHardiness')) ||
        getCellString(getCellFromKnownHeaders(row, ['Cold Hardiness (°F)', 'Cold Hardiness'])) ||
        undefined,
      ripeningWindow:
        getCellString(findHeaderValue(row, 'ripeningWindow')) ||
        getCellString(getCellFromKnownHeaders(row, ['Ripening Window (Southern WI)', 'Ripening Window'])) ||
        undefined,
      pollinationNotes: getCellString(findHeaderValue(row, 'pollinationNotes')) || undefined,
      ciderFlavorProfile,
      fireBlightSusceptibility,
      appleScabSusceptibility,
      otherDiseaseNotes,
      diseaseNotes,
      biennialTendency,
      biennialManagement,
      bloomGroupTiming,
      storagePotential,
      orchardNotes: orchardNotesCell || undefined,
      activePlantingInventory: !placeholderOnly && quantity > 0 && !archivedFromPlanner,
      placeholderOnly,
      sourceRefs: ['Tendolle Orchard Varieties .xlsx'],
    } satisfies TreeSeedRecord

    if (!archivedFromPlanner && quantity > 0) {
      inventoryRecords.push(record)
    } else {
      inactiveInventoryRecords.push(record)
    }
  })

  return { inventoryRecords, inactiveInventoryRecords }
}

function inferPdfType(filename: string): SourceDocument['type'] {
  const normalizedName = filename.toLowerCase()
  if (normalizedName.includes('plan') || normalizedName.includes('prototype') || normalizedName.includes('layout')) {
    return 'orchard-plan-pdf'
  }

  return 'supporting-pdf'
}

async function extractPdfText(file: File) {
  const buffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: buffer }).promise
  const pages: string[] = []

  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (pageText) {
      pages.push(pageText)
    }
  }

  return pages.join('\n\n')
}

async function parseSpreadsheetFile(file: File) {
  const buffer = await file.arrayBuffer()
  const workbook = read(buffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[firstSheetName]
  const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: false,
    defval: '',
  })

  return parseSpreadsheetRows(rows)
}

export async function importOrchardFiles(files: File[]): Promise<ImportedInventoryBundle> {
  if (!files.length) {
    return bundledProjectImportBundle
  }

  const spreadsheets = files.filter((file) => /\.(xlsx?|csv)$/i.test(file.name))
  const pdfs = files.filter((file) => /\.pdf$/i.test(file.name))

  const sourceDocuments: SourceDocument[] = []
  const sourceConflicts: SourceConflict[] = []
  const placementAssumptions = [...tendollePlacementAssumptions]

  let inventoryRecords: TreeSeedRecord[] = []
  let inactiveInventoryRecords: TreeSeedRecord[] = []

  if (spreadsheets[0]) {
    const parsedSpreadsheet = await parseSpreadsheetFile(spreadsheets[0])
    inventoryRecords = parsedSpreadsheet.inventoryRecords
    inactiveInventoryRecords = parsedSpreadsheet.inactiveInventoryRecords
    sourceDocuments.push({
      id: 'uploaded-spreadsheet',
      name: spreadsheets[0].name,
      type: 'spreadsheet',
      notes: [
        'Spreadsheet treated as final inventory truth.',
        `Parsed ${inventoryRecords.length} active source rows and ${inactiveInventoryRecords.length} inactive alternates.`,
      ],
    })
  } else {
    return bundledProjectImportBundle
  }

  const orchardPlanPdf = pdfs.find((file) => file.name.toLowerCase().includes('orchard plan'))
  if (inactiveInventoryRecords.length) {
    sourceConflicts.push({
      id: 'uploaded-inactive-candidates',
      severity: 'info',
      summary: 'Spreadsheet includes inactive alternate varieties.',
      detail:
        `${inactiveInventoryRecords.length} spreadsheet rows had quantity zero and were preserved as alternates instead of active plantings.`,
      sourceIds: ['uploaded-spreadsheet'],
    })
  }

  for (const pdf of pdfs) {
    const extractedText = await extractPdfText(pdf)
    const type = inferPdfType(pdf.name)
    sourceDocuments.push({
      id: slugify(pdf.name),
      name: pdf.name,
      type,
      extractedText,
      notes:
        type === 'orchard-plan-pdf'
          ? [
              extractedText
                ? 'Used only for rough zoning intent, not exact geometry.'
                : 'Image-based orchard plan; used via manual zoning interpretation rather than machine-readable text.',
            ]
          : ['Used as reference material for orchard attributes and planning notes.'],
    })
  }

  if (orchardPlanPdf && !sourceDocuments.find((document) => document.id === slugify(orchardPlanPdf.name))?.extractedText) {
    sourceConflicts.push({
      id: 'uploaded-image-plan',
      severity: 'info',
      summary: 'The uploaded orchard plan PDF is image-based.',
      detail:
        'The zoning model uses manual plan interpretation and user rules instead of extractable PDF text.',
      sourceIds: [slugify(orchardPlanPdf.name)],
    })
  }

  if (spreadsheets.length > 1) {
    sourceConflicts.push({
      id: 'multiple-spreadsheets',
      severity: 'warning',
      summary: 'Multiple spreadsheet files were uploaded.',
      detail: `Only ${spreadsheets[0].name} was used as the source of truth.`,
      sourceIds: ['uploaded-spreadsheet'],
    })
  }

  sourceConflicts.push(
    ...tendolleConflicts.filter((conflict) =>
      ['cider-alternatives-not-additive', 'persimmon-placeholder-override'].includes(conflict.id),
    ),
  )

  return {
    inventoryRecords: enrichInventoryRecords(inventoryRecords),
    inactiveInventoryRecords: enrichInventoryRecords(inactiveInventoryRecords),
    sourceDocuments,
    sourceConflicts,
    placementAssumptions,
  }
}
