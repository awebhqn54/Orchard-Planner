export function formatUsd(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return '—'
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatMaybe(value: string | number | boolean | undefined, empty = '—'): string {
  if (value === undefined || value === null || value === '') {
    return empty
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  return String(value)
}
