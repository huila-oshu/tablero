import { indicators } from '@/config/general'
import type { IndicatorMeta } from '@/config/general'
import type { AnalyticsIndicatorKey } from '@/lib/parquet'

export const indicatorsBySlug = Object.fromEntries(
  indicators.map((i) => [i.slug, i]),
) as Record<AnalyticsIndicatorKey, IndicatorMeta>
