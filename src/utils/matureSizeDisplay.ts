import type { Tree } from '../types'

/** Size note from traits (e.g. semi-dwarf, standard), falling back to coarse sizeClass. */
export function matureSizeNote(tree: Tree): string {
  const text = tree.matureSizeText?.trim()
  if (text) {
    return text
  }
  if (tree.sizeClass === 'large') {
    return 'Standard / large'
  }
  if (tree.sizeClass === 'small') {
    return 'Semi-dwarf / small'
  }
  return 'Medium'
}

export function matureHeightFeetLabel(tree: Tree): string {
  if (tree.matureHeightFt != null && Number.isFinite(tree.matureHeightFt)) {
    return `${Math.round(tree.matureHeightFt)} ft`
  }
  return '—'
}

/** Combined line for map labels and chips: size note plus numeric height from traits. */
export function formatMatureSizeWithHeight(tree: Tree): string {
  return `${matureSizeNote(tree)} · ${matureHeightFeetLabel(tree)}`
}
