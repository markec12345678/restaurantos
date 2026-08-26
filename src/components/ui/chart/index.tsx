"use client"

// Barrel file — re-exports all chart components so that
// `import { … } from "@/components/ui/chart"` still works.

// Types
export type { ChartConfig } from "./chart-context"

// Context & hooks
export { ChartContext, useChart } from "./chart-context"

// Container & style
export { ChartContainer, ChartStyle } from "./chart-container"

// Tooltip
export { ChartTooltip, ChartTooltipContent } from "./chart-tooltip"

// Legend
export { ChartLegend, ChartLegendContent } from "./chart-legend"
