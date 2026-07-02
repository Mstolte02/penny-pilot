/**
 * Penny Pilot design system — "aviation at dusk".
 *
 * Deep navy is the primary surface; warm gold is Penny's color, the safe-to-spend
 * number, and every positive affordance. Sky-blue is informational. Over-budget and
 * warning states use muted coral — there is intentionally no bright red anywhere:
 * the audience avoids their finances out of stress, and color is the fastest way to
 * trigger or defuse that. Both color-scheme slots resolve to the dusk palette so the
 * app reads as one calm instrument panel regardless of OS setting.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#F2F6FB',
    background: '#0F1B2D',
    backgroundElement: '#16263C',
    backgroundSelected: '#1F3350',
    textSecondary: '#8FA3BD',
    primary: '#F5B841',
    accent: '#7FB6E8',
    success: '#5FC49C',
    warning: '#E8A06B',
    danger: '#E4796B',
    border: '#22354E',
    borderStrong: '#2C425F',
    surface: '#16263C',
    // Deepest panel color, used for summary bars and the tab bar.
    ink: '#0A1524',
    // Text/icon color on top of gold (primary) fills.
    onPrimary: '#13233B',
  },
  dark: {
    text: '#F2F6FB',
    background: '#0F1B2D',
    backgroundElement: '#16263C',
    backgroundSelected: '#1F3350',
    textSecondary: '#8FA3BD',
    primary: '#F5B841',
    accent: '#7FB6E8',
    success: '#5FC49C',
    warning: '#E8A06B',
    danger: '#E4796B',
    border: '#22354E',
    borderStrong: '#2C425F',
    surface: '#16263C',
    ink: '#0A1524',
    onPrimary: '#13233B',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Setup-wizard variant of the same palette: a brief violet/starfield cast so the
 * wizard→pilot swap feels like a costume change, not a different app. Gold stays —
 * it's Penny's color in both costumes.
 */
export const WizardColors = {
  text: '#F4F0FF',
  background: '#141029',
  backgroundElement: '#1E1840',
  backgroundSelected: '#2A2154',
  textSecondary: '#A79FCC',
  primary: '#F5B841',
  accent: '#A78BFA',
  success: '#5FC49C',
  warning: '#E8A06B',
  danger: '#E4796B',
  border: '#312757',
  borderStrong: '#3D3169',
  surface: '#1E1840',
  ink: '#0D0A1D',
  onPrimary: '#13233B',
} as const;

// Distinct categorical palette for charts/legends, tuned to read on deep navy —
// gold / sky / mint / coral / violet plus tints. No bright red.
export const categoryColors: Record<string, string> = {
  Essentials: '#7FB6E8',
  Food: '#F5B841',
  Debt: '#E4796B',
  'Daily Living': '#9AB0C9',
  'Subscriptions & Fun': '#E8A06B',
  Entertainment: '#E8A06B',
  Health: '#5FC49C',
  Home: '#A78BFA',
  Giving: '#F0D49B',
  Income: '#7FB6E8',
  Uncategorized: '#7A8AA0',
};

const categoryFallback = [
  '#7FB6E8',
  '#F5B841',
  '#5FC49C',
  '#E8A06B',
  '#E4796B',
  '#A78BFA',
  '#9AB0C9',
  '#F0D49B',
];

export function colorForCategory(category: string, index = 0): string {
  return categoryColors[category] ?? categoryFallback[index % categoryFallback.length];
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-rounded)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * Three sizes do most of the work: the hero number (Safe to Spend), section
 * headers, and body. Money always renders with tabular figures so digits don't
 * jitter as they update.
 */
export const TypeScale = {
  hero: 48,
  section: 20,
  body: 15,
} as const;

export const Radius = {
  card: 18,
  control: 14,
  pill: 999,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 92, android: 96, default: 96 });
export const MaxContentWidth = 800;
