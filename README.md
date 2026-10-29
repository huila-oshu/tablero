# Sistema de Monitoreo de Determinantes Sociales de la Salud del Huila

Observatorio de Salud del Huila — Secretaría de Salud Departamental.

## Datos disponibles

Pobreza multidimensional del Huila: incidencia total departamental, 2018–2025, en porcentaje.

- Fuente: [DANE, anexo departamental de pobreza multidimensional 2025](https://www.dane.gov.co/files/operaciones/PM/anex-PMultidimensional-Departamental-2025.xlsx), hoja `IPM_Departamentos`.
- Procesamiento y resultados originales: [huila-oshu/dss-data-r](https://github.com/huila-oshu/dss-data-r/tree/main/src/indicators/dss/pobreza_multidimensional).
- Archivos del tablero: `public/data/csv/pobreza-multidimensional.csv` y `public/data/parquet/pobreza-multidimensional.parquet`.
- Sección: Determinantes Sociales de la Salud → Pobreza multidimensional del Huila.

La configuración territorial usa Huila y conserva únicamente este indicador verificado. No se incluyen datos, mapas ni análisis de demostración. Las secciones de inequidad y análisis avanzado muestran un aviso hasta incorporar los indicadores priorizados y los datos reales necesarios. Los mapas y el análisis de dispersión están desactivados.

## Desarrollo y validación

```sh
npm ci
npm run dev
npm test
npm run build
```

`app.config.json` define los indicadores y sus archivos. Para pobreza, `territory` selecciona Huila, `valueMultiplier: 1` conserva los porcentajes originales y `map: false` evita solicitar mapas que no existen para esta serie.

La compilación genera `dist/`. La publicación en GitHub Pages se realiza mediante el workflow existente al integrar cambios en `main`.
