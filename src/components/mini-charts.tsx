import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type BarPoint = {
  label: string;
  value: number;
  comparison?: number;
};

type MiniBarChartProps = {
  data: BarPoint[];
  valueLabel?: (value: number) => string;
  height?: number;
};

export function MiniBarChart({ data, valueLabel, height = 132 }: MiniBarChartProps) {
  const theme = useTheme();
  const max = Math.max(
    1,
    ...data.flatMap((point) => [point.value, point.comparison ?? 0])
  );

  return (
    <View style={[styles.chart, { height }]}>
      {data.map((point) => {
        const barHeight = Math.max(5, (point.value / max) * (height - 38));
        const comparisonHeight =
          point.comparison == null ? 0 : Math.max(5, (point.comparison / max) * (height - 38));

        return (
          <View key={point.label} style={styles.barColumn}>
            <View style={styles.barTrack}>
              {point.comparison != null && (
                <View
                  style={[
                    styles.comparisonBar,
                    {
                      height: comparisonHeight,
                      backgroundColor: theme.backgroundSelected,
                    },
                  ]}
                />
              )}
              <View
                style={[
                  styles.valueBar,
                  {
                    height: barHeight,
                    backgroundColor: theme.primary,
                  },
                ]}
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.barLabel}>
              {point.label}
            </ThemedText>
            {valueLabel && (
              <ThemedText type="small" style={styles.barValue}>
                {valueLabel(point.value)}
              </ThemedText>
            )}
          </View>
        );
      })}
    </View>
  );
}

type SparklineProps = {
  values: number[];
  labels?: string[];
  valueLabel?: (value: number) => string;
};

export function SparkBars({ values, labels, valueLabel }: SparklineProps) {
  const theme = useTheme();
  const max = Math.max(1, ...values.map((value) => Math.abs(value)));

  return (
    <View style={styles.sparkWrap}>
      {values.map((value, index) => (
        <View key={`${value}-${index}`} style={styles.sparkColumn}>
          <View
            style={[
              styles.sparkBar,
              {
                height: Math.max(6, (Math.abs(value) / max) * 70),
                backgroundColor: value >= 0 ? theme.success : theme.warning,
              },
            ]}
          />
          {labels?.[index] && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.sparkLabel}>
              {labels[index]}
            </ThemedText>
          )}
          {valueLabel && (
            <ThemedText type="small" style={styles.sparkValue}>
              {valueLabel(value)}
            </ThemedText>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    width: '100%',
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
    minWidth: 0,
  },
  barTrack: {
    height: '100%',
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  valueBar: {
    width: '58%',
    minWidth: 10,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  comparisonBar: {
    position: 'absolute',
    bottom: 0,
    width: '86%',
    minWidth: 16,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  barLabel: {
    textAlign: 'center',
    fontSize: 10,
  },
  barValue: {
    textAlign: 'center',
    fontSize: 10,
  },
  sparkWrap: {
    minHeight: 110,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  sparkColumn: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
  },
  sparkBar: {
    width: '64%',
    minWidth: 12,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  sparkLabel: {
    fontSize: 10,
  },
  sparkValue: {
    fontSize: 10,
    textAlign: 'center',
  },
});
