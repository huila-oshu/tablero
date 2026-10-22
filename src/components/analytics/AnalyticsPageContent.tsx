import { useState, useMemo } from 'react'
import { DSForestPlot } from '@ops-dss/charts/forest-plot'
import { DSScatterChart } from '@ops-dss/charts/scatter-chart'
import { AnalyticsDualChart } from './AnalyticsDualChart'
import { AnalyticsMapPanel } from './AnalyticsMapPanel'
import { indicatorsBySlug } from './indicatorsBySlug'
import { ExpandablePanel } from '@/components/ExpandablePanel'
import { app, indicators } from '@/config/general'
import type { IndicatorMeta } from '@/config/general'
import type {
  ForestPlotDataRow,
  AnalyticsRow,
  ScatterRow,
  AnalyticsIndicatorKey,
} from '@/lib/parquet'

// ── Types ─────────────────────────────────────────────────────────────────────

type ScatterPoint = { x: number; y: number; label: string; size: number }

interface AnalyticsPageContentProps {
  priority: IndicatorMeta
  forestPlotData?: ForestPlotDataRow[]
  analyticsData?: AnalyticsRow[]
  scatterData?: ScatterRow[]
  geojsonUrls?: Record<AnalyticsIndicatorKey, Record<number, string>>
  priorityGeojsonUrls?: Record<number, string>
  dssBivariateGeojsonUrls?: Partial<
    Record<
      AnalyticsIndicatorKey,
      Partial<Record<AnalyticsIndicatorKey, Record<number, string>>>
    >
  >
  csvUrl?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const hasRows = (rows: unknown[] | undefined) => !!rows && rows.length > 0

// Derive available years from whichever datasets are loaded (sorted
// descending for display) — scatter alone isn't a reliable source since
// it's gated behind its own feature flag and may be empty.
function collectYears(...datasets: ({ anio: number }[] | undefined)[]) {
  const years = new Set<number>()
  for (const rows of datasets) {
    for (const r of rows ?? []) years.add(r.anio)
  }
  return [...years].sort((a, b) => b - a)
}

function buildScatterPoints(
  scatterData: ScatterRow[] | undefined,
  year: number | null,
  indicator: AnalyticsIndicatorKey,
): ScatterPoint[] {
  if (!scatterData || year === null) return []
  return scatterData
    .filter((r) => r.anio === year)
    .map((r) => ({
      x: (r[indicator] as number) * 100,
      y: r.valor,
      label: r.territorio,
      size: r.nacimientos,
    }))
    .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
}

const yearLabel = (year: number | null, prefix = '') =>
  year !== null ? `${prefix}${year}` : 'último año disponible'

// ── Year selector ─────────────────────────────────────────────────────────────

function YearSelector({
  years,
  effectiveYear,
  lastYear,
  onSelect,
}: {
  years: number[]
  effectiveYear: number | null
  lastYear: number | null
  onSelect: (year: number | null) => void
}) {
  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm py-2 border-b border-gray-100 -mx-2 px-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 overflow-x-auto">
      <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm w-fit">
        {years.map((yr) => (
          <button
            key={yr}
            onClick={() => onSelect(yr === lastYear ? null : yr)}
            className={`px-3 py-1 text-sm transition-colors ${
              yr === effectiveYear
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {yr}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Chart panels ──────────────────────────────────────────────────────────────

function ForestPlotPanel({
  priority,
  data,
  effectiveYear,
  selectedIndicator,
  onSelect,
}: {
  priority: IndicatorMeta
  data: ForestPlotDataRow[]
  effectiveYear: number | null
  selectedIndicator: AnalyticsIndicatorKey
  onSelect: (indicator: AnalyticsIndicatorKey) => void
}) {
  return (
    <ExpandablePanel>
      <h2 className="text-xl font-bold text-gray-900 mr-8">
        Correlaciones con {priority.title}
      </h2>
      <p className="text-sm text-gray-500 mt-1">
        Correlación de Spearman entre cada indicador y la problemática
        priorizada (barrios,{' '}
        {yearLabel(effectiveYear, ' ')}).
        Seleccione un indicador para explorar su relación.
      </p>
      {data.length > 0 ? (
        <DSForestPlot
          data={data}
          selectedIndicator={selectedIndicator}
          onSelectIndicator={(ind) => onSelect(ind as AnalyticsIndicatorKey)}
        />
      ) : (
        <p className="text-gray-400 italic text-sm py-6 text-center">
          Sin datos suficientes para {effectiveYear}.
        </p>
      )}
    </ExpandablePanel>
  )
}

function ScatterPanel({
  priority,
  selectedMeta,
  effectiveYear,
  points,
}: {
  priority: IndicatorMeta
  selectedMeta: IndicatorMeta
  effectiveYear: number | null
  points: ScatterPoint[]
}) {
  return (
    <ExpandablePanel className="relative border rounded-lg p-4 flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mr-8">
          Dispersión:{' '}
          <span style={{ color: selectedMeta.color }}>{selectedMeta.title}</span>{' '}
          vs {priority.axisLabel}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Cada punto es un barrio de {app.local} (
          {yearLabel(effectiveYear, 'año ')}). El tamaño refleja el número de
          nacidos vivos. La línea punteada muestra la tendencia lineal.
        </p>
      </div>
      <DSScatterChart
        data={points}
        xLabel={selectedMeta.axisLabel}
        yLabel={priority.axisLabel}
        width={800}
      />
    </ExpandablePanel>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export const AnalyticsPageContent = ({
  priority,
  forestPlotData,
  analyticsData,
  scatterData,
  geojsonUrls,
  priorityGeojsonUrls,
  dssBivariateGeojsonUrls,
  csvUrl,
}: AnalyticsPageContentProps) => {
  const [selectedIndicator, setSelectedIndicator] =
    useState<AnalyticsIndicatorKey>(indicators[0]?.slug ?? '')

  // ── Year selection ──────────────────────────────────────────────────────────

  const availableYears = useMemo(
    () => collectYears(analyticsData, scatterData, forestPlotData),
    [analyticsData, scatterData, forestPlotData],
  )

  const lastYear = availableYears[0] ?? null

  // selectedYear === null means "use lastYear" (default, pre-selected)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const effectiveYear: number | null = selectedYear ?? lastYear

  // ── Derived values ─────────────────────────────────────────────────────────

  const hasData =
    hasRows(forestPlotData) || hasRows(analyticsData) || hasRows(scatterData)

  const selectedMeta = indicatorsBySlug[selectedIndicator]

  // Forest plot: filter to the selected year; rows without data for this year
  // are simply absent (the R script skips indicator-year combos with n < 4).
  const forestPlotForYear = useMemo(() => {
    if (!forestPlotData || effectiveYear === null) return forestPlotData ?? []
    return forestPlotData.filter((r) => r.anio === effectiveYear)
  }, [forestPlotData, effectiveYear])

  const scatterPoints = buildScatterPoints(
    scatterData,
    effectiveYear,
    selectedIndicator,
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!hasData) {
    return (
      <p className="text-gray-500 italic py-8 text-center">
        No hay datos disponibles.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4 mb-10">
      {availableYears.length > 1 && (
        <YearSelector
          years={availableYears}
          effectiveYear={effectiveYear}
          lastYear={lastYear}
          onSelect={setSelectedYear}
        />
      )}

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex flex-col md:basis-1/2 flex-1 gap-4">
          {hasRows(forestPlotData) && (
            <ForestPlotPanel
              priority={priority}
              data={forestPlotForYear}
              effectiveYear={effectiveYear}
              selectedIndicator={selectedIndicator}
              onSelect={setSelectedIndicator}
            />
          )}

          {/* ── Temporal trends ── */}
          {analyticsData && analyticsData.length > 0 && (
            <ExpandablePanel className="relative border rounded-lg p-4 flex flex-col gap-4">
              {(isFullscreen) => (
                <AnalyticsDualChart
                  priority={priority}
                  data={analyticsData}
                  selectedIndicator={selectedIndicator}
                  selectedYear={effectiveYear}
                  isFullscreen={isFullscreen}
                />
              )}
            </ExpandablePanel>
          )}
        </div>

        <div className="flex flex-col md:basis-1/2 gap-4 flex-1">
          {scatterPoints.length > 0 && (
            <ScatterPanel
              priority={priority}
              selectedMeta={selectedMeta}
              effectiveYear={effectiveYear}
              points={scatterPoints}
            />
          )}

          {app.features.map && (
            <AnalyticsMapPanel
              priority={priority}
              selectedIndicator={selectedIndicator}
              selectedMeta={selectedMeta}
              effectiveYear={effectiveYear}
              geojsonUrls={geojsonUrls}
              priorityGeojsonUrls={priorityGeojsonUrls}
              dssBivariateGeojsonUrls={dssBivariateGeojsonUrls}
              csvUrl={csvUrl}
            />
          )}
        </div>
      </div>
    </div>
  )
}
