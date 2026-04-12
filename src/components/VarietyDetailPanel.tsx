import type { ReactNode } from 'react'
import type { Tree, TreeSeedRecord } from '../types'
import { formatMaybe, formatUsd } from '../utils/format'
import { getSpeciesPillDisplay } from '../utils/speciesPillDisplay'
import { isRootstockCodeMissing } from '../utils/rootstock'
import { normalizeComparableText, rootstockIdentityKey } from '../utils/varietyEnrichment'

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="detail-section">
      <h3 className="detail-section-title">{title}</h3>
      {children}
    </section>
  )
}

function formatLink(url: string | undefined) {
  if (!url) {
    return '—'
  }
  const trimmed = url.trim()
  if (!trimmed) {
    return '—'
  }
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return (
    <a className="detail-link" href={href} rel="noopener noreferrer" target="_blank">
      {trimmed}
    </a>
  )
}

function formatBool(v: boolean): string {
  return v ? 'Yes' : 'No'
}

export function VarietyDetailPanel({
  tree,
  record,
  getSpotLabel,
}: {
  tree: Tree | null
  record: TreeSeedRecord | null
  getSpotLabel?: (spotId: string | null) => string
}) {
  if (!record) {
    return <p className="empty-state">Select a variety or tree.</p>
  }

  const speciesPill = getSpeciesPillDisplay(tree ?? record)

  function spotLabel(spotId: string | null): string {
    if (getSpotLabel) {
      return getSpotLabel(spotId)
    }
    return spotId ?? '—'
  }

  const f = tree?.fulfillment
  const rootstockCodeMissing = isRootstockCodeMissing(record)
  const showRootstockCode = !rootstockCodeMissing
  const rootstockNote = record.rootstock?.trim()
  const showRootstockNotes = Boolean(
    rootstockNote &&
      rootstockIdentityKey(rootstockNote) !== rootstockIdentityKey(record.rootstockCode) &&
      normalizeComparableText(rootstockNote) !== normalizeComparableText(record.matureSizeText),
  )

  return (
    <div className="detail-stack">
      <span className={`species-pill ${speciesPill.variantClass}`}>{speciesPill.label}</span>
      <h3>{record.varietyName}</h3>

      <DetailSection title="Sourcing & order">
        <div className="detail-plain-lines">
          <p>
            <span className="detail-plain-k">Supplier</span> {formatMaybe(record.supplier)}
          </p>
          <p>
            <span className="detail-plain-k">Link</span> {formatLink(record.link)}
          </p>
          <p>
            <span className="detail-plain-k">Qty</span> {String(record.quantity)}
          </p>
          <p>
            <span className="detail-plain-k">Cost / tree</span> {formatUsd(record.costPerTreeUsd)}
          </p>
          <p>
            <span className="detail-plain-k">Total</span> {formatUsd(record.totalUsd)}
          </p>
        </div>
      </DetailSection>

      {tree ? (
        <DetailSection title="Placement (this tree)">
          <div className="detail-plain-lines">
            <p>
              <span className="detail-plain-k">Current spot</span> {spotLabel(tree.currentSpotId)}
            </p>
            <p>
              <span className="detail-plain-k">Recommended spot</span> {spotLabel(tree.recommendedSpotId)}
            </p>
            <p>
              <span className="detail-plain-k">Manual move</span> {formatBool(tree.manualOverride.isManualOverride)}
            </p>
          </div>
        </DetailSection>
      ) : null}

      {tree && f ? (
        <DetailSection title="Fulfillment & physical inventory">
          <div className="detail-plain-lines">
            <p>
              <span className="detail-plain-k">Physically available to plant now</span>{' '}
              {f.readyToPlant && f.received ? (
                <span className="detail-status-ok">Yes</span>
              ) : (
                <span className="detail-status-warn">No</span>
              )}
            </p>
            <p>
              <span className="detail-plain-k">Ordered</span> {formatBool(f.ordered)}
            </p>
            <p>
              <span className="detail-plain-k">Received on site</span> {formatBool(f.received)}
            </p>
            <p>
              <span className="detail-plain-k">Missing from shipment</span> {formatBool(f.missing)}
            </p>
            <p>
              <span className="detail-plain-k">Replacement confirmed</span> {formatBool(f.replacementConfirmed)}
            </p>
            <p>
              <span className="detail-plain-k">In transit</span> {formatBool(f.inTransit)}
            </p>
            <p>
              <span className="detail-plain-k">Ready to plant (flag)</span> {formatBool(f.readyToPlant)}
            </p>
            <p>
              <span className="detail-plain-k">Nursery / order source</span> {formatMaybe(f.orderSource)}
            </p>
            <p>
              <span className="detail-plain-k">Shipment group</span> {formatMaybe(f.shipmentGroup)}
            </p>
            <p>
              <span className="detail-plain-k">Expected arrival</span> {formatMaybe(f.expectedArrival)}
            </p>
            <p>
              <span className="detail-plain-k">Notes</span> {formatMaybe(f.notes)}
            </p>
          </div>
        </DetailSection>
      ) : (
        <DetailSection title="Fulfillment & physical inventory">
          <p className="detail-muted">Select a tree on the map to see per-instance fulfillment.</p>
        </DetailSection>
      )}

      <DetailSection title="Tree traits">
        <div className="detail-plain-lines">
          <p>
            <span className="detail-plain-k">Rootstock code</span>{' '}
            {showRootstockCode ? formatMaybe(record.rootstockCode) : '—'}
            {rootstockCodeMissing ? (
              <span className="detail-rootstock-missing-flag" title="Confirm from tree tag or nursery invoice">
                Missing
              </span>
            ) : null}
          </p>
          {showRootstockNotes ? (
            <p>
              <span className="detail-plain-k">Rootstock notes</span> {rootstockNote}
            </p>
          ) : null}
          <p>
            <span className="detail-plain-k">Mature height (ft)</span> {formatMaybe(record.matureHeightFt)}
          </p>
          <p>
            <span className="detail-plain-k">Mature size</span> {formatMaybe(record.matureSizeText)}
          </p>
          <p>
            <span className="detail-plain-k">Shipping / plant size</span> {formatMaybe(record.shippingPlantSize)}
          </p>
          <p>
            <span className="detail-plain-k">Bloom group / timing</span> {formatMaybe(record.bloomGroupTiming)}
          </p>
          <p>
            <span className="detail-plain-k">Pollination</span> {formatMaybe(record.pollinationNotes)}
          </p>
        </div>
      </DetailSection>

      <DetailSection title="Climate & harvest">
        <div className="detail-plain-lines">
          <p>
            <span className="detail-plain-k">Cold hardiness</span> {formatMaybe(record.coldHardiness)}
          </p>
          <p>
            <span className="detail-plain-k">Ripening (Southern WI)</span> {formatMaybe(record.ripeningWindow)}
          </p>
          <p>
            <span className="detail-plain-k">Storage potential</span> {formatMaybe(record.storagePotential)}
          </p>
        </div>
      </DetailSection>

      <DetailSection title="Disease & management">
        <div className="detail-plain-lines">
          <p>
            <span className="detail-plain-k">Fire blight</span> {formatMaybe(record.fireBlightSusceptibility)}
          </p>
          <p>
            <span className="detail-plain-k">Apple scab</span> {formatMaybe(record.appleScabSusceptibility)}
          </p>
          <p>
            <span className="detail-plain-k">Other disease notes</span> {formatMaybe(record.otherDiseaseNotes)}
          </p>
          <p>
            <span className="detail-plain-k">Biennial tendency</span> {formatMaybe(record.biennialTendency)}
          </p>
          <p>
            <span className="detail-plain-k">Biennial management</span> {formatMaybe(record.biennialManagement)}
          </p>
        </div>
      </DetailSection>

      <DetailSection title="Use & notes">
        <div className="detail-plain-lines">
          <p>
            <span className="detail-plain-k">Cider / flavor profile</span> {formatMaybe(record.ciderFlavorProfile)}
          </p>
          <p>
            <span className="detail-plain-k">Orchard notes</span> {formatMaybe(record.orchardNotes)}
          </p>
        </div>
      </DetailSection>
    </div>
  )
}
