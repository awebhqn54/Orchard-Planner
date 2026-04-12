import { useMemo, useState } from 'react'
import type { TreeSeedRecord } from '../types'
import { formatMaybe, formatUsd } from '../utils/format'

export type CatalogSortKey =
  | 'varietyName'
  | 'species'
  | 'orchardSection'
  | 'supplierGroup'
  | 'quantity'
  | 'orchardRoleCategory'
  | 'costPerTreeUsd'
  | 'totalUsd'
  | 'matureHeightFt'
  | 'coldHardiness'
  | 'ripeningWindow'
  | 'bloomGroupTiming'
  | 'storagePotential'

interface VarietyCatalogProps {
  records: TreeSeedRecord[]
  selectedRecordId: string | null
  onSelectRecord: (record: TreeSeedRecord) => void
}

function compareStrings(a: string | undefined, b: string | undefined) {
  return (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base' })
}

function compareNumbers(a: number | undefined, b: number | undefined) {
  const na = a ?? Number.NEGATIVE_INFINITY
  const nb = b ?? Number.NEGATIVE_INFINITY
  return na - nb
}

export function VarietyCatalog({ records, selectedRecordId, onSelectRecord }: VarietyCatalogProps) {
  const [search, setSearch] = useState('')
  const [speciesFilter, setSpeciesFilter] = useState('all')
  const [sectionFilter, setSectionFilter] = useState('all')
  const [supplierGroupFilter, setSupplierGroupFilter] = useState('all')
  const [sortKey, setSortKey] = useState<CatalogSortKey>('varietyName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const speciesOptions = useMemo(
    () => Array.from(new Set(records.map((r) => r.species))).sort(),
    [records],
  )
  const sectionOptions = useMemo(
    () => Array.from(new Set(records.map((r) => r.orchardSection))).sort(),
    [records],
  )
  const supplierGroupOptions = useMemo(
    () =>
      Array.from(new Set(records.map((r) => r.supplierGroup).filter(Boolean) as string[])).sort(),
    [records],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return records.filter((r) => {
      if (speciesFilter !== 'all' && r.species !== speciesFilter) {
        return false
      }
      if (sectionFilter !== 'all' && r.orchardSection !== sectionFilter) {
        return false
      }
      if (supplierGroupFilter !== 'all' && (r.supplierGroup ?? '') !== supplierGroupFilter) {
        return false
      }
      if (!q) {
        return true
      }
      const hay = [
        r.varietyName,
        r.species,
        r.orchardSection,
        r.supplierGroup,
        r.supplier,
        r.orchardRoleCategory,
        r.ripeningWindow,
        r.rootstock,
        r.rootstockCode,
        r.diseaseNotes,
        r.ciderFlavorProfile,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [records, search, speciesFilter, sectionFilter, supplierGroupFilter])

  const sorted = useMemo(() => {
    const next = [...filtered]
    next.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'quantity':
        case 'costPerTreeUsd':
        case 'totalUsd':
        case 'matureHeightFt':
          cmp = compareNumbers(a[sortKey], b[sortKey])
          break
        default:
          cmp = compareStrings(
            a[sortKey] as string | undefined,
            b[sortKey] as string | undefined,
          )
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return next
  }, [filtered, sortKey, sortDir])

  function toggleSort(key: CatalogSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <div className="variety-catalog">
      <div className="catalog-filters">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search varieties, notes, supplier…"
        />
        <select value={speciesFilter} onChange={(e) => setSpeciesFilter(e.target.value)}>
          <option value="all">All species</option>
          {speciesOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
          <option value="all">All sections</option>
          {sectionOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={supplierGroupFilter} onChange={(e) => setSupplierGroupFilter(e.target.value)}>
          <option value="all">All supplier groups</option>
          {supplierGroupOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <p className="catalog-meta">{sorted.length} varieties</p>
      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <thead>
            <tr>
              <th>
                <button type="button" className="sort-btn" onClick={() => toggleSort('varietyName')}>
                  Variety {sortKey === 'varietyName' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th>
                <button type="button" className="sort-btn" onClick={() => toggleSort('species')}>
                  Species {sortKey === 'species' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th>
                <button type="button" className="sort-btn" onClick={() => toggleSort('orchardSection')}>
                  Section {sortKey === 'orchardSection' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th>
                <button type="button" className="sort-btn" onClick={() => toggleSort('supplierGroup')}>
                  Supplier group {sortKey === 'supplierGroup' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th>
                <button type="button" className="sort-btn" onClick={() => toggleSort('quantity')}>
                  Qty {sortKey === 'quantity' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th>
                <button type="button" className="sort-btn" onClick={() => toggleSort('orchardRoleCategory')}>
                  Role {sortKey === 'orchardRoleCategory' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th>
                <button type="button" className="sort-btn" onClick={() => toggleSort('costPerTreeUsd')}>
                  $/tree {sortKey === 'costPerTreeUsd' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th>
                <button type="button" className="sort-btn" onClick={() => toggleSort('totalUsd')}>
                  Total {sortKey === 'totalUsd' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th>
                <button type="button" className="sort-btn" onClick={() => toggleSort('matureHeightFt')}>
                  Ht (ft) {sortKey === 'matureHeightFt' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th>
                <button type="button" className="sort-btn" onClick={() => toggleSort('coldHardiness')}>
                  Hardiness {sortKey === 'coldHardiness' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th>
                <button type="button" className="sort-btn" onClick={() => toggleSort('ripeningWindow')}>
                  Ripening {sortKey === 'ripeningWindow' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th>
                <button type="button" className="sort-btn" onClick={() => toggleSort('bloomGroupTiming')}>
                  Bloom {sortKey === 'bloomGroupTiming' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th>
                <button type="button" className="sort-btn" onClick={() => toggleSort('storagePotential')}>
                  Storage {sortKey === 'storagePotential' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.id}
                className={selectedRecordId === r.id ? 'catalog-row-selected' : undefined}
              >
                <td>
                  <button type="button" className="catalog-link" onClick={() => onSelectRecord(r)}>
                    {r.varietyName}
                  </button>
                </td>
                <td>{r.species}</td>
                <td>{r.orchardSection}</td>
                <td>{formatMaybe(r.supplierGroup)}</td>
                <td>{r.quantity}</td>
                <td>{formatMaybe(r.orchardRoleCategory)}</td>
                <td>{formatUsd(r.costPerTreeUsd)}</td>
                <td>{formatUsd(r.totalUsd)}</td>
                <td>{formatMaybe(r.matureHeightFt)}</td>
                <td>{formatMaybe(r.coldHardiness)}</td>
                <td className="catalog-clip">{formatMaybe(r.ripeningWindow)}</td>
                <td className="catalog-clip">{formatMaybe(r.bloomGroupTiming)}</td>
                <td className="catalog-clip">{formatMaybe(r.storagePotential)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
