import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadAllDatasets, buildPages } from '@/lib/pageFactory'
import { annualComparison, municipalComparison, povertyAssociation, difference } from '@/lib/maternalAnalysis'

describe('Maternal mortality analyses from the real Huila outputs', () => {
  it('loads all source rates unchanged and exposes the priority analysis routes', async () => {
    const datasets = await loadAllDatasets()
    const rows = datasets.priorityData['mortalidad-materna']
    const csv = readFileSync('public/data/csv/mortalidad-materna.csv', 'utf8').trim().split(/\r?\n/).slice(1)
    expect(rows).toHaveLength(csv.length)
    for (const line of csv) {
      const [, territorio, , anio, , valor] = line.split(',')
      expect(rows.find((r) => r.territorio === territorio && r.anio === Number(anio))?.valor).toBeCloseTo(Number(valor), 10)
    }
    const pages = buildPages(datasets)
    expect(pages.find((p) => p.slug === 'analisis-de-inequidad/mortalidad-materna')?.data).toEqual(rows)
    expect(pages.find((p) => p.slug === 'analisis/mortalidad-materna')?.stratifiedData).toEqual(datasets.stratifiedData['pobreza-multidimensional'])
  })

  it('does not replace the missing national 2026 rate by zero or discard zero municipal rates', async () => {
    const { priorityData } = await loadAllDatasets()
    const rows = priorityData['mortalidad-materna']
    const latest = annualComparison(rows).find((r) => r.anio === 2026)!
    expect(latest.nacional).toBeNull()
    expect(latest.absolute).toBeNull()
    expect(latest.relative).toBeNull()
    const municipal = municipalComparison(rows, 2025)
    expect(municipal).toHaveLength(37)
    expect(municipal.some((r) => r.valor === 0)).toBe(true)
    const zero = municipal.find((r) => r.valor === 0)!
    expect(zero.relative).toBe(0)
    expect(difference(latest.huila, zero.valor).relative).toBeNull()
    expect(municipal.every((r) => !['Huila', 'Nacional'].includes(r.territorio))).toBe(true)
  })

  it('pairs departmental observations by actual year, applies lags and does not use 2026', async () => {
    const d = await loadAllDatasets()
    const maternal = d.priorityData['mortalidad-materna'], poverty = d.stratifiedData['pobreza-multidimensional']
    const same = povertyAssociation(maternal, poverty)
    expect(same.pairs.map((r) => r.anio)).toEqual(poverty.map((r) => r.anio))
    expect(same.pairs).toHaveLength(8)
    for (const lag of [0, 1, 2]) {
      const result = povertyAssociation(maternal, poverty, lag)
      expect(result.pairs.every((r) => r.anio < 2026 && r.anioPobreza === r.anio - lag)).toBe(true)
      expect(result.pairs).toHaveLength(8 - lag)
    }
    // Independently checked against pandas/scipy on the same committed CSV files.
    expect(same.pearson).toBeCloseTo(-0.42755237924526285, 10)
    expect(same.spearman).toBeCloseTo(-0.5714285714285715, 10)
    expect(povertyAssociation([], poverty).spearman).toBeNull()
  })
})
