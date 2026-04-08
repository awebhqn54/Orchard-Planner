import type { Tree, TreeSeedRecord } from '../types'

export interface SpeciesPillDisplay {
  label: string
  /** Extra class after `species-pill` (e.g. `species-apple-cider`). */
  variantClass: string
}

/**
 * Map chips use cider (red) vs eating (green) for apples; the detail pill should match.
 */
export function getSpeciesPillDisplay(
  source: Pick<Tree, 'species' | 'orchardSection'> | Pick<TreeSeedRecord, 'species' | 'orchardSection'>,
): SpeciesPillDisplay {
  const species = source.species
  const section = source.orchardSection.toLowerCase()
  const speciesLower = species.toLowerCase()

  if (speciesLower === 'apple') {
    if (section.includes('cider')) {
      return { label: 'Cider apple', variantClass: 'species-apple-cider' }
    }
    return { label: 'Dessert apple', variantClass: 'species-apple-dessert' }
  }

  const slug = species.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return { label: species, variantClass: `species-${slug}` }
}
