import type { SourceConflict, SourceDocument } from '../types'
import { enrichBundledInventoryRecords } from '../utils/varietyEnrichment'
import {
  prototypeZoneConflicts,
  prototypeZoneSourceDocument,
  tendollePrototypeZoneLayout,
} from './prototypeZoneLayout'
import {
  tendolleInactiveInventoryRecordsRaw,
  tendolleInventoryRecordsRaw,
} from './tendolleSheetExtract.generated'

export const tendolleSourceDocuments: SourceDocument[] = [
  prototypeZoneSourceDocument,
  {
    id: 'tendolle-varieties-xlsx',
    name: 'Tendolle Orchard Varieties .xlsx',
    type: 'spreadsheet',
    notes: [
      'Spreadsheet treated as final source of truth for active tree counts and variety selection.',
      'Workbook includes supplier/group, section, species, role, qty, costs, size, rootstock, height, shipping, hardiness, ripening, cider/flavor, disease columns, biennial, bloom, pollination, storage, and links.',
    ],
  },
  {
    id: 'tendolle-orchard-plan-pdf',
    name: 'Tendolle Orchard Plan.pdf',
    type: 'orchard-plan-pdf',
    notes: [
      'Prototype layout is image-based and was interpreted visually rather than from extractable text.',
      'It shows a house-side stone-fruit zone, a central/right cider block, a south dessert-apple band, and a south-side persimmon placeholder area.',
    ],
  },
  {
    id: 'cider-recommendations-pdf',
    name: 'Cider orchard Recommendations.pdf',
    type: 'supporting-pdf',
    notes: [
      'Provides cider variety profiles, disease risk, hardiness, ripening windows, and rootstock maturity ranges.',
      'Contains both a traditional English plan and a modern disease-resistant plan; only the spreadsheet decides which one was actually ordered.',
    ],
  },
  {
    id: 'eating-baking-pdf',
    name: 'Eating-Baking Fruit Tree Selection.pdf',
    type: 'supporting-pdf',
    notes: [
      'Provides mature size, spacing, harvest timing, pollination, and site guidance for dessert fruit, plums, pears, cherries, apricots, and persimmons.',
      'Used to infer placement cues such as Lapins anchoring sweet-cherry pollination and pears needing more space than peaches.',
    ],
  },
  {
    id: 'orchard-investment-pdf',
    name: 'Orchard & Windbreak Investment Summary.pdf',
    type: 'supporting-pdf',
    notes: [
      'Used only as a budgeting and category-count cross-check.',
      'Not used as final inventory truth when it differs from the spreadsheet.',
    ],
  },
  {
    id: 'maple-report-pdf',
    name: 'Maple Tree Report for Tendolles.pdf',
    type: 'supporting-pdf',
    notes: [
      'Maple and windbreak planning are adjacent projects and are not mixed into orchard planting spots.',
    ],
  },
]

export const tendolleConflicts: SourceConflict[] = [
  {
    id: 'cider-alternatives-not-additive',
    severity: 'warning',
    summary: 'The cider recommendation PDF contains two alternative 32-tree plans.',
    detail:
      'The traditional English block and the modern disease-resistant block are treated as alternatives, not additive inventory. The spreadsheet is the authority for final cider varieties and counts.',
    sourceIds: ['cider-recommendations-pdf', 'tendolle-varieties-xlsx'],
  },
  {
    id: 'inactive-spreadsheet-candidates',
    severity: 'info',
    summary: 'The spreadsheet includes candidate varieties with quantity zero.',
    detail:
      'Zero-quantity varieties are preserved as alternates in diagnostics but are not expanded into active planting trees or auto-placed spots.',
    sourceIds: ['tendolle-varieties-xlsx'],
  },
  {
    id: 'persimmon-placeholder-override',
    severity: 'info',
    summary: 'Prairie Dawn is archived from active planning while planted persimmons stay active.',
    detail:
      'Meader and Prairie Star are treated as active planting inventory. Prairie Dawn is intentionally preserved as an inactive archival record and hidden from default plantable views.',
    sourceIds: ['tendolle-varieties-xlsx', 'tendolle-orchard-plan-pdf'],
  },
  ...prototypeZoneConflicts,
]

export const tendollePlacementAssumptions = [
  ...tendollePrototypeZoneLayout.orchardBlock.notes,
  ...tendollePrototypeZoneLayout.placementRulesFromPrototype,
  'Initial layout follows a manual starter pattern: peaches, apricots, plums, then cherries stacked down columns 1-2; non-cider apples continue in lower columns 1-2 and column 3; cider apples shift right, with largest standard cider apples prioritized in column 5.',
  'Spreadsheet counts remain authoritative whenever they differ from prototype planned counts.',
  'Sweet cherries and tart cherries should remain visually distinct but adjacent even though the prototype explicitly labels only sweet cherries.',
]

export const tendolleInventoryRecords = enrichBundledInventoryRecords(tendolleInventoryRecordsRaw)

export const tendolleInactiveInventoryRecords = enrichBundledInventoryRecords(tendolleInactiveInventoryRecordsRaw)
