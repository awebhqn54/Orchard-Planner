export type TreeActivityStatus = 'assigned' | 'holding' | 'unassigned'

export type TreeDeliveryStatus = 'on-site' | 'in-transit'

export interface PlacementReason {
  code: string
  label: string
  detail: string
  weight: number
}

export interface PlacementExplanation {
  zoneId: string
  summary: string
  reasons: PlacementReason[]
  ruleTrace: string[]
}

export interface ManualOverrideState {
  isManualOverride: boolean
  overriddenAt?: string
  previousSpotId?: string | null
  note?: string
}

export interface TreePlacement {
  treeId: string
  spotId: string | null
  rowId: string | null
  rowNumber: number | null
  columnIndex: number | null
  status: TreeActivityStatus
}

export interface Tree {
  id: string
  sourceRecordId: string
  varietyName: string
  species: string
  orchardSection: string
  /** Raw spreadsheet orchard section label before deriveSection normalization (uploads). */
  orchardSectionSpreadsheet?: string
  orchardRoleCategory?: string
  supplierGroup?: string
  supplier?: string
  /** Product / order link from spreadsheet */
  link?: string
  /** Spreadsheet "Standard?" — standard vs dwarf/semi-dwarf vigor where noted. */
  isStandard?: boolean
  costPerTreeUsd?: number
  totalUsd?: number
  shippingPlantSize?: string
  ciderFlavorProfile?: string
  fireBlightSusceptibility?: string
  appleScabSusceptibility?: string
  otherDiseaseNotes?: string
  biennialTendency?: string
  biennialManagement?: string
  bloomGroupTiming?: string
  storagePotential?: string
  quantity: number
  batchQuantity: number
  matureHeightFt?: number
  matureWidthFt?: number
  matureSizeText?: string
  rootstock?: string
  sizeClass: 'small' | 'medium' | 'large'
  coldHardiness?: string
  ripeningWindow?: string
  pollinationNotes?: string
  /** Combined disease summary for planner compatibility; may mirror raw columns when imported. */
  diseaseNotes?: string
  orchardNotes?: string
  recommendedSpotId: string | null
  currentSpotId: string | null
  placement: TreePlacement
  manualOverride: ManualOverrideState
  placementExplanation: PlacementExplanation
  activePlantingInventory: boolean
  placeholderOnly: boolean
  sourceRefs: string[]
  /** Physical receipt: on site vs still shipping. */
  deliveryStatus: TreeDeliveryStatus
}

export interface PlantingSpot {
  id: string
  rowId: string
  rowNumber: number
  columnIndex: number
  kind: 'active' | 'placeholder'
  zoneId: string
  offsetFeetFromFence: number
  recommendedTreeId: string | null
  currentTreeId: string | null
}

export interface OrchardRow {
  id: string
  rowNumber: number
  label: string
  offsetFeetFromFence: number
  spotIds: string[]
  prototypeRowType?: string
  prototypeSide?: string
}

export interface OrchardZone {
  id: string
  label: string
  description: string
  rowRange: [number, number]
  columnRange: [number, number]
  purpose: string
  accepts: string[]
  rowId?: string
  cropType?: string
  relativePosition?: string
  plannedCount?: number | null
  prototypeLabel?: string
  placeholderOnly?: boolean
}

export interface SourceDocument {
  id: string
  name: string
  type: 'spreadsheet' | 'orchard-plan-pdf' | 'supporting-pdf' | 'prototype-zone-json' | 'seed'
  extractedText?: string
  notes: string[]
}

export interface SourceConflict {
  id: string
  severity: 'info' | 'warning' | 'high'
  summary: string
  detail: string
  sourceIds: string[]
}

export interface PlacementWarning {
  id: string
  severity: 'info' | 'warning'
  summary: string
  detail: string
}

export interface OrchardConfig {
  rowOffsetsFeet: number[]
  rowCount: number
  spotsPerRow: number
}

export interface NormalizedOrchardData {
  sourceDocuments: SourceDocument[]
  sourceConflicts: SourceConflict[]
  placementAssumptions: string[]
  orchardConfig: OrchardConfig
  orchardRows: OrchardRow[]
  orchardZones: OrchardZone[]
  plantingSpots: PlantingSpot[]
  trees: Tree[]
  inactiveInventoryRecords: TreeSeedRecord[]
  stagingTreeIds: string[]
  placementWarnings: PlacementWarning[]
}

export interface TreeSeedRecord {
  id: string
  varietyName: string
  species: string
  orchardSection: string
  /** Original section/group cell from the spreadsheet when imported. */
  orchardSectionSpreadsheet?: string
  orchardRoleCategory?: string
  supplierGroup?: string
  supplier?: string
  /** Product / order link from spreadsheet */
  link?: string
  isStandard?: boolean
  costPerTreeUsd?: number
  totalUsd?: number
  shippingPlantSize?: string
  ciderFlavorProfile?: string
  fireBlightSusceptibility?: string
  appleScabSusceptibility?: string
  otherDiseaseNotes?: string
  biennialTendency?: string
  biennialManagement?: string
  bloomGroupTiming?: string
  storagePotential?: string
  quantity: number
  matureHeightFt?: number
  matureWidthFt?: number
  matureSizeText?: string
  rootstock?: string
  sizeClass?: 'small' | 'medium' | 'large'
  coldHardiness?: string
  ripeningWindow?: string
  pollinationNotes?: string
  diseaseNotes?: string
  orchardNotes?: string
  activePlantingInventory?: boolean
  placeholderOnly?: boolean
  sourceRefs?: string[]
}

export interface PrototypeLayoutZone {
  zoneId: string
  cropType: string
  labelFromPlan: string
  plannedCount: number | null
  relativePosition: string
  placeholderOnly?: boolean
  notes?: string[]
}

export interface PrototypeLayoutRow {
  rowId: string
  type: string
  side: string
  zonesTopToBottom: PrototypeLayoutZone[]
}

export interface PrototypeOrchardBlock {
  rowCount: number
  orientation: string
  notes: string[]
}

export interface PrototypeZoneLayout {
  layoutType: string
  sourceNote: string
  orchardBlock: PrototypeOrchardBlock
  rows: PrototypeLayoutRow[]
  placementRulesFromPrototype: string[]
  importantWarnings: string[]
}
