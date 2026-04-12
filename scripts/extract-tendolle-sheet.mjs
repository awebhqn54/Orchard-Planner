/**
 * Reads docs/Tendolle Orchard Varieties .xlsx and writes src/data/tendolleSheetExtract.generated.ts
 * Run: node scripts/extract-tendolle-sheet.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { read, utils } from 'xlsx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function normalizeVarietyKey(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/®/g, '')
    .replace(/\s+/g, ' ')
}

function normalizeSpecies(raw) {
  const normalized = String(raw || '')
    .trim()
    .toLowerCase()
  if (normalized.includes('persimmon')) return 'Persimmon'
  if (normalized === 'sweet cherry') return 'Sweet Cherry'
  if (normalized === 'tart cherry') return 'Tart Cherry'
  if (normalized) return String(raw).trim()
  return 'Unknown species'
}

function deriveSection(species, sourceSection) {
  const normalizedSpecies = species.toLowerCase()
  const normalizedSection = String(sourceSection || '').toLowerCase()

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

/** Stable ids — match prior bundle for tree id continuity. */
const STABLE_ID_BY_VARIETY = {
  'brown snout': 'cider-brown-snout',
  crimsoncrisp: 'cider-crimsoncrisp',
  goldrush: 'cider-goldrush',
  winecrisp: 'cider-winecrisp',
  enterprise: 'cider-enterprise',
  'golden russet': 'cider-golden-russet',
  'roxbury russet': 'cider-roxbury-russet',
  liberty: 'cider-liberty',
  'harry masters jersey': 'cider-harry-masters-jersey',
  foxwhelp: 'cider-foxwhelp',
  priscilla: 'cider-priscilla',
  rubinette: 'inactive-rubinette',
  'yarlington mill': 'inactive-yarlington-mill',
  'state fair': 'eat-state-fair',
  honeycrisp: 'eat-honeycrisp',
  snowsweet: 'eat-snowsweet',
  cortland: 'eat-cortland',
  haralson: 'eat-haralson',
  'zestar!': 'eat-zestar',
  summercrisp: 'pear-summercrisp',
  harrowsweet: 'pear-harrowsweet',
  luscious: 'pear-luscious',
  ure: 'inactive-ure',
  seckel: 'inactive-seckel',
  patten: 'inactive-patten',
  parker: 'inactive-parker',
  toka: 'plum-toka',
  'black ice': 'inactive-black-ice',
  contender: 'peach-contender',
  intrepid: 'peach-intrepid',
  reliance: 'peach-reliance',
  lapins: 'sweet-lapins',
  kristin: 'sweet-kristin',
  mormon: 'apricot-mormon',
  montmorency: 'tart-montmorency',
  balaton: 'tart-balaton',
  stanley: 'plum-stanley',
  superior: 'plum-superior',
  'mount royal': 'inactive-mount-royal',
  valor: 'inactive-valor',
  meader: 'persimmon-meader',
  'prairie star': 'persimmon-prairie-star',
  'prairie dawn': 'persimmon-prairie-dawn',
  blushingstar: 'inactive-blushingstar',
  bounty: 'inactive-bounty',
}

function recordIdFor(varietyRaw) {
  const key = normalizeVarietyKey(varietyRaw)
  return STABLE_ID_BY_VARIETY[key] ?? `sheet-${key.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
}

/** Product URLs that must match `supplier` when the spreadsheet Link column is wrong or stale. */
const LINK_OVERRIDE_BY_RECORD_ID = {
  'eat-zestar': 'https://fedcoseeds.com/trees/zestar-apple-7280',
  'sweet-lapins': 'https://rootstofruitsnursery.com/collections/sweet-cherry-trees/products/lapins',
}

/** Freeform rootstock notes applied after prune (nursery wording beyond `rootstockCode`). */
const ROOTSTOCK_NOTE_OVERRIDE_BY_RECORD_ID = {
  'peach-contender': 'Lovell Dwarf',
}

const ROOTSTOCK_CODE_OVERRIDE = JSON.parse(
  readFileSync(join(root, 'src/data/rootstockCodeOverrides.json'), 'utf8'),
)
const TRAIT_OVERRIDES = JSON.parse(readFileSync(join(root, 'src/data/traitOverrides.json'), 'utf8'))

/** Keep in dataset for reference, but hide from active planning views. */
const ARCHIVED_FROM_PLANNER_IDS = new Set(['persimmon-prairie-dawn'])
const PLANTED_PERSIMMON_IDS = new Set(['persimmon-meader', 'persimmon-prairie-star'])

function isUnconfirmedRootstockNote(s) {
  const t = String(s || '').trim().toLowerCase()
  if (!t) return true
  if (t === 'unknown') return true
  if (t.includes('varies')) return true
  if (t.includes('check invoice')) return true
  if (t === 'dwarf seedling') return true
  if (t === 'seedling') return true
  return false
}

/** Receipt / curated rootstock identifier; falls back to spreadsheet when it already names a concrete stock. */
function applyRootstockCodeFields(o, id) {
  const fromEvidence = ROOTSTOCK_CODE_OVERRIDE[id]
  if (fromEvidence) {
    o.rootstockCode = fromEvidence
    return
  }
  const rs = o.rootstock
  if (!rs || typeof rs !== 'string') return
  if (isUnconfirmedRootstockNote(rs)) return
  o.rootstockCode = rs
}

function parseQty(raw) {
  const n = Number.parseInt(String(raw || '').replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

function parseUsd(raw) {
  if (raw === undefined || raw === null) return undefined
  const s = String(raw).trim()
  if (!s || /^not specified$/i.test(s)) return undefined
  const range = s.match(/(\d+)\s*[–-]\s*(\d+)/)
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2)
  const n = Number.parseFloat(s.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : undefined
}

function parseHeightFt(raw) {
  if (!raw || String(raw).toLowerCase().includes('not specified')) return undefined
  const s = String(raw)
  const range = s.match(/(\d+)\s*[–-]\s*(\d+)/)
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2)
  const single = s.match(/(\d+)/)
  return single ? Number(single[1]) : undefined
}

function parseStandard(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (!s) return undefined
  if (['available', 'standard', 'yes', 'y', 'true', 'x'].some((w) => s.includes(w))) return true
  if (['no', 'n', 'false', '0'].includes(s)) return false
  return undefined
}

function toSizeClass(raw, height) {
  const t = String(raw || '').toLowerCase()
  if (t.includes('dwarf') && !t.includes('semi')) return 'small'
  if (t.includes('semi-dwarf') || t.includes('semi dwarf')) return 'medium'
  if (t.includes('large') || t.includes('standard vigor') || t === 'standard') return 'large'
  if (t.includes('semi-standard') || t.includes('vigorous')) return 'large'
  if (height !== undefined) {
    if (height >= 17) return 'large'
    if (height <= 13) return 'small'
  }
  return 'medium'
}

function cleanNote(s) {
  const t = String(s || '').trim()
  if (!t || t.toLowerCase() === 'not specified') return undefined
  return t
}

function normalizeComparableText(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[.,;:()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
}

/** Collapse punctuation/spacing so MM106 and MM.106 match for dedupe vs `rootstockCode`. */
function rootstockIdentityKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function pruneRedundantRootstockNote(o) {
  const rootstock = cleanNote(o.rootstock)
  if (!rootstock) {
    delete o.rootstock
    return
  }
  const rootstockNorm = normalizeComparableText(rootstock)
  const sizeNorm = normalizeComparableText(o.matureSizeText)
  const sameAsCode =
    o.rootstockCode &&
    rootstockIdentityKey(rootstock) &&
    rootstockIdentityKey(rootstock) === rootstockIdentityKey(String(o.rootstockCode))
  if (sameAsCode || (rootstockNorm && rootstockNorm === sizeNorm)) {
    delete o.rootstock
    return
  }
  o.rootstock = rootstock
}

function applyTraitOverrides(o, id) {
  const override = TRAIT_OVERRIDES[id]
  if (!override) return
  if (Object.prototype.hasOwnProperty.call(override, 'bloomGroupTiming')) {
    o.bloomGroupTiming = cleanNote(override.bloomGroupTiming)
  }
  if (Object.prototype.hasOwnProperty.call(override, 'pollinationNotes')) {
    o.pollinationNotes = cleanNote(override.pollinationNotes)
  }
  if (Object.prototype.hasOwnProperty.call(override, 'matureSizeText')) {
    o.matureSizeText = cleanNote(override.matureSizeText)
  }
}

function combineDisease(fire, scab, other) {
  const parts = []
  const f = cleanNote(fire)
  const s = cleanNote(scab)
  const o = cleanNote(other)
  if (f) parts.push(`Fire blight: ${f}`)
  if (s) parts.push(`Apple scab: ${s}`)
  if (o) parts.push(o)
  return parts.length ? parts.join('; ') : undefined
}

function buildRecord(row) {
  const varietyName = String(row['Tree Variety'] || '').trim()
  const rawSpecies = String(row['Species'] || '').trim()
  const species = normalizeSpecies(rawSpecies)
  const rawOrchardSection = String(row['Orchard Section'] || '').trim()
  const qty = parseQty(row['Qty'])
  const matureHeightFt = parseHeightFt(row['Mature Height (ft)'])
  const sizeClass = toSizeClass(row['Size Class'], matureHeightFt)

  const fire = String(row['Fire Blight Susceptibility'] || '').trim()
  const scab = String(row['Apple Scab Susceptibility'] || '').trim()
  const otherDis = String(row['Other Disease Notes'] || '').trim()
  const diseaseNotes = combineDisease(fire, scab, otherDis)

  const id = recordIdFor(varietyName)
  const orchardSectionDefault = deriveSection(species, rawOrchardSection)
  const orchardSection =
    species === 'Persimmon' && PLANTED_PERSIMMON_IDS.has(id) ? 'Persimmons' : orchardSectionDefault
  const isStandard = parseStandard(row['Standard?'])
  const costPerTreeUsd = parseUsd(row['Cost/Tree (USD)'])
  let totalUsd = parseUsd(row['Total (USD)'])
  if (totalUsd === undefined && costPerTreeUsd !== undefined && qty > 0) {
    totalUsd = Math.round(costPerTreeUsd * qty * 100) / 100
  }

  const placeholderOnly = species === 'Persimmon' && !PLANTED_PERSIMMON_IDS.has(id)
  const activePlantingInventory = !placeholderOnly && qty > 0

  /** @type {Record<string, unknown>} */
  const o = {
    id,
    varietyName,
    species,
    orchardSection,
    orchardSectionSpreadsheet: rawOrchardSection || undefined,
    orchardRoleCategory: cleanNote(row['Orchard Role Category']),
    supplierGroup: cleanNote(row['Supplier Group']),
    supplier: cleanNote(row['Supplier']),
    link: cleanNote(row['Link']),
    isStandard,
    costPerTreeUsd,
    totalUsd,
    quantity: qty,
    matureHeightFt,
    matureSizeText: cleanNote(row['Size Class']),
    shippingPlantSize: cleanNote(row['Shipping / Plant Size']),
    rootstock: cleanNote(row['Rootstock']),
    sizeClass,
    coldHardiness: cleanNote(row['Cold Hardiness (°F)']),
    ripeningWindow: cleanNote(row['Ripening Window (Southern WI)']),
    ciderFlavorProfile: cleanNote(row['Cider / Flavor Profile']),
    fireBlightSusceptibility: cleanNote(row['Fire Blight Susceptibility']),
    appleScabSusceptibility: cleanNote(row['Apple Scab Susceptibility']),
    otherDiseaseNotes: cleanNote(row['Other Disease Notes']),
    diseaseNotes,
    biennialTendency: cleanNote(row['Biennial Tendency']),
    biennialManagement: cleanNote(row['Biennial Management']),
    bloomGroupTiming: cleanNote(row['Bloom Group / Timing']),
    pollinationNotes: cleanNote(row['Pollination']),
    storagePotential: cleanNote(row['Storage Potential']),
    orchardNotes: cleanNote(row['Orchard Notes']),
    activePlantingInventory,
    placeholderOnly,
    sourceRefs: ['Tendolle Orchard Varieties .xlsx'],
  }

  const linkOverride = LINK_OVERRIDE_BY_RECORD_ID[id]
  if (linkOverride) {
    o.link = linkOverride
  }

  applyRootstockCodeFields(o, id)
  applyTraitOverrides(o, id)
  pruneRedundantRootstockNote(o)
  const curatedNote = ROOTSTOCK_NOTE_OVERRIDE_BY_RECORD_ID[id]
  if (curatedNote) {
    o.rootstock = curatedNote
  }

  if (!String(o.rootstockCode ?? '').trim()) {
    o.rootstockCode = 'Unknown'
  }

  for (const k of Object.keys(o)) {
    if (o[k] === undefined) delete o[k]
  }
  return o
}

function formatRecord(obj) {
  const lines = []
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue
    if (k === 'sourceRefs') {
      lines.push(`    ${k}: ['Tendolle Orchard Varieties .xlsx'],`)
      continue
    }
    if (typeof v === 'string') {
      lines.push(`    ${k}: ${JSON.stringify(v)},`)
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      lines.push(`    ${k}: ${v},`)
    } else if (Array.isArray(v)) {
      lines.push(`    ${k}: ${JSON.stringify(v)},`)
    }
  }
  return `  {\n${lines.join('\n')}\n  }`
}

const buf = readFileSync(join(root, 'docs/Tendolle Orchard Varieties .xlsx'))
const wb = read(buf, { type: 'buffer' })
const sheet = wb.Sheets[wb.SheetNames[0]]
const rows = utils.sheet_to_json(sheet, { defval: '', raw: false })
const dataRows = rows.filter((r) => String(r['Tree Variety'] || '').trim() && String(r['Species'] || '').trim())

const active = []
const inactive = []

for (const row of dataRows) {
  const obj = buildRecord(row)
  if (ARCHIVED_FROM_PLANNER_IDS.has(obj.id)) {
    inactive.push({ ...obj, quantity: 0, activePlantingInventory: false, placeholderOnly: false })
  } else if (obj.quantity > 0) {
    active.push(obj)
  } else {
    inactive.push(obj)
  }
}

function writeRootstockGapReport(activeObjs, inactiveObjs) {
  const all = [...activeObjs, ...inactiveObjs].sort((a, b) => String(a.id).localeCompare(String(b.id)))
  const missing = []
  const unknownMarked = []
  const ambiguous = []
  const lowConfidence = []

  for (const r of all) {
    const code = r.rootstockCode
    const row = { id: r.id, variety: r.varietyName, note: r.rootstock }
    if (!code) {
      missing.push(row)
      continue
    }
    if (String(code).toLowerCase() === 'unknown') {
      unknownMarked.push({ ...row, matureSize: r.matureSizeText })
      continue
    }
    if (String(code).includes('/')) {
      ambiguous.push({ ...row, code })
      continue
    }
    if (/seedling/i.test(code) || /^dwarf\s+seedling$/i.test(String(r.rootstock || ''))) {
      lowConfidence.push({ ...row, code })
    }
  }

  const lines = [
    '# Rootstock gaps (auto-generated)',
    '',
    'Generated by `npm run extract:tendolle` based on spreadsheet + `src/data/rootstockCodeOverrides.json`.',
    '',
    '`rootstockCode` defaults to **Unknown** when no cultivar-level stock is known; use **Mature size** / notes for vigor (e.g. dwarf).',
    '',
    '## Missing rootstock code',
    '',
    ...missing.map((m) => `- **${m.id}** (${m.variety}) — spreadsheet note: ${m.note ?? '—'}`),
    '',
    '## Unknown (no cultivar code yet)',
    '',
    ...unknownMarked.map(
      (m) =>
        `- **${m.id}** (${m.variety}) — mature size: ${m.matureSize ?? '—'} — note: ${m.note ?? '—'}`,
    ),
    '',
    '## Ambiguous / multiple codes (per-order split not tracked per tree)',
    '',
    ...ambiguous.map((m) => `- **${m.id}** (${m.variety}) — \`${m.code}\` — note: ${m.note ?? '—'}`),
    '',
    '## Lower-confidence identifiers',
    '',
    'Seedling-level or generic nursery wording; confirm from tags or nursery if needed.',
    '',
    ...lowConfidence.map((m) => `- **${m.id}** (${m.variety}) — \`${m.code}\``),
    '',
  ]

  writeFileSync(join(root, 'docs/rootstock-gaps.md'), lines.join('\n'), 'utf8')
}

writeRootstockGapReport(active, inactive)

const activeFormatted = active.map(formatRecord)
const inactiveFormatted = inactive.map(formatRecord)

const header = `/**
 * AUTO-GENERATED by scripts/extract-tendolle-sheet.mjs from docs/Tendolle Orchard Varieties .xlsx
 * Do not edit by hand — re-run the script after spreadsheet changes.
 */
import type { TreeSeedRecord } from '../types'

`

const out =
  header +
  `export const tendolleInventoryRecordsRaw: TreeSeedRecord[] = [\n${activeFormatted.join(',\n')},\n]\n\n` +
  `export const tendolleInactiveInventoryRecordsRaw: TreeSeedRecord[] = [\n${inactiveFormatted.join(',\n')},\n]\n`

writeFileSync(join(root, 'src/data/tendolleSheetExtract.generated.ts'), out, 'utf8')
console.log(`Wrote ${active.length} active + ${inactive.length} inactive records + docs/rootstock-gaps.md`)
