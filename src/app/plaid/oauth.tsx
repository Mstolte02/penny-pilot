import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Landing spot for Plaid's OAuth return (https://penny-pilot.net/plaid/oauth).
 * After a bank's own sign-in page, iOS reopens Penny on this path. The Plaid SDK
 * finishes the connection by itself; this screen only has to exist (otherwise the
 * router shows "Unmatched Route") and hand the user back to where they were.
 */
export default function PlaidOAuthReturn() {
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/transactions');
    }, 150);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <ThemedView style={styles.screen}>
      <ActivityIndicator color={theme.primary} />
      <ThemedText type="smallBold" themeColor="textSecondary">
        Back from your bank. Finishing up…
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
});
