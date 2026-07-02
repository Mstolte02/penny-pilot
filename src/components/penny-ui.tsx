import { Image } from 'expo-image';
import { Fragment, PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CardProps = PropsWithChildren<{
  style?: ViewStyle;
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
          shadowColor: theme.borderStrong,
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
  mascot?: ReactNode;
  segments?: Segment[];
  active?: string;
  onSelect?: (value: string) => void;
  children: ReactNode;
};

/**
 * Fixed screen frame: pinned header + optional segmented sub-tabs, with a flexible body
 * below. The header and segments never scroll away; panels decide whether their own body
 * needs a short bounded scroll — so no screen is one long continuous scroll.
 */
export function Screen({
  eyebrow,
  title,
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
          <PageHead eyebrow={eyebrow} title={title} mascot={mascot} />
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
              style={{ color: on ? '#FFF8E8' : theme.textSecondary, fontSize: 13 }}>
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
    good: { bg: '#E7F6EC', fg: theme.success },
    bad: { bg: '#FBEAE8', fg: theme.danger },
    muted: { bg: theme.backgroundSelected, fg: theme.textSecondary },
    info: { bg: '#E4F1FB', fg: theme.accent },
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
            <ThemedText style={[styles.totalSegmentValue, segment.accent && { color: '#E8B27A' }]}>
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
}: PennyBadgeProps) {
  const [float] = useState(() => new Animated.Value(0));
  const source = mode === 'wizard' ? pennySources.wizard : pennySources[expression];

  useEffect(() => {
    if (!animated) {
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
  }, [animated, float]);

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
        style={styles.pennyImage}
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
        style={{ color: selected ? '#FFF8E8' : theme.text }}>
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
        style={{ color: isPrimary ? '#FFF8E8' : theme.text }}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

type ProgressBarProps = {
  value: number;
};

export function ProgressBar({ value }: ProgressBarProps) {
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
            backgroundColor: theme.success,
            width: `${Math.max(4, Math.min(value * 100, 100))}%`,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.two,
    // Hard editorial offset shadow (finance_tracker look), not a soft blur.
    shadowOpacity: 0.16,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pennyImage: {
    width: 82,
    height: 104,
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
    paddingHorizontal: Spacing.four,
    paddingTop: Platform.OS === 'web' ? Spacing.five : Spacing.three,
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
    fontSize: 32,
    lineHeight: 36,
    fontWeight: 800,
    letterSpacing: -0.3,
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
    borderRadius: 8,
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
    borderRadius: 6,
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
    borderRadius: 8,
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  totalSegment: {
    gap: 3,
  },
  totalSegmentLabel: {
    color: '#FFF8E8',
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
    borderRadius: 7,
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
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
