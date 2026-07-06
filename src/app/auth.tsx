import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PennyBadge, PillButton, SpeechBubble, ToggleChip } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  BUDGET_STYLE_KEY,
  NOTIFICATION_PREFS_KEY,
  notificationTemplates,
  SETUP_COMPLETE_KEY,
} from '@/constants/penny-voice';
import type { UserProfile } from '@/domain/finance';
import { useThemePreference, type ThemePreference } from '@/hooks/theme-preference';
import { authService } from '@/services';
import { useFinance } from '@/services/finance-store';

const APPEARANCE_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

type NotificationKey =
  | 'morningBriefing'
  | 'billHeadsUp'
  | 'turbulence'
  | 'weeklyReport'
  | 'goalMilestones';

const NOTIFICATION_OPTIONS: { key: NotificationKey; label: string; description: string }[] = [
  {
    key: 'morningBriefing',
    label: 'Morning briefing',
    description: '8am, one line — your safe-to-spend for the day.',
  },
  {
    key: 'billHeadsUp',
    label: 'Bill heads-up',
    description: 'A nudge the day before each bill hits.',
  },
  {
    key: 'turbulence',
    label: 'Pace alerts',
    description: 'When a category runs ahead of plan mid-month.',
  },
  {
    key: 'weeklyReport',
    label: 'Weekly recap',
    description: 'Sunday summary of the week, linked to the Logbook.',
  },
  {
    key: 'goalMilestones',
    label: 'Goal milestones',
    description: 'A small celebration when a goal crosses a marker.',
  },
];

const NOTIFICATION_DEFAULTS: Record<NotificationKey, boolean> = {
  morningBriefing: true,
  billHeadsUp: true,
  turbulence: false,
  weeklyReport: true,
  goalMilestones: true,
};

export default function AccountScreen() {
  const router = useRouter();
  const { preference, setPreference } = useThemePreference();
  const { resetToSeeds } = useFinance();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<string>('Checking session...');
  const [busy, setBusy] = useState(false);
  const [notificationPrefs, setNotificationPrefs] =
    useState<Record<NotificationKey, boolean>>(NOTIFICATION_DEFAULTS);
  const [resetPhrase, setResetPhrase] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(NOTIFICATION_PREFS_KEY)
      .then((value) => {
        if (!value) return;
        try {
          setNotificationPrefs({ ...NOTIFICATION_DEFAULTS, ...JSON.parse(value) });
        } catch {}
      })
      .catch(() => {});
  }, []);

  const toggleNotification = (key: NotificationKey) => {
    setNotificationPrefs((current) => {
      const next = { ...current, [key]: !current[key] };
      AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const [confirmingReset, setConfirmingReset] = useState(false);
  const resetPhraseMatches = resetPhrase === 'Delete Data';

  const startFresh = async () => {
    await resetToSeeds();
    await AsyncStorage.multiRemove([SETUP_COMPLETE_KEY, BUDGET_STYLE_KEY]).catch(() => {});
    router.replace('/setup');
  };

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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled">
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <ThemedText type="smallBold" themeColor="primary">
                Penny&apos;s corner
              </ThemedText>
              <ThemedText type="subtitle" style={styles.title}>
                Settings & account
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                Everything that isn&apos;t flying: account, notifications, and re-running setup.
              </ThemedText>
            </View>
            <PennyBadge expression="happy" />
          </View>

          <SpeechBubble expression="default">
            You found the gear. What do you need, captain?
          </SpeechBubble>

          <Card>
            <ThemedText type="smallBold">Appearance</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Follow your device, or pin light or dark.
            </ThemedText>
            <View style={styles.actions}>
              {APPEARANCE_OPTIONS.map((option) => (
                <ToggleChip
                  key={option.value}
                  label={option.label}
                  selected={preference === option.value}
                  onPress={() => setPreference(option.value)}
                />
              ))}
            </View>
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

          <Card>
            <ThemedText type="smallBold">Notifications</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Factual and kind, never a shame notification. Pick what Penny is allowed to send:
            </ThemedText>
            {NOTIFICATION_OPTIONS.map((option) => (
              <View key={option.key} style={styles.notifRow}>
                <View style={styles.notifCopy}>
                  <ThemedText type="smallBold">{option.label}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {option.description}
                  </ThemedText>
                </View>
                <ToggleChip
                  label={notificationPrefs[option.key] ? 'On' : 'Off'}
                  selected={notificationPrefs[option.key]}
                  onPress={() => toggleNotification(option.key)}
                />
              </View>
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              Example briefing: “{notificationTemplates.morningBriefing('$34')}” — choices are
              saved now; delivery arrives with push support.
            </ThemedText>
          </Card>

          <Card>
            <ThemedText type="smallBold">The Hangar</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Flight school for your finances — pilot rank, wings, and streaks earned from
              real habits, not taps.
            </ThemedText>
            <View style={styles.actions}>
              <PillButton tone="primary" onPress={() => router.push('/hangar')}>
                Enter the Hangar
              </PillButton>
            </View>
          </Card>

          <Card>
            <ThemedText type="smallBold">Run setup again</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Adding an account or starting fresh? Wizard Penny briefly returns. (“You rang?”)
            </ThemedText>
            <View style={styles.actions}>
              <PillButton onPress={() => router.push('/setup')}>Summon the wizard</PillButton>
            </View>
          </Card>

          <Card>
            <ThemedText type="smallBold">Start fresh</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Erases everything stored on this device — transactions, budget, goals, imports — and
              reruns setup from the top. There is no undo.
            </ThemedText>
            <View style={styles.actions}>
              {confirmingReset ? (
                <>
                  <ThemedText type="smallBold">Type Delete Data to confirm.</ThemedText>
                  <TextInput
                    value={resetPhrase}
                    onChangeText={setResetPhrase}
                    autoCapitalize="words"
                    autoCorrect={false}
                    placeholder="Delete Data"
                    placeholderTextColor="#8D8274"
                    style={styles.confirmInput}
                  />
                  <PillButton
                    tone="primary"
                    disabled={!resetPhraseMatches}
                    onPress={() => void startFresh()}>
                    Delete Data
                  </PillButton>
                  <PillButton
                    onPress={() => {
                      setConfirmingReset(false);
                      setResetPhrase('');
                    }}>
                    Keep my data
                  </PillButton>
                </>
              ) : (
                <PillButton onPress={() => setConfirmingReset(true)}>Erase and start fresh</PillButton>
              )}
            </View>
          </Card>
        </SafeAreaView>
        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
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
  confirmInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#D6CABC',
    backgroundColor: '#FFFDF8',
    color: '#2C251E',
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
    minHeight: 46,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  notifCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
});
