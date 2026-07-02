import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
};

/**
 * Compact bars for a value over time with a dotted trailing-average line. Bars are thin so
 * many months fit; scaled from a lifted baseline (not 0) so month-to-month differences read.
 * No per-bar number labels — the shape does the talking; the latest bar is highlighted.
 */
export function TrendBars({ data, height = 128, signed, averageWindow = 3 }: TrendBarsProps) {
  const theme = useTheme();
  const values = data.map((point) => point.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  // Lift the baseline when everything is positive so small deltas read as tall/short bars.
  const base = min > 0 ? min - (max - min) * 0.5 - 1 : min;
  const span = Math.max(max - base, 1);
  const plotHeight = height - 20;
  const heightFor = (value: number) => Math.max(3, ((value - base) / span) * plotHeight);

  const averages =
    averageWindow > 0
      ? values.map((_, index) => {
          const start = Math.max(0, index - averageWindow + 1);
          const window = values.slice(start, index + 1);
          return window.reduce((sum, value) => sum + value, 0) / window.length;
        })
      : null;

  // Show at most ~6 x labels so they never crowd.
  const labelStep = Math.max(1, Math.ceil(data.length / 6));

  return (
    <View style={styles.trend}>
      <View style={[styles.trendPlot, { height: plotHeight }]}>
        {data.map((point, index) => {
          const isLast = index === data.length - 1;
          const color = signed
            ? point.value >= 0
              ? theme.success
              : theme.danger
            : theme.accent;

          return (
            <View key={`${point.label}-${index}`} style={styles.trendColumn}>
              <View
                style={[
                  styles.trendBar,
                  { height: heightFor(point.value), backgroundColor: color, opacity: isLast ? 1 : 0.55 },
                ]}
              />
              {averages ? (
                <View
                  style={[
                    styles.trendAvgDot,
                    { bottom: heightFor(averages[index]) - 3, backgroundColor: theme.text },
                  ]}
                />
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={styles.trendLabels}>
        {data.map((point, index) => (
          <ThemedText
            key={`${point.label}-label-${index}`}
            numberOfLines={1}
            themeColor="textSecondary"
            style={styles.trendLabel}>
            {index % labelStep === 0 ? point.label : ''}
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
  trendAvgDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  trendLabels: {
    flexDirection: 'row',
    gap: 3,
  },
  trendLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
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
