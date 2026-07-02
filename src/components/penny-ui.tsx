import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Fragment, PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function Card({ children, style }: CardProps) {
  const theme = useTheme();

  return (
    <ThemedView
      type="backgroundElement"
      style={[
        styles.card,
        {
          borderColor: theme.borderStrong,
          shadowColor: theme.ink,
        },
        style,
      ]}>
      {children}
    </ThemedView>
  );
}

type Segment = { label: string; value: string };

type ScreenProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  mascot?: ReactNode;
  segments?: Segment[];
  active?: string;
  onSelect?: (value: string) => void;
  children: ReactNode;
};

/**
 * Penny's corner avatar doubles as the door to settings and account management:
 * tap Penny anywhere in the app and she offers help plus the settings gear.
 */
function MascotDoor({ children }: PropsWithChildren) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Penny — help and settings"
      hitSlop={8}
      onPress={() => router.push('/auth')}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {children}
    </Pressable>
  );
}

/**
 * Fixed screen frame: pinned header + optional segmented sub-tabs, with a flexible body
 * below. The header and segments never scroll away; panels decide whether their own body
 * needs a short bounded scroll — so no screen is one long continuous scroll.
 */
export function Screen({
  eyebrow,
  title,
  subtitle,
  mascot,
  segments,
  active,
  onSelect,
  children,
}: ScreenProps) {
  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.screenSafe}>
        <View style={styles.screenInner}>
          <PageHead
            eyebrow={eyebrow}
            title={title}
            subtitle={subtitle}
            mascot={mascot ? <MascotDoor>{mascot}</MascotDoor> : undefined}
          />
          {segments && active !== undefined && onSelect ? (
            <SegmentedToggle stretch options={segments} value={active} onChange={onSelect} />
          ) : null}
          <View style={styles.screenBody}>{children}</View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

/** Bottom padding to clear the native tab bar for scrolling panel bodies. */
export const PANEL_BOTTOM_INSET = BottomTabInset + Spacing.four;

/** One-line label/value row: the label truncates, the value never wraps. */
export function StatRow({
  label,
  sublabel,
  value,
  valueColor,
  divider = true,
}: {
  label: string;
  sublabel?: string;
  value: string;
  valueColor?: string;
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.statRow, divider && { borderTopWidth: 1, borderTopColor: theme.border }]}>
      <View style={styles.statRowLabel}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {label}
        </ThemedText>
        {sublabel ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {sublabel}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText
        type="smallBold"
        numberOfLines={1}
        style={[styles.statRowValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </ThemedText>
    </View>
  );
}

/**
 * Compact KPI: value plus a single, colored trend chip (one metric — the percent — so it
 * never crowds or truncates). Color reflects good/bad via `goodWhenUp`.
 */
export function TrendStat({
  label,
  value,
  deltaPct,
  note,
  goodWhenUp = true,
  style,
}: {
  label: string;
  value: string;
  deltaPct?: number;
  note?: string;
  goodWhenUp?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const hasDelta = deltaPct !== undefined;
  const up = (deltaPct ?? 0) >= 0;
  const flat = Math.round(deltaPct ?? 0) === 0;
  const color = !hasDelta || flat ? theme.textSecondary : up === goodWhenUp ? theme.success : theme.danger;

  return (
    <Card style={StyleSheet.flatten([styles.statCard, style])}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
        {value}
      </ThemedText>
      {hasDelta ? (
        <ThemedText type="smallBold" numberOfLines={1} style={{ color }}>
          {flat ? '•' : up ? '▲' : '▼'} {Math.abs(deltaPct ?? 0).toFixed(0)}%{note ? ` ${note}` : ''}
        </ThemedText>
      ) : note ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {note}
        </ThemedText>
      ) : null}
    </Card>
  );
}

/** Compact ‹ month › stepper for browsing by month. */
export function MonthTicker({
  months,
  value,
  onChange,
  formatLabel,
}: {
  months: string[];
  value: string;
  onChange: (month: string) => void;
  formatLabel: (month: string) => string;
}) {
  const theme = useTheme();
  const index = months.indexOf(value);
  const canPrev = index > 0;
  const canNext = index >= 0 && index < months.length - 1;

  return (
    <View
      style={[
        styles.ticker,
        { borderColor: theme.borderStrong, backgroundColor: theme.backgroundElement },
      ]}>
      <Pressable
        disabled={!canPrev}
        hitSlop={10}
        onPress={() => onChange(months[index - 1])}
        style={styles.tickerButton}>
        <ThemedText style={[styles.tickerArrow, { opacity: canPrev ? 1 : 0.3 }]}>‹</ThemedText>
      </Pressable>
      <ThemedText type="smallBold" numberOfLines={1}>
        {formatLabel(value)}
      </ThemedText>
      <Pressable
        disabled={!canNext}
        hitSlop={10}
        onPress={() => onChange(months[index + 1])}
        style={styles.tickerButton}>
        <ThemedText style={[styles.tickerArrow, { opacity: canNext ? 1 : 0.3 }]}>›</ThemedText>
      </Pressable>
    </View>
  );
}

type PageHeadProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  mascot?: ReactNode;
};

/** Large editorial page title + subtitle (mirrors finance_tracker's .page-head), with an
 *  optional mascot slot on the right so Penny still greets each screen. */
export function PageHead({ eyebrow, title, subtitle, mascot }: PageHeadProps) {
  return (
    <View style={styles.pageHead}>
      <View style={styles.pageHeadCopy}>
        {eyebrow ? (
          <ThemedText type="smallBold" themeColor="primary">
            {eyebrow}
          </ThemedText>
        ) : null}
        <ThemedText style={styles.pageHeadTitle}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {mascot}
    </View>
  );
}

type StatTrend = 'up' | 'down' | 'flat';

/** KPI tile: muted label, large value, colored delta (finance_tracker's .stat). */
export function Stat({
  label,
  value,
  delta,
  trend = 'flat',
  style,
}: {
  label: string;
  value: string;
  delta?: string;
  trend?: StatTrend;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const deltaColor =
    trend === 'up' ? theme.success : trend === 'down' ? theme.danger : theme.textSecondary;

  return (
    <Card style={StyleSheet.flatten([styles.statCard, style])}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText
        style={styles.statValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}>
        {value}
      </ThemedText>
      {delta ? (
        <ThemedText type="small" style={{ color: deltaColor }} numberOfLines={1}>
          {delta}
        </ThemedText>
      ) : null}
    </Card>
  );
}

/** Segmented control (finance_tracker's .toggle-row). */
export function SegmentedToggle<T extends string | number>({
  options,
  value,
  onChange,
  stretch,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  stretch?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.toggleRow,
        stretch && styles.toggleRowStretch,
        { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
      ]}>
      {options.map((option) => {
        const on = option.value === value;

        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.toggleButton,
              stretch && styles.toggleButtonStretch,
              on && { backgroundColor: theme.primary },
              { opacity: pressed ? 0.8 : 1 },
            ]}>
            <ThemedText
              type="smallBold"
              style={{ color: on ? theme.onPrimary : theme.textSecondary, fontSize: 13 }}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

type PillTone = 'cat' | 'good' | 'bad' | 'muted' | 'info';

/** Small status pill (finance_tracker's .pill). */
export function Pill({ label, tone = 'cat' }: { label: string; tone?: PillTone }) {
  const theme = useTheme();
  const palette: Record<PillTone, { bg: string; fg: string }> = {
    cat: { bg: theme.backgroundSelected, fg: theme.primary },
    good: { bg: 'rgba(95, 196, 156, 0.16)', fg: theme.success },
    bad: { bg: 'rgba(228, 121, 107, 0.18)', fg: theme.danger },
    muted: { bg: theme.backgroundSelected, fg: theme.textSecondary },
    info: { bg: 'rgba(127, 182, 232, 0.16)', fg: theme.accent },
  };
  const { bg, fg } = palette[tone];

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <ThemedText type="smallBold" style={{ color: fg, fontSize: 11.5 }}>
        {label}
      </ThemedText>
    </View>
  );
}

type TotalSegment = { label: string; value: string; accent?: boolean };

/** Dark summary bar with math-style segments (finance_tracker's .budget-total). */
export function SectionTotalBar({
  segments,
  operators,
}: {
  segments: TotalSegment[];
  operators?: string[];
}) {
  const theme = useTheme();

  return (
    <View style={[styles.totalBar, { backgroundColor: theme.ink }]}>
      {segments.map((segment, index) => (
        <Fragment key={segment.label}>
          {index > 0 ? (
            <ThemedText style={styles.totalOperator}>{operators?.[index - 1] ?? '+'}</ThemedText>
          ) : null}
          <View style={styles.totalSegment}>
            <ThemedText type="small" style={styles.totalSegmentLabel}>
              {segment.label}
            </ThemedText>
            <ThemedText style={[styles.totalSegmentValue, segment.accent && { color: '#F5B841' }]}>
              {segment.value}
            </ThemedText>
          </View>
        </Fragment>
      ))}
    </View>
  );
}

type PennyBadgeProps = {
  mode?: 'pilot' | 'wizard';
  expression?: 'default' | 'happy' | 'onTrack' | 'thinking' | 'concerned' | 'celebrating';
  animated?: boolean;
  size?: number;
};

const pennySources = {
  default: require('@/assets/mascot/penny-pilot-cropped.png'),
  wizard: require('@/assets/mascot/penny-wizard-cropped.png'),
  happy: require('@/assets/mascot/penny-happy-cropped.png'),
  onTrack: require('@/assets/mascot/penny-on-track-cropped.png'),
  thinking: require('@/assets/mascot/penny-thinking-cropped.png'),
  concerned: require('@/assets/mascot/penny-concerned-cropped.png'),
  celebrating: require('@/assets/mascot/penny-celebrating-cropped.png'),
};

export function PennyBadge({
  mode = 'pilot',
  expression = 'default',
  animated = true,
  size = 82,
}: PennyBadgeProps) {
  const [float] = useState(() => new Animated.Value(0));
  const reducedMotion = useReducedMotion();
  const source = mode === 'wizard' ? pennySources.wizard : pennySources[expression];

  useEffect(() => {
    if (!animated || reducedMotion) {
      float.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [animated, float, reducedMotion]);

  const mascotMotion = {
    transform: [
      {
        translateY: float.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -5],
        }),
      },
      {
        rotate: float.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', mode === 'wizard' ? '-1.5deg' : '1.5deg'],
        }),
      },
    ],
  };

  return (
    <Animated.View style={mascotMotion}>
      <Image
        source={source}
        style={{ width: size, height: Math.round(size * (104 / 82)) }}
        contentFit="contain"
        accessibilityLabel={
          mode === 'wizard' ? 'Penny setup wizard mascot' : `Penny Pilot ${expression} mascot`
        }
      />
    </Animated.View>
  );
}

export function StepDots({ total, active }: { total: number; active: number }) {
  const theme = useTheme();

  return (
    <View style={styles.stepDots}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.stepDot,
            {
              backgroundColor: index === active ? theme.primary : theme.backgroundSelected,
              width: index === active ? 24 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function ToggleChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggleChip,
        {
          backgroundColor: selected ? theme.primary : theme.backgroundElement,
          borderColor: selected ? theme.primary : theme.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      <ThemedText
        type="smallBold"
        style={{ color: selected ? theme.onPrimary : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

type PillButtonProps = PropsWithChildren<{
  tone?: 'primary' | 'quiet';
  onPress?: () => void;
  disabled?: boolean;
}>;

export function PillButton({ children, tone = 'quiet', onPress, disabled }: PillButtonProps) {
  const theme = useTheme();
  const isPrimary = tone === 'primary';

  return (
    <Pressable
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.pillButton,
        {
          backgroundColor: isPrimary ? theme.primary : theme.backgroundElement,
          borderColor: isPrimary ? theme.primary : theme.border,
          opacity: disabled ? 0.55 : pressed ? 0.75 : 1,
        },
      ]}>
      <ThemedText
        type="smallBold"
        style={{ color: isPrimary ? theme.onPrimary : theme.text }}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

type ProgressBarProps = {
  value: number;
  color?: string;
};

export function ProgressBar({ value, color }: ProgressBarProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.progressTrack,
        { backgroundColor: theme.background, borderColor: theme.border },
      ]}>
      <View
        style={[
          styles.progressFill,
          {
            backgroundColor: color ?? theme.primary,
            width: `${Math.max(4, Math.min(value * 100, 100))}%`,
          },
        ]}
      />
    </View>
  );
}

/**
 * Penny's speech bubble. All of Penny's dialogue renders in this one component so
 * users learn "gold bubble = Penny talking to me."
 */
export function SpeechBubble({
  children,
  mode = 'pilot',
  expression = 'default',
  animated = false,
}: PropsWithChildren<{
  mode?: 'pilot' | 'wizard';
  expression?: PennyBadgeProps['expression'];
  animated?: boolean;
}>) {
  const theme = useTheme();

  return (
    <View style={styles.speechRow}>
      <PennyBadge mode={mode} expression={expression} animated={animated} size={44} />
      <View style={[styles.speechBubble, { backgroundColor: theme.primary }]}>
        <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
          {children}
        </ThemedText>
      </View>
    </View>
  );
}

/**
 * Horizontal fuel gauge for budget envelopes: "fuel remaining" framing instead of
 * "you overspent" framing. Gold fuel; coral only when the tank is effectively dry.
 */
export function FuelGauge({
  label,
  spent,
  capacity,
  formatValue,
  detail,
}: {
  label: string;
  spent: number;
  capacity: number;
  formatValue: (value: number) => string;
  detail?: string;
}) {
  const theme = useTheme();
  const remaining = capacity - spent;
  const fraction = capacity > 0 ? Math.max(0, Math.min(remaining / capacity, 1)) : 0;
  const low = fraction < 0.15;

  return (
    <View style={styles.fuelGauge}>
      <View style={styles.fuelTop}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.fuelLabel}>
          {label}
        </ThemedText>
        <ThemedText type="money" style={{ color: low ? theme.danger : theme.primary }}>
          {formatValue(Math.max(0, remaining))}
        </ThemedText>
      </View>
      <View style={[styles.fuelTrack, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <View
          style={[
            styles.fuelFill,
            {
              backgroundColor: low ? theme.danger : theme.primary,
              width: `${Math.max(2, fraction * 100)}%`,
            },
          ]}
        />
        {[0.25, 0.5, 0.75].map((tick) => (
          <View
            key={tick}
            pointerEvents="none"
            style={[styles.fuelTick, { left: `${tick * 100}%`, backgroundColor: theme.border }]}
          />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {detail ?? `${formatValue(Math.max(0, remaining))} fuel left of ${formatValue(capacity)}`}
      </ThemedText>
    </View>
  );
}

const ARC_SEGMENTS = 25;

/**
 * The altitude gauge: a semicircular arc comparing month progress vs. budget burn.
 * Gold segments fill to the burn fraction; the sky-blue marker sits at today's
 * position in the month. Burn behind the marker = cruising; ahead = turbulence.
 * Built from positioned dots (same idiom as the chart dotted lines) so it renders
 * identically on iOS, Android, and web with no SVG dependency.
 */
export function AltitudeArc({
  burn,
  datePosition,
  size = 220,
}: {
  /** Fraction of the monthly budget spent so far (0..1, clamps past 1). */
  burn: number;
  /** Fraction of the month elapsed (0..1). */
  datePosition: number;
  size?: number;
}) {
  const theme = useTheme();
  const clampedBurn = Math.max(0, Math.min(burn, 1));
  const cruising = burn <= datePosition;
  const dotSize = 10;
  const radius = size / 2 - dotSize;
  const centerX = size / 2;
  const centerY = size / 2;
  const filled = Math.round(clampedBurn * ARC_SEGMENTS);
  const markerIndex = Math.max(0, Math.min(Math.round(datePosition * ARC_SEGMENTS), ARC_SEGMENTS));

  const pointAt = (index: number, r = radius) => {
    const angle = Math.PI - (index / ARC_SEGMENTS) * Math.PI;
    return { x: centerX + Math.cos(angle) * r, y: centerY - Math.sin(angle) * r };
  };

  return (
    <View style={{ width: size, height: size / 2 + dotSize, alignSelf: 'center' }}>
      {Array.from({ length: ARC_SEGMENTS + 1 }).map((_, index) => {
        const { x, y } = pointAt(index);
        const on = index <= filled && clampedBurn > 0;
        return (
          <View
            key={index}
            style={{
              position: 'absolute',
              left: x - dotSize / 2,
              top: y - dotSize / 2,
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: on
                ? cruising
                  ? theme.primary
                  : theme.warning
                : theme.backgroundSelected,
            }}
          />
        );
      })}
      {(() => {
        const { x, y } = pointAt(markerIndex, radius + dotSize * 0.1);
        return (
          <View
            style={{
              position: 'absolute',
              left: x - 9,
              top: y - 9,
              width: 18,
              height: 18,
              borderRadius: 9,
              borderWidth: 3,
              borderColor: theme.background,
              backgroundColor: theme.accent,
            }}
          />
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  speechRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  speechBubble: {
    flex: 1,
    borderRadius: Radius.card,
    borderBottomLeftRadius: 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  fuelGauge: {
    gap: Spacing.one,
  },
  fuelTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  fuelLabel: {
    flex: 1,
    minWidth: 0,
  },
  fuelTrack: {
    height: 14,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fuelFill: {
    height: '100%',
    borderRadius: 999,
  },
  fuelTick: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    width: 1,
  },
  screen: {
    flex: 1,
  },
  screenSafe: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  screenInner: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Platform.OS === 'web' ? Spacing.five : Spacing.two,
    gap: Spacing.three,
  },
  screenBody: {
    flex: 1,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  statRowLabel: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  statRowValue: {
    flexShrink: 0,
  },
  ticker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'flex-start',
    minWidth: 150,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    gap: Spacing.two,
  },
  tickerButton: {
    paddingHorizontal: Spacing.two,
  },
  tickerArrow: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: 700,
  },
  pageHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  pageHeadCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  pageHeadTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: 800,
    letterSpacing: -0.2,
  },
  statCard: {
    flex: 1,
    gap: Spacing.one,
  },
  statValue: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: 700,
    letterSpacing: -0.3,
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  toggleRowStretch: {
    alignSelf: 'stretch',
    flexWrap: 'nowrap',
  },
  toggleButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonStretch: {
    flex: 1,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  totalBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  totalSegment: {
    gap: 3,
  },
  totalSegmentLabel: {
    color: '#F2F6FB',
    opacity: 0.72,
    fontSize: 12,
  },
  totalSegmentValue: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: 700,
  },
  totalOperator: {
    color: '#FFFFFF',
    opacity: 0.45,
    fontSize: 20,
    fontWeight: 300,
  },
  pillButton: {
    minHeight: 42,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 11,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  stepDots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  stepDot: {
    height: 8,
    borderRadius: 4,
  },
  toggleChip: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
