import type { PlantingSpot, Tree } from '../types'

/**
 * Effective crown extent (ft) for in-row spacing: the largest of mature spread,
 * mature height, and the same height→spread heuristic as import (~0.75× height, min 10).
 * So a pair uses max(tree A extent, tree B extent), matching “size up to the larger tree.”
 */
export function crownDiameterFtForSpacing(tree: Tree): number | null {
  const candidates: number[] = []
  const w = tree.matureWidthFt
  if (w != null && Number.isFinite(w) && w > 0) {
    candidates.push(w)
  }
  const h = tree.matureHeightFt
  if (h != null && Number.isFinite(h) && h > 0) {
    candidates.push(h)
    candidates.push(Math.max(10, Math.round(h * 0.75)))
  }
  if (candidates.length === 0) {
    return null
  }
  return Math.max(...candidates)
}

export interface RowSpacingPair {
  fromSpotId: string
  toSpotId: string
  gapFt: number | null
  unknown: boolean
}

export interface RowSpacingMetrics {
  pairs: RowSpacingPair[]
  /** Sum of known gaps only (excludes pairs with missing diameter). */
  totalKnownFt: number
  hasUnknownPair: boolean
}

export interface SpotFeetFromRowStart {
  /** Sum of known segment gaps from the first spot along row order. */
  feetFromRowStart: number
  /** Some segment before this spot had missing crown data; total omits those gaps. */
  partial: boolean
}

function gapBetweenConsecutiveSpots(
  spotA: PlantingSpot,
  spotB: PlantingSpot,
  treeById: Map<string, Tree>,
): { gapFt: number | null; unknown: boolean } {
  const tA = spotA.currentTreeId ? (treeById.get(spotA.currentTreeId) ?? null) : null
  const tB = spotB.currentTreeId ? (treeById.get(spotB.currentTreeId) ?? null) : null
  if (!tA && !tB) {
    return { gapFt: 0, unknown: false }
  }
  const dA = tA ? crownDiameterFtForSpacing(tA) : null
  const dB = tB ? crownDiameterFtForSpacing(tB) : null
  if (tA && tB) {
    if (dA == null || dB == null) {
      return { gapFt: null, unknown: true }
    }
    return { gapFt: Math.max(dA, dB), unknown: false }
  }
  const d = dA ?? dB
  if (d == null) {
    return { gapFt: null, unknown: true }
  }
  return { gapFt: d, unknown: false }
}

/**
 * Cumulative distance (ft) from the start of the row (first spot in `rowSpotIds`) along slot order.
 */
export function computeFeetFromRowStartBySpotId(
  rowSpotIds: string[],
  spotById: Map<string, PlantingSpot>,
  treeById: Map<string, Tree>,
): Map<string, SpotFeetFromRowStart> {
  const out = new Map<string, SpotFeetFromRowStart>()
  if (rowSpotIds.length === 0) {
    return out
  }

  let cum = 0
  let partial = false
  out.set(rowSpotIds[0], { feetFromRowStart: 0, partial: false })

  for (let i = 0; i < rowSpotIds.length - 1; i++) {
    const a = spotById.get(rowSpotIds[i])
    const b = spotById.get(rowSpotIds[i + 1])
    const nextId = rowSpotIds[i + 1]
    if (!a || !b) {
      partial = true
      out.set(nextId, { feetFromRowStart: cum, partial })
      continue
    }
    const { gapFt, unknown } = gapBetweenConsecutiveSpots(a, b, treeById)
    if (unknown) {
      partial = true
    } else if (gapFt != null) {
      cum += gapFt
    }
    out.set(nextId, { feetFromRowStart: cum, partial })
  }

  return out
}

/**
 * Consecutive occupied spots along row order (spotIds). Gap = max(diameter A, diameter B).
 */
export function computeRowSpacingMetrics(
  rowSpotIds: string[],
  spotById: Map<string, PlantingSpot>,
  treeById: Map<string, Tree>,
): RowSpacingMetrics {
  const pairs: RowSpacingPair[] = []
  let prevSpotId: string | null = null
  let prevTree: Tree | null = null

  for (const spotId of rowSpotIds) {
    const spot = spotById.get(spotId)
    if (!spot?.currentTreeId) {
      continue
    }
    const tree = treeById.get(spot.currentTreeId)
    if (!tree) {
      continue
    }

    if (prevTree != null && prevSpotId != null) {
      const d1 = crownDiameterFtForSpacing(prevTree)
      const d2 = crownDiameterFtForSpacing(tree)
      const unknown = d1 == null || d2 == null
      const gapFt = unknown ? null : Math.max(d1!, d2!)
      pairs.push({ fromSpotId: prevSpotId, toSpotId: spotId, gapFt, unknown })
    }
    prevSpotId = spotId
    prevTree = tree
  }

  let totalKnownFt = 0
  let hasUnknownPair = false
  for (const p of pairs) {
    if (p.unknown || p.gapFt == null) {
      hasUnknownPair = true
      continue
    }
    totalKnownFt += p.gapFt
  }

  return { pairs, totalKnownFt, hasUnknownPair }
}
