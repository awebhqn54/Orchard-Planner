import type { TreeDeliveryStatus } from '../types'

/** Per–source-record overrides; default is on-site (picked up). */
const DELIVERY_BY_SOURCE_RECORD_ID: Partial<Record<string, TreeDeliveryStatus>> = {
  'cider-priscilla': 'in-transit',
}

/** Expected arrival for in-transit inventory (detail panel / tooltips). */
const IN_TRANSIT_ARRIVAL: Partial<Record<string, { detail: string }>> = {
  'cider-priscilla': { detail: 'April 14' },
}

export function deliveryStatusForSourceRecordId(sourceRecordId: string): TreeDeliveryStatus {
  return DELIVERY_BY_SOURCE_RECORD_ID[sourceRecordId] ?? 'on-site'
}

/** Prefer `tree.deliveryStatus`; fall back to source record (handles older clones / imports). */
export function resolveDeliveryStatus(tree: {
  deliveryStatus?: TreeDeliveryStatus
  sourceRecordId: string
}): TreeDeliveryStatus {
  return tree.deliveryStatus ?? deliveryStatusForSourceRecordId(tree.sourceRecordId)
}

/** Map chip: only in-transit trees get a line (no default “on site” tag). */
export function deliveryStatusChipLine(_sourceRecordId: string, status: TreeDeliveryStatus): string | null {
  if (status !== 'in-transit') {
    return null
  }
  return 'In transit'
}

export function deliveryStatusLabel(status: TreeDeliveryStatus, sourceRecordId?: string): string {
  if (status === 'in-transit') {
    const arrival = sourceRecordId ? IN_TRANSIT_ARRIVAL[sourceRecordId] : undefined
    return arrival
      ? `In transit — due ${arrival.detail} (not on site yet)`
      : 'In transit — not on site yet'
  }
  return 'On site — picked up'
}
