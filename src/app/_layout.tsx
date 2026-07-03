import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { Colors, Fonts } from '@/constants/theme';

function navigationTheme(scheme: 'light' | 'dark') {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const palette = Colors[scheme];

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.primary,
      background: palette.background,
      card: palette.backgroundElement,
      text: palette.text,
      border: palette.border,
      notification: palette.danger,
    },
    fonts: {
      ...base.fonts,
      regular: { ...base.fonts.regular, fontFamily: Fonts.rounded },
      medium: { ...base.fonts.medium, fontFamily: Fonts.rounded },
      bold: { ...base.fonts.bold, fontFamily: Fonts.rounded },
      heavy: { ...base.fonts.heavy, fontFamily: Fonts.rounded },
    },
  };
}

export default function TabLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <ThemeProvider value={navigationTheme(scheme)}>
      <StatusBar style="auto" />
      <AppTabs />
    </ThemeProvider>
  );
}
