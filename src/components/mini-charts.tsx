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
}: TrendBarsProps) {
  const theme = useTheme();
  const [plotWidth, setPlotWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const values = data.map((point) => point.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  // Lift the baseline when everything is positive so small deltas read as tall/short bars.
  const base = min > 0 ? min - (max - min) * 0.5 - 1 : min;
  const span = Math.max(max - base, 1);
  const plotHeight = height - 20;
  const heightFor = (value: number) => Math.max(3, ((value - base) / span) * plotHeight);

  const averages =
    averageWindow > 0 && data.length > 1
      ? values.map((_, index) => {
          const start = Math.max(0, index - averageWindow + 1);
          const window = values.slice(start, index + 1);
          return window.reduce((sum, value) => sum + value, 0) / window.length;
        })
      : null;

  // Build a dotted line by interpolating small dots along the average polyline.
  const dots: { x: number; y: number }[] = [];
  if (averages && plotWidth > 0) {
    const slot = plotWidth / data.length;
    const points = averages.map((avg, index) => ({
      x: (index + 0.5) * slot,
      y: plotHeight - heightFor(avg),
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
      <View
        style={[styles.trendPlot, { height: plotHeight }]}
        onLayout={(event) => setPlotWidth(event.nativeEvent.layout.width)}>
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
                  styles.trendBar,
                  {
                    height: heightFor(point.value),
                    backgroundColor: color,
                    opacity: isLast || isSelected ? 1 : 0.55,
                    borderWidth: isSelected ? 1.5 : 0,
                    borderColor: theme.text,
                  },
                ]}
              />
            </Pressable>
          );
        })}
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

  return (
    <View style={styles.ranked}>
      {data.map((item, index) => (
        <View key={`${item.label}-${index}`} style={styles.rankedRow}>
          <View style={styles.rankedTop}>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.rankedLabel}>
              {item.label}
            </ThemedText>
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
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  trend: {
    width: '100%',
    gap: Spacing.one,
  },
  trendPlot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    width: '100%',
  },
  trendColumn: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    minWidth: 0,
  },
  trendBar: {
    width: '52%',
    minWidth: 4,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
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
    borderWidth: 2,
    borderRadius: 8,
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
    gap: Spacing.three,
  },
  rankedRow: {
    gap: Spacing.one,
  },
  rankedTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rankedLabel: {
    flex: 1,
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
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
  },
  rankedFill: {
    height: '100%',
    borderRadius: 999,
  },
});
