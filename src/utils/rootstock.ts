/** True when there is no confirmed horticultural rootstock identifier on the tree/record. */
export function isRootstockCodeMissing(entity: { rootstockCode?: string }): boolean {
  return !String(entity.rootstockCode ?? '').trim()
}
