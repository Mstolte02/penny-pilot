import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TOOLTIP_WIDTH = 104;

type TrendPoint = {
  label: string;
  value: number;
};

type TrendBarsProps = {
  data: TrendPoint[];
  height?: number;
  /** Color bars by sign (green when >= 0, red when negative) instead of accent/primary. */
  signed?: boolean;
  /** Trailing moving-average window drawn as a dotted line. 0 hides it. */
  averageWindow?: number;
  /** Formats the value shown in the tap tooltip. */
  formatValue?: (value: number) => string;
  /** Optional plan/budget line. */
  targetValue?: number;
  targetLabel?: string;
};

/**
 * Compact bars for a value over time with a dotted trailing-average line. Bars are thin so
 * many months fit; scaled from a lifted baseline (not 0) so month-to-month differences read.
 * No per-bar number labels — the shape does the talking; the latest bar is highlighted.
 */
export function TrendBars({
  data,
  height = 128,
  signed,
  averageWindow = 3,
  formatValue,
  targetValue,
  targetLabel = 'Plan',
}: TrendBarsProps) {
  const theme = useTheme();
  const [plotWidth, setPlotWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const values = data.map((point) => point.value);
  const includedValues = targetValue === undefined ? values : [...values, targetValue];
  const max = Math.max(...includedValues, 1);
  const min = Math.min(...includedValues, 0);
  // Lift the baseline when everything is positive so small deltas read as tall/short bars.
  const base = min > 0 ? min - (max - min) * 0.5 - 1 : min;
  const span = Math.max(max - base, 1);
  const plotHeight = height - 20;
  const heightFor = (value: number) => Math.max(3, ((value - base) / span) * plotHeight);
  const yFor = (value: number) => plotHeight - heightFor(value);

  const averages =
    averageWindow > 0 && data.length > 1
      ? values.map((_, index) => {
          const start = Math.max(0, index - averageWindow + 1);
          const window = values.slice(start, index + 1);
          return window.reduce((sum, value) => sum + value, 0) / window.length;
        })
      : null;
  const latest = values[values.length - 1] ?? 0;
  const previous = values[values.length - 2] ?? latest;
  const avg = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const latestLabel = data[data.length - 1]?.label ?? 'Latest';
  const delta = latest - previous;

  // Build a dotted line by interpolating small dots along the average polyline.
  const dots: { x: number; y: number }[] = [];
  if (averages && plotWidth > 0) {
    const slot = plotWidth / data.length;
    const points = averages.map((avg, index) => ({
      x: (index + 0.5) * slot,
      y: yFor(avg),
    }));
    const spacing = 6;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.round(distance / spacing));
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        dots.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
  }

  const format = formatValue ?? ((value: number) => String(Math.round(value)));
  const columnWidth = data.length > 0 ? plotWidth / data.length : 0;
  const tooltipLeft =
    selected !== null
      ? Math.min(
          Math.max((selected + 0.5) * columnWidth - TOOLTIP_WIDTH / 2, 0),
          Math.max(plotWidth - TOOLTIP_WIDTH, 0)
        )
      : 0;

  return (
    <View style={styles.trend}>
      <View style={styles.chartSummary}>
        <View style={styles.chartSummaryItem}>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {latestLabel}
          </ThemedText>
          <ThemedText type="smallBold" numberOfLines={1}>
            {format(latest)}
          </ThemedText>
        </View>
        <View style={styles.chartSummaryItem}>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            Avg
          </ThemedText>
          <ThemedText type="smallBold" numberOfLines={1}>
            {format(avg)}
          </ThemedText>
        </View>
        <View style={styles.chartSummaryItem}>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            Change
          </ThemedText>
          <ThemedText
            type="smallBold"
            numberOfLines={1}
            style={{ color: delta >= 0 ? theme.success : theme.danger }}>
            {delta >= 0 ? '+' : '-'}{format(Math.abs(delta))}
          </ThemedText>
        </View>
      </View>
      <View
        style={[
          styles.trendPlot,
          { height: plotHeight, backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}
        onLayout={(event) => setPlotWidth(event.nativeEvent.layout.width)}>
        {[0.25, 0.5, 0.75].map((line) => (
          <View
            key={line}
            pointerEvents="none"
            style={[
              styles.guideLine,
              { top: plotHeight * line, backgroundColor: theme.border },
            ]}
          />
        ))}
        {data.map((point, index) => {
          const isLast = index === data.length - 1;
          const isSelected = selected === index;
          const color = signed
            ? point.value >= 0
              ? theme.success
              : theme.danger
            : theme.accent;

          return (
            <Pressable
              key={`${point.label}-${index}`}
              style={styles.trendColumn}
              onPress={() => setSelected(isSelected ? null : index)}>
              <View
                style={[
                  styles.barBackplate,
                  { backgroundColor: signed ? theme.background : theme.backgroundSelected },
                ]}>
                <View
                  style={[
                  styles.trendBar,
                  {
                    height: heightFor(point.value),
                    backgroundColor: color,
                    opacity: isLast || isSelected ? 1 : 0.72,
                    borderWidth: isSelected ? 2 : 0,
                    borderColor: theme.text,
                  },
                ]}
                />
              </View>
              {isLast ? <View style={[styles.latestDot, { backgroundColor: color }]} /> : null}
            </Pressable>
          );
        })}
        {targetValue !== undefined && plotWidth > 0 ? (
          <View pointerEvents="none" style={[styles.targetLine, { top: yFor(targetValue) }]}>
            <View style={[styles.targetDash, { backgroundColor: theme.primary }]} />
            <View style={[styles.targetLabel, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold" themeColor="primary" numberOfLines={1} style={styles.targetLabelText}>
                {targetLabel}
              </ThemedText>
            </View>
          </View>
        ) : null}
        {dots.length > 0 ? (
          <View pointerEvents="none" style={styles.trendOverlay}>
            {dots.map((dot, index) => (
              <View
                key={index}
                style={[
                  styles.trendDot,
                  { left: dot.x - 1.5, top: dot.y - 1.5, backgroundColor: theme.text },
                ]}
              />
            ))}
          </View>
        ) : null}
        {selected !== null && plotWidth > 0 ? (
          <View
            pointerEvents="none"
            style={[
              styles.tooltip,
              {
                left: tooltipLeft,
                top: Math.max(0, plotHeight - heightFor(values[selected]) - 42),
                borderColor: theme.borderStrong,
                backgroundColor: theme.background,
              },
            ]}>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {data[selected].label}
            </ThemedText>
            <ThemedText type="smallBold" numberOfLines={1}>
              {format(values[selected])}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.trendLabels}>
        {data.map((point, index) => (
          <ThemedText
            key={`${point.label}-label-${index}`}
            numberOfLines={1}
            themeColor="textSecondary"
            style={styles.trendLabel}>
            {point.label.split(' ')[0]}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

type RankedItem = {
  label: string;
  value: number;
  color?: string;
  delta?: string;
  deltaUp?: boolean;
};

type RankedBarsProps = {
  data: RankedItem[];
  valueLabel: (value: number) => string;
  max?: number;
};

/**
 * Horizontal, sorted bars for composition / "biggest items". Distinct from the trend
 * chart at a glance, and every number sits on one line.
 */
export function RankedBars({ data, valueLabel, max: maxProp }: RankedBarsProps) {
  const theme = useTheme();
  const max = Math.max(maxProp ?? 0, ...data.map((item) => item.value), 1);
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;

  return (
    <View style={styles.ranked}>
      {data.map((item, index) => (
        <View
          key={`${item.label}-${index}`}
          style={[styles.rankedRow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={styles.rankedTop}>
            <View style={styles.rankedLabelGroup}>
              <View style={[styles.rankBadge, { backgroundColor: item.color ?? theme.primary }]}>
                <ThemedText type="smallBold" style={styles.rankBadgeText}>
                  {index + 1}
                </ThemedText>
              </View>
              <View style={styles.rankedLabelCopy}>
                <ThemedText type="smallBold" numberOfLines={1} style={styles.rankedLabel}>
                  {item.label}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {Math.round((item.value / total) * 100)}% of shown spend
                </ThemedText>
              </View>
            </View>
            <View style={styles.rankedNums}>
              {item.delta ? (
                <ThemedText
                  numberOfLines={1}
                  style={[
                    styles.rankedDelta,
                    { color: item.deltaUp ? theme.danger : theme.success },
                  ]}>
                  {item.delta}
                </ThemedText>
              ) : null}
              <ThemedText type="smallBold" numberOfLines={1}>
                {valueLabel(item.value)}
              </ThemedText>
            </View>
          </View>
          <View
            style={[styles.rankedTrack, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View
              style={[
                styles.rankedFill,
                {
                  width: `${Math.max(3, (item.value / max) * 100)}%`,
                  backgroundColor: item.color ?? theme.primary,
                },
              ]}
            />
            <View
              style={[
                styles.rankedKnob,
                {
                  left: `${Math.max(3, Math.min((item.value / max) * 100, 96))}%`,
                  backgroundColor: item.color ?? theme.primary,
                  borderColor: theme.backgroundElement,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  trend: {
    width: '100%',
    gap: Spacing.two,
  },
  chartSummary: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chartSummaryItem: {
    flex: 1,
    minWidth: 0,
  },
  guideLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 1,
    opacity: 0.7,
  },
  trendPlot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    width: '100%',
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden',
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
  },
  trendColumn: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    minWidth: 0,
  },
  barBackplate: {
    width: '72%',
    minWidth: 7,
    height: '100%',
    borderRadius: 999,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  trendBar: {
    width: '100%',
    minHeight: 4,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
  latestDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  trendOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  trendDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  tooltip: {
    position: 'absolute',
    width: TOOLTIP_WIDTH,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
    zIndex: 10,
    elevation: 6,
  },
  trendLabels: {
    flexDirection: 'row',
    gap: 3,
  },
  trendLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
  },
  ranked: {
    gap: Spacing.two,
  },
  rankedRow: {
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.three,
  },
  rankedTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rankedLabelGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rankedLabelCopy: {
    flex: 1,
    minWidth: 0,
  },
  rankedLabel: {
    flex: 1,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    color: '#13233B',
    fontSize: 12,
  },
  rankedNums: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    flexShrink: 0,
  },
  rankedDelta: {
    fontSize: 12,
    fontWeight: 700,
  },
  rankedTrack: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  rankedFill: {
    height: '100%',
    borderRadius: 999,
  },
  rankedKnob: {
    position: 'absolute',
    top: -3,
    width: 18,
    height: 18,
    marginLeft: -9,
    borderRadius: 9,
    borderWidth: 3,
  },
  targetLine: {
    position: 'absolute',
    left: Spacing.two,
    right: Spacing.two,
    height: 1,
    justifyContent: 'center',
  },
  targetDash: {
    height: 2,
    opacity: 0.9,
  },
  targetLabel: {
    position: 'absolute',
    right: 0,
    top: -11,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  targetLabelText: {
    fontSize: 10,
  },
});
