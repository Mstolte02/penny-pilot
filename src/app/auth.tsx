import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PennyBadge, PillButton } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { env } from '@/config/env';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import type { UserProfile } from '@/domain/finance';
import { authService } from '@/services';

export default function AuthScreen() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<string>('Checking session...');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    authService
      .getCurrentUser()
      .then((currentUser) => {
        if (!mounted) return;
        setUser(currentUser);
        setStatus(currentUser ? 'Signed in and ready.' : 'No active session yet.');
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setStatus(error instanceof Error ? error.message : 'Could not check auth session.');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async (provider: 'apple' | 'google') => {
    setBusy(true);
    setStatus(`Starting ${provider} sign-in...`);

    try {
      const signedInUser =
        provider === 'apple'
          ? await authService.signInWithApple()
          : await authService.signInWithGoogle();
      setUser(signedInUser);
      setStatus('Signed in and ready.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Sign-in could not complete yet.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    try {
      await authService.signOut();
      setUser(null);
      setStatus('Signed out.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Sign-out could not complete.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <ThemedText type="smallBold" themeColor="primary">
                Account
              </ThemedText>
              <ThemedText type="subtitle" style={styles.title}>
                Sign in to sync
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                Penny Pilot uses Supabase Auth for Apple and Google sign-in.
              </ThemedText>
            </View>
            <PennyBadge expression="happy" />
          </View>

          <Card>
            <ThemedText type="smallBold">Current mode</ThemedText>
            <ThemedText themeColor="textSecondary">
              {env.dataSource === 'supabase'
                ? 'Supabase mode is enabled. Social providers must be configured in Supabase.'
                : 'Mock mode is enabled. Buttons use the demo user until Supabase mode is turned on.'}
            </ThemedText>
          </Card>

          <Card>
            <ThemedText type="smallBold">{user ? 'Signed in' : 'No active session'}</ThemedText>
            <ThemedText themeColor="textSecondary">{status}</ThemedText>
            {user && (
              <ThemedText type="small" themeColor="textSecondary">
                {user.displayName ?? user.email ?? user.id}
              </ThemedText>
            )}
            <View style={styles.actions}>
              <PillButton tone="primary" onPress={() => void signIn('google')}>
                {busy ? 'Working...' : 'Continue with Google'}
              </PillButton>
              <PillButton onPress={() => void signIn('apple')}>Continue with Apple</PillButton>
              {user && <PillButton onPress={() => void signOut()}>Sign out</PillButton>}
            </View>
          </Card>
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    width: '100%',
  },
  safeArea: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.three : Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headerCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
