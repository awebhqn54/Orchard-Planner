import type {
  NormalizedOrchardData,
  OrchardRow,
  OrchardZone,
  PlantingSpot,
  PlacementExplanation,
  PlacementReason,
  PlacementWarning,
  SourceConflict,
  SourceDocument,
  Tree,
  TreeSeedRecord,
} from '../types'
import { deliveryStatusForSourceRecordId } from './treeDeliveryStatus'

/**
 * Spacing along the row axis from the fence (ft): 24' fence→Row 1, then alternating 18'/24' between rows.
 * Seven segments for seven row lines; no trailing segment past Row 7.
 */
export const ROW_SPACING_SEGMENTS_FT = [24, 18, 24, 18, 24, 18, 24] as const

function cumulativeOffsetsFromSpacingSegments(segments: readonly number[]): number[] {
  let acc = 0
  return segments.map((segment) => {
    acc += segment
    return acc
  })
}

/** Cumulative distance from fence to each row line (R1…R7). */
const ROW_OFFSETS_FEET = cumulativeOffsetsFromSpacingSegments(ROW_SPACING_SEGMENTS_FT)

function padSpotNumber(value: number) {
  return String(value).padStart(2, '0')
}

function expandInventory(records: TreeSeedRecord[]) {
  return records.flatMap((record) =>
    Array.from({ length: record.quantity }, (_, index) => {
      const treeId = `${record.id}-${index + 1}`
      const sizeClass =
        record.sizeClass ??
        (record.matureHeightFt && record.matureHeightFt >= 17
          ? 'large'
          : record.matureHeightFt && record.matureHeightFt <= 13
            ? 'small'
            : 'medium')

      const emptyExplanation: PlacementExplanation = {
        zoneId: 'unassigned',
        summary: 'Waiting for placement.',
        reasons: [],
        ruleTrace: [],
      }

      return {
        id: treeId,
        sourceRecordId: record.id,
        varietyName: record.varietyName,
        species: record.species,
        orchardSection: record.orchardSection,
        orchardSectionSpreadsheet: record.orchardSectionSpreadsheet,
        orchardRoleCategory: record.orchardRoleCategory,
        supplierGroup: record.supplierGroup,
        supplier: record.supplier,
        link: record.link,
        isStandard: record.isStandard,
        costPerTreeUsd: record.costPerTreeUsd,
        totalUsd: record.totalUsd,
        shippingPlantSize: record.shippingPlantSize,
        ciderFlavorProfile: record.ciderFlavorProfile,
        fireBlightSusceptibility: record.fireBlightSusceptibility,
        appleScabSusceptibility: record.appleScabSusceptibility,
        otherDiseaseNotes: record.otherDiseaseNotes,
        biennialTendency: record.biennialTendency,
        biennialManagement: record.biennialManagement,
        bloomGroupTiming: record.bloomGroupTiming,
        storagePotential: record.storagePotential,
        quantity: 1,
        batchQuantity: record.quantity,
        matureHeightFt: record.matureHeightFt,
        matureWidthFt: record.matureWidthFt,
        matureSizeText: record.matureSizeText,
        rootstock: record.rootstock,
        sizeClass,
        coldHardiness: record.coldHardiness,
        ripeningWindow: record.ripeningWindow,
        pollinationNotes: record.pollinationNotes,
        diseaseNotes: record.diseaseNotes,
        orchardNotes: record.orchardNotes,
        recommendedSpotId: null,
        currentSpotId: null,
        placement: {
          treeId,
          spotId: null,
          rowId: null,
          rowNumber: null,
          columnIndex: null,
          status: 'unassigned',
        },
        manualOverride: {
          isManualOverride: false,
        },
        placementExplanation: emptyExplanation,
        activePlantingInventory: record.activePlantingInventory ?? !record.placeholderOnly,
        placeholderOnly: Boolean(record.placeholderOnly),
        sourceRefs: record.sourceRefs ?? [],
        deliveryStatus: deliveryStatusForSourceRecordId(record.id),
      } satisfies Tree
    }),
  )
}

function computeSpotsPerRow(trees: Tree[]): number {
  return Math.max(16, Math.ceil(trees.length / 5))
}

export interface ZoneLayoutParams {
  w: number
  persimmonCols: number
}

export function computeZoneLayout(w: number): ZoneLayoutParams {
  return {
    w,
    // Keep this field for compatibility, but persimmons are no longer reserved.
    persimmonCols: 0,
  }
}

function buildMinimalOrchardZones(spotsPerRow: number): OrchardZone[] {
  return [
    {
      id: 'orchard-grid',
      label: 'Planting grid',
      description: 'All spots are active and movable for all tree types, including persimmons.',
      rowRange: [1, ROW_OFFSETS_FEET.length],
      columnRange: [1, spotsPerRow],
      purpose: 'General tree layout.',
      accepts: ['Apple', 'Pear', 'Plum', 'Sweet Cherry', 'Tart Cherry', 'Peach', 'Apricot', 'Persimmon'],
    },
  ]
}

function determineSpotZone(rowNumber: number, columnIndex: number, params: ZoneLayoutParams): { zoneId: string; kind: 'active' | 'placeholder' } {
  void rowNumber
  void columnIndex
  void params
  return { zoneId: 'orchard-grid', kind: 'active' }
}

function buildRowsAndSpots(spotsPerRow: number) {
  const zoneParams = computeZoneLayout(spotsPerRow)
  const orchardZones = buildMinimalOrchardZones(spotsPerRow)
  const orchardRows: OrchardRow[] = []
  const plantingSpots: PlantingSpot[] = []

  ROW_OFFSETS_FEET.forEach((offsetFeetFromFence, rowIndex) => {
    const rowNumber = rowIndex + 1
    const rowId = `R${rowNumber}`
    const spotIds: string[] = []

    for (let columnIndex = 1; columnIndex <= spotsPerRow; columnIndex += 1) {
      const spotId = `${rowId}-${padSpotNumber(columnIndex)}`
      const { zoneId, kind } = determineSpotZone(rowNumber, columnIndex, zoneParams)

      spotIds.push(spotId)
      plantingSpots.push({
        id: spotId,
        rowId,
        rowNumber,
        columnIndex,
        kind,
        zoneId,
        offsetFeetFromFence,
        recommendedTreeId: null,
        currentTreeId: null,
      })
    }

    orchardRows.push({
      id: rowId,
      rowNumber,
      label: `Row ${rowNumber}`,
      offsetFeetFromFence,
      spotIds,
    })
  })

  return { orchardRows, plantingSpots, orchardZones }
}

function sortSpotsRowMajor(spots: PlantingSpot[]) {
  return [...spots].sort((a, b) => a.rowNumber - b.rowNumber || a.columnIndex - b.columnIndex)
}

function sortTreesDeterministic(trees: Tree[]): Tree[] {
  return [...trees].sort((a, b) => {
    const src = a.sourceRecordId.localeCompare(b.sourceRecordId)
    if (src !== 0) {
      return src
    }
    const v = a.varietyName.localeCompare(b.varietyName)
    if (v !== 0) {
      return v
    }
    return a.id.localeCompare(b.id)
  })
}

function lower(value: string | undefined): string {
  return (value ?? '').toLowerCase()
}

function isPeach(tree: Tree) {
  return lower(tree.species) === 'peach'
}

function isApricot(tree: Tree) {
  return lower(tree.species) === 'apricot'
}

function isPlum(tree: Tree) {
  return lower(tree.species) === 'plum'
}

function isCherry(tree: Tree) {
  return lower(tree.species).includes('cherry')
}

function isApple(tree: Tree) {
  return lower(tree.species) === 'apple'
}

function isCiderApple(tree: Tree) {
  return isApple(tree) && lower(tree.orchardSection).includes('cider')
}

function isLargeStandardApple(tree: Tree) {
  if (!isApple(tree)) {
    return false
  }
  return (
    Boolean(tree.isStandard) ||
    lower(tree.matureSizeText).includes('standard') ||
    tree.sizeClass === 'large' ||
    (tree.matureHeightFt ?? 0) >= 17
  )
}

function takeFromColumn(
  columns: Map<number, PlantingSpot[]>,
  cursors: Map<number, number>,
  rowNumber: number,
  count: number,
): PlantingSpot[] {
  const col = columns.get(rowNumber) ?? []
  const start = cursors.get(rowNumber) ?? 0
  const end = Math.min(col.length, start + count)
  cursors.set(rowNumber, end)
  return col.slice(start, end)
}

function buildPreferredActiveSpotOrder(activeSpots: PlantingSpot[]) {
  const columns = new Map<number, PlantingSpot[]>()
  for (let rowNumber = 1; rowNumber <= 5; rowNumber += 1) {
    const spots = activeSpots
      .filter((spot) => spot.rowNumber === rowNumber)
      .sort((a, b) => a.columnIndex - b.columnIndex)
    columns.set(rowNumber, spots)
  }

  const cursors = new Map<number, number>([
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
  ])

  const peachSlots = [...takeFromColumn(columns, cursors, 1, 3), ...takeFromColumn(columns, cursors, 2, 3)]
  const apricotSlots = [...takeFromColumn(columns, cursors, 1, 2), ...takeFromColumn(columns, cursors, 2, 2)]
  const plumSlots = [...takeFromColumn(columns, cursors, 1, 3), ...takeFromColumn(columns, cursors, 2, 3)]
  const cherrySlots = [...takeFromColumn(columns, cursors, 1, 4), ...takeFromColumn(columns, cursors, 2, 4)]

  const col1 = columns.get(1) ?? []
  const col2 = columns.get(2) ?? []
  const col3 = columns.get(3) ?? []
  const col4 = columns.get(4) ?? []
  const col5 = columns.get(5) ?? []

  const col1Remaining = col1.slice(cursors.get(1) ?? 0)
  const col2Remaining = col2.slice(cursors.get(2) ?? 0)
  const col3Split = Math.max(1, Math.ceil(col3.length / 2))
  const col3TopHalf = col3.slice(0, col3Split)
  const col3BottomHalf = col3.slice(col3Split)

  const nonCiderAppleSlots = [...col1Remaining, ...col2Remaining, ...col3TopHalf]
  const ciderAppleSlots = [...col3BottomHalf, ...col4, ...col5]
  const farRightAppleSlots = [...col5]

  return {
    peachSlots,
    apricotSlots,
    plumSlots,
    cherrySlots,
    nonCiderAppleSlots,
    ciderAppleSlots,
    farRightAppleSlots,
  }
}

function buildExplanation(tree: Tree, spot: PlantingSpot, phaseLabel: string): PlacementExplanation {
  const reasons: PlacementReason[] = [
    {
      code: 'manual-start-layout',
      label: 'Placed by requested start layout',
      detail: phaseLabel,
      weight: 5,
    },
  ]

  if (tree.batchQuantity > 1) {
    reasons.push({
      code: 'grouped-variety',
      label: 'Grouped with same variety',
      detail: `${tree.varietyName} copies are listed together by inventory order.`,
      weight: 4,
    })
  }

  return {
    zoneId: spot.zoneId,
    summary: `${tree.varietyName} is placed at ${spot.id} using your requested starter pattern.`,
    reasons,
    ruleTrace: [
      'Peach/apricot/plum/cherry blocks are anchored at the top of columns 1 and 2.',
      'Non-cider apples fill the lower portions of columns 1 and 2, then move into column 3.',
      'Cider apples shift to the right side, with largest standard apples prioritized in the far-right column.',
      'All tree types, including persimmons, are movable and use the same active spot grid.',
    ],
  }
}

function assignTreeToSpot(
  tree: Tree,
  spot: PlantingSpot,
  plantingSpots: PlantingSpot[],
  phaseLabel: string,
): void {
  const spotRef = plantingSpots.find((item) => item.id === spot.id)
  if (!spotRef) {
    return
  }

  spotRef.recommendedTreeId = tree.id
  spotRef.currentTreeId = tree.id

  tree.recommendedSpotId = spotRef.id
  tree.currentSpotId = spotRef.id
  tree.placement = {
    treeId: tree.id,
    spotId: spotRef.id,
    rowId: spotRef.rowId,
    rowNumber: spotRef.rowNumber,
    columnIndex: spotRef.columnIndex,
    status: 'assigned',
  }
  tree.placementExplanation = buildExplanation(tree, spotRef, phaseLabel)
}

function markTreeHolding(tree: Tree) {
  tree.placement = {
    treeId: tree.id,
    spotId: null,
    rowId: null,
    rowNumber: null,
    columnIndex: null,
    status: 'holding',
  }
  tree.currentSpotId = null
  tree.recommendedSpotId = null
  tree.placementExplanation = {
    zoneId: 'holding',
    summary: `${tree.varietyName} could not be placed: not enough compatible spots in the current grid.`,
    reasons: [
      {
        code: 'no-compatible-spot',
        label: 'No compatible spot was available',
        detail: 'Increase inventory column width or reduce counts.',
        weight: 5,
      },
    ],
    ruleTrace: ['Placement follows the configured starter blocks and falls back to the next open compatible spot.'],
  }
}

function assignGroupToPreferredSpots(
  trees: Tree[],
  preferred: PlantingSpot[],
  allActiveSpots: PlantingSpot[],
  usedSpotIds: Set<string>,
  plantingSpots: PlantingSpot[],
  stagingTreeIds: string[],
  phaseLabel: string,
) {
  const preferredQueue = [...preferred]
  const fallbackQueue = [...allActiveSpots]

  const takeNextAvailable = (queue: PlantingSpot[]) => {
    while (queue.length > 0) {
      const next = queue.shift()!
      if (!usedSpotIds.has(next.id)) {
        return next
      }
    }
    return null
  }

  for (const tree of sortTreesDeterministic(trees)) {
    const spot = takeNextAvailable(preferredQueue) ?? takeNextAvailable(fallbackQueue)
    if (!spot) {
      markTreeHolding(tree)
      stagingTreeIds.push(tree.id)
      continue
    }
    usedSpotIds.add(spot.id)
    assignTreeToSpot(tree, spot, plantingSpots, phaseLabel)
  }
}

export function createPlacementWarnings(spots: PlantingSpot[], trees: Tree[]) {
  const warnings: PlacementWarning[] = []
  const treeById = new Map(trees.map((tree) => [tree.id, tree]))

  const rows = new Map<number, PlantingSpot[]>()
  spots.forEach((spot) => {
    const rowSpots = rows.get(spot.rowNumber) ?? []
    rowSpots.push(spot)
    rows.set(spot.rowNumber, rowSpots)
  })

  rows.forEach((rowSpots, rowNumber) => {
    const sorted = rowSpots.sort((left, right) => left.columnIndex - right.columnIndex)

    for (let index = 1; index < sorted.length; index += 1) {
      const previousTreeId = sorted[index - 1]!.currentTreeId
      const currentTreeId = sorted[index]!.currentTreeId
      if (!previousTreeId || !currentTreeId) {
        continue
      }

      const leftTree = treeById.get(previousTreeId)
      const rightTree = treeById.get(currentTreeId)
      if (!leftTree || !rightTree) {
        continue
      }

      const heightGap = Math.abs((leftTree.matureHeightFt ?? 0) - (rightTree.matureHeightFt ?? 0))
      if (heightGap >= 6) {
        warnings.push({
          id: `row-${rowNumber}-height-gap-${index}`,
          severity: 'warning',
          summary: `Large height jump inside Row ${rowNumber}.`,
          detail: `${leftTree.varietyName} and ${rightTree.varietyName} differ by about ${heightGap} feet in mature height.`,
        })
      }
    }
  })

  const stagingTrees = trees.filter((tree) => !tree.currentSpotId && tree.activePlantingInventory)
  if (stagingTrees.length) {
    warnings.push({
      id: 'staging-overflow',
      severity: 'warning',
      summary: 'Some active trees remain unassigned.',
      detail: `${stagingTrees.length} active trees are not placed on a planting spot because no compatible spot was available.`,
    })
  }

  return warnings
}

/** Recompute staging ids and warnings after manual edits or applying a saved layout. */
export function finalizeLayoutState(data: NormalizedOrchardData): NormalizedOrchardData {
  const next = structuredClone(data) as NormalizedOrchardData
  next.stagingTreeIds = next.trees.filter((item) => !item.currentSpotId).map((item) => item.id)
  next.placementWarnings = createPlacementWarnings(next.plantingSpots, next.trees)
  return next
}

export function buildNormalizedOrchardData(args: {
  inventoryRecords: TreeSeedRecord[]
  inactiveInventoryRecords: TreeSeedRecord[]
  sourceDocuments: SourceDocument[]
  sourceConflicts: SourceConflict[]
  placementAssumptions: string[]
}): NormalizedOrchardData {
  const trees = expandInventory(args.inventoryRecords)
  const spotsPerRow = computeSpotsPerRow(trees)
  const { orchardRows, plantingSpots, orchardZones } = buildRowsAndSpots(spotsPerRow)
  const stagingTreeIds: string[] = []
  const activeSpots = sortSpotsRowMajor(plantingSpots.filter((s) => s.kind === 'active'))
  const usedSpotIds = new Set<string>()

  const preferred = buildPreferredActiveSpotOrder(activeSpots)

  const peaches = trees.filter(isPeach)
  const apricots = trees.filter(isApricot)
  const plums = trees.filter(isPlum)
  const cherries = trees.filter(isCherry)
  const ciderLargeStandardApples = trees.filter((tree) => isCiderApple(tree) && isLargeStandardApple(tree))
  const nonCiderApples = trees.filter((tree) => isApple(tree) && !isCiderApple(tree))
  const ciderApplesOther = trees.filter((tree) => isCiderApple(tree) && !isLargeStandardApple(tree))

  const classifiedIds = new Set<string>(
    [...peaches, ...apricots, ...plums, ...cherries, ...nonCiderApples, ...ciderLargeStandardApples, ...ciderApplesOther].map(
      (t) => t.id,
    ),
  )
  const otherTrees = trees.filter((tree) => !classifiedIds.has(tree.id))

  assignGroupToPreferredSpots(
    peaches,
    preferred.peachSlots,
    activeSpots,
    usedSpotIds,
    plantingSpots,
    stagingTreeIds,
    'Peaches are anchored at the top of columns 1 and 2 (about three each).',
  )
  assignGroupToPreferredSpots(
    apricots,
    preferred.apricotSlots,
    activeSpots,
    usedSpotIds,
    plantingSpots,
    stagingTreeIds,
    'Apricots are placed below peaches in columns 1 and 2.',
  )
  assignGroupToPreferredSpots(
    plums,
    preferred.plumSlots,
    activeSpots,
    usedSpotIds,
    plantingSpots,
    stagingTreeIds,
    'Plums are placed below apricots in columns 1 and 2.',
  )
  assignGroupToPreferredSpots(
    cherries,
    preferred.cherrySlots,
    activeSpots,
    usedSpotIds,
    plantingSpots,
    stagingTreeIds,
    'Cherries are placed below plums in columns 1 and 2.',
  )
  assignGroupToPreferredSpots(
    nonCiderApples,
    preferred.nonCiderAppleSlots,
    activeSpots,
    usedSpotIds,
    plantingSpots,
    stagingTreeIds,
    'Non-cider apples fill lower columns 1 and 2, then continue through column 3.',
  )
  assignGroupToPreferredSpots(
    otherTrees,
    preferred.nonCiderAppleSlots,
    activeSpots,
    usedSpotIds,
    plantingSpots,
    stagingTreeIds,
    'Other non-cider trees use open slots after the left-column priority blocks.',
  )
  assignGroupToPreferredSpots(
    ciderLargeStandardApples,
    preferred.farRightAppleSlots,
    activeSpots,
    usedSpotIds,
    plantingSpots,
    stagingTreeIds,
    'Largest standard cider apples are prioritized into the far-right column.',
  )
  assignGroupToPreferredSpots(
    ciderApplesOther,
    preferred.ciderAppleSlots,
    activeSpots,
    usedSpotIds,
    plantingSpots,
    stagingTreeIds,
    'Remaining cider apples fill the right side, including lower column 3 and later columns.',
  )

  return {
    sourceDocuments: args.sourceDocuments,
    sourceConflicts: args.sourceConflicts,
    placementAssumptions: args.placementAssumptions,
    orchardConfig: {
      rowOffsetsFeet: ROW_OFFSETS_FEET,
      rowCount: ROW_OFFSETS_FEET.length,
      spotsPerRow,
    },
    orchardRows,
    orchardZones,
    plantingSpots,
    trees,
    inactiveInventoryRecords: args.inactiveInventoryRecords,
    stagingTreeIds,
    placementWarnings: createPlacementWarnings(plantingSpots, trees),
  }
}
