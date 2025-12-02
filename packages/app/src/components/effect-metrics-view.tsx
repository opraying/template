import type { CountMetric, DebugMetric, FrequencyMetric, GaugeMetric, HistogramMetric } from '@xstack/app/metric/utils'
import { useAppearance } from '@xstack/lib/appearance/hooks'
import { useEffect, useId, useRef, useState } from 'react'

// 改用普通 Map 而不是 WeakMap，使用 instanceId 作为 key
const metricsHistoryStore = new Map<string, Map<string, number[]>>()

interface EffectMetricsView {
  width?: number
  minHeight?: number
  getMetrics: () => Promise<DebugMetric[]>
  className?: string
  refreshInterval?: number
  historySize?: number
  // 可选的实例 ID，用于多实例场景
  instanceId?: string
  onLoad?: () => void
  fallback?: React.ReactNode
}

const PR = Math.round(window.devicePixelRatio || 1)

const removeDotZero = /\.0$/

const formatNumber = (value: number, unit?: string) => {
  if (value < 1000) {
    // 0.0 -> 0
    if (value === 0) {
      return unit ? `0 ${unit}` : '0'
    }

    return unit
      ? `${value.toFixed(1).replace(removeDotZero, '')} ${unit}`
      : `${value.toFixed(1).replace(removeDotZero, '')}`
  }

  return unit
    ? `${(value / 1000).toFixed(1).replace(removeDotZero, '')}k ${unit}`
    : `${(value / 1000).toFixed(1).replace(removeDotZero, '')}k`
}

const getMonoFont = (fallback = "'JetBrains Mono', 'Fira Code', 'Consolas', monospace") => {
  // 如果在浏览器环境中
  if (typeof window !== 'undefined') {
    const computedStyle = window.getComputedStyle(document.documentElement)
    return computedStyle.getPropertyValue('--font-mono').trim() || fallback
  }

  return fallback
}

const THEMES = {
  light: {
    background: 'rgba(0, 0, 0, 0.02)',
    gridLines: 'rgba(0, 0, 0, 0.1)',
    text: 'rgba(0, 0, 0, 0.87)',
  },
  dark: {
    background: 'rgba(255, 255, 255, 0.5)',
    gridLines: 'rgba(255, 255, 255, 0.1)',
    text: 'rgba(255, 255, 255, 0.87)',
  },
} as const
export type ChartTheme = (typeof THEMES)[keyof typeof THEMES]

const CHART_CONFIG = {
  grid: {
    padding: 4 * PR,
    cellSpacing: 6 * PR,
    columns: 4,
  },
  cell: {
    standardHeight: 45 * PR,
    textOnlyHeight: 28 * PR,
    histogramHeight: 80 * PR,
    frequencyHeight: 100 * PR,
    padding: 4 * PR,
    titleFontSize: 11 * PR,
    valueFontSize: 13 * PR,
    statsFontSize: 12 * PR,
  },
  chart: {
    gridLines: 3,
    lineWidth: PR,
    barSpacing: PR,
    maxBarWidth: 6 * PR,
  },
  colors: {
    background: THEMES.light.background,
    gridLines: THEMES.light.gridLines,
    text: THEMES.light.text,
  },
  histogram: {
    labelHeight: 15 * PR,
    barMinHeight: 2 * PR,
    opacity: {
      bars: 0.8,
      highlight: 1,
    },
  },
  font: {
    mono: getMonoFont(),
  },
} as const

interface GridCell {
  x: number
  y: number
  width: number
  height: number
}

const getHistory = (instanceId: string) => {
  if (!metricsHistoryStore.has(instanceId)) {
    metricsHistoryStore.set(instanceId, new Map())
  }

  return metricsHistoryStore.get(instanceId)!
}

const getRGBAColor = (color: string, alpha: number) => {
  if (color.startsWith('rgba')) {
    return color.replace(/[\d.]+\)$/g, `${alpha})`)
  }
  if (color.startsWith('rgb')) {
    return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`)
  }
  return color // 如果是其他格式，保持原样
}

const calculateGridCells = (adjustedWidth: number, metrics: DebugMetric[]): GridCell[] => {
  const cells: GridCell[] = []
  let currentY = CHART_CONFIG.grid.padding
  let currentCol = 0
  let rowMaxHeight = CHART_CONFIG.cell.standardHeight

  // 计算基础单元格尺寸
  const availableWidth = adjustedWidth - CHART_CONFIG.grid.padding * 2
  const baseColumnWidth =
    (availableWidth - CHART_CONFIG.grid.cellSpacing * (CHART_CONFIG.grid.columns - 1)) / CHART_CONFIG.grid.columns
  const doubleColumnWidth = baseColumnWidth * 2 + CHART_CONFIG.grid.cellSpacing // 两列的宽度

  metrics.forEach((metric, _index) => {
    // 检查是否需要占用整行
    const isFullWidth =
      metric.type === 'frequency'
        ? true
        : metric.type === 'histogram'
          ? ((metric as HistogramMetric).fullWidth ?? true)
          : false

    // histogram 类型且不是整行时占用两列
    const isDoubleWidth = metric.type === 'histogram' && !isFullWidth

    // 计算当前元素需要的宽度
    const cellWidth = isFullWidth ? availableWidth : isDoubleWidth ? doubleColumnWidth : baseColumnWidth

    const cellHeight =
      metric.type === 'histogram'
        ? CHART_CONFIG.cell.histogramHeight
        : metric.type === 'frequency'
          ? CHART_CONFIG.cell.frequencyHeight
          : metric.type === 'count' && (metric as CountMetric).textOnly
            ? CHART_CONFIG.cell.textOnlyHeight
            : CHART_CONFIG.cell.standardHeight

    // 如果当前行已有元素且遇到整行元素，先换行
    if (currentCol > 0 && isFullWidth) {
      currentY += rowMaxHeight + CHART_CONFIG.grid.cellSpacing
      currentCol = 0
      rowMaxHeight = cellHeight
    }
    // 如果是双列宽度且剩余空间不足，换行
    else if (isDoubleWidth && currentCol > CHART_CONFIG.grid.columns - 2) {
      currentY += rowMaxHeight + CHART_CONFIG.grid.cellSpacing
      currentCol = 0
      rowMaxHeight = cellHeight
    }
    // 如果到达行尾，也换行
    else if (currentCol >= CHART_CONFIG.grid.columns) {
      currentY += rowMaxHeight + CHART_CONFIG.grid.cellSpacing
      currentCol = 0
      rowMaxHeight = cellHeight
    }

    const x = isFullWidth
      ? CHART_CONFIG.grid.padding
      : CHART_CONFIG.grid.padding + currentCol * (baseColumnWidth + CHART_CONFIG.grid.cellSpacing)

    cells.push({
      x,
      y: currentY,
      width: cellWidth,
      height: cellHeight,
    })

    if (!isFullWidth) {
      currentCol += isDoubleWidth ? 2 : 1 // 双列宽度时增加2，否则增加1
      rowMaxHeight = Math.max(rowMaxHeight, cellHeight)
    } else {
      // 整行元素后直接换行
      currentY += cellHeight + CHART_CONFIG.grid.cellSpacing
      currentCol = 0
      rowMaxHeight = CHART_CONFIG.cell.standardHeight
    }
  })

  return cells
}

const drawChart = (
  ctx: CanvasRenderingContext2D,
  values: number[],
  cell: GridCell,
  color: string,
  label: string,
  value: string,
  historySize: number,
  textOnly = false,
  theme?: ChartTheme,
) => {
  if (textOnly) {
    // 仅绘制文本和值
    ctx.fillStyle = theme?.background ?? CHART_CONFIG.colors.background
    ctx.fillRect(cell.x, cell.y, cell.width, cell.height)

    // 绘制标签
    ctx.fillStyle = color
    ctx.font = `${CHART_CONFIG.cell.titleFontSize}px ${CHART_CONFIG.font.mono}`
    ctx.fillText(label, cell.x + CHART_CONFIG.cell.padding, cell.y + CHART_CONFIG.cell.titleFontSize)

    // 绘制值（在下一行）
    ctx.font = `bold ${CHART_CONFIG.cell.valueFontSize}px ${CHART_CONFIG.font.mono}`
    ctx.fillText(
      formatNumber(Number(value)),
      cell.x + CHART_CONFIG.cell.padding,
      cell.y + CHART_CONFIG.cell.titleFontSize + CHART_CONFIG.cell.valueFontSize + 10,
    )
    return
  }

  const points = values.slice(-historySize)
  if (points.length < 2) return

  // Draw title and value
  ctx.fillStyle = color
  ctx.font = `${CHART_CONFIG.cell.titleFontSize}px ${CHART_CONFIG.font.mono}`
  ctx.fillText(label, cell.x + CHART_CONFIG.cell.padding, cell.y + CHART_CONFIG.cell.titleFontSize)
  ctx.font = `bold ${CHART_CONFIG.cell.valueFontSize}px ${CHART_CONFIG.font.mono}`
  ctx.fillText(
    formatNumber(Number(value)),
    cell.x + CHART_CONFIG.cell.padding,
    cell.y + CHART_CONFIG.cell.titleFontSize + CHART_CONFIG.cell.valueFontSize + 6,
  )

  // Calculate chart area
  const chartArea = {
    x: cell.x + CHART_CONFIG.cell.padding,
    y: cell.y + CHART_CONFIG.cell.titleFontSize + CHART_CONFIG.cell.valueFontSize + CHART_CONFIG.cell.padding + 10,
    width: cell.width - CHART_CONFIG.cell.padding * 2,
    height:
      cell.height - (CHART_CONFIG.cell.titleFontSize + CHART_CONFIG.cell.valueFontSize + CHART_CONFIG.cell.padding * 2),
  }

  // Draw grid lines
  ctx.strokeStyle = theme?.gridLines ?? CHART_CONFIG.colors.gridLines
  ctx.lineWidth = 1
  for (let i = 0; i < CHART_CONFIG.chart.gridLines; i++) {
    const y = chartArea.y + (chartArea.height * i) / (CHART_CONFIG.chart.gridLines - 1)
    ctx.beginPath()
    ctx.moveTo(chartArea.x, y)
    ctx.lineTo(chartArea.x + chartArea.width, y)
    ctx.stroke()
  }

  // Draw chart line
  const maxValue = Math.max(...points)
  const minValue = Math.min(...points)
  const range = maxValue - minValue || 1

  ctx.strokeStyle = color
  ctx.lineWidth = CHART_CONFIG.chart.lineWidth
  ctx.beginPath()
  points.forEach((value, index) => {
    const pointX = chartArea.x + (index * chartArea.width) / (historySize - 1)
    const normalizedValue = (value - minValue) / range
    const pointY = chartArea.y + chartArea.height - normalizedValue * chartArea.height

    if (index === 0) {
      ctx.moveTo(pointX, pointY)
    } else {
      ctx.lineTo(pointX, pointY)
    }
  })
  ctx.stroke()
}

const drawHistogram = (ctx: CanvasRenderingContext2D, metric: HistogramMetric, cell: GridCell, theme?: ChartTheme) => {
  if (metric.count === 0) return
  // Draw title
  ctx.fillStyle = metric.color
  ctx.font = `${CHART_CONFIG.cell.titleFontSize}px ${CHART_CONFIG.font.mono}`
  ctx.fillText(metric.label, cell.x + CHART_CONFIG.cell.padding, cell.y + CHART_CONFIG.cell.titleFontSize)

  // Draw count on the same line as title
  ctx.font = `bold ${CHART_CONFIG.cell.titleFontSize}px ${CHART_CONFIG.font.mono}`
  const countText = formatNumber(metric.count)
  const countWidth = ctx.measureText(countText).width
  ctx.fillText(
    countText,
    cell.x + cell.width - CHART_CONFIG.cell.padding - countWidth,
    cell.y + CHART_CONFIG.cell.titleFontSize + 2,
  )

  // Draw stats with smaller font
  ctx.font = `${CHART_CONFIG.cell.statsFontSize}px ${CHART_CONFIG.font.mono}`
  const stats = [
    `min: ${formatNumber(metric.min, metric.unit)}`,
    `max: ${formatNumber(metric.max, metric.unit)}`,
    `avg: ${formatNumber(metric.sum / metric.count, metric.unit)}`,
  ].join(' ')
  ctx.fillText(
    stats,
    cell.x + CHART_CONFIG.cell.padding,
    cell.y + CHART_CONFIG.cell.titleFontSize + CHART_CONFIG.cell.statsFontSize + CHART_CONFIG.cell.padding,
  )

  // Adjust chart area to new layout
  const chartArea = {
    x: cell.x + CHART_CONFIG.cell.padding * 2,
    y: 10 + cell.y + CHART_CONFIG.cell.titleFontSize + CHART_CONFIG.cell.statsFontSize + CHART_CONFIG.cell.padding * 2,
    width: cell.width - CHART_CONFIG.cell.padding * 5 - 10,
    height:
      cell.height -
      (CHART_CONFIG.cell.titleFontSize +
        CHART_CONFIG.cell.statsFontSize +
        CHART_CONFIG.cell.padding * 4 + // 增加底部空间用于显示最大最小值
        CHART_CONFIG.cell.statsFontSize), // 为底部标签预留空间
  }

  // Draw histogram bars
  if (metric.buckets.length > 0) {
    // 找出有意义的数据范围
    const significantThreshold = Math.max(...metric.buckets.map(([, count]) => count)) * 0.01 // 1% 阈值
    const significantBuckets = metric.buckets
      .map(([value, count], index) => ({ value, count, index }))
      .filter(({ count }) => count >= significantThreshold)

    if (significantBuckets.length === 0) {
      significantBuckets.push({
        value: metric.buckets[0][0],
        count: metric.buckets[0][1],
        index: 0,
      })
    }

    // 计算显示范围
    const firstIndex = Math.max(0, Math.min(...significantBuckets.map((b) => b.index)) - 1)
    const lastIndex = Math.min(metric.buckets.length - 1, Math.max(...significantBuckets.map((b) => b.index)) + 1)

    // 计算新的柱状图宽度和位置
    const effectiveWidth = chartArea.width
    const barWidth = Math.max(1, effectiveWidth / (lastIndex - firstIndex + 1) - 1)

    // 绘制垂直网格线
    ctx.strokeStyle = theme?.gridLines ?? CHART_CONFIG.colors.gridLines
    ctx.lineWidth = 0.5
    const gridCount = 10
    for (let i = 0; i <= gridCount; i++) {
      const x = chartArea.x + (i * effectiveWidth) / gridCount
      ctx.beginPath()
      ctx.moveTo(x, chartArea.y)
      ctx.lineTo(x, chartArea.y + chartArea.height)
      ctx.stroke()
    }

    // 使用更平滑的对数比例
    const maxCount = Math.max(...metric.buckets.slice(firstIndex, lastIndex + 1).map(([, count]) => count))
    const logScale = (value: number) => {
      if (value <= 0) return 0
      const base = Math.E
      return Math.log(value * (base - 1) + 1) / Math.log(maxCount * (base - 1) + 1)
    }

    // 优化柱状图的渐变效果
    const createBarGradient = (x: number, y: number, height: number) => {
      const gradient = ctx.createLinearGradient(x, y, x, y + height)
      gradient.addColorStop(0, getRGBAColor(metric.color, 0.9))
      gradient.addColorStop(0.4, getRGBAColor(metric.color, 0.7))
      gradient.addColorStop(1, getRGBAColor(metric.color, 0.3))
      return gradient
    }

    // 绘制柱状图
    metric.buckets.forEach(([, count], index) => {
      if (index < firstIndex || index > lastIndex) return
      if (count === 0) return

      const normalizedHeight = logScale(count) * chartArea.height
      const x = chartArea.x + ((index - firstIndex) * effectiveWidth) / (lastIndex - firstIndex + 1)
      const y = chartArea.y + chartArea.height - normalizedHeight

      // 在绘制柱状图时使用渐变
      ctx.fillStyle = createBarGradient(x, y, normalizedHeight)
      ctx.fillRect(x, y, barWidth, normalizedHeight)
    })

    // 显示范围标签
    const bucketSize = (metric.max - metric.min) / metric.buckets.length
    const displayMin = metric.min + firstIndex * bucketSize
    const displayMax = metric.min + lastIndex * bucketSize

    // Draw range labels
    const labelY = chartArea.y + chartArea.height + CHART_CONFIG.cell.padding + CHART_CONFIG.cell.statsFontSize
    ctx.fillStyle = getRGBAColor(metric.color, 0.75)
    ctx.font = `${CHART_CONFIG.cell.statsFontSize * 0.8}px ${CHART_CONFIG.font.mono}`

    // 在网格线位置显示刻度值
    for (let i = 0; i <= gridCount; i++) {
      const value = displayMin + (i * (displayMax - displayMin)) / gridCount
      const x = chartArea.x + (i * effectiveWidth) / gridCount
      const text = formatNumber(value)
      const textWidth = ctx.measureText(text).width
      ctx.fillText(text, x - textWidth / 2, labelY)
    }

    // 计算平均值
    const avg = metric.sum / metric.count

    // 找到平均值对应的 x 坐标
    const avgX = chartArea.x + (avg / displayMax) * effectiveWidth

    // 绘制平均值标记线
    if (avgX >= chartArea.x && avgX <= chartArea.x + effectiveWidth) {
      // 绘制虚线
      ctx.setLineDash([5, 5])
      ctx.strokeStyle = getRGBAColor('rgb(235, 215, 59)', 0.8)
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(avgX, chartArea.y)
      ctx.lineTo(avgX, chartArea.y + chartArea.height)
      ctx.stroke()
      ctx.setLineDash([]) // 重置虚线样式
    }
  }
}

const drawFrequency = (ctx: CanvasRenderingContext2D, metric: FrequencyMetric, cell: GridCell) => {
  // Draw title
  ctx.fillStyle = metric.color
  ctx.font = `${CHART_CONFIG.cell.titleFontSize}px ${CHART_CONFIG.font.mono}`
  ctx.fillText(metric.label, cell.x + CHART_CONFIG.cell.padding, cell.y + CHART_CONFIG.cell.titleFontSize)

  // Draw total count on the same line as title
  ctx.font = `bold ${CHART_CONFIG.cell.titleFontSize}px ${CHART_CONFIG.font.mono}`
  const totalText = formatNumber(metric.total)
  const totalWidth = ctx.measureText(totalText).width
  ctx.fillText(
    totalText,
    cell.x + cell.width - CHART_CONFIG.cell.padding - totalWidth,
    cell.y + CHART_CONFIG.cell.titleFontSize,
  )

  // Adjust chart area to new layout
  const chartArea = {
    x: cell.x + CHART_CONFIG.cell.padding,
    y: cell.y + CHART_CONFIG.cell.titleFontSize + CHART_CONFIG.cell.padding,
    width: cell.width - CHART_CONFIG.cell.padding * 2,
    height: cell.height - (CHART_CONFIG.cell.titleFontSize + CHART_CONFIG.cell.padding * 3),
  }

  // 智能过滤和排序频率数据
  const maxCount = Math.max(...metric.frequencies.map(([_, count]) => count))
  const significantThreshold = maxCount * 0.01 // 1% 阈值

  const sortedFrequencies = [...metric.frequencies]
    .filter(([_, count]) => count >= significantThreshold) // 过滤掉不重要的数据
    .sort((a, b) => b[1] - a[1]) // 按计数降序排序
    .slice(0, 12) // 最多显示前12项

  if (sortedFrequencies.length === 0 && metric.frequencies.length > 0) {
    // 如果没有显著数据，至少显示最大的一项
    sortedFrequencies.push([...metric.frequencies].sort((a, b) => b[1] - a[1])[0])
  }

  // 重新计算布局
  const maxDisplayCount = sortedFrequencies.length
  const barHeight = Math.min(
    15 * PR,
    Math.max(12 * PR, (chartArea.height - CHART_CONFIG.cell.padding) / maxDisplayCount - PR),
  )
  const labelWidth = chartArea.width * 0.2

  // 使用对数比例尺来增强小值的可见性
  const logScale = (value: number) => {
    if (value <= 0) return 0
    const base = Math.E
    return Math.log(value * (base - 1) + 1) / Math.log(maxCount * (base - 1) + 1)
  }

  // Draw frequency bars
  sortedFrequencies.forEach(([label, count], index) => {
    const y = 10 + chartArea.y + index * (barHeight + PR)

    // Draw label
    ctx.fillStyle = metric.color
    ctx.font = `${CHART_CONFIG.cell.statsFontSize}px ${CHART_CONFIG.font.mono}`
    const truncatedLabel = label.length > 15 ? `${label.slice(0, 12)}...` : label
    ctx.fillText(truncatedLabel, chartArea.x, y + barHeight / 2 + CHART_CONFIG.cell.statsFontSize / 3)

    // Draw bar with logarithmic scale
    const normalizedWidth = logScale(count)
    const barWidth = normalizedWidth * (chartArea.width - labelWidth - CHART_CONFIG.cell.padding - 80)
    const barX = chartArea.x + labelWidth

    // Create gradient
    const gradient = ctx.createLinearGradient(barX, y, barX + barWidth, y)
    gradient.addColorStop(0, getRGBAColor(metric.color, 0.85))
    gradient.addColorStop(0.5, getRGBAColor(metric.color, 0.5))
    gradient.addColorStop(1, getRGBAColor(metric.color, 0.15))

    ctx.fillStyle = gradient
    ctx.fillRect(barX, y, barWidth, barHeight)

    // Draw count with percentage
    ctx.fillStyle = getRGBAColor(metric.color, 0.8)
    ctx.font = `${CHART_CONFIG.cell.statsFontSize}px ${CHART_CONFIG.font.mono}`
    ctx.fillText(
      formatNumber(count),
      barX + barWidth + CHART_CONFIG.cell.padding,
      y + barHeight / 2 + CHART_CONFIG.cell.statsFontSize / 3,
    )
  })

  // 如果有被过滤掉的数据，显示一个摘要
  const filteredCount = metric.frequencies.length - sortedFrequencies.length
  if (filteredCount > 0) {
    const y = chartArea.y + chartArea.height - CHART_CONFIG.cell.statsFontSize
    ctx.fillStyle = getRGBAColor(metric.color, 0.5)
    ctx.font = `${CHART_CONFIG.cell.statsFontSize}px ${CHART_CONFIG.font.mono}`
    ctx.fillText(`+${filteredCount} more items`, chartArea.x + labelWidth + 12, y - 5)
  }
}

const drawGauge = (ctx: CanvasRenderingContext2D, metric: GaugeMetric, cell: GridCell) => {
  // Draw title
  ctx.fillStyle = metric.color
  ctx.font = `${CHART_CONFIG.cell.titleFontSize}px ${CHART_CONFIG.font.mono}`
  ctx.fillText(metric.label, cell.x + CHART_CONFIG.cell.padding, cell.y + CHART_CONFIG.cell.titleFontSize)

  // 调整进度条区域的尺寸和位置
  const gaugeArea = {
    x: cell.x + CHART_CONFIG.cell.padding,
    y: 10 + cell.y + CHART_CONFIG.cell.titleFontSize + CHART_CONFIG.cell.padding,
    width: (cell.width - CHART_CONFIG.cell.padding * 2) * 0.65, // 稍微缩小进度条宽度
    height: CHART_CONFIG.cell.valueFontSize * 1.1, // 稍微降低高度使其更紧凑
  }

  // 调整值的显示位置，使其更靠近进度条
  ctx.font = `bold ${CHART_CONFIG.cell.titleFontSize}px ${CHART_CONFIG.font.mono}`
  const valueText = formatNumber(metric.value, metric.unit)
  ctx.fillText(
    valueText,
    cell.x + gaugeArea.width + CHART_CONFIG.cell.padding + 8, // 微调间距
    5 + cell.y + CHART_CONFIG.cell.titleFontSize + CHART_CONFIG.cell.padding + CHART_CONFIG.cell.valueFontSize * 0.85,
  )

  // Draw background bar
  ctx.fillStyle = getRGBAColor(metric.color, 0.1)
  ctx.fillRect(gaugeArea.x, gaugeArea.y, gaugeArea.width, gaugeArea.height)

  // 根据单位类型使用不同的渲染策略
  if (metric.unit === 'ms') {
    // 延迟指标的默认阈值（以毫秒为单位）
    const defaultThresholds = {
      warning: 100, // 0-100ms 被认为是好的
      danger: 300, // >300ms 是危险
    }

    const thresholds = {
      ...defaultThresholds,
      ...metric.thresholds,
    }

    // 使用对数比例来处理延迟值
    const logScale = (value: number) => {
      const base = Math.E
      const maxValue = 1000 // 最大显示1000ms
      return Math.log(value * (base - 1) + 1) / Math.log(maxValue * (base - 1) + 1)
    }

    const normalizedValue = logScale(metric.value)
    const progressWidth = gaugeArea.width * normalizedValue

    // 根据延迟值和阈值选择颜色
    let gradient: string
    if (metric.value <= thresholds.warning) {
      gradient = getRGBAColor(metric.color, 0.6)
    } else if (metric.value <= thresholds.danger) {
      gradient = getRGBAColor('rgb(255, 166, 0)', 0.8) // 橙色
    } else {
      gradient = getRGBAColor('rgb(255, 77, 77)', 0.8) // 红色
    }

    ctx.fillStyle = gradient
    ctx.fillRect(gaugeArea.x, gaugeArea.y, progressWidth, gaugeArea.height)

    // Draw thresholds markers
    const drawThresholdMarker = (value: number, color: string) => {
      const x = gaugeArea.x + gaugeArea.width * logScale(value)
      ctx.strokeStyle = getRGBAColor(color, 0.5)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, gaugeArea.y)
      ctx.lineTo(x, gaugeArea.y + gaugeArea.height)
      ctx.stroke()
    }

    drawThresholdMarker(thresholds.warning, 'rgb(255, 166, 0)')
    drawThresholdMarker(thresholds.danger, 'rgb(255, 77, 77)')
  } else {
    // 其他类型指标的默认阈值（0-1范围）
    const defaultThresholds = {
      warning: 0.7,
      danger: 0.9,
    }

    const thresholds = {
      ...defaultThresholds,
      ...metric.thresholds,
    }

    const normalizedValue = Math.max(0, Math.min(1, metric.value))
    const progressWidth = gaugeArea.width * normalizedValue

    // 根据值和阈值创建渐变
    let gradient: string
    if (normalizedValue <= thresholds.warning) {
      gradient = getRGBAColor(metric.color, 0.6)
    } else if (normalizedValue <= thresholds.danger) {
      gradient = getRGBAColor('rgb(255, 166, 0)', 0.8)
    } else {
      gradient = getRGBAColor('rgb(255, 77, 77)', 0.8)
    }

    ctx.fillStyle = gradient
    ctx.fillRect(gaugeArea.x, gaugeArea.y, progressWidth, gaugeArea.height)

    // Draw threshold markers
    const drawThresholdMarker = (value: number, color: string) => {
      const x = gaugeArea.x + gaugeArea.width * value
      ctx.strokeStyle = getRGBAColor(color, 0.5)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, gaugeArea.y)
      ctx.lineTo(x, gaugeArea.y + gaugeArea.height)
      ctx.stroke()
    }

    drawThresholdMarker(thresholds.warning, 'rgb(255, 166, 0)')
    drawThresholdMarker(thresholds.danger, 'rgb(255, 77, 77)')
  }
}

export const EffectMetricsView = ({
  width = 200,
  minHeight = 150,
  getMetrics,
  className,
  refreshInterval = 1000,
  historySize = 60,
  instanceId: propInstanceId,
  onLoad,
  fallback,
}: EffectMetricsView) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number>(null)
  const lastUpdateRef = useRef<number>(0)
  const generatedId = useId()
  const instanceId = propInstanceId || generatedId
  const [isLoading, setIsLoading] = useState(true)

  const { resolvedAppearance } = useAppearance()
  const theme = THEMES[resolvedAppearance]

  const adjustedWidth = Math.round(width * PR)

  // 动态计算画布高度
  const calculateCanvasHeight = (metrics: DebugMetric[]) => {
    const cells = calculateGridCells(adjustedWidth, metrics)
    if (cells.length === 0) return Math.round(minHeight * PR)

    const lastCell = cells[cells.length - 1]
    const calculatedHeight = Math.round(lastCell.y + lastCell.height + CHART_CONFIG.grid.padding)

    // 确保不小于最小高度
    return Math.max(calculatedHeight, Math.round(minHeight * PR))
  }

  // 在绘制前更新 canvas 高度
  const updateCanvasSize = (metrics: DebugMetric[]) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const newHeight = calculateCanvasHeight(metrics)
    if (canvas.height !== newHeight) {
      canvas.height = newHeight
      canvas.style.height = `${newHeight / PR}px`
    }
  }

  const draw = (ctx: CanvasRenderingContext2D, metrics: DebugMetric[]) => {
    // 更新画布尺寸
    updateCanvasSize(metrics)

    ctx.clearRect(0, 0, adjustedWidth, ctx.canvas.height)
    const cells = calculateGridCells(adjustedWidth, metrics)
    const history = getHistory(instanceId)

    metrics.forEach((metric, index) => {
      const cell = cells[index]

      switch (metric.type) {
        case 'count': {
          const metricHistory = history.get(metric.label) || []
          metricHistory.push(metric.value)
          if (metricHistory.length > historySize) metricHistory.shift()
          history.set(metric.label, metricHistory)

          drawChart(
            ctx,
            metricHistory,
            cell,
            metric.color,
            metric.label,
            metric.value.toString(),
            historySize,
            metric.textOnly,
            theme,
          )
          break
        }
        case 'histogram':
          drawHistogram(ctx, metric, cell, theme)
          break
        case 'frequency':
          drawFrequency(ctx, metric, cell)
          break
        case 'gauge':
          drawGauge(ctx, metric, cell)
          break
      }
    })
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let firstTime = true

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const loop = (timestamp: number) => {
      animationFrameRef.current = requestAnimationFrame(loop)

      if (timestamp - lastUpdateRef.current >= refreshInterval) {
        getMetrics().then((metrics) => {
          if (firstTime) {
            firstTime = false
            setIsLoading(false)
            onLoad?.()
          }
          draw(ctx, metrics)
          lastUpdateRef.current = timestamp
        })
      }
    }

    animationFrameRef.current = requestAnimationFrame(loop)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return (
    <div className="relative size-full">
      <canvas
        ref={canvasRef}
        width={adjustedWidth}
        className={className || ''}
        height={Math.round(minHeight * PR)}
        style={{
          width,
          display: 'block', // 防止底部间隙
          height: 'auto', // 允许高度自动调整
        }}
      />
      {fallback && isLoading && <div className="absolute inset-0 flex items-center justify-center">{fallback}</div>}
    </div>
  )
}
