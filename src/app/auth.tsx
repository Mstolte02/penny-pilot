import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Medal } from '@/components/flight-deck';
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
import { useConsent } from '@/hooks/use-consent';
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
    description: '8am: one line with your safe-to-spend for the day.',
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
    description: 'A little cheer when a goal passes a milestone.',
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
  const { syncToServer: syncConsentToServer } = useConsent();
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

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const deletePhraseMatches = deletePhrase === 'Delete Account';

  // Which wipe just finished. Drives the confirmation sheet so nobody taps again
  // wondering whether it worked.
  const [erased, setErased] = useState<'data' | 'account' | null>(null);
  const [erasing, setErasing] = useState(false);

  const startFresh = async () => {
    if (erasing) return;
    setErasing(true);
    try {
      await resetToSeeds();
      await AsyncStorage.multiRemove([SETUP_COMPLETE_KEY, BUDGET_STYLE_KEY]).catch(() => {});
      setConfirmingReset(false);
      setResetPhrase('');
      setErased('data');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Couldn't erase your data. Try again.");
    } finally {
      setErasing(false);
    }
  };

  const finishErase = () => {
    setErased(null);
    // push, not replace: inside the tab navigator replace('/setup') is a silent no-op.
    router.push('/setup');
  };

  const deleteAccount = async () => {
    setBusy(true);
    setStatus('Deleting your account and all synced data…');
    try {
      await authService.deleteAccount();
      // Server data is gone; clear local state and the session UI too.
      await resetToSeeds();
      await AsyncStorage.multiRemove([SETUP_COMPLETE_KEY, BUDGET_STYLE_KEY]).catch(() => {});
      setUser(null);
      setConfirmingDelete(false);
      setDeletePhrase('');
      setStatus('Your account and synced data have been deleted.');
      setErased('account');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Couldn't delete your account.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    authService
      .getCurrentUser()
      .then((currentUser) => {
        if (!mounted) return;
        setUser(currentUser);
        setStatus(currentUser ? 'Signed in and ready.' : 'Not signed in yet.');
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setStatus(error instanceof Error ? error.message : "Couldn't check whether you're signed in.");
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
      // Land any consent captured before authentication into the server audit trail.
      await syncConsentToServer();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sign-in didn't go through.");
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
      setStatus(error instanceof Error ? error.message : "Sign-out didn't go through.");
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
                The ground crew stuff: account, notifications, and setup.
              </ThemedText>
            </View>
            <PennyBadge expression="happy" />
          </View>

          <SpeechBubble expression="default">
            What do you need, captain?
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
            <ThemedText type="smallBold">{user ? 'Signed in' : 'Not signed in'}</ThemedText>
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
              Penny sticks to the facts and never shames you. Pick what Penny can send:
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
              Your choices are saved. Alerts start when push support arrives. Example
              briefing: “{notificationTemplates.morningBriefing('$34')}”
            </ThemedText>
          </Card>

          <Card>
            <ThemedText type="smallBold">The Hangar</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Flight school for your money. Rank, wings, and streaks come from real habits,
              not taps.
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
              Adding an account or starting over? Wizard Penny comes back for a bit. (“You rang?”)
            </ThemedText>
            <View style={styles.actions}>
              <PillButton onPress={() => router.push('/setup')}>Summon the wizard</PillButton>
            </View>
          </Card>

          <Card>
            <ThemedText type="smallBold">Start fresh</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Erases everything stored on this device (transactions, budget, goals, imports) and
              runs setup again from the start. There is no undo.
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
                    disabled={!resetPhraseMatches || erasing}
                    onPress={() => void startFresh()}>
                    {erasing ? 'Erasing…' : 'Delete Data'}
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

          {user && (
            <Card>
              <ThemedText type="smallBold">Delete account</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Permanently deletes your account and everything synced to our backend
                (transactions, accounts, budgets, goals) and revokes any connected bank at
                Plaid. This cannot be undone.
              </ThemedText>
              <View style={styles.actions}>
                {confirmingDelete ? (
                  <>
                    <ThemedText type="smallBold">Type Delete Account to confirm.</ThemedText>
                    <TextInput
                      value={deletePhrase}
                      onChangeText={setDeletePhrase}
                      autoCapitalize="words"
                      autoCorrect={false}
                      placeholder="Delete Account"
                      placeholderTextColor="#8D8274"
                      style={styles.confirmInput}
                    />
                    <PillButton
                      tone="primary"
                      disabled={!deletePhraseMatches || busy}
                      onPress={() => void deleteAccount()}>
                      {busy ? 'Deleting…' : 'Delete Account'}
                    </PillButton>
                    <PillButton
                      onPress={() => {
                        setConfirmingDelete(false);
                        setDeletePhrase('');
                      }}>
                      Keep my account
                    </PillButton>
                  </>
                ) : (
                  <PillButton onPress={() => setConfirmingDelete(true)}>
                    Delete my account
                  </PillButton>
                )}
              </View>
            </Card>
          )}
        </SafeAreaView>
        </ScrollView>
      </ThemedView>

      <Modal visible={erased !== null} transparent animationType="fade" onRequestClose={finishErase}>
        <View style={styles.doneOverlay}>
          <Card style={styles.doneCard}>
            <View style={styles.doneMedal}>
              <Medal icon="checkmark" tone="green" size={52} />
            </View>
            <ThemedText type="section" style={styles.doneTitle}>
              {erased === 'account' ? 'Account deleted' : 'All erased'}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.doneBody}>
              {erased === 'account'
                ? 'Your account and everything synced to it are gone, and your bank connection is revoked.'
                : 'Everything on this device is gone: transactions, budget, goals, and imports.'}
            </ThemedText>
            <PillButton tone="primary" onPress={finishErase}>
              Start setup
            </PillButton>
          </Card>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  doneOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(27, 39, 66, 0.55)',
  },
  doneCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'stretch',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  doneMedal: {
    alignItems: 'center',
  },
  doneTitle: {
    textAlign: 'center',
    fontSize: 26,
    lineHeight: 30,
  },
  doneBody: {
    textAlign: 'center',
  },
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
    borderRadius: 4,
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
