import { useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useGrowOnMount } from '@/components/mini-charts';
import { Card } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Low→high heat ramp for bar magnitude: calm teal for quiet months up to brick
 * red for the biggest one. Color restates what bar height and the printed value
 * already say, so it's redundant encoding — safe for colorblind readers.
 */
const HEAT_STOPS = ['#3F8A89', '#9BB58A', '#D4A24C', '#D58B45', '#C94C4C'] as const;

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function heatColor(t: number) {
  const clamped = Math.min(Math.max(t, 0), 1);
  const scaled = clamped * (HEAT_STOPS.length - 1);
  const index = Math.min(Math.floor(scaled), HEAT_STOPS.length - 2);
  const mix = scaled - index;
  const from = hexToRgb(HEAT_STOPS[index]);
  const to = hexToRgb(HEAT_STOPS[index + 1]);
  const channel = (a: number, b: number) => Math.round(a + (b - a) * mix);
  return `rgb(${channel(from[0], to[0])}, ${channel(from[1], to[1])}, ${channel(from[2], to[2])})`;
}

export function compactMoney(value: number) {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `$${Math.round(value)}`;
}

export type CategoryTrendPoint = { label: string; value: number };

export type CategoryTrend = {
  name: string;
  /** One point per window month, uniform across every card; 0 = no spend. */
  points: CategoryTrendPoint[];
  /** Trailing 3-month average aligned to points; null where the window has no data. */
  avg: (number | null)[];
  /** Monthly budget target for the category, when a plan section matches. */
  target?: number;
  total: number;
};

type CategoryTrendChartProps = {
  points: CategoryTrendPoint[];
  avg: (number | null)[];
  target?: number;
  height?: number;
  formatValue?: (value: number) => string;
};

/** Room above the tallest bar for its printed value. */
const VALUE_GUTTER = 18;
const AVG_DOT_STEP = 7;

/**
 * One category's months: bars on an honest zero baseline, heat-colored by size
 * within the card, every bar labeled with its amount, a dashed steel-blue
 * trailing 3-month average, and a dashed copper budget-target line when the
 * target sits near the data's scale.
 */
export function CategoryTrendChart({
  points,
  avg,
  target,
  height = 116,
  formatValue = compactMoney,
}: CategoryTrendChartProps) {
  const theme = useTheme();
  const grow = useGrowOnMount();
  const [plotWidth, setPlotWidth] = useState(0);

  const values = points.map((point) => point.value);
  const avgValues = avg.filter((value): value is number => value !== null);
  const dataMax = Math.max(...values, ...avgValues, 1);
  // The target only joins the scale when it's near the data — a far-off target
  // would squash every bar flat; the drill-down still prints it.
  const showTarget = target !== undefined && target > 0 && target <= dataMax * 1.3;
  const max = showTarget ? Math.max(dataMax, target) : dataMax;
  const hasData = values.some((value) => value > 0);

  // Heat spreads across the card's own min→max spend, so the cheapest month is
  // teal and the priciest brick. Near-flat categories (rent) compress toward the
  // mid-tone instead — a $35 wiggle on $1.6k must not paint teal-to-red.
  const positives = values.filter((value) => value > 0);
  const barMin = positives.length > 0 ? Math.min(...positives) : 0;
  const barMax = positives.length > 0 ? Math.max(...positives) : 1;
  const spread = barMax - barMin;
  const significance = Math.min(1, spread / (0.6 * barMax));
  const heatFor = (value: number) => {
    const raw = spread < 1 ? 0.5 : (value - barMin) / spread;
    return 0.5 + (raw - 0.5) * significance;
  };

  const heightFor = (value: number) => (value / max) * (height - VALUE_GUTTER);
  const yFor = (value: number) => height - heightFor(value);
  const columnWidth = points.length > 0 ? plotWidth / points.length : 0;
  const xFor = (index: number) => (index + 0.5) * columnWidth;

  const avgDots: { x: number; y: number }[] = [];
  if (plotWidth > 0) {
    for (let index = 0; index < avg.length - 1; index += 1) {
      const a = avg[index];
      const b = avg[index + 1];
      if (a === null || b === null) continue;
      const x1 = xFor(index);
      const y1 = yFor(a);
      const dx = xFor(index + 1) - x1;
      const dy = yFor(b) - y1;
      const steps = Math.max(1, Math.round(Math.hypot(dx, dy) / AVG_DOT_STEP));
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        avgDots.push({ x: x1 + dx * t, y: y1 + dy * t });
      }
    }
  }

  const targetDashCount = plotWidth > 0 ? Math.max(6, Math.floor(plotWidth / 12)) : 0;

  return (
    <View style={styles.chart}>
      <View
        style={[styles.plot, { height, borderBottomColor: theme.border }]}
        onLayout={(event) => setPlotWidth(event.nativeEvent.layout.width)}>
        {[0.25, 0.5, 0.75].map((line) => (
          <View
            key={line}
            pointerEvents="none"
            style={[styles.guideLine, { top: height * line, backgroundColor: theme.border }]}
          />
        ))}

        {points.map((point, index) => {
          const barHeight = heightFor(point.value);
          return (
            <View key={`${point.label}-${index}`} style={styles.column}>
              {point.value > 0 ? (
                <>
                  <View pointerEvents="none" style={[styles.barValue, { bottom: barHeight + 3 }]}>
                    <ThemedText
                      type="smallBold"
                      numberOfLines={1}
                      style={[styles.barValueText, { color: theme.textSecondary }]}>
                      {formatValue(point.value)}
                    </ThemedText>
                  </View>
                  <Animated.View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(barHeight, 3),
                        backgroundColor: heatColor(heatFor(point.value)),
                        transformOrigin: 'bottom',
                        transform: [{ scaleY: grow }],
                      },
                    ]}
                  />
                </>
              ) : null}
            </View>
          );
        })}

        {showTarget && targetDashCount > 0 ? (
          <View pointerEvents="none" style={[styles.targetLine, { top: yFor(target) }]}>
            {Array.from({ length: targetDashCount }).map((_, dash) => (
              <View key={dash} style={[styles.targetDash, { backgroundColor: theme.accent }]} />
            ))}
          </View>
        ) : null}

        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: grow }]}>
          {avgDots.map((dot, index) => (
            <View
              key={index}
              style={[
                styles.avgDot,
                { left: dot.x - 1.5, top: dot.y - 1.5, backgroundColor: theme.info },
              ]}
            />
          ))}
        </Animated.View>

        {!hasData ? (
          <View pointerEvents="none" style={styles.emptyPlot}>
            <ThemedText type="small" themeColor="textSecondary">
              No spending in this window
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.axis}>
        {points.map((point, index) => (
          <ThemedText
            key={`${point.label}-label-${index}`}
            numberOfLines={1}
            themeColor="textSecondary"
            style={styles.axisLabel}>
            {/* Past ~9 columns "Dec '25" no longer fits, so fall back to month-only. */}
            {points.length > 9 ? point.label.split(' ')[0] : point.label}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

export function ChartLegend({ showTarget }: { showTarget: boolean }) {
  const theme = useTheme();

  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={styles.legendRamp}>
          {HEAT_STOPS.map((stop) => (
            <View key={stop} style={{ flex: 1, backgroundColor: stop }} />
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Low→High
        </ThemedText>
      </View>
      <View style={styles.legendItem}>
        <View style={styles.legendDashes}>
          {[0, 1, 2].map((dot) => (
            <View key={dot} style={[styles.legendDot, { backgroundColor: theme.info }]} />
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          3-mo Avg
        </ThemedText>
      </View>
      {showTarget ? (
        <View style={styles.legendItem}>
          <View style={styles.legendDashes}>
            {[0, 1, 2].map((dash) => (
              <View key={dash} style={[styles.legendTargetDash, { backgroundColor: theme.accent }]} />
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Budget
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

type CategoryTrendCardProps = {
  trend: CategoryTrend;
  formatValue?: (value: number) => string;
  onPress?: () => void;
};

export function CategoryTrendCard({ trend, formatValue, onPress }: CategoryTrendCardProps) {
  const theme = useTheme();
  const dataMax = Math.max(
    ...trend.points.map((point) => point.value),
    ...trend.avg.filter((value): value is number => value !== null),
    1
  );
  const showTarget = trend.target !== undefined && trend.target > 0 && trend.target <= dataMax * 1.3;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${trend.name} spending`}
      onPress={onPress}
      style={({ pressed }) => [styles.cardWrap, { opacity: pressed ? 0.75 : 1 }]}>
      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.cardTitle}>
            {trend.name}
          </ThemedText>
          <View style={[styles.drillPill, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="small" numberOfLines={1} style={{ color: theme.secondary, fontSize: 10.5 }}>
              tap to drill down →
            </ThemedText>
          </View>
        </View>
        <CategoryTrendChart
          points={trend.points}
          avg={trend.avg}
          target={trend.target}
          formatValue={formatValue}
        />
        <ChartLegend showTarget={showTarget} />
      </Card>
    </Pressable>
  );
}

type CategoryTrendPagerProps = {
  categories: CategoryTrend[];
  formatValue?: (value: number) => string;
  onPressCategory?: (name: string) => void;
};

/**
 * One category card at a time: swipe (or tap a dot) to move between categories
 * instead of scrolling down through a stack of cards.
 */
export function CategoryTrendPager({ categories, formatValue, onPressCategory }: CategoryTrendPagerProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);

  const goTo = (index: number) => {
    if (Platform.OS === 'web') {
      // The CSS scroll-snap that pagingEnabled adds cancels both RN-web's
      // JS-driven animated scroll and the DOM's smooth scroll, snapping back to
      // the old page. An instant scrollLeft jump lands exactly on the snap point.
      const node = scrollRef.current?.getScrollableNode?.() as { scrollLeft?: number } | undefined;
      if (node) node.scrollLeft = index * width;
    } else {
      scrollRef.current?.scrollTo({ x: index * width, animated: true });
    }
    setPage(index);
  };

  return (
    <View
      style={styles.pager}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          snapToInterval={width}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onScroll={(event) => {
            const next = Math.round(event.nativeEvent.contentOffset.x / width);
            if (next !== page && next >= 0 && next < categories.length) setPage(next);
          }}
          scrollEventThrottle={16}>
          {categories.map((trend) => (
            <View key={trend.name} style={{ width }}>
              <CategoryTrendCard
                trend={trend}
                formatValue={formatValue}
                onPress={onPressCategory ? () => onPressCategory(trend.name) : undefined}
              />
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.dots} accessibilityRole="tablist">
        {categories.map((trend, index) => (
          <Pressable
            key={trend.name}
            onPress={() => goTo(index)}
            hitSlop={8}
            accessibilityRole="tab"
            accessibilityState={{ selected: index === page }}
            accessibilityLabel={`Show ${trend.name}`}>
            <View
              style={[
                styles.dot,
                index === page
                  ? { backgroundColor: theme.primary, width: 18 }
                  : { backgroundColor: theme.borderStrong },
              ]}
            />
          </Pressable>
        ))}
      </View>
      {categories[page] ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.pagerCaption}>
          {categories[page].name} · {page + 1} of {categories.length}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pager: {
    gap: Spacing.two,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pagerCaption: {
    textAlign: 'center',
  },
  cardWrap: {
    flexGrow: 1,
  },
  card: {
    gap: Spacing.two,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTitle: {
    flexShrink: 1,
    fontSize: 15,
  },
  drillPill: {
    borderRadius: 3,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  chart: {
    gap: 3,
  },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    width: '100%',
    borderBottomWidth: 1,
  },
  guideLine: {
    position: 'absolute',
    left: 6,
    right: 6,
    height: 1,
    opacity: 0.6,
  },
  column: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    minWidth: 0,
  },
  bar: {
    width: '58%',
    maxWidth: 30,
    minWidth: 8,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  barValue: {
    position: 'absolute',
    left: -18,
    right: -18,
    alignItems: 'center',
    zIndex: 5,
  },
  barValueText: {
    fontSize: 9.5,
    fontVariant: ['tabular-nums'],
  },
  avgDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.9,
  },
  targetLine: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetDash: {
    width: 5,
    height: 2,
    borderRadius: 1,
    opacity: 0.85,
  },
  emptyPlot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  axis: {
    flexDirection: 'row',
    gap: 4,
  },
  axisLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 8.5,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  legendRamp: {
    flexDirection: 'row',
    width: 22,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  legendDashes: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  legendDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  legendTargetDash: {
    width: 5,
    height: 2,
    borderRadius: 1,
  },
});
