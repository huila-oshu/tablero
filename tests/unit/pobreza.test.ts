import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { indicators } from '@/config/general'
import { loadAllDatasets, buildPages } from '@/lib/pageFactory'
import { pivotData } from '@/components/StratifiedLineChart'

describe('Huila poverty series from the committed DANE outputs', () => {
  it('loads Huila despite the template territory and preserves CSV percentages in the chart', async () => {
    const datasets = await loadAllDatasets()
    const indicator = indicators.find((ind) => ind.slug === 'pobreza-multidimensional')!
    const rows = datasets.stratifiedData[indicator.slug]
    const csv = readFileSync('public/data/csv/pobreza-multidimensional.csv', 'utf8').trim().split(/\r?\n/).slice(1)
      .map((line) => { const [territorio, anio, valor] = line.split(','); return { territorio, anio: Number(anio), valor: Number(valor) } })
    expect(rows).toEqual(csv)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.territorio === 'Huila')).toBe(true)
    const { chartData } = pivotData(rows, 'total', [], indicator)
    expect(chartData.map((row) => row.Total)).toEqual(csv.map((row) => row.valor))
    expect(buildPages(datasets).find((page) => page.slug === indicator.slug)?.stratifiedData).toEqual(rows)
  })

  it('preserves the existing proportion scaling when a multiplier is absent', async () => {
    const datasets = await loadAllDatasets()
    const indicator = indicators.find((ind) => ind.slug === 'traslado')!
    const rows = datasets.stratifiedData[indicator.slug]
    const row = rows.find((r) => (indicator.stratifiers ?? []).every((s) => r[s] === 'Total'))!
    expect(row).toBeDefined()
    expect(pivotData([row], 'total', indicator.stratifiers ?? [], indicator).chartData[0].Total).toBe(row.valor * 100)
  })
})
