import type { NormalizedOrchardData } from '../types'

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function exportSpotAssignments(data: NormalizedOrchardData) {
  const treeById = new Map(data.trees.map((tree) => [tree.id, tree]))
  const rows = [
    ['spotId', 'row', 'column', 'zone', 'kind', 'treeId', 'variety', 'species', 'currentPlacement'].join(','),
    ...data.plantingSpots.map((spot) => {
      const tree = spot.currentTreeId ? treeById.get(spot.currentTreeId) : undefined
      return [
        spot.id,
        spot.rowNumber,
        spot.columnIndex,
        spot.zoneId,
        spot.kind,
        tree?.id ?? '',
        tree?.varietyName ?? '',
        tree?.species ?? '',
        tree ? 'assigned' : 'empty',
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    }),
  ]

  downloadTextFile('orchard-spot-assignments.csv', rows.join('\n'), 'text/csv;charset=utf-8')
}

export function exportStakeList(data: NormalizedOrchardData) {
  const treeById = new Map(data.trees.map((tree) => [tree.id, tree]))
  const lines = data.plantingSpots
    .filter((spot) => spot.currentTreeId)
    .map((spot) => {
      const tree = treeById.get(spot.currentTreeId!)
      return `${spot.id} - ${tree?.varietyName ?? 'Unknown'} (${tree?.species ?? 'Unknown'})`
    })

  downloadTextFile('orchard-stake-list.txt', lines.join('\n'), 'text/plain;charset=utf-8')
}
