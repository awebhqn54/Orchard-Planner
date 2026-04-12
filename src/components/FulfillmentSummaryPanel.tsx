import type { Tree } from '../types'
import { fulfillmentVisualKind } from '../utils/fulfillment'

function groupByFulfillment(trees: Tree[]) {
  const onSiteReady: Tree[] = []
  const missingReplacement: Tree[] = []
  const inTransit: Tree[] = []
  const future: Tree[] = []

  for (const tree of trees) {
    const kind = fulfillmentVisualKind(tree)
    if (kind === 'future_placeholder') {
      future.push(tree)
    } else if (kind === 'missing_replacement') {
      missingReplacement.push(tree)
    } else if (kind === 'in_transit') {
      inTransit.push(tree)
    } else if (tree.fulfillment.readyToPlant && tree.fulfillment.received) {
      onSiteReady.push(tree)
    } else {
      inTransit.push(tree)
    }
  }

  return { onSiteReady, missingReplacement, inTransit, future }
}

function TreeLine({ tree }: { tree: Tree }) {
  return (
    <li>
      <span className="fulfillment-summary-variety">{tree.varietyName}</span>
      {tree.currentSpotId ? (
        <span className="fulfillment-summary-spot"> · {tree.currentSpotId}</span>
      ) : null}
    </li>
  )
}

export function FulfillmentSummaryPanel({ trees, embedded }: { trees: Tree[]; embedded?: boolean }) {
  const { onSiteReady, missingReplacement, inTransit, future } = groupByFulfillment(trees)

  return (
    <article
      className={`card fulfillment-summary-panel${embedded ? ' fulfillment-summary-panel--embedded' : ''}`}
    >
      {embedded ? (
        <p className="fulfillment-summary-intro">Physical inventory and shipment status by tree (same data as map chips).</p>
      ) : (
        <div className="panel-header">
          <div>
            <h2>Shipment & fulfillment</h2>
            <p className="panel-header-note">Planning vs physical inventory by tree.</p>
          </div>
        </div>
      )}
      <div className="fulfillment-summary-grid">
        <section className="fulfillment-summary-section">
          <h3>On site & ready to plant</h3>
          <p className="fulfillment-summary-count">{onSiteReady.length} trees</p>
          <ul className="fulfillment-summary-list">
            {onSiteReady.map((t) => (
              <TreeLine key={t.id} tree={t} />
            ))}
          </ul>
        </section>
        <section className="fulfillment-summary-section fulfillment-summary-section--warning">
          <h3>Missing from shipment — replacement confirmed</h3>
          <p className="fulfillment-summary-count">{missingReplacement.length} trees</p>
          <ul className="fulfillment-summary-list">
            {missingReplacement.map((t) => (
              <TreeLine key={t.id} tree={t} />
            ))}
          </ul>
        </section>
        <section className="fulfillment-summary-section fulfillment-summary-section--transit">
          <h3>In transit (separate or follow-up orders)</h3>
          <p className="fulfillment-summary-count">{inTransit.length} trees</p>
          <ul className="fulfillment-summary-list">
            {inTransit.map((t) => (
              <TreeLine key={t.id} tree={t} />
            ))}
          </ul>
        </section>
        <section className="fulfillment-summary-section fulfillment-summary-section--muted">
          <h3>Placeholder / future planting</h3>
          <p className="fulfillment-summary-count">{future.length} trees</p>
          <ul className="fulfillment-summary-list">
            {future.map((t) => (
              <TreeLine key={t.id} tree={t} />
            ))}
          </ul>
        </section>
      </div>
    </article>
  )
}
