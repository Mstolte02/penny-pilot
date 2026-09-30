/**
 * Penny Pilot design system — flight deck and travel documents.
 *
 * Mirrors the web app (stolte-finance-planner, penny-v2.css): paper documents on a
 * map-paper canvas, a stitched leather strap on each panel, brass-ringed icon
 * medallions, luggage-tag totals, ticket-stub labels and brass-plate buttons.
 * Navy ink for display type, copper for the brand, brass for trim.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#262019',
    // Canvas behind the documents: warm map paper.
    background: '#F3EBDD',
    // Document paper — every card is a sheet of this.
    backgroundElement: '#FFFCF5',
    backgroundSelected: '#F7EEDF',
    textSecondary: '#6C6255',
    primary: '#B8652F',
    primaryHover: '#94501F',
    accent: '#C99A3E',
    secondary: '#7A4726',
    info: '#1F5F7A',
    success: '#2F7A55',
    warning: '#C99A3E',
    danger: '#B8433A',
    border: '#E7DAC6',
    borderStrong: '#E4D5BE',
    surface: '#FFFCF5',
    // Navy ink for display titles and dark summary plates.
    ink: '#1B2742',
    onPrimary: '#FFFFFF',
    // Flight-deck materials.
    navy: '#1B2742',
    leather: '#7A4726',
    leatherDark: '#55301A',
    stitch: '#E6C28F',
    brass: '#C99A3E',
    brassDark: '#9C7424',
    sky: '#4FA3C7',
    skyTint: '#E1F0F6',
    greenTint: '#DCEFE3',
    goldTint: '#F6EACB',
    redTint: '#F6DEDA',
    cloud: '#EFE4D2',
    plateEdge: '#D9C7AB',
  },
  dark: {
    // Night flight: the same documents under cabin lights.
    text: '#F4EBDD',
    background: '#141A2A',
    backgroundElement: '#1F2638',
    backgroundSelected: '#283048',
    textSecondary: '#B8AE9E',
    primary: '#D98A52',
    primaryHover: '#B8652F',
    accent: '#E4BE6A',
    secondary: '#E6C28F',
    info: '#7CC0DC',
    success: '#5FA982',
    warning: '#E4BE6A',
    danger: '#D8736A',
    border: '#323A52',
    borderStrong: '#3C4560',
    surface: '#1F2638',
    ink: '#0E1320',
    onPrimary: '#FFFFFF',
    navy: '#E9DDC8',
    leather: '#6A3D20',
    leatherDark: '#4A2915',
    stitch: '#C9A06A',
    brass: '#C99A3E',
    brassDark: '#9C7424',
    sky: '#4FA3C7',
    skyTint: '#1E3444',
    greenTint: '#1D3A2D',
    goldTint: '#3A3220',
    redTint: '#3E2522',
    cloud: '#2A3148',
    plateEdge: '#0E1320',
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
  navy: '#F4F0FF',
  leather: '#5B3A8C',
  leatherDark: '#3D2766',
  stitch: '#C9B8F0',
  brass: '#D18A45',
  brassDark: '#A35F28',
  sky: '#8FA8C8',
  skyTint: '#231C4A',
  greenTint: '#1D3A2D',
  goldTint: '#3A3220',
  redTint: '#3E2522',
  cloud: '#2A2154',
  plateEdge: '#0D0A1D',
} as const;

/** Chart palette — warm, distinct, and legible on both ivory and warm-dark. */
export const chartPalette = {
  copper: '#B8652F',
  gold: '#C99A3E',
  olive: '#6F8F3E',
  sage: '#8DBB6E',
  steelBlue: '#4FA3C7',
  teal: '#1F5F7A',
  plum: '#7A5C8C',
  brick: '#B8433A',
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

/**
 * Nunito for reading, Fraunces for display — the same pair the web app uses.
 * Each weight is its own family (that is how expo-google-fonts registers them),
 * so ThemedText maps fontWeight to one of these names.
 */
export const Fonts = {
  sans: 'Nunito_600SemiBold',
  serif: 'Fraunces_800ExtraBold',
  rounded: 'Nunito_600SemiBold',
  mono: Platform.select({ ios: 'ui-monospace', web: 'var(--font-mono)', default: 'monospace' }),
};

export const NunitoByWeight: Record<string, string> = {
  '400': 'Nunito_500Medium',
  '500': 'Nunito_500Medium',
  '600': 'Nunito_600SemiBold',
  '700': 'Nunito_700Bold',
  '800': 'Nunito_800ExtraBold',
  '900': 'Nunito_900Black',
  normal: 'Nunito_500Medium',
  bold: 'Nunito_700Bold',
};

export const FrauncesByWeight: Record<string, string> = {
  '400': 'Fraunces_600SemiBold',
  '500': 'Fraunces_600SemiBold',
  '600': 'Fraunces_600SemiBold',
  '700': 'Fraunces_700Bold',
  '800': 'Fraunces_800ExtraBold',
  '900': 'Fraunces_900Black',
  normal: 'Fraunces_600SemiBold',
  bold: 'Fraunces_700Bold',
};

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

/** Paper documents and brass plates have crisp corners — no soft cards, no pills. */
export const Radius = {
  card: 5,
  control: 4,
  pill: 3,
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

export const BottomTabInset = Platform.select({ ios: 110, android: 112, default: 108 });
export const MaxContentWidth = 800;
