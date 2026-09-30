import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { Fonts, FrauncesByWeight, NunitoByWeight, ThemeColor, TypeScale } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'hero'
    | 'money'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'section'
    | 'link'
    | 'linkPrimary'
    | 'code'
    | 'eyebrow';
  themeColor?: ThemeColor;
};

// Display types set in Fraunces (the web app's serif); everything else in Nunito.
const DISPLAY_TYPES = new Set(['title', 'hero', 'subtitle', 'section']);

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const typeStyle = styles[type as keyof typeof styles] ?? styles.default;
  const flat: TextStyle = StyleSheet.flatten([typeStyle, style]) ?? {};
  const weight = String(flat.fontWeight ?? 500);
  // Each weight is its own registered family, so pick the family from the weight
  // unless the caller asked for a specific family (monospace code, for example).
  const family =
    type === 'code'
      ? Fonts.mono
      : (DISPLAY_TYPES.has(type) ? FrauncesByWeight : NunitoByWeight)[weight] ?? Fonts.rounded;

  return (
    <Text
      style={[
        { fontFamily: family, color: type === 'eyebrow' ? theme.primary : DISPLAY_TYPES.has(type) ? theme.navy : theme.text },
        themeColor ? { color: theme[themeColor] } : null,
        typeStyle,
        style,
        // On native each weight is its own font file, so an extra fontWeight makes iOS
        // hunt for a variant it does not have and fall back to the system face.
        Platform.OS !== 'web' ? { fontWeight: 'normal' } : null,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: 900,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: TypeScale.body,
    lineHeight: 22,
    fontWeight: 500,
  },
  // The hero number (Safe to Spend). Tabular figures so digits don't jitter.
  hero: {
    fontSize: TypeScale.hero,
    lineHeight: 54,
    fontWeight: 800,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  // Any inline money value: same body rhythm, trustworthy aligned digits.
  money: {
    fontSize: TypeScale.body,
    lineHeight: 22,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  section: {
    fontSize: TypeScale.section,
    lineHeight: 26,
    fontWeight: 700,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#B8652F',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
