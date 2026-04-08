import type { PrototypeZoneLayout, SourceConflict, SourceDocument } from '../types'

export const tendollePrototypeZoneLayout: PrototypeZoneLayout = {
  layoutType: 'prototype_zone_layout_from_pdf',
  sourceNote:
    'Derived manually from Tendolle Orchard Plan PDF image. Use spreadsheet as final inventory authority. Ignore maple trees and arborvitae for now.',
  orchardBlock: {
    rowCount: 5,
    orientation: 'vertical_rows_top_to_bottom',
    notes: [
      'The plan shows five long orchard rows.',
      'The far-left orchard row is a mixed-fruit row divided into stacked zones.',
      'The next four rows are apple-heavy rows.',
      'Peaches are closest to the house/top-left side.',
      'Persimmons are at the bottom or south end of the mixed-fruit row.',
      'Dessert apples are concentrated near the bottom of one interior row.',
      'Cider apples fill most of the main right-side block.',
    ],
  },
  rows: [
    {
      rowId: 'R1',
      type: 'mixed_fruit_row',
      side: 'leftmost',
      zonesTopToBottom: [
        {
          zoneId: 'R1-Z1',
          cropType: 'peach',
          labelFromPlan: '6 Peach',
          plannedCount: 6,
          relativePosition: 'top',
        },
        {
          zoneId: 'R1-Z2',
          cropType: 'apricot',
          labelFromPlan: '4 Apricot',
          plannedCount: 4,
          relativePosition: 'upper_middle',
        },
        {
          zoneId: 'R1-Z3',
          cropType: 'sweet_cherry',
          labelFromPlan: '4 Sweet Cherry',
          plannedCount: 4,
          relativePosition: 'upper_middle',
        },
        {
          zoneId: 'R1-Z4',
          cropType: 'pear',
          labelFromPlan: '6 Pear',
          plannedCount: 6,
          relativePosition: 'middle',
        },
        {
          zoneId: 'R1-Z5',
          cropType: 'plum',
          labelFromPlan: '6 Plum',
          plannedCount: 6,
          relativePosition: 'lower_middle',
        },
        {
          zoneId: 'R1-Z6',
          cropType: 'persimmon',
          labelFromPlan: '6 Persimmons',
          plannedCount: 6,
          relativePosition: 'bottom',
          placeholderOnly: true,
          notes: ['Keep as placeholder area for now if persimmons are not in active current planting.'],
        },
      ],
    },
    {
      rowId: 'R2',
      type: 'apple_row_transition',
      side: 'left_center',
      zonesTopToBottom: [
        {
          zoneId: 'R2-Z1',
          cropType: 'mixed_apple_buffer',
          labelFromPlan: 'visually part of the main apple block',
          plannedCount: null,
          relativePosition: 'top_to_mid',
        },
        {
          zoneId: 'R2-Z2',
          cropType: 'dessert_apple',
          labelFromPlan: '16 Dessert Apple (Eating/baking)',
          plannedCount: 16,
          relativePosition: 'bottom_bias',
          notes: [
            'The label arrow points toward the lower portion of the interior-left apple area.',
            'Treat this as the general dessert apple area, not exact spot geometry.',
          ],
        },
      ],
    },
    {
      rowId: 'R3',
      type: 'cider_apple_row',
      side: 'center',
      zonesTopToBottom: [
        {
          zoneId: 'R3-Z1',
          cropType: 'cider_apple',
          labelFromPlan: '32 Cider Apple block',
          plannedCount: null,
          relativePosition: 'full_row',
        },
      ],
    },
    {
      rowId: 'R4',
      type: 'cider_apple_row',
      side: 'right_center',
      zonesTopToBottom: [
        {
          zoneId: 'R4-Z1',
          cropType: 'cider_apple',
          labelFromPlan: '32 Cider Apple block',
          plannedCount: null,
          relativePosition: 'full_row',
        },
      ],
    },
    {
      rowId: 'R5',
      type: 'cider_apple_row',
      side: 'rightmost',
      zonesTopToBottom: [
        {
          zoneId: 'R5-Z1',
          cropType: 'cider_apple',
          labelFromPlan: '32 Cider Apple block',
          plannedCount: null,
          relativePosition: 'full_row',
        },
      ],
    },
  ],
  placementRulesFromPrototype: [
    'Keep peaches nearest the house and upper-left area.',
    'Keep apricots below peaches.',
    'Keep sweet cherries below apricots and above pears.',
    'Keep pears below cherries.',
    'Keep plums below pears.',
    'Keep persimmons at the bottom or south end as placeholders.',
    'Keep dessert apples in the lower-left portion of the apple block.',
    'Keep cider apples filling the main center and right block.',
  ],
  importantWarnings: [
    'Do not use these counts as final inventory if they conflict with the spreadsheet.',
    'Use this layout as zoning guidance only.',
    'The PDF is a visual prototype, not an exact surveyed planting map.',
    'Sweet cherries shown in the plan may not account for tart cherries separately.',
  ],
}

export const prototypeZoneSourceDocument: SourceDocument = {
  id: 'prototype-zone-json',
  name: 'Prototype zone layout JSON',
  type: 'prototype-zone-json',
  notes: [
    'User-provided zoning guide derived manually from the earlier orchard plan PDF.',
    'Used as the authoritative rough row and zone source for placement, while spreadsheet counts remain final authority.',
  ],
}

export const prototypeZoneConflicts: SourceConflict[] = [
  {
    id: 'prototype-zone-guidance-only',
    severity: 'info',
    summary: 'Prototype zone JSON is zoning guidance only.',
    detail:
      'The prototype layout JSON sets rough row and zone intent but does not override spreadsheet inventory counts or exact planting geometry.',
    sourceIds: ['prototype-zone-json', 'tendolle-varieties-xlsx'],
  },
  {
    id: 'prototype-sweet-vs-tart-ambiguity',
    severity: 'warning',
    summary: 'Prototype zone JSON does not define a separate tart cherry zone.',
    detail:
      'The spreadsheet includes tart cherries, but the prototype zoning only labels a sweet cherry band. Tart cherries should therefore be kept adjacent to the sweet cherry zone rather than treated as a separately planned block.',
    sourceIds: ['prototype-zone-json', 'tendolle-varieties-xlsx'],
  },
]
