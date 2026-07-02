/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1D3557',
    background: '#FFFFFF',
    backgroundElement: '#FFFDF7',
    backgroundSelected: '#F6E8CF',
    textSecondary: '#667085',
    primary: '#B87333',
    accent: '#5DA9E9',
    success: '#2FA866',
    warning: '#D9823B',
    danger: '#C4443B',
    border: '#E8DCC7',
    // Hard editorial border/shadow color (finance_tracker uses #111; penny uses its navy ink).
    borderStrong: '#1D3557',
    surface: '#FFFDF7',
    // Dark bar used for budget / contribution totals (finance_tracker's .budget-total).
    ink: '#1D3557',
  },
  dark: {
    text: '#1D3557',
    background: '#FFFFFF',
    backgroundElement: '#FFFDF7',
    backgroundSelected: '#F6E8CF',
    textSecondary: '#667085',
    primary: '#B87333',
    accent: '#5DA9E9',
    success: '#2FA866',
    warning: '#D9823B',
    danger: '#C4443B',
    border: '#E8DCC7',
    borderStrong: '#1D3557',
    surface: '#FFFFFF',
    ink: '#1D3557',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// Distinct categorical palette for charts/legends, drawn from Penny's own colors
// (copper / sky / green / navy / orange) plus a few tints — no new brand hues.
export const categoryColors: Record<string, string> = {
  Essentials: '#5DA9E9',
  Food: '#B87333',
  Debt: '#C4443B',
  'Daily Living': '#667085',
  'Subscriptions & Fun': '#D9823B',
  Entertainment: '#D9823B',
  Health: '#2FA866',
  Home: '#1D3557',
  Giving: '#E8B27A',
  Income: '#5DA9E9',
  Uncategorized: '#A8A29E',
};

const categoryFallback = [
  '#5DA9E9',
  '#B87333',
  '#2FA866',
  '#D9823B',
  '#C4443B',
  '#1D3557',
  '#667085',
  '#E8B27A',
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
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
