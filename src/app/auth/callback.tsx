import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PennyBadge, PillButton } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { authService } from '@/services';
import { completeSupabaseOAuthCallback } from '@/services/supabase-services';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const [status, setStatus] = useState('Finishing secure sign-in...');
  const [failed, setFailed] = useState(false);

  const code = useMemo(() => {
    if (Array.isArray(params.code)) {
      return params.code[0];
    }

    return params.code;
  }, [params.code]);

  const providerError = useMemo(() => {
    const description = Array.isArray(params.error_description)
      ? params.error_description[0]
      : params.error_description;
    const error = Array.isArray(params.error) ? params.error[0] : params.error;

    return description ?? error;
  }, [params.error, params.error_description]);

  useEffect(() => {
    let mounted = true;
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;

    async function finishSignIn() {
      if (providerError) {
        throw new Error(providerError);
      }

      if (!code) {
        throw new Error('No authorization code was returned.');
      }

      await completeSupabaseOAuthCallback(code);
      await authService.getCurrentUser();
    }

    finishSignIn()
      .then(() => {
        if (!mounted) return;
        setStatus('Signed in. Taking you back to Penny Pilot...');
        redirectTimer = setTimeout(() => router.replace('/auth'), 500);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setFailed(true);
        setStatus(error instanceof Error ? error.message : 'Sign-in could not complete.');
      });

    return () => {
      mounted = false;
      if (redirectTimer) {
        clearTimeout(redirectTimer);
      }
    };
  }, [code, providerError]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Card style={styles.card}>
          <View style={styles.header}>
            <View style={styles.copy}>
              <ThemedText type="smallBold" themeColor={failed ? 'warning' : 'primary'}>
                Account
              </ThemedText>
              <ThemedText type="subtitle" style={styles.title}>
                {failed ? 'Sign-in needs attention' : 'Finishing sign-in'}
              </ThemedText>
              <ThemedText themeColor="textSecondary">{status}</ThemedText>
            </View>
            <PennyBadge expression={failed ? 'concerned' : 'onTrack'} />
          </View>

          {failed && (
            <View style={styles.actions}>
              <PillButton tone="primary" onPress={() => router.replace('/auth')}>
                Back to sign in
              </PillButton>
            </View>
          )}
        </Card>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.three : Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  card: {
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  copy: {
    flex: 1,
    gap: Spacing.one,
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
