import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react'
import './App.css'
import { VarietyDetailPanel } from './components/VarietyDetailPanel'
import { defaultStarterLayout } from './data/defaultStarterLayout'
import { bundledProjectImportBundle } from './utils/importData'
import type { ImportedInventoryBundle } from './utils/importData'
import { buildNormalizedOrchardData } from './utils/placementEngine'
import { exportSpotAssignments, exportStakeList } from './utils/export'
import { applyLayoutSnapshot, captureLayoutSnapshot, downloadLayoutFile, parseLayoutJson } from './utils/layoutSnapshot'
import {
  computeFeetFromRowStartBySpotId,
  computeRowSpacingMetrics,
  crownDiameterFtForSpacing,
  type SpotFeetFromRowStart,
} from './utils/inRowTreeSpacing'
import { formatMatureSizeWithHeight } from './utils/matureSizeDisplay'
import { getOrchardDisplayCategory } from './utils/orchardDisplayCategory'
import type { NormalizedOrchardData, PlantingSpot, Tree } from './types'

const bundle: ImportedInventoryBundle = bundledProjectImportBundle

/** In-row / fence strips with this width (ft) are shown as tractor / equipment lanes. */
const TRACTOR_DRIVE_LANE_SPACING_FT = 24

function getTreeSpeciesLabel(tree: Tree): string {
  if (tree.species === 'Apple' && tree.orchardSection.toLowerCase().includes('cider')) {
    return 'Cider apple'
  }
  return tree.species
}

function canApplyDefaultStarterLayout(data: NormalizedOrchardData): boolean {
  if (data.orchardConfig.spotsPerRow !== defaultStarterLayout.spotsPerRow) {
    return false
  }

  const knownTreeIds = new Set(data.trees.map((tree) => tree.id))
  for (const treeId of Object.values(defaultStarterLayout.spotToTreeId)) {
    if (treeId && !knownTreeIds.has(treeId)) {
      return false
    }
  }

  return true
}

function buildOrchardDataWithOptionalDefaultLayout(importBundle: ImportedInventoryBundle): NormalizedOrchardData {
  const rebuilt = buildNormalizedOrchardData(importBundle)
  return canApplyDefaultStarterLayout(rebuilt) ? applyLayoutSnapshot(rebuilt, defaultStarterLayout) : rebuilt
}

function getInitialSelectedTreeId(data: NormalizedOrchardData): string | null {
  return data.trees.find((tree) => tree.currentSpotId)?.id ?? data.trees[0]?.id ?? null
}

const initialData = buildOrchardDataWithOptionalDefaultLayout(bundle)

const NARROW_MEDIA = '(max-width: 1200px)'

function useNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(NARROW_MEDIA).matches : false,
  )

  useEffect(() => {
    const mql = window.matchMedia(NARROW_MEDIA)
    const sync = () => setNarrow(mql.matches)
    sync()
    mql.addEventListener('change', sync)
    return () => mql.removeEventListener('change', sync)
  }, [])

  return narrow
}

function App() {
  const [data, setData] = useState<NormalizedOrchardData | null>(initialData)
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(getInitialSelectedTreeId(initialData))
  const [draggedTreeId, setDraggedTreeId] = useState<string | null>(null)
  const [layoutImportMessage, setLayoutImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  )
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [advancedActionsOpen, setAdvancedActionsOpen] = useState(false)
  const isNarrowViewport = useNarrowViewport()

  function selectTreeForPlanner(treeId: string | null) {
    setSelectedTreeId(treeId)
    if (treeId && typeof window !== 'undefined' && window.matchMedia(NARROW_MEDIA).matches) {
      setDetailDrawerOpen(true)
    }
  }

  useEffect(() => {
    if (!isNarrowViewport) {
      setDetailDrawerOpen(false)
    }
  }, [isNarrowViewport])

  useEffect(() => {
    if (!isNarrowViewport || !detailDrawerOpen) {
      return
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDetailDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isNarrowViewport, detailDrawerOpen])

  useEffect(() => {
    if (!isNarrowViewport || !detailDrawerOpen) {
      document.body.classList.remove('detail-drawer-open')
      return
    }
    document.body.classList.add('detail-drawer-open')
    return () => document.body.classList.remove('detail-drawer-open')
  }, [isNarrowViewport, detailDrawerOpen])

  function updateTreePlacement(tree: Tree, targetSpot: PlantingSpot | null) {
    tree.currentSpotId = targetSpot?.id ?? null
    tree.placement = {
      treeId: tree.id,
      spotId: targetSpot?.id ?? null,
      rowId: targetSpot?.rowId ?? null,
      rowNumber: targetSpot?.rowNumber ?? null,
      columnIndex: targetSpot?.columnIndex ?? null,
      status: targetSpot ? 'assigned' : 'holding',
    }
    tree.manualOverride = {
      isManualOverride: tree.currentSpotId !== tree.recommendedSpotId,
      overriddenAt: tree.currentSpotId !== tree.recommendedSpotId ? new Date().toISOString() : undefined,
      previousSpotId: tree.recommendedSpotId,
    }
  }

  function moveTree(treeId: string, targetSpotId: string | null) {
    setData((previous) => {
      if (!previous) {
        return previous
      }

      const next = structuredClone(previous) as NormalizedOrchardData
      const tree = next.trees.find((item) => item.id === treeId)
      if (!tree) {
        return previous
      }

      const sourceSpot = next.plantingSpots.find((spot) => spot.currentTreeId === treeId) ?? null
      const targetSpot = targetSpotId
        ? next.plantingSpots.find((spot) => spot.id === targetSpotId) ?? null
        : null

      const displacedTree = targetSpot?.currentTreeId
        ? next.trees.find((item) => item.id === targetSpot.currentTreeId) ?? null
        : null

      if (sourceSpot) {
        sourceSpot.currentTreeId = null
      }

      if (targetSpot) {
        targetSpot.currentTreeId = tree.id
      }

      updateTreePlacement(tree, targetSpot)

      if (displacedTree && displacedTree.id !== tree.id) {
        if (sourceSpot) {
          sourceSpot.currentTreeId = displacedTree.id
          updateTreePlacement(displacedTree, sourceSpot)
        } else {
          updateTreePlacement(displacedTree, null)
        }
      }

      next.stagingTreeIds = next.trees.filter((item) => !item.currentSpotId).map((item) => item.id)
      next.placementWarnings = next.placementWarnings.filter((warning) => warning.id !== 'staging-overflow')
      if (next.stagingTreeIds.length) {
        next.placementWarnings.push({
          id: 'staging-overflow',
          severity: 'warning',
          summary: 'Some active trees remain unassigned.',
          detail: `${next.stagingTreeIds.length} trees are currently in the holding area.`,
        })
      }

      return next
    })
  }

  function handleDropToSpot(spotId: string) {
    if (!draggedTreeId) {
      return
    }

    moveTree(draggedTreeId, spotId)
    setDraggedTreeId(null)
  }

  function handleDropToHolding() {
    if (!draggedTreeId) {
      return
    }

    moveTree(draggedTreeId, null)
    setDraggedTreeId(null)
  }

  function handleResetToDefault() {
    const next = buildOrchardDataWithOptionalDefaultLayout(bundle)
    setData(next)
    setSelectedTreeId(getInitialSelectedTreeId(next))
  }

  function handleSaveLayoutJson() {
    if (!data) {
      return
    }

    downloadLayoutFile(captureLayoutSnapshot(data))
  }

  async function handleImportLayoutFile(file: File) {
    if (!data) {
      return
    }

    try {
      const text = await file.text()
      const snapshot = parseLayoutJson(text)
      const base = structuredClone(data) as NormalizedOrchardData
      const applied = applyLayoutSnapshot(base, snapshot)
      setData(applied)
      setSelectedTreeId(applied.trees.find((tree) => tree.currentSpotId)?.id ?? applied.trees[0]?.id ?? null)
      setLayoutImportMessage({ type: 'success', text: 'Layout imported successfully.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not import layout file.'
      setLayoutImportMessage({ type: 'error', text: message })
    }
  }

  const detailTree = useMemo(() => {
    if (!data || !selectedTreeId) {
      return null
    }

    return data.trees.find((tree) => tree.id === selectedTreeId) ?? null
  }, [data, selectedTreeId])

  const detailRecord = useMemo(() => {
    if (!detailTree) {
      return null
    }

    const merged = [...bundle.inventoryRecords, ...bundle.inactiveInventoryRecords]
    return merged.find((record) => record.id === detailTree.sourceRecordId) ?? null
  }, [detailTree])

  const treeById = useMemo(() => new Map(data?.trees.map((tree) => [tree.id, tree]) ?? []), [data])

  const spotById = useMemo(
    () => new Map(data?.plantingSpots.map((spot) => [spot.id, spot]) ?? []),
    [data],
  )

  const rowSpacingByRowId = useMemo(() => {
    const m = new Map<string, ReturnType<typeof computeRowSpacingMetrics>>()
    if (!data) {
      return m
    }
    for (const row of data.orchardRows) {
      m.set(row.id, computeRowSpacingMetrics(row.spotIds, spotById, treeById))
    }
    return m
  }, [data, spotById, treeById])

  const feetFromRowStartBySpotId = useMemo(() => {
    const m = new Map<string, SpotFeetFromRowStart>()
    if (!data) {
      return m
    }
    for (const row of data.orchardRows) {
      const rowM = computeFeetFromRowStartBySpotId(row.spotIds, spotById, treeById)
      rowM.forEach((value, spotId) => {
        m.set(spotId, value)
      })
    }
    return m
  }, [data, spotById, treeById])

  return (
    <div className="app-shell">
      <header className="topbar card">
        <div>
          <p className="eyebrow">Local orchard planner</p>
          <h1>Orchard Planning and Tree Placement</h1>
          <p className="lede">
            Drag-and-drop layout, save/load JSON, exports, and trait labels (mature size and height).
          </p>
        </div>
        <div className="topbar-actions">
          <div className="topbar-actions-row topbar-actions-primary">
            <button
              className="button detail-drawer-toggle"
              type="button"
              onClick={() => setDetailDrawerOpen((open) => !open)}
              aria-expanded={detailDrawerOpen}
              aria-controls="variety-details-panel"
            >
              {detailDrawerOpen ? 'Hide variety details' : 'Variety details'}
            </button>
            <button className="button button-primary" onClick={handleResetToDefault} type="button">
              Reset to default
            </button>
            <button className="button" onClick={() => data && exportSpotAssignments(data)} type="button">
              Export CSV
            </button>
            <button className="button" onClick={() => window.print()} type="button">
              Print
            </button>
          </div>
          <div className="topbar-actions-row topbar-actions-advanced-line">
            <button
              className="button"
              type="button"
              onClick={() => setAdvancedActionsOpen((open) => !open)}
              aria-expanded={advancedActionsOpen}
              aria-controls="topbar-advanced-actions"
            >
              {advancedActionsOpen ? 'Hide advanced' : 'Advanced'}
            </button>
          </div>
          <div
            className="topbar-actions-row topbar-actions-advanced"
            hidden={!advancedActionsOpen}
            id="topbar-advanced-actions"
          >
            <button className="button" onClick={handleSaveLayoutJson} type="button">
              Save layout as JSON
            </button>
            <label className="button">
              Import layout JSON
              <input
                type="file"
                hidden
                accept=".json,application/json"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    void handleImportLayoutFile(file)
                  }
                  event.target.value = ''
                }}
              />
            </label>
            <button className="button" onClick={() => data && exportStakeList(data)} type="button">
              Export stake list
            </button>
            {layoutImportMessage ? (
              <p
                className={`layout-import-hint topbar-advanced-hint ${layoutImportMessage.type === 'error' ? 'layout-import-hint--error' : 'layout-import-hint--success'}`}
              >
                {layoutImportMessage.text}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <main className="layout-grid">
        <section className="workspace">
          <article className="card orchard-panel">
            <div className="panel-header">
              <div>
                <h2>Orchard layout</h2>
                <p>Drag to rearrange.</p>
              </div>
            </div>

            <div className="orchard-map-scroll">
              <div
                className="orchard-map"
                style={
                  {
                    '--orchard-map-columns': data?.orchardRows.length ?? 5,
                    '--orchard-map-strip-count': data?.orchardRows.length ?? 5,
                  } as CSSProperties
                }
              >
                {data && data.orchardRows.length > 0 ? (
                  <>
                    <div className="orchard-map-band orchard-map-band--header">
                      <div className="orchard-map-gap-strip orchard-map-gap-strip--band-header" aria-hidden />
                      {data.orchardRows.map((row, rowIdx) => {
                        const rowSpacing = rowSpacingByRowId.get(row.id)
                        return (
                          <Fragment key={row.id}>
                            <div className="orchard-row-header">
                              <div className="row-label row-label-top">
                                <strong>{row.label}</strong>
                                <span>{row.offsetFeetFromFence} ft from fence</span>
                                {rowSpacing ? (
                                  <span className="row-along-total">
                                    {rowSpacing.pairs.length === 0
                                      ? '—'
                                      : rowSpacing.hasUnknownPair && rowSpacing.totalKnownFt === 0
                                        ? '— (add crown spread)'
                                        : rowSpacing.hasUnknownPair
                                          ? `${rowSpacing.totalKnownFt}′ to last tree (partial — add spread)`
                                          : `${rowSpacing.totalKnownFt}′ to last tree`}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            {rowIdx < data.orchardRows.length - 1 ? (
                              <div className="orchard-map-gap-strip orchard-map-gap-strip--band-header" aria-hidden />
                            ) : null}
                          </Fragment>
                        )
                      })}
                    </div>
                    <div className="orchard-map-band orchard-map-band--body">
                      {(() => {
                        const fenceToRow1Ft = data.orchardRows[0].offsetFeetFromFence
                        const fenceIsTractorLane = fenceToRow1Ft === TRACTOR_DRIVE_LANE_SPACING_FT
                        return (
                          <div
                            className={`orchard-map-gap-strip orchard-map-gap-strip--fence orchard-map-gap-strip--band-spacer${fenceIsTractorLane ? ' orchard-map-gap-strip--drive-lane' : ''}`}
                            title={
                              fenceIsTractorLane
                                ? 'Fence to Row 1 — tractor / equipment lane'
                                : 'Fence to Row 1'
                            }
                          >
                            <span
                              className={`orchard-map-gap-strip__label${fenceIsTractorLane ? ' orchard-map-gap-strip__label--drive-lane' : ''}`}
                            >
                              {fenceToRow1Ft}′{' '}
                              <span className="orchard-arrow-glyph">→</span>
                            </span>
                          </div>
                        )
                      })()}
                      {data.orchardRows.map((row, rowIdx) => {
                        const rowSpacing = rowSpacingByRowId.get(row.id)
                        const nextRow = rowIdx < data.orchardRows.length - 1 ? data.orchardRows[rowIdx + 1] : null
                        const betweenRowGapFt = nextRow ? nextRow.offsetFeetFromFence - row.offsetFeetFromFence : null
                        const stripIsTractorLane = betweenRowGapFt === TRACTOR_DRIVE_LANE_SPACING_FT
                        return (
                          <Fragment key={row.id}>
                            <div className="orchard-row-column">
                              <div className="row-spots-vertical">
                                {row.spotIds.map((spotId) => {
                                  const spot = data.plantingSpots.find((item) => item.id === spotId)!
                                  const tree = spot.currentTreeId ? treeById.get(spot.currentTreeId) : undefined
                                  const isSelected = tree?.id === selectedTreeId
                                  const spacingUnknown = Boolean(tree && crownDiameterFtForSpacing(tree) == null)
                                  const pairAfter = rowSpacing?.pairs.find((p) => p.fromSpotId === spot.id)
                                  const rowStart = feetFromRowStartBySpotId.get(spot.id)

                                  return (
                                    <Fragment key={spot.id}>
                                      <div
                                        className={`spot ${spot.kind} spot-zone-${spot.zoneId.replace(/[^a-z0-9-]+/gi, '-')} ${isSelected ? 'spot-selected' : ''} ${spacingUnknown ? 'spot--spacing-unknown' : ''}`}
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={() => handleDropToSpot(spot.id)}
                                      >
                                        {tree ? (
                                          <div className="tree-chip-wrap">
                                            <button
                                              className={`tree-chip orchard-cat-${getOrchardDisplayCategory(tree)} species-${tree.species.toLowerCase().replace(/[^a-z0-9]+/g, '-')} ${tree.manualOverride.isManualOverride ? 'manual' : ''} ${spacingUnknown ? 'tree-chip--spacing-unknown' : ''}`}
                                              draggable
                                              onClick={() => selectTreeForPlanner(tree.id)}
                                              onDragStart={() => setDraggedTreeId(tree.id)}
                                              onDragEnd={() => setDraggedTreeId(null)}
                                              type="button"
                                              title={
                                                spacingUnknown
                                                  ? 'Crown spread unknown — add mature width or height'
                                                  : undefined
                                              }
                                            >
                                              <span>{tree.varietyName}</span>
                                              <small>{getTreeSpeciesLabel(tree)}</small>
                                              <small className="tree-chip-size">{formatMatureSizeWithHeight(tree)}</small>
                                              {rowStart && (rowStart.feetFromRowStart > 0 || rowStart.partial) ? (
                                                <small
                                                  className="tree-chip-row-start"
                                                  title={
                                                    rowStart.partial
                                                      ? 'Feet along row from the first spot; omits gaps with unknown crown spread'
                                                      : 'Feet along row from the first spot'
                                                  }
                                                >
                                                  {rowStart.feetFromRowStart}′ from row start
                                                  {rowStart.partial ? '\u202f*' : ''}
                                                </small>
                                              ) : null}
                                              <small className="tree-chip-spot-pill">{tree.currentSpotId}</small>
                                            </button>
                                            <button
                                              className="chip-mini-action"
                                              onClick={(event) => {
                                                event.stopPropagation()
                                                moveTree(tree.id, null)
                                              }}
                                              type="button"
                                            >
                                              Send to staging
                                            </button>
                                          </div>
                                        ) : null}
                                      </div>
                                      {pairAfter ? (
                                        <div
                                          className={`row-inter-tree-spacing ${pairAfter.unknown ? 'row-inter-tree-spacing--unknown' : ''}`}
                                          aria-hidden
                                        >
                                          {pairAfter.unknown ? (
                                            <span>
                                              <span className="orchard-arrow-glyph">{'\u2195'}</span> —
                                            </span>
                                          ) : (
                                            <span>
                                              <span className="orchard-arrow-glyph">{'\u2195'}</span> {pairAfter.gapFt}′
                                            </span>
                                          )}
                                        </div>
                                      ) : null}
                                    </Fragment>
                                  )
                                })}
                              </div>
                            </div>
                            {nextRow ? (
                              <div
                                className={`orchard-map-gap-strip${stripIsTractorLane ? ' orchard-map-gap-strip--drive-lane' : ''}`}
                                aria-hidden
                                title={stripIsTractorLane ? 'Tractor / equipment lane between rows' : undefined}
                              >
                                <span
                                  className={`orchard-map-gap-strip__label${stripIsTractorLane ? ' orchard-map-gap-strip__label--drive-lane' : ''}`}
                                >
                                  <span className="orchard-arrow-glyph">{'\u2194'}</span>{' '}
                                  {betweenRowGapFt}′
                                </span>
                              </div>
                            ) : null}
                          </Fragment>
                        )
                      })}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </article>

          <article
            className="card holding-panel"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDropToHolding}
          >
            <div className="panel-header">
              <div>
                <h2>Holding / staging area</h2>
                <p>Trees can sit here without shifting or renumbering fixed orchard spots.</p>
              </div>
            </div>
            <div className="holding-tray">
              {data?.trees
                .filter((tree) => !tree.currentSpotId)
                .map((tree) => (
                  <button
                    key={tree.id}
                    className={`tree-chip holding-chip orchard-cat-${getOrchardDisplayCategory(tree)} species-${tree.species.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    draggable
                    onClick={() => selectTreeForPlanner(tree.id)}
                    onDragStart={() => setDraggedTreeId(tree.id)}
                    onDragEnd={() => setDraggedTreeId(null)}
                    type="button"
                  >
                    <span>{tree.varietyName}</span>
                    <small>{getTreeSpeciesLabel(tree)}</small>
                    <small className="tree-chip-size">{formatMatureSizeWithHeight(tree)}</small>
                    <small>Unassigned</small>
                  </button>
                ))}
              {!data?.trees.some((tree) => !tree.currentSpotId) ? <p className="empty-state">No trees in holding.</p> : null}
            </div>
          </article>
        </section>

        {isNarrowViewport && detailDrawerOpen ? (
          <button
            type="button"
            className="detail-drawer-backdrop"
            aria-label="Close variety details"
            onClick={() => setDetailDrawerOpen(false)}
          />
        ) : null}

        <aside
          className={`detail-panel card ${detailDrawerOpen ? 'detail-panel--open' : ''}`}
          id="variety-details-panel"
          aria-hidden={isNarrowViewport ? !detailDrawerOpen : false}
        >
          <div className="panel-header">
            <h2>Variety details</h2>
            <button
              type="button"
              className="detail-drawer-close"
              onClick={() => setDetailDrawerOpen(false)}
              aria-label="Close variety details"
            >
              ×
            </button>
          </div>
          <VarietyDetailPanel record={detailRecord} tree={detailTree} />
        </aside>
      </main>
    </div>
  )
}

export default App
