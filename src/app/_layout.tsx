import { DarkTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import AppTabs from '@/components/app-tabs';
import { Colors, Fonts } from '@/constants/theme';

// Aviation at dusk, regardless of the OS color scheme: one calm instrument panel.
const duskTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.background,
    card: Colors.dark.ink,
    text: Colors.dark.text,
    border: Colors.dark.border,
    notification: Colors.dark.danger,
  },
  fonts: {
    ...DarkTheme.fonts,
    regular: { ...DarkTheme.fonts.regular, fontFamily: Fonts.rounded },
    medium: { ...DarkTheme.fonts.medium, fontFamily: Fonts.rounded },
    bold: { ...DarkTheme.fonts.bold, fontFamily: Fonts.rounded },
    heavy: { ...DarkTheme.fonts.heavy, fontFamily: Fonts.rounded },
  },
};

export default function TabLayout() {
  return (
    <ThemeProvider value={duskTheme}>
      <StatusBar style="light" />
      <AppTabs />
    </ThemeProvider>
  );
}
