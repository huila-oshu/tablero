# Sistema de Monitoreo de Determinantes Sociales de la Salud del Huila

Observatorio de Salud del Huila — Secretaría de Salud Departamental.

## Datos disponibles

Pobreza multidimensional del Huila: incidencia total departamental, 2018–2025, en porcentaje.

- Fuente: [DANE, anexo departamental de pobreza multidimensional 2025](https://www.dane.gov.co/files/operaciones/PM/anex-PMultidimensional-Departamental-2025.xlsx), hoja `IPM_Departamentos`.
- Procesamiento y resultados originales: [huila-oshu/dss-data-r](https://github.com/huila-oshu/dss-data-r/tree/main/src/indicators/dss/pobreza_multidimensional).
- Archivos del tablero: `public/data/csv/pobreza-multidimensional.csv` y `public/data/parquet/pobreza-multidimensional.parquet`.
- Sección: Determinantes Sociales de la Salud → Pobreza multidimensional del Huila.

La configuración territorial usa Huila y conserva los datos de pobreza y mortalidad materna. No se incluyen datos de demostración. Los mapas están desactivados; la dispersión temporal de pobreza y mortalidad usa únicamente años departamentales emparejados.

## Desarrollo y validación

```sh
npm ci
npm run dev
npm test
npm run build
```

`app.config.json` define los indicadores y sus archivos. Para pobreza, `territory` selecciona Huila, `valueMultiplier: 1` conserva los porcentajes originales y `map: false` evita solicitar mapas que no existen para esta serie.

La compilación genera `dist/`. La publicación en GitHub Pages se realiza mediante el workflow existente al integrar cambios en `main`.

## Indicador priorizado: razón de mortalidad materna

Se incluyen sin alterar los resultados de `huila-oshu/dss-data-r`, commit `f050ca5ede06e77379518e3c8feb70e928b3abe9`: `outputs/csv/razon_mortalidad_materna.csv` y `outputs/parquet/razon_mortalidad_materna.parquet`. Se copian como `mortalidad-materna.csv` y `.parquet` en este tablero. Son 857 registros sin duplicados por territorio/año, con Huila, 37 municipios y Nacional. La serie abarca 2005–2026; Nacional termina en 2025. CSV y Parquet coinciden.

El portal de origen identificado en el código del repositorio (Gobernación del Huila, idFile=85285) devolvió HTTP 403 al intentar una segunda verificación del Excel. Por ello, se conserva la trazabilidad a los resultados existentes y no se afirma haber verificado nuevamente el Excel. El archivo adjunto denominado `razon_mortalidad_huila.R` calcula suicidio y no se utiliza para este indicador.

### Métodos reproducibles

Los cálculos se implementan en `src/lib/maternalAnalysis.ts`, sobre los datos leídos del Parquet. No hay valores sanitarios embebidos en los componentes.

- Tendencia: valores publicados de Huila, Nacional y el municipio seleccionado, sin multiplicarlos por 100 ni limitar el eje a 100.
- Diferencia absoluta: RMM del territorio comparado menos RMM de referencia. Razón relativa: RMM del territorio comparado dividida por la referencia; no calculable cuando la referencia es cero o falta. Los ceros observados se conservan.
- Cambio anual: diferencia y variación porcentual respecto al año inmediatamente anterior disponible; no se salta un año faltante ni se divide por cero.
- Comparación municipal: cada municipio frente al valor publicado de Huila del mismo año. Las subregiones se usan solo como filtros, sin promediar razones para reconstruir un agregado.
- Pobreza y mortalidad: cruce de Huila por año, con pobreza del mismo año o uno/dos años antes. Se excluye 2026 porque el corte no está documentado; el selector territorial inicia en 2025. Correlaciones descriptivas de Pearson y Spearman (rangos promedio en empates); se requieren al menos tres pares y variación en ambas series. No se publican p-valores ni intervalos de confianza de independencia para estas series temporales.
- No se asigna pobreza departamental a los municipios ni se generan quintiles socioeconómicos, índices de concentración/pendiente, brechas por etnia/área o mapas bivariados sin datos correspondientes. No se reconstruyen conteos de defunciones o nacimientos a partir de razones.

Las tablas de comparaciones y pares temporales pueden descargarse desde la interfaz. Son análisis exploratorios y no prueban causalidad.
