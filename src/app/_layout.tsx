import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { Fraunces_800ExtraBold } from '@expo-google-fonts/fraunces/800ExtraBold';
import { Fraunces_900Black } from '@expo-google-fonts/fraunces/900Black';
import { Nunito_500Medium } from '@expo-google-fonts/nunito/500Medium';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import AppTabs from '@/components/app-tabs';
import { ConsentGate } from '@/components/consent-gate';
import { Colors } from '@/constants/theme';
import { ThemePreferenceProvider, useThemePreference } from '@/hooks/theme-preference';
import { FinanceProvider } from '@/services/finance-store';

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
      regular: { ...base.fonts.regular, fontFamily: 'Nunito_500Medium' },
      medium: { ...base.fonts.medium, fontFamily: 'Nunito_600SemiBold' },
      bold: { ...base.fonts.bold, fontFamily: 'Nunito_800ExtraBold' },
      heavy: { ...base.fonts.heavy, fontFamily: 'Nunito_900Black' },
    },
  };
}

function ThemedNavigation() {
  const { scheme } = useThemePreference();

  return (
    <ThemeProvider value={navigationTheme(scheme)}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ConsentGate>
        <AppTabs />
      </ConsentGate>
    </ThemeProvider>
  );
}

export default function TabLayout() {
  // The flight-deck type pair (Nunito + Fraunces). Render nothing until it loads so
  // no screen flashes in a fallback face.
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Fraunces_800ExtraBold,
    Fraunces_900Black,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemePreferenceProvider>
      <FinanceProvider>
        <ThemedNavigation />
      </FinanceProvider>
    </ThemePreferenceProvider>
  );
}
