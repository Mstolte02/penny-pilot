import { Image } from 'expo-image';
import { PropsWithChildren, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CardProps = PropsWithChildren<{
  style?: ViewStyle;
}>;

export function Card({ children, style }: CardProps) {
  const theme = useTheme();

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: theme.border }, style]}>
      {children}
    </ThemedView>
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
          backgroundColor: selected ? theme.primary : theme.backgroundSelected,
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
}>;

export function PillButton({ children, tone = 'quiet', onPress }: PillButtonProps) {
  const theme = useTheme();
  const isPrimary = tone === 'primary';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pillButton,
        {
          backgroundColor: isPrimary ? theme.primary : theme.backgroundSelected,
          opacity: pressed ? 0.75 : 1,
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
    <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
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
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  pennyImage: {
    width: 92,
    height: 120,
  },
  pillButton: {
    minHeight: 42,
    paddingHorizontal: Spacing.three,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
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
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
