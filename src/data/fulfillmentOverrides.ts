import type { TreeFulfillment } from '../types'

/** Missing from main shipment; replacement stock in transit (blue in-transit tag). */
const missingInTransit: Partial<TreeFulfillment> = {
  received: false,
  missing: true,
  replacementConfirmed: false,
  inTransit: true,
  readyToPlant: false,
  expectedArrival: 'Monday, April 13, 2026',
  shipmentGroup: 'Roots to Fruits — replacement in transit',
  orderSource: 'Roots to Fruits Nursery',
  notes: 'Missing from main shipment; replacement in transit.',
}

const fedcoInTransit: Partial<TreeFulfillment> = {
  received: false,
  missing: false,
  replacementConfirmed: false,
  inTransit: true,
  readyToPlant: false,
  orderSource: 'Fedco Seeds',
  shipmentGroup: 'Fedco Seeds — separate order',
  notes: 'In transit from Fedco Seeds. Not missing from Roots to Fruits — different supplier.',
}

const priscillaSeparateOrder: Partial<TreeFulfillment> = {
  received: false,
  missing: false,
  replacementConfirmed: false,
  inTransit: true,
  readyToPlant: false,
  orderSource: 'Separate order',
  shipmentGroup: 'Separate order — in transit',
  notes: 'Priscilla apples in transit on a separate order.',
}

/** Per tree instance id — merged onto defaults after layout is applied. */
export const FULFILLMENT_OVERRIDES_BY_TREE_ID: Record<string, Partial<TreeFulfillment>> = {
  'cider-liberty-1': { ...missingInTransit },
  'cider-liberty-2': { ...missingInTransit },
  'cider-liberty-3': { ...missingInTransit },
  'cider-liberty-4': { ...missingInTransit },
  'cider-liberty-5': { ...missingInTransit },
  'eat-cortland-1': { ...missingInTransit },
  'eat-cortland-2': { ...missingInTransit },
  'eat-cortland-3': { ...missingInTransit },
  'pear-harrowsweet-1': { ...missingInTransit },
  'pear-harrowsweet-2': { ...missingInTransit },
  'peach-reliance-1': { ...missingInTransit },
  'peach-reliance-2': { ...missingInTransit },
  'eat-zestar-1': { ...fedcoInTransit },
  'eat-zestar-2': { ...fedcoInTransit },
  'eat-zestar-3': { ...fedcoInTransit },
  'cider-priscilla-1': { ...priscillaSeparateOrder },
  'cider-priscilla-2': { ...priscillaSeparateOrder },
}
