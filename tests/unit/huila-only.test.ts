import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { app, priorities } from '@/config/general'
import { buildPages, loadAllDatasets } from '@/lib/pageFactory'

describe('Huila-only dashboard', () => {
  it('keeps only the verified Huila dataset and removes demo analytics and maps', async () => {
    expect(app.local).toBe('Huila')
    expect(priorities).toHaveLength(0)
    expect(app.features).toEqual({ map: false, scatter: false })
    expect(app.datasets).toBeUndefined()
    expect(readdirSync('public/data/csv').filter((name) => !name.startsWith('.'))).toEqual(['pobreza-multidimensional.csv'])
    expect(readdirSync('public/data/parquet').filter((name) => !name.startsWith('.'))).toEqual(['pobreza-multidimensional.parquet'])
    const datasets = await loadAllDatasets()
    expect(Object.keys(datasets.stratifiedData)).toEqual(['pobreza-multidimensional'])
    expect(datasets.stratifiedData['pobreza-multidimensional'].every((row) => row.territorio === 'Huila')).toBe(true)
    expect(datasets.analyticsData).toHaveLength(0)
    expect(datasets.scatterData).toHaveLength(0)
    expect(datasets.forestPlotData).toHaveLength(0)
    const routes = buildPages(datasets).map((page) => page.slug)
    expect(routes).not.toContain('mortalidad-materna')
    expect(routes).not.toContain('analisis/mortalidad-materna')
  })
})
