import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  cloneElement,
  Fragment,
  isValidElement,
  PropsWithChildren,
  ReactNode,
  useEffect,
  useState,
} from 'react';
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

import { Scene, SceneWash, Stub, Strap } from '@/components/flight-deck';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

/** Every panel is a paper document with a stitched leather strap down its left edge. */
export function Card({ children, style }: CardProps) {
  const theme = useTheme();

  return (
    <ThemedView
      type="backgroundElement"
      style={[
        styles.card,
        {
          borderColor: theme.borderStrong,
          borderBottomColor: theme.plateEdge,
          shadowColor: theme.leatherDark,
        },
        style,
      ]}>
      <Strap />
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
 * Penny's corner avatar still opens settings when tapped, but the explicit gear
 * button next to her is what makes the destination obvious.
 */
function MascotDoor({ children }: PropsWithChildren) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Penny: help and settings"
      hitSlop={8}
      onPress={() => router.push('/auth')}
      style={({ pressed }) => [styles.mascotDoor, { opacity: pressed ? 0.7 : 1 }]}>
      {children}
    </Pressable>
  );
}

/** Circular gear button in every screen header — the unambiguous door to settings. */
export function SettingsButton() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Settings"
      hitSlop={8}
      onPress={() => router.push('/auth')}
      style={({ pressed }) => [
        styles.settingsButton,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.plateEdge,
          borderBottomColor: theme.plateEdge,
          opacity: pressed ? 0.7 : 1,
          transform: [{ translateY: pressed ? 1 : 0 }],
        },
      ]}>
      <Ionicons name="settings-outline" size={19} color={theme.navy} />
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
            action={<SettingsButton />}
            mascot={
              mascot ? (
                <MascotDoor>
                  {/* The banner holds a slightly smaller Penny so titles keep their room. */}
                  {isValidElement<{ size?: number }>(mascot) ? cloneElement(mascot, { size: 70 }) : mascot}
                </MascotDoor>
              ) : undefined
            }
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

/** Bottom padding to clear the floating tab bar for scrolling panel bodies —
 *  generous enough that the last card (usually Penny's bubble) sits fully clear. */
export const PANEL_BOTTOM_INSET = BottomTabInset + Spacing.five;

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
      <ThemedText type="eyebrow" themeColor="textSecondary" numberOfLines={1} style={styles.statLabel}>
        {label}
      </ThemedText>
      <FitValue value={value} size={styles.statValue.fontSize} />
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

/**
 * A one-line serif figure that shrinks to fit its box. `adjustsFontSizeToFit` only
 * works on iOS, so measure the box and size the text from its character count;
 * the number then never clips or ends in an ellipsis on Android or the web.
 */
function FitValue({ value, size, centered }: { value: string; size: number; centered?: boolean }) {
  const [width, setWidth] = useState(0);
  // Fraunces ExtraBold figures, $ and commas run up to ~0.7em wide on iOS; leave a margin.
  const fitted = width > 0 ? Math.min(size, width / (Math.max(value.length, 1) * 0.74)) : size;

  return (
    <View style={styles.fitValue} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <ThemedText
        type="section"
        numberOfLines={1}
        style={[
          styles.statValue,
          { fontSize: fitted, lineHeight: Math.round(fitted * 1.18) },
          centered && { textAlign: 'center' },
        ]}>
        {value}
      </ThemedText>
    </View>
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
        {
          borderColor: theme.plateEdge,
          borderBottomColor: theme.plateEdge,
          backgroundColor: theme.backgroundElement,
        },
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
  action?: ReactNode;
  mascot?: ReactNode;
};

/** Large editorial page title + subtitle (mirrors finance_tracker's .page-head), with an
 *  optional action (settings gear) and mascot slot so Penny still greets each screen. */
export function PageHead({ eyebrow, title, subtitle, action, mascot }: PageHeadProps) {
  const theme = useTheme();
  const [copyWidth, setCopyWidth] = useState(0);
  // The title is always one line, so a word can never break ("Transactio/ns").
  // iOS and Android shrink it to fit (adjustsFontSizeToFit); the web cannot, so size
  // it from the measured column there too. Fraunces ExtraBold runs ~0.64em per character.
  const titleSize =
    copyWidth > 0
      ? Math.min(styles.pageHeadTitle.fontSize, copyWidth / (Math.max(title.length, 1) * 0.64))
      : styles.pageHeadTitle.fontSize;

  return (
    <View
      style={[
        styles.pageHead,
        {
          borderColor: theme.borderStrong,
          borderBottomColor: theme.plateEdge,
          shadowColor: theme.leatherDark,
        },
      ]}>
      <View style={styles.pageHeadArt} pointerEvents="none">
        <Scene />
        <SceneWash />
      </View>
      <View
        style={styles.pageHeadCopy}
        onLayout={(event) => setCopyWidth(event.nativeEvent.layout.width)}>
        {eyebrow ? (
          <ThemedText type="eyebrow" numberOfLines={1}>
            {eyebrow}
          </ThemedText>
        ) : null}
        <ThemedText
          type="title"
          style={[styles.pageHeadTitle, { fontSize: titleSize, lineHeight: Math.round(titleSize * 1.15) }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="smallBold" numberOfLines={2} style={{ color: theme.textSecondary }}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {mascot ? <View style={styles.pageHeadMascot}>{mascot}</View> : null}
      {action ? <View style={styles.pageHeadAction}>{action}</View> : null}
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
  centered,
  valueSize,
  style,
}: {
  label: string;
  value: string;
  delta?: string;
  trend?: StatTrend;
  centered?: boolean;
  /** Fixed value font size — use across a row of tiles so numbers match instead of
   *  each tile auto-shrinking independently. */
  valueSize?: number;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const deltaColor =
    trend === 'up' ? theme.success : trend === 'down' ? theme.danger : theme.textSecondary;

  return (
    <Card
      style={StyleSheet.flatten([styles.statCard, centered && { alignItems: 'center' }, style])}>
      <ThemedText type="eyebrow" themeColor="textSecondary" numberOfLines={1} style={styles.statLabel}>
        {label}
      </ThemedText>
      <FitValue value={value} size={valueSize ?? styles.statValue.fontSize} centered={centered} />

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
        { backgroundColor: theme.backgroundSelected, borderColor: theme.borderStrong },
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
              on && { backgroundColor: theme.navy },
              { opacity: pressed ? 0.8 : 1 },
            ]}>
            <ThemedText
              type="smallBold"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={{
                color: on ? theme.backgroundElement : theme.textSecondary,
                fontSize: 13,
                fontWeight: 800,
              }}>
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
/** Status label, drawn as a ticket stub (the web app's .stub) instead of a pill. */
export function Pill({ label, tone = 'cat' }: { label: string; tone?: PillTone }) {
  const stubTone = ({ cat: 'gold', good: 'green', bad: 'red', muted: 'navy', info: 'sky' } as const)[tone];

  return <Stub label={label} tone={stubTone} />;
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
    <View style={[styles.totalBar, { backgroundColor: theme.leather, borderColor: theme.leatherDark }]}>
      <View pointerEvents="none" style={[styles.totalStitch, { borderColor: theme.stitch }]} />
      {segments.map((segment, index) => (
        <Fragment key={segment.label}>
          {index > 0 ? (
            <ThemedText style={styles.totalOperator}>{operators?.[index - 1] ?? '+'}</ThemedText>
          ) : null}
          <View style={styles.totalSegment}>
            <ThemedText type="eyebrow" style={styles.totalSegmentLabel}>
              {segment.label}
            </ThemedText>
            <ThemedText
              type="section"
              style={[styles.totalSegmentValue, segment.accent && { color: '#F2C979' }]}>
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
          // Copper + a check mark: reads as "chosen" on the paper screens and on the
          // dark wizard alike (navy vanished against the wizard's night sky).
          backgroundColor: selected ? theme.primary : theme.backgroundElement,
          borderColor: selected ? theme.primaryHover : theme.plateEdge,
          borderBottomColor: selected ? theme.leatherDark : theme.plateEdge,
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      <ThemedText
        type="smallBold"
        style={{ color: selected ? '#FFFFFF' : theme.navy, fontWeight: 800 }}>
        {selected ? `✓ ${label}` : label}
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
          borderColor: isPrimary ? theme.primaryHover : theme.plateEdge,
          borderBottomColor: isPrimary ? theme.leatherDark : theme.plateEdge,
          opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
          transform: [{ translateY: pressed ? 1 : 0 }],
        },
      ]}>
      {isPrimary ? <View pointerEvents="none" style={styles.plateShine} /> : null}
      <ThemedText
        type="smallBold"
        style={{
          color: isPrimary ? theme.onPrimary : theme.navy,
          fontWeight: 800,
          textAlign: 'center',
        }}>
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
  const reducedMotion = useReducedMotion();
  const target = Math.max(4, Math.min(value * 100, 100));
  const [fill] = useState(() => new Animated.Value(reducedMotion ? target : 4));

  // Fill glides to its value on mount and on change; width animation is layout-
  // driven, so this stays JS-side (useNativeDriver: false) by necessity.
  useEffect(() => {
    if (reducedMotion) {
      fill.setValue(target);
      return;
    }
    const animation = Animated.timing(fill, {
      toValue: target,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [target, fill, reducedMotion]);

  return (
    <View
      style={[
        styles.progressTrack,
        { backgroundColor: theme.cloud },
      ]}>
      {[0.25, 0.5, 0.75].map((tick) => (
        <View
          key={tick}
          pointerEvents="none"
          style={[styles.fuelTick, { left: `${tick * 100}%`, backgroundColor: theme.borderStrong }]}
        />
      ))}
      <Animated.View
        style={[
          styles.progressFill,
          {
            backgroundColor: color ?? theme.primary,
            width: fill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </View>
  );
}

/**
 * Penny's speech bubble. All of Penny's dialogue renders in this one component so
 * users learn "the copper-trimmed bubble = Penny talking to me." A soft tint with
 * a copper edge, not a solid block — the brand color stays an accent, not a wall.
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
  const reducedMotion = useReducedMotion();
  const [entrance] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));

  // The bubble pops in like a chat message arriving — once, on mount.
  useEffect(() => {
    if (reducedMotion) {
      entrance.setValue(1);
      return;
    }
    const animation = Animated.spring(entrance, {
      toValue: 1,
      friction: 7,
      tension: 70,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [entrance, reducedMotion]);

  return (
    <View style={styles.speechRow}>
      <PennyBadge mode={mode} expression={expression} animated={animated} size={44} />
      <Animated.View
        style={[
          styles.speechBubble,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.borderStrong,
            borderLeftColor: theme.primary,
          },
          {
            opacity: entrance,
            transform: [
              { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
              { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            ],
            transformOrigin: 'bottom left',
          },
        ]}>
        <ThemedText type="smallBold">{children}</ThemedText>
      </Animated.View>
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
  color,
}: {
  label: string;
  spent: number;
  capacity: number;
  formatValue: (value: number) => string;
  detail?: string;
  color?: string;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const remaining = capacity - spent;
  const fraction = capacity > 0 ? Math.max(0, Math.min(remaining / capacity, 1)) : 0;
  const low = fraction < 0.15;
  const fuelTarget = Math.max(2, fraction * 100);
  const [fuel] = useState(() => new Animated.Value(reducedMotion ? fuelTarget : 2));

  useEffect(() => {
    if (reducedMotion) {
      fuel.setValue(fuelTarget);
      return;
    }
    const animation = Animated.timing(fuel, {
      toValue: fuelTarget,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [fuelTarget, fuel, reducedMotion]);

  return (
    <View style={styles.fuelGauge}>
      <View style={styles.fuelTop}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.fuelLabel}>
          {label}
        </ThemedText>
        <ThemedText type="money" style={{ color: low ? theme.danger : color ?? theme.primary }}>
          {formatValue(Math.max(0, remaining))}
        </ThemedText>
      </View>
      <View style={[styles.fuelTrack, { backgroundColor: theme.cloud, borderColor: theme.borderStrong }]}>
        <Animated.View
          style={[
            styles.fuelFill,
            {
              backgroundColor: low ? theme.danger : color ?? theme.primary,
              width: fuel.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
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
        {detail ?? `${formatValue(Math.max(0, remaining))} left of ${formatValue(capacity)}`}
      </ThemedText>
    </View>
  );
}

const ARC_SEGMENTS = 25;

/**
 * Month-pace gauge: a semicircular arc filled to the fraction of the budget spent,
 * with a marker pinned at today's position in the month. Fill behind the marker
 * means spending is slower than the calendar; past it means faster. A center slot
 * states the headline (e.g. "42% spent") so the gauge never needs decoding.
 * Built from positioned dots (same idiom as the chart dotted lines) so it renders
 * identically on iOS, Android, and web with no SVG dependency.
 */
export function AltitudeArc({
  burn,
  datePosition,
  size = 220,
  centerLabel,
  centerSub,
}: {
  /** Fraction of the monthly budget spent so far (0..1, clamps past 1). */
  burn: number;
  /** Fraction of the month elapsed (0..1). */
  datePosition: number;
  size?: number;
  /** Headline inside the arc, e.g. "42% spent". */
  centerLabel?: string;
  /** Second line inside the arc, e.g. "day 2 of 31". */
  centerSub?: string;
}) {
  const theme = useTheme();
  const clampedBurn = Math.max(0, Math.min(burn, 1));
  const onTrack = burn <= datePosition;
  const dotSize = 10;
  const radius = size / 2 - dotSize;
  const centerX = size / 2;
  const centerY = size / 2;
  const filled = Math.round(clampedBurn * ARC_SEGMENTS);
  const markerIndex = Math.max(0, Math.min(Math.round(datePosition * ARC_SEGMENTS), ARC_SEGMENTS));
  const marker = (() => {
    const angle = Math.PI - (markerIndex / ARC_SEGMENTS) * Math.PI;
    const r = radius + dotSize * 0.1;
    return { x: centerX + Math.cos(angle) * r, y: centerY - Math.sin(angle) * r };
  })();

  const pointAt = (index: number) => {
    const angle = Math.PI - (index / ARC_SEGMENTS) * Math.PI;
    return { x: centerX + Math.cos(angle) * radius, y: centerY - Math.sin(angle) * radius };
  };

  return (
    <View style={{ width: size, height: size / 2 + dotSize * 2, alignSelf: 'center' }}>
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
                ? onTrack
                  ? theme.primary
                  : theme.warning
                : theme.backgroundSelected,
            }}
          />
        );
      })}
      <View
        style={{
          position: 'absolute',
          left: marker.x - 9,
          top: marker.y - 9,
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 3,
          borderColor: theme.backgroundElement,
          backgroundColor: theme.ink,
        }}
      />
      {centerLabel ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: size * 0.22,
            alignItems: 'center',
            gap: 2,
          }}>
          <ThemedText
            type="hero"
            style={{ fontSize: 30, lineHeight: 34, color: onTrack ? theme.primary : theme.warning }}>
            {centerLabel}
          </ThemedText>
          {centerSub ? (
            <ThemedText type="small" themeColor="textSecondary">
              {centerSub}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderBottomWidth: 3,
    borderRadius: Radius.card,
    padding: Spacing.three,
    paddingLeft: Spacing.three + 9,
    gap: Spacing.two,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  speechRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  speechBubble: {
    flex: 1,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: Radius.card,
    borderBottomLeftRadius: 0,
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
    borderRadius: 2,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fuelFill: {
    height: '100%',
    borderRadius: 2,
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
    borderBottomWidth: 3,
    borderRadius: Radius.control,
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
    gap: Spacing.two,
    minHeight: 118,
    borderWidth: 1,
    borderBottomWidth: 3,
    borderRadius: Radius.card,
    paddingVertical: Spacing.three,
    paddingLeft: Spacing.three + 2,
    paddingRight: Spacing.two,
    overflow: 'hidden',
    backgroundColor: '#E7F3F6',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  pageHeadArt: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  pageHeadMascot: {
    alignSelf: 'flex-end',
    marginRight: 30,
    marginTop: Spacing.four,
    marginBottom: -Spacing.three - 6,
  },
  pageHeadAction: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
  },
  mascotDoor: {
    alignSelf: 'flex-end',
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderBottomWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageHeadCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  pageHeadTitle: {
    fontSize: 30,
    lineHeight: 33,
    fontWeight: 800,
    letterSpacing: -0.3,
  },
  statCard: {
    flex: 1,
    gap: Spacing.one,
    // Small read-out tiles sit three to a row, so give the figure the room.
    paddingRight: Spacing.two + 2,
    paddingLeft: Spacing.three + 2,
  },
  fitValue: {
    alignSelf: 'stretch',
    minWidth: 0,
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 1.4,
  },
  statValue: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: 800,
    letterSpacing: 0,
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.control,
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
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonStretch: {
    flex: 1,
  },
  totalBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: Radius.card + 3,
    borderWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 24,
    shadowColor: '#3C230F',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  totalStitch: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 4,
    opacity: 0.8,
  },
  totalSegment: {
    gap: 3,
  },
  totalSegmentLabel: {
    color: '#F4E7D2',
    opacity: 0.85,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  totalSegmentValue: {
    color: '#FFFCF5',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: 800,
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
    borderRadius: Radius.control,
    borderWidth: 1,
    borderBottomWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  plateShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  progressTrack: {
    height: 10,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  stepDots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  stepDot: {
    height: 8,
    borderRadius: 2,
  },
  toggleChip: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderBottomWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
