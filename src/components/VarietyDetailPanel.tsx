import type { ReactNode } from 'react'
import type { Tree, TreeSeedRecord } from '../types'
import { formatMaybe, formatUsd } from '../utils/format'
import { getSpeciesPillDisplay } from '../utils/speciesPillDisplay'

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

export function VarietyDetailPanel({
  tree,
  record,
}: {
  tree: Tree | null
  record: TreeSeedRecord | null
}) {
  if (!record) {
    return <p className="empty-state">Select a variety or tree.</p>
  }

  const speciesPill = getSpeciesPillDisplay(tree ?? record)

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

      <DetailSection title="Tree traits">
        <div className="detail-plain-lines">
          <p>
            <span className="detail-plain-k">Rootstock</span> {formatMaybe(record.rootstock)}
          </p>
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
