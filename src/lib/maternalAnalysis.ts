import type { PriorityRow, StratifiedRow } from './parquet'

export const difference = (value: number, reference: number) => ({
  absolute: value - reference,
  relative: reference > 0 ? value / reference : null,
})

export function annualComparison(rows: PriorityRow[]) {
  const local = rows.filter((r) => r.territorio === 'Huila').sort((a, b) => a.anio - b.anio)
  return local.map((row) => {
    const national = rows.find((r) => r.territorio === 'Nacional' && r.anio === row.anio)
    const previous = local.find((r) => r.anio === row.anio - 1)
    return {
      anio: row.anio, huila: row.valor, nacional: national?.valor ?? null,
      absolute: national ? difference(row.valor, national.valor).absolute : null,
      relative: national ? difference(row.valor, national.valor).relative : null,
      change: previous ? row.valor - previous.valor : null,
      changePercent: previous && previous.valor > 0 ? (row.valor / previous.valor - 1) * 100 : null,
    }
  })
}

export function municipalComparison(rows: PriorityRow[], year: number) {
  const reference = rows.find((r) => r.territorio === 'Huila' && r.anio === year)
  return rows.filter((r) => r.anio === year && r.territorio !== 'Huila' && r.territorio !== 'Nacional')
    .map((r) => ({ ...r, absolute: reference ? difference(r.valor, reference.valor).absolute : null,
      relative: reference ? difference(r.valor, reference.valor).relative : null }))
    .sort((a, b) => b.valor - a.valor || a.territorio.localeCompare(b.territorio, 'es'))
}

function ranks(values: number[]) {
  const ordered = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value)
  const result = new Array<number>(values.length)
  for (let i = 0; i < ordered.length;) {
    let j = i + 1
    while (j < ordered.length && ordered[j].value === ordered[i].value) j++
    for (let k = i; k < j; k++) result[ordered[k].index] = (i + j + 1) / 2
    i = j
  }
  return result
}

export function correlation(x: number[], y: number[]) {
  if (x.length !== y.length || x.length < 3) return null
  if (![...x, ...y].every(Number.isFinite)) return null
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
  const mx = mean(x), my = mean(y)
  const cross = x.reduce((sum, v, i) => sum + (v - mx) * (y[i] - my), 0)
  const denominator = Math.sqrt(x.reduce((sum, v) => sum + (v - mx) ** 2, 0) * y.reduce((sum, v) => sum + (v - my) ** 2, 0))
  return denominator > 0 ? Math.max(-1, Math.min(1, cross / denominator)) : null
}

export function povertyAssociation(rows: PriorityRow[], poverty: StratifiedRow[], lag = 0) {
  if (!Number.isInteger(lag) || lag < 0) throw new Error('Invalid lag')
  // Pair annual departmental observations only; never repeat Huila poverty across municipalities.
  // 2026 has no documented closing date and is excluded from the temporal association.
  const pairs = rows.filter((r) => r.territorio === 'Huila' && r.anio < 2026)
    .flatMap((r) => {
      const p = poverty.find((p) => p.anio === r.anio - lag && p.territorio === 'Huila')
      return p ? [{ anio: r.anio, anioPobreza: p.anio, mortalidad: r.valor, pobreza: p.valor }] : []
    }).sort((a, b) => a.anio - b.anio)
  const x = pairs.map((p) => p.pobreza), y = pairs.map((p) => p.mortalidad)
  return { pairs, pearson: correlation(x, y), spearman: correlation(ranks(x), ranks(y)) }
}
