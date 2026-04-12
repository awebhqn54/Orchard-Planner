import type { Tree, TreeFulfillment } from '../types'
import { FULFILLMENT_OVERRIDES_BY_TREE_ID } from '../data/fulfillmentOverrides'
import type { NormalizedOrchardData } from '../types'

export type FulfillmentVisualKind = 'received' | 'missing_replacement' | 'in_transit' | 'future_placeholder'

export function defaultFulfillmentFromRecord(supplier: string | undefined): TreeFulfillment {
  return {
    ordered: true,
    received: true,
    missing: false,
    replacementConfirmed: false,
    inTransit: false,
    readyToPlant: true,
    orderSource: supplier,
    shipmentGroup: supplier ? `${supplier} — received` : 'Received',
  }
}

export function mergeFulfillment(base: TreeFulfillment, patch: Partial<TreeFulfillment>): TreeFulfillment {
  return { ...base, ...patch }
}

export function applyFulfillmentOverrides(data: NormalizedOrchardData): NormalizedOrchardData {
  const next = structuredClone(data) as NormalizedOrchardData
  for (const tree of next.trees) {
    const ov = FULFILLMENT_OVERRIDES_BY_TREE_ID[tree.id]
    if (ov) {
      tree.fulfillment = mergeFulfillment(tree.fulfillment, ov)
    }
  }
  return next
}

export function fulfillmentVisualKind(tree: Tree): FulfillmentVisualKind {
  if (tree.placeholderOnly) {
    return 'future_placeholder'
  }
  const f = tree.fulfillment
  if (f.missing && f.replacementConfirmed) {
    return 'missing_replacement'
  }
  if (f.inTransit) {
    return 'in_transit'
  }
  return 'received'
}

/** Short uppercase chip label; null = no pill (received & ready). */
export function fulfillmentPillModifierClass(kind: FulfillmentVisualKind): string {
  switch (kind) {
    case 'in_transit':
      return 'tree-chip-fulfillment-pill--in-transit'
    case 'missing_replacement':
      return 'tree-chip-fulfillment-pill--missing'
    case 'future_placeholder':
      return 'tree-chip-fulfillment-pill--future'
    default:
      return 'tree-chip-fulfillment-pill--not-ready'
  }
}

export function fulfillmentChipPillText(tree: Tree): string | null {
  const kind = fulfillmentVisualKind(tree)
  const f = tree.fulfillment
  if (kind === 'received' && f.readyToPlant) {
    return null
  }
  switch (kind) {
    case 'future_placeholder':
      return 'Future'
    case 'missing_replacement':
      return 'Missing — replacement'
    case 'in_transit':
      if (f.missing && !f.replacementConfirmed) {
        return 'Missing — in transit'
      }
      return 'In transit'
    default:
      return f.readyToPlant ? null : 'Not ready'
  }
}

export function fulfillmentTooltipSummary(tree: Tree): string {
  const f = tree.fulfillment
  const parts: string[] = []
  if (f.orderSource) {
    parts.push(`Source: ${f.orderSource}`)
  }
  if (f.shipmentGroup) {
    parts.push(`Shipment: ${f.shipmentGroup}`)
  }
  if (f.missing && f.inTransit && !f.replacementConfirmed) {
    parts.push('Missing from shipment; replacement in transit.')
  } else if (f.missing && f.replacementConfirmed) {
    parts.push('Missing from original shipment; replacement confirmed.')
  } else if (f.inTransit) {
    parts.push('In transit.')
  }
  if (f.expectedArrival) {
    parts.push(`Expected: ${f.expectedArrival}`)
  }
  parts.push(f.readyToPlant ? 'Ready to plant now.' : 'Not yet available to plant.')
  if (f.notes) {
    parts.push(f.notes)
  }
  return parts.join(' ')
}

