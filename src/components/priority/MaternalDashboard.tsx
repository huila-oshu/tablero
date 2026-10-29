import { useState } from 'react'
import { DSLineChart } from '@ops-dss/charts/line-chart'
import { DSScatterChart } from '@ops-dss/charts/scatter-chart'
import type { PriorityRow, StratifiedRow } from '@/lib/parquet'
import { annualComparison, municipalComparison, povertyAssociation } from '@/lib/maternalAnalysis'

const fmt = (v: number | null | undefined, digits = 2) =>
  v == null || !Number.isFinite(v) ? 'No calculable' : v.toLocaleString('es-CO', { maximumFractionDigits: digits, minimumFractionDigits: digits })
const unit = 'Muertes maternas por 100.000 nacidos vivos'
const panel = 'rounded-lg border border-gray-200 bg-white p-4 overflow-x-auto'
const cell = 'px-3 py-2 text-right border-b border-gray-100'

function download(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const quote = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const csv = [keys.map(quote).join(','), ...rows.map((r) => keys.map((k) => quote(r[k])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function MaternalDashboard({ data, poverty = [], mode, csvPath }: {
  data: PriorityRow[]; poverty?: StratifiedRow[]; mode: 'priority' | 'advanced'; csvPath: string
}) {
  const annual = annualComparison(data)
  const years = annual.map((r) => r.anio).sort((a, b) => b - a)
  const [year, setYear] = useState(years.find((y) => y < 2026) ?? years[0])
  const [municipality, setMunicipality] = useState('')
  const [subregion, setSubregion] = useState('Todas')
  const [lag, setLag] = useState(0)
  const selected = annual.find((r) => r.anio === year)
  const municipal = municipalComparison(data, year)
  const visible = municipal.filter((r) => subregion === 'Todas' || r.subregion === subregion)
  const municipalities = [...new Set(data.filter((r) => !['Huila', 'Nacional'].includes(r.territorio)).map((r) => r.territorio))].sort((a, b) => a.localeCompare(b, 'es'))
  const trend = annual.map((r) => ({ anio: r.anio, Huila: r.huila,
    ...(r.nacional == null ? {} : { Colombia: r.nacional }),
    ...(municipality ? { Municipio: data.find((d) => d.anio === r.anio && d.territorio === municipality)?.valor } : {}),
  }))
  const association = povertyAssociation(data, poverty, lag)
  const subregions = [...new Set(municipal.map((r) => String(r.subregion)))].sort()
  const buttons = 'rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50'

  return <div className="flex flex-col gap-6 text-black">
    <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
      La base incluye 2026 sin fecha de corte ni estado definitivo documentados. Se selecciona inicialmente 2025 y se excluye 2026 de las asociaciones temporales. Verifique el corte antes de comparar 2026 con años completos.
    </p>
    {mode === 'priority' && <label className="flex gap-3 items-center">Año de comparación
      <select aria-label="Año de comparación" value={year} onChange={(e) => setYear(Number(e.target.value))} className={buttons}>
        {years.map((y) => <option key={y} value={y}>{y}{y === 2026 ? ' (corte por confirmar)' : ''}</option>)}
      </select>
    </label>}
    {mode === 'priority' && <>
      <div className="grid gap-4 md:grid-cols-3">
        <div className={panel}><p>Huila · {year}</p><strong className="text-3xl">{fmt(selected?.huila)}</strong><p className="text-sm">{unit}</p></div>
        <div className={panel}><p>Colombia · {year}</p><strong className="text-3xl">{fmt(selected?.nacional)}</strong><p className="text-sm">{unit}</p></div>
        <div className={panel}><p>Cambio frente al año anterior</p><strong className="text-3xl">{fmt(selected?.changePercent)}{selected?.changePercent == null ? '' : ' %'}</strong><p className="text-sm">Diferencia en la RMM: {fmt(selected?.change)}</p></div>
      </div>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Tendencia de la razón de mortalidad materna</h2>
        <p className="text-sm my-2">Las líneas muestran las razones publicadas; no se promedian los valores municipales para obtener el total departamental.</p>
        <label>Municipio para comparar <select className={buttons} value={municipality} onChange={(e) => setMunicipality(e.target.value)}>
          <option value="">Solo Huila y Colombia</option>{municipalities.map((m) => <option key={m}>{m}</option>)}
        </select></label>
        <DSLineChart data={trend} xAxisKey="anio" lines={[
          { dataKey: 'Huila', name: 'Huila', color: '#b91c1c' },
          { dataKey: 'Colombia', name: 'Colombia', color: '#1d4ed8' },
          ...(municipality ? [{ dataKey: 'Municipio', name: municipality, color: '#548235' }] : []),
        ]} height={420} xAxisLabel="Año" yAxisLabel={unit} yAxisDomain={[0, 'auto']} highlightX={year} />
      </section>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Comparación anual Huila–Colombia</h2>
        <p className="text-sm my-2">Diferencia absoluta = Huila − Colombia; razón relativa = Huila / Colombia. El cambio anual se calcula frente al año inmediatamente anterior. Las razones relativas no se calculan cuando el denominador es cero o falta.</p>
        <button className={buttons} onClick={() => download('comparacion-mortalidad-huila-colombia.csv', annual)}>Descargar comparación anual</button>
        <table className="w-full text-sm mt-3"><caption className="text-left">RMM por 100.000 nacidos vivos y diferencias entre territorios</caption>
          <thead><tr>{['Año', 'Huila', 'Colombia', 'Diferencia absoluta', 'Razón relativa', 'Cambio anual (%)'].map((s) => <th key={s} className={cell}>{s}</th>)}</tr></thead>
          <tbody>{[...annual].reverse().map((r) => <tr key={r.anio}><th className={cell}>{r.anio}</th><td className={cell}>{fmt(r.huila)}</td><td className={cell}>{fmt(r.nacional)}</td><td className={cell}>{fmt(r.absolute)}</td><td className={cell}>{fmt(r.relative)}</td><td className={cell}>{fmt(r.changePercent)}</td></tr>)}</tbody>
        </table>
      </section>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Comparación de los municipios con Huila · {year}</h2>
        <p className="text-sm my-2">Diferencias territoriales descriptivas; por sí solas no prueban inequidad. Los valores cero registrados se conservan. Una RMM alta en un municipio con pocos nacimientos puede variar considerablemente entre años.</p>
        <label>Subregión <select value={subregion} className={buttons} onChange={(e) => setSubregion(e.target.value)}><option>Todas</option>{subregions.map((s) => <option key={s}>{s}</option>)}</select></label>
        <button className={buttons} onClick={() => download(`comparacion-municipal-${year}.csv`, visible)}>Descargar comparación municipal</button>
        <table className="w-full text-sm mt-3"><thead><tr>{['Municipio', 'Subregión', 'RMM', 'Diferencia con Huila', 'Razón frente a Huila'].map((s) => <th key={s} className={cell}>{s}</th>)}</tr></thead>
          <tbody>{visible.map((r) => <tr key={r.territorio}><th className={cell}>{r.territorio}</th><td className={cell}>{r.subregion}</td><td className={cell}>{fmt(r.valor)}</td><td className={cell}>{fmt(r.absolute)}</td><td className={cell}>{fmt(r.relative)}</td></tr>)}</tbody></table>
      </section>
    </>}
    {mode === 'advanced' && <>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Relación temporal entre pobreza y mortalidad materna</h2>
        <p className="my-2">Cada observación corresponde a un año del Huila. Solo se emparejan años disponibles en ambas series; no se asigna el IPM departamental a los municipios.</p>
        <label>Desfase de pobreza <select className={buttons} value={lag} onChange={(e) => setLag(Number(e.target.value))}>
          <option value={0}>Mismo año</option><option value={1}>Pobreza del año anterior</option><option value={2}>Pobreza de dos años antes</option>
        </select></label>
        <div className="grid gap-4 md:grid-cols-3 my-4">
          <p>Años emparejados: <strong>{association.pairs.length}</strong></p>
          <p>Spearman (rangos): <strong>{fmt(association.spearman, 3)}</strong></p>
          <p>Pearson (lineal): <strong>{fmt(association.pearson, 3)}</strong></p>
        </div>
        <p className="text-sm my-2">Análisis exploratorio de series anuales, con pocas observaciones y posible dependencia temporal. Las correlaciones no demuestran causalidad ni relaciones individuales; el desfase tampoco establece un efecto. No se presentan pruebas de significación ni intervalos de confianza sin un modelo temporal apropiado.</p>
        {association.pairs.length >= 3 && <DSScatterChart data={association.pairs.map((p) => ({ x: p.pobreza, y: p.mortalidad, label: `RMM ${p.anio} · IPM ${p.anioPobreza}`, size: 1 }))} xLabel="Pobreza multidimensional (%)" yLabel={unit} width={800} />}
        <button className={buttons} onClick={() => download(`mortalidad-pobreza-desfase-${lag}.csv`, association.pairs)}>Descargar años emparejados</button>
        <table className="w-full text-sm mt-3"><thead><tr>{['Año de mortalidad', 'Año de pobreza', 'IPM (%)', 'RMM'].map((s) => <th key={s} className={cell}>{s}</th>)}</tr></thead>
          <tbody>{association.pairs.map((r) => <tr key={r.anio}><th className={cell}>{r.anio}</th><td className={cell}>{r.anioPobreza}</td><td className={cell}>{fmt(r.pobreza)}</td><td className={cell}>{fmt(r.mortalidad)}</td></tr>)}</tbody></table>
      </section>
      <section className={panel}><h2 className="text-xl font-semibold">Alcance de los análisis disponibles</h2>
        <p className="mt-2">Se necesita pobreza municipal para analizar brechas por quintiles socioeconómicos, índices de pendiente o concentración y mapas bivariados. La base disponible tampoco contiene etnia, área urbana/rural, defunciones ni nacidos vivos para calcular brechas de esos grupos, agregados subregionales ponderados o intervalos de la RMM. La subregión solo se usa como filtro de municipios.</p>
      </section>
    </>}
    <a className="underline text-blue-800" href={csvPath} download>Descargar datos originales de mortalidad materna</a>
  </div>
}
