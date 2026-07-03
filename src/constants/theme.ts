/**
 * Penny Pilot design system — warm copper, penny-colored.
 *
 * Light-first: warm ivory background, white cards, copper as the brand color for
 * buttons, highlights, and the safe-to-spend number. Dark mode is a true warm-dark
 * variant, not inverted navy. Overspending uses brick red sparingly — states stay
 * factual and kind, never a red screen.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#2E2E2E',
    background: '#FAF7F2',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F3E9DC',
    textSecondary: '#6B6B6B',
    primary: '#B87333',
    primaryHover: '#A35F28',
    accent: '#D58B45',
    secondary: '#7A4A24',
    // Steel-blue informational — cools the UI down so copper stays special.
    info: '#5D7C96',
    success: '#2E7D32',
    warning: '#D69E2E',
    danger: '#C94C4C',
    border: '#DDD5CA',
    borderStrong: '#CBBFAF',
    surface: '#FFFFFF',
    // Dark summary panels (totals bar) — charcoal, matches primary text.
    ink: '#2E2E2E',
    // Text/icon color on top of copper (primary) fills.
    onPrimary: '#FFFFFF',
  },
  dark: {
    text: '#F6F2EC',
    background: '#161311',
    backgroundElement: '#211C19',
    backgroundSelected: '#2B241E',
    textSecondary: '#B9AEA1',
    primary: '#D18A45',
    primaryHover: '#B87333',
    accent: '#D58B45',
    secondary: '#C89B6E',
    info: '#7E9DB7',
    success: '#5FA463',
    warning: '#E0B14E',
    danger: '#D96C6C',
    border: '#352C24',
    borderStrong: '#453A30',
    surface: '#211C19',
    ink: '#0F0D0B',
    onPrimary: '#241A10',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Setup-wizard variant: a brief violet/starfield cast so the wizard→pilot swap
 * feels like a costume change, not a different app. Copper stays — it's Penny's
 * color in both costumes.
 */
export const WizardColors = {
  text: '#F4F0FF',
  background: '#141029',
  backgroundElement: '#1E1840',
  backgroundSelected: '#2A2154',
  textSecondary: '#A79FCC',
  primary: '#D18A45',
  primaryHover: '#B87333',
  accent: '#A78BFA',
  secondary: '#C89B6E',
  info: '#8FA8C8',
  success: '#5FA463',
  warning: '#E0B14E',
  danger: '#D96C6C',
  border: '#312757',
  borderStrong: '#3D3169',
  surface: '#1E1840',
  ink: '#0D0A1D',
  onPrimary: '#241A10',
} as const;

/** Chart palette — warm, distinct, and legible on both ivory and warm-dark. */
export const chartPalette = {
  copper: '#B87333',
  gold: '#D4A24C',
  olive: '#7A8F4E',
  sage: '#9BB58A',
  steelBlue: '#5D7C96',
  teal: '#3F8A89',
  plum: '#82658C',
  brick: '#C06A52',
} as const;

export const categoryColors: Record<string, string> = {
  Essentials: chartPalette.steelBlue,
  Food: chartPalette.copper,
  Debt: chartPalette.brick,
  'Daily Living': chartPalette.sage,
  'Subscriptions & Fun': chartPalette.gold,
  Entertainment: chartPalette.gold,
  Health: chartPalette.teal,
  Home: chartPalette.plum,
  Giving: chartPalette.olive,
  Income: chartPalette.olive,
  Uncategorized: '#A8A29E',
};

const categoryFallback = [
  chartPalette.copper,
  chartPalette.steelBlue,
  chartPalette.gold,
  chartPalette.teal,
  chartPalette.sage,
  chartPalette.plum,
  chartPalette.brick,
  chartPalette.olive,
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
