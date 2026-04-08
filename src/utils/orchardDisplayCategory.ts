import type { Tree } from '../types'

/** Visual / UX category for map chips and list styling (not placement zones). */
export type OrchardDisplayCategory =
  | 'cider'
  | 'eating'
  | 'stone'
  | 'cherry'
  | 'pear-plum'
  | 'persimmon'
  | 'other'

export function getOrchardDisplayCategory(tree: Tree): OrchardDisplayCategory {
  const species = tree.species.toLowerCase()
  const section = tree.orchardSection.toLowerCase()

  if (tree.placeholderOnly || species.includes('persimmon')) {
    return 'persimmon'
  }

  if (section.includes('cider')) {
    return 'cider'
  }

  if (species === 'apple' && (section.includes('eating') || section.includes('baking'))) {
    return 'eating'
  }

  if (species === 'peach' || species === 'apricot') {
    return 'stone'
  }

  if (species.includes('cherry')) {
    return 'cherry'
  }

  if (species === 'pear' || species === 'plum') {
    return 'pear-plum'
  }

  if (species === 'apple') {
    return 'eating'
  }

  return 'other'
}

export function orchardDisplayCategoryLabel(cat: OrchardDisplayCategory): string {
  switch (cat) {
    case 'cider':
      return 'Cider apple'
    case 'eating':
      return 'Eating / baking apple'
    case 'stone':
      return 'Stone fruit'
    case 'cherry':
      return 'Cherry'
    case 'pear-plum':
      return 'Pear / plum'
    case 'persimmon':
      return 'Persimmon (placeholder)'
    default:
      return 'Other'
  }
}
