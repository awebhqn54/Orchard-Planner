import type { NormalizedOrchardData, PlantingSpot, Tree } from '../types'
import { finalizeLayoutState } from './placementEngine'

export const LAYOUT_STORAGE_KEY = 'orchard-planner-saved-layout-v1'

export interface SavedLayoutV1 {
  version: 1
  savedAt: string
  spotsPerRow: number
  /** Each spot’s current tree assignment (null = empty). */
  spotToTreeId: Record<string, string | null>
}

export function captureLayoutSnapshot(data: NormalizedOrchardData): SavedLayoutV1 {
  const spotToTreeId: Record<string, string | null> = {}
  for (const spot of data.plantingSpots) {
    spotToTreeId[spot.id] = spot.currentTreeId
  }
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    spotsPerRow: data.orchardConfig.spotsPerRow,
    spotToTreeId,
  }
}

function clearAssignments(next: NormalizedOrchardData) {
  for (const spot of next.plantingSpots) {
    spot.currentTreeId = null
    spot.recommendedTreeId = null
  }

  for (const tree of next.trees) {
    if (tree.currentSpotId) {
      tree.currentSpotId = null
      tree.recommendedSpotId = null
      tree.placement = {
        treeId: tree.id,
        spotId: null,
        rowId: null,
        rowNumber: null,
        columnIndex: null,
        status: 'holding',
      }
    }
  }
}

function updateTreePlacement(tree: Tree, spot: PlantingSpot | null) {
  tree.currentSpotId = spot?.id ?? null
  tree.placement = {
    treeId: tree.id,
    spotId: spot?.id ?? null,
    rowId: spot?.rowId ?? null,
    rowNumber: spot?.rowNumber ?? null,
    columnIndex: spot?.columnIndex ?? null,
    status: spot ? 'assigned' : 'holding',
  }
  tree.manualOverride = {
    isManualOverride: tree.currentSpotId !== tree.recommendedSpotId,
    overriddenAt: tree.currentSpotId !== tree.recommendedSpotId ? new Date().toISOString() : undefined,
    previousSpotId: tree.recommendedSpotId,
  }
}

/**
 * Apply a saved snapshot onto the current normalized orchard (same spotsPerRow).
 * Does not re-run auto-placement; only restores spot ↔ tree links.
 */
export function applyLayoutSnapshot(base: NormalizedOrchardData, saved: SavedLayoutV1): NormalizedOrchardData {
  if (saved.spotsPerRow !== base.orchardConfig.spotsPerRow) {
    throw new Error(
      `Saved layout uses ${saved.spotsPerRow} spots per row; current plan has ${base.orchardConfig.spotsPerRow}. Import inventory or rerun placement first.`,
    )
  }

  const next = structuredClone(base) as NormalizedOrchardData
  const spotById = new Map(next.plantingSpots.map((s) => [s.id, s]))
  const treeById = new Map(next.trees.map((t) => [t.id, t]))

  clearAssignments(next)

  const usedTrees = new Set<string>()

  for (const [spotId, treeId] of Object.entries(saved.spotToTreeId)) {
    if (!treeId) {
      continue
    }

    const spot = spotById.get(spotId)
    const tree = treeById.get(treeId)
    if (!spot || !tree) {
      continue
    }

    spot.currentTreeId = tree.id
    spot.recommendedTreeId = tree.id
    updateTreePlacement(tree, spot)
    usedTrees.add(tree.id)
  }

  for (const tree of next.trees) {
    if (!usedTrees.has(tree.id) && tree.currentSpotId) {
      updateTreePlacement(tree, null)
    }
  }

  return finalizeLayoutState(next)
}

export function parseLayoutJson(text: string): SavedLayoutV1 {
  const raw = JSON.parse(text) as unknown
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid layout file.')
  }

  const obj = raw as Record<string, unknown>
  if (obj.version !== 1 || obj.spotToTreeId === undefined || typeof obj.spotsPerRow !== 'number') {
    throw new Error('Unsupported layout format (expected version 1).')
  }

  return {
    version: 1,
    savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : new Date().toISOString(),
    spotsPerRow: obj.spotsPerRow,
    spotToTreeId: obj.spotToTreeId as Record<string, string | null>,
  }
}

export function downloadLayoutFile(snapshot: SavedLayoutV1, filename = 'orchard-layout.json') {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
