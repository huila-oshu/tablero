import { useState, useEffect, lazy, Suspense, type ReactNode } from 'react'
import { ExpandablePanel } from '@/components/ExpandablePanel'
import type { IndicatorMeta } from '@/config/general'
import type { AnalyticsIndicatorKey } from '@/lib/parquet'
import { indicatorsBySlug } from './indicatorsBySlug'

// ── Constants ─────────────────────────────────────────────────────────────────

// Loaded on demand — only imported when app.features.map is enabled, so
// deployments without geolocation data never fetch the map bundle.
const DSChoroplethMap = lazy(() =>
  import('@ops-dss/charts/choropleth-map').then((m) => ({
    default: m.DSChoroplethMap,
  })),
)

// Bivariate colour palette — BIVARIATE_COLORS[mmRow][indCol]
// mmRow  0 = low MM … 2 = high MM
// indCol 0 = low indicator … 2 = high indicator
const BIVARIATE_COLORS: string[][] = [
  ['#e8e8e8', '#ace4e4', '#5ac8c8'], // mm low
  ['#dfb0d6', '#a5b8c5', '#5a9ab5'], // mm med
  ['#be64ac', '#8c62aa', '#3b4994'], // mm high
]

// ── Types ─────────────────────────────────────────────────────────────────────

type TableRow = { name: string; value: number | null }
type MapView = 'map' | 'table'

type GeojsonSources = {
  geojsonUrls?: Record<AnalyticsIndicatorKey, Record<number, string>>
  priorityGeojsonUrls?: Record<number, string>
  dssBivariateGeojsonUrls?: Partial<
    Record<
      AnalyticsIndicatorKey,
      Partial<Record<AnalyticsIndicatorKey, Record<number, string>>>
    >
  >
}

interface AnalyticsMapPanelProps extends GeojsonSources {
  priority: IndicatorMeta
  selectedIndicator: AnalyticsIndicatorKey
  selectedMeta: IndicatorMeta
  effectiveYear: number | null
  csvUrl?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// 3 map modes:
//   DSS bivariate  — dssIndicator is set
//   MM bivariate   — dssIndicator is null && isBivariate
//   Solo MM        — dssIndicator is null && !isBivariate
function resolveGeojsonUrl(
  sources: GeojsonSources,
  selection: {
    selectedIndicator: AnalyticsIndicatorKey
    dssIndicator: AnalyticsIndicatorKey | null
    isBivariate: boolean
    year: number | null
  },
): string | undefined {
  const { selectedIndicator, dssIndicator, isBivariate, year } = selection
  if (year === null) return undefined
  if (dssIndicator) {
    return sources.dssBivariateGeojsonUrls?.[selectedIndicator]?.[
      dssIndicator
    ]?.[year]
  }
  if (isBivariate) return sources.geojsonUrls?.[selectedIndicator]?.[year]
  return sources.priorityGeojsonUrls?.[year]
}

const formatPercent = (v: number) => (v * 100).toFixed(1) + '%'
const formatDecimal = (v: number) => v.toFixed(2)

const toggleClass = (active: boolean) =>
  `px-4 py-1.5 transition-colors ${
    active
      ? 'bg-gray-800 text-white'
      : 'bg-white text-gray-600 hover:bg-gray-50'
  }`

function parseTableRows(geojson: {
  features?: { properties: { Territorio?: string; value?: number } }[]
}): TableRow[] {
  return (geojson.features ?? [])
    .map((f) => ({
      name: f.properties.Territorio ?? '',
      value: f.properties.value ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function useGeojsonTable() {
  const [tableData, setTableData] = useState<TableRow[]>([])
  const [tableLoading, setTableLoading] = useState(false)

  const fetchTableData = (url: string) => {
    setTableLoading(true)
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((geojson) => {
        setTableData(parseTableRows(geojson))
        setTableLoading(false)
      })
      .catch(() => setTableLoading(false))
  }

  return { tableData, tableLoading, fetchTableData }
}

// ── Bivariate legend ──────────────────────────────────────────────────────────

function BivariateLegend({
  indLabel,
  yAxisLabel,
}: {
  indLabel: string
  yAxisLabel: string
}) {
  const cellSize = 22

  return (
    <div className="flex items-end gap-3">
      <div
        className="flex flex-col items-center gap-1 shrink-0"
        style={{ width: 14 }}
      >
        <span
          className="text-gray-500 text-xs font-medium"
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            whiteSpace: 'nowrap',
            lineHeight: 1.1,
          }}
        >
          {yAxisLabel} →
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {[...BIVARIATE_COLORS].reverse().map((mmRow, reversedIdx) => {
          const mmIdx = BIVARIATE_COLORS.length - 1 - reversedIdx
          return (
            <div key={mmIdx} className="flex gap-0.5">
              {mmRow.map((color, indIdx) => (
                <div
                  key={indIdx}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: color,
                    border: '1px solid rgba(0,0,0,0.08)',
                  }}
                  title={`${yAxisLabel}: ${mmIdx === 0 ? 'Baja' : mmIdx === 1 ? 'Media' : 'Alta'} / Indicador: ${indIdx === 0 ? 'Bajo' : indIdx === 1 ? 'Medio' : 'Alto'}`}
                />
              ))}
            </div>
          )
        })}

        <div
          className="flex items-center gap-1 mt-0.5"
          style={{ paddingLeft: 2 }}
        >
          <span className="text-gray-400 text-xs">Bajo</span>
          <div
            className="flex-1 border-t border-gray-400"
            style={{ marginTop: 1 }}
          />
          <span className="text-gray-400 text-xs">→</span>
        </div>

        <div className="text-center">
          <span
            className="text-gray-500 text-xs font-medium"
            style={{ whiteSpace: 'nowrap' }}
          >
            {indLabel}
          </span>
        </div>
      </div>
    </div>
  )
}

function NoDataSwatch({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div
        style={{
          width: 14,
          height: 14,
          background: '#CCCCCC',
          border: '1px solid #9ca3af',
          borderRadius: 3,
          flexShrink: 0,
        }}
      />
      <span className="text-gray-600 text-xs">Sin datos</span>
    </div>
  )
}

function MapLegend({
  isDssValue,
  indLabel,
  yAxisLabel,
  priorityTitle,
}: {
  isDssValue: boolean
  indLabel: string
  yAxisLabel: string
  priorityTitle: string
}) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-gray-700">Leyenda:</span>

      {isDssValue ? (
        <div className="flex items-start gap-6 flex-wrap">
          <BivariateLegend indLabel={indLabel} yAxisLabel={yAxisLabel} />
          <NoDataSwatch className="self-end" />
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs w-36 shrink-0">
              {priorityTitle}
            </span>
            <span className="text-gray-600 text-xs">Menor</span>
            <div
              style={{
                width: 120,
                height: 14,
                background:
                  'linear-gradient(to right, #FFFFB2, #FECC5C, #FD8D3C, #F03B20, #BD0026)',
                border: '1px solid #9ca3af',
                borderRadius: 3,
              }}
            />
            <span className="text-gray-600 text-xs">Mayor</span>
          </div>
          <NoDataSwatch />
        </div>
      )}
    </div>
  )
}

// ── Map title ─────────────────────────────────────────────────────────────────

function MapTitle({
  isBivariate,
  isDssBivariate,
  selectedMeta,
  dssSecondaryMeta,
  priority,
}: {
  isBivariate: boolean
  isDssBivariate: boolean
  selectedMeta: IndicatorMeta
  dssSecondaryMeta: IndicatorMeta | null
  priority: IndicatorMeta
}) {
  const primary = (text: string) => (
    <span style={{ color: selectedMeta.color }}>{text}</span>
  )

  let content: ReactNode
  if (isBivariate) {
    content = (
      <>
        {primary(selectedMeta.title)} vs{' '}
        <span>
          {dssSecondaryMeta ? dssSecondaryMeta.title : priority.axisLabel}
        </span>
      </>
    )
  } else if (isDssBivariate) {
    content = (
      <>
        {primary(selectedMeta.label)} vs{' '}
        <span>
          {dssSecondaryMeta ? dssSecondaryMeta.label : priority.axisLabel}
        </span>
      </>
    )
  } else {
    content = primary(`Solo ${priority.title}`)
  }

  return (
    <h2 className="text-xl font-bold text-gray-900 mr-8">Mapa: {content}</h2>
  )
}

// ── Controls bar ──────────────────────────────────────────────────────────────

function DownloadLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      download
      className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Descargar Tabla
    </a>
  )
}

function DssIndicatorSelect({
  value,
  active,
  options,
  onChange,
}: {
  value: AnalyticsIndicatorKey | null
  active: boolean
  options: [AnalyticsIndicatorKey, IndicatorMeta][]
  onChange: (key: AnalyticsIndicatorKey | null) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500 shrink-0">Bivariado DSS:</span>
      <select
        value={value ?? ''}
        onChange={(e) =>
          onChange(
            e.target.value ? (e.target.value as AnalyticsIndicatorKey) : null,
          )
        }
        className={`text-sm rounded-lg border px-2 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 ${
          active
            ? 'border-gray-800 bg-gray-800 text-white'
            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        <option value="">Seleccionar indicador</option>
        {options.map(([key, meta]) => (
          <option key={key} value={key}>
            {meta.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function ToggleGroup({
  items,
}: {
  items: { label: string; active: boolean; onClick: () => void }[]
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={item.onClick}
          className={toggleClass(item.active)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ── Table view ────────────────────────────────────────────────────────────────

function MapTable({
  rows,
  loading,
  columnLabel,
  formatValue,
}: {
  rows: TableRow[]
  loading: boolean
  columnLabel: string
  formatValue: (v: number) => string
}) {
  if (loading) {
    return (
      <p className="text-gray-500 italic py-8 text-center">Cargando datos…</p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 font-medium">Barrio</th>
            <th className="px-4 py-3 font-medium">{columnLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr
              key={row.name}
              className="bg-white hover:bg-gray-50 transition-colors"
            >
              <td className="px-4 py-3 font-medium text-gray-900">
                {row.name}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {row.value != null && Number.isFinite(row.value)
                  ? formatValue(row.value)
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export const AnalyticsMapPanel = ({
  priority,
  selectedIndicator,
  selectedMeta,
  effectiveYear,
  geojsonUrls,
  priorityGeojsonUrls,
  dssBivariateGeojsonUrls,
  csvUrl,
}: AnalyticsMapPanelProps) => {
  const [isBivariate, setIsBivariate] = useState(true)
  // null = no DSS-vs-DSS mode; a key = show bivariate of selectedIndicator × selectedDssIndicator
  const [selectedDssIndicator, setSelectedDssIndicator] =
    useState<AnalyticsIndicatorKey | null>(null)
  const [view, setView] = useState<MapView>('map')
  const { tableData, tableLoading, fetchTableData } = useGeojsonTable()

  // Reset DSS indicator choice whenever the forest-plot selection changes so the
  // dropdown never holds the same key as selectedIndicator.
  useEffect(() => {
    setSelectedDssIndicator(null)
  }, [selectedIndicator])

  const sources = { geojsonUrls, priorityGeojsonUrls, dssBivariateGeojsonUrls }
  const urlFor = (
    dssIndicator: AnalyticsIndicatorKey | null,
    bivariate: boolean,
  ) =>
    resolveGeojsonUrl(sources, {
      selectedIndicator,
      dssIndicator,
      isBivariate: bivariate,
      year: effectiveYear,
    })

  const activeGeojsonUrl = urlFor(selectedDssIndicator, isBivariate)

  const isDssBivariate = selectedDssIndicator !== null
  const dssSecondaryMeta = selectedDssIndicator
    ? indicatorsBySlug[selectedDssIndicator]
    : null

  // DSS indicator values in GeoJSON are in 0-1 range; display as percentages
  const isDssValue = isBivariate || isDssBivariate

  // All indicator options except the currently selected one (for the DSS selector)
  const dssOptions = (
    Object.entries(indicatorsBySlug) as [AnalyticsIndicatorKey, IndicatorMeta][]
  ).filter(([key]) => key !== selectedIndicator)

  // ── Map / table handlers ───────────────────────────────────────────────────

  useEffect(() => {
    if (view === 'table' && activeGeojsonUrl) {
      fetchTableData(activeGeojsonUrl)
    }
  }, [activeGeojsonUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshTable = (nextUrl: string | undefined) => {
    if (view === 'table' && nextUrl) fetchTableData(nextUrl)
  }

  const handleViewChange = (nextView: MapView) => {
    setView(nextView)
    if (nextView === 'table' && activeGeojsonUrl) {
      fetchTableData(activeGeojsonUrl)
    }
  }

  const handleBivariateToggle = (next: boolean) => {
    setSelectedDssIndicator(null)
    setIsBivariate(next)
    refreshTable(urlFor(null, next))
  }

  const handleDssIndicatorChange = (key: AnalyticsIndicatorKey | null) => {
    setSelectedDssIndicator(key)
    refreshTable(urlFor(key, isBivariate))
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const valueName = isDssValue ? selectedMeta.label : priority.axisLabel
  const secondaryValueName = isDssBivariate
    ? dssSecondaryMeta?.label
    : isBivariate
      ? priority.axisLabel
      : undefined
  const legendYAxisLabel = isDssBivariate
    ? (dssSecondaryMeta?.label ?? '')
    : priority.axisLabel

  return (
    <ExpandablePanel className="relative border rounded-lg p-4 flex flex-col gap-4">
      {(isFullscreen) => {
        const mapHeight = isFullscreen ? 'calc(100vh - 280px)' : '30em'
        return (
          <>
            <MapTitle
              isBivariate={isBivariate}
              isDssBivariate={isDssBivariate}
              selectedMeta={selectedMeta}
              dssSecondaryMeta={dssSecondaryMeta}
              priority={priority}
            />

            {/* Controls bar */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {/* Bivariate / solo toggle + DSS indicator selector */}
              <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup
                  items={[
                    {
                      label: 'Bivariado',
                      active: isBivariate && !isDssBivariate,
                      onClick: () => handleBivariateToggle(true),
                    },
                    {
                      label: `Solo ${priority.title}`,
                      active: !isBivariate && !isDssBivariate,
                      onClick: () => handleBivariateToggle(false),
                    },
                  ]}
                />
                <DssIndicatorSelect
                  value={selectedDssIndicator}
                  active={isDssBivariate}
                  options={dssOptions}
                  onChange={handleDssIndicatorChange}
                />
              </div>

              <div className="flex items-center gap-2">
                <ToggleGroup
                  items={[
                    {
                      label: 'Mapa',
                      active: view === 'map',
                      onClick: () => handleViewChange('map'),
                    },
                    {
                      label: 'Tabla',
                      active: view === 'table',
                      onClick: () => handleViewChange('table'),
                    },
                  ]}
                />
                {csvUrl && <DownloadLink href={csvUrl} />}
              </div>
            </div>

            {view === 'map' ? (
              <>
                <Suspense
                  fallback={
                    <div
                      className="flex items-center justify-center text-gray-400 text-sm"
                      style={{ height: mapHeight }}
                    >
                      Cargando mapa…
                    </div>
                  }
                >
                  <DSChoroplethMap
                    geojsonUrl={activeGeojsonUrl}
                    center={[2.3, -75.7]}
                    zoom={8}
                    height={mapHeight}
                    nameProperty="Territorio"
                    valueProperty="value"
                    valueName={valueName}
                    secondaryValueProperty={
                      isDssValue ? priority.bivariateValue : undefined
                    }
                    secondaryValueName={secondaryValueName}
                    valueFormatter={isDssValue ? formatPercent : undefined}
                  />
                </Suspense>

                <MapLegend
                  isDssValue={isDssValue}
                  indLabel={`${selectedMeta.label} →`}
                  yAxisLabel={legendYAxisLabel}
                  priorityTitle={priority.title}
                />
              </>
            ) : (
              <MapTable
                rows={tableData}
                loading={tableLoading}
                columnLabel={valueName}
                formatValue={isDssValue ? formatPercent : formatDecimal}
              />
            )}
          </>
        )
      }}
    </ExpandablePanel>
  )
}
