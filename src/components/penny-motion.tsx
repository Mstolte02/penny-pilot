import { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { Animated, Easing, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

/**
 * Shared motion primitives. The rule of the house: motion confirms what just
 * happened or draws the eye once — it never loops for decoration (Penny's idle
 * float is the single deliberate exception, and it lives in PennyBadge).
 * Everything here collapses to a static render under reduced motion.
 */

/** Fades and rises content in on mount. Stagger with `delay` (ms). */
export function FadeInUp({
  children,
  delay = 0,
  distance = 14,
  style,
}: PropsWithChildren<{ delay?: number; distance?: number; style?: StyleProp<ViewStyle> }>) {
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reducedMotion]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

/** One gentle scale "pop" whenever `trigger` changes — confirmation, not spectacle. */
export function PopOnChange({
  children,
  trigger,
  style,
}: PropsWithChildren<{ trigger: unknown; style?: StyleProp<ViewStyle> }>) {
  const reducedMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (reducedMotion) return;
    scale.setValue(0.94);
    const animation = Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 120,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [trigger, scale, reducedMotion]);

  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

/**
 * Money that counts up to its value on mount and re-counts when the value changes
 * meaningfully. Uses a plain JS-driven number (text can't be native-driven), kept
 * short enough (650ms) that it reads as "alive," not as a slot machine.
 */
export function CountUpMoney({
  value,
  format,
  style,
  durationMs = 650,
}: {
  value: number;
  format: (value: number) => string;
  style?: StyleProp<TextStyle>;
  durationMs?: number;
}) {
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const [animated] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reducedMotion) return;
    const id = animated.addListener(({ value: v }) => setDisplay(v));
    const animation = Animated.timing(animated, {
      toValue: value,
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      animated.removeListener(id);
      animation.stop();
    };
  }, [value, animated, durationMs, reducedMotion]);

  return (
    <ThemedText type="hero" style={style} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
      {format(reducedMotion ? value : display)}
    </ThemedText>
  );
}
