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
  valueLabel?: (value: number) => string;
  height?: number;
};

/**
 * Vertical bars for a value over time. Scaled from a lifted baseline (just below the
 * smallest value) instead of 0, so month-to-month differences are actually visible —
 * that's the whole point of a trend chart. The latest bar is highlighted.
 */
export function TrendBars({ data, valueLabel, height = 176 }: TrendBarsProps) {
  const theme = useTheme();
  const values = data.map((point) => point.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  // Lift the baseline when everything is positive so small deltas read as tall/short bars.
  const base = min > 0 ? min - (max - min) * 0.6 - 1 : min;
  const span = Math.max(max - base, 1);
  const barMax = height - 46;

  return (
    <View style={[styles.trend, { height }]}>
      {data.map((point, index) => {
        const barHeight = Math.max(8, ((point.value - base) / span) * barMax);
        const isLast = index === data.length - 1;

        return (
          <View key={`${point.label}-${index}`} style={styles.trendColumn}>
            {valueLabel ? (
              <ThemedText numberOfLines={1} style={styles.trendValue}>
                {valueLabel(point.value)}
              </ThemedText>
            ) : null}
            <View
              style={[
                styles.trendBar,
                { height: barHeight, backgroundColor: isLast ? theme.primary : theme.accent },
              ]}
            />
            <ThemedText numberOfLines={1} themeColor="textSecondary" style={styles.trendLabel}>
              {point.label}
            </ThemedText>
          </View>
        );
      })}
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    width: '100%',
  },
  trendColumn: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
    minWidth: 0,
  },
  trendBar: {
    width: '66%',
    minWidth: 12,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  trendValue: {
    fontSize: 11,
    fontWeight: 700,
  },
  trendLabel: {
    fontSize: 11,
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
