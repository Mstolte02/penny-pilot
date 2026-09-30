import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { Card, PennyBadge, PillButton, SpeechBubble } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { consentCopy, PRIVACY_POLICY_URL } from '@/constants/consent';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useConsent } from '@/hooks/use-consent';
import { useTheme } from '@/hooks/use-theme';

/**
 * First-run consent gate. Blocks the app until the user affirmatively agrees to the
 * Privacy Policy for the current consent version. Agreement is recorded locally (so
 * it survives with no account) and mirrored to the server audit trail when signed in.
 * Once granted, this renders its children unchanged.
 */
export function ConsentGate({ children }: { children: React.ReactNode }) {
  const { status, grant } = useConsent();
  const theme = useTheme();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (status === 'loading') {
    // Brief; avoids a flash of the gate for users who have already consented.
    return <ThemedView style={styles.container} />;
  }

  if (status === 'granted') {
    return <>{children}</>;
  }

  const onAgree = async () => {
    setBusy(true);
    try {
      await grant(['privacy_terms'], 'in_app_gate');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <PennyBadge expression="happy" />
            <ThemedText type="subtitle" style={styles.title}>
              {consentCopy.title}
            </ThemedText>
          </View>

          <SpeechBubble expression="default">{consentCopy.intro}</SpeechBubble>

          <Card>
            {consentCopy.points.map((point) => (
              <View key={point} style={styles.point}>
                <ThemedText type="smallBold" themeColor="primary">
                  •
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.pointText}>
                  {point}
                </ThemedText>
              </View>
            ))}
            <ExternalLink href={PRIVACY_POLICY_URL}>
              <ThemedText type="small" themeColor="primary">
                {consentCopy.linkLabel} ↗
              </ThemedText>
            </ExternalLink>
          </Card>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            onPress={() => setAgreed((value) => !value)}
            style={styles.agreeRow}>
            <View
              style={[
                styles.checkbox,
                { borderColor: theme.borderStrong },
                agreed && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}>
              {agreed && (
                <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                  ✓
                </ThemedText>
              )}
            </View>
            <ThemedText type="small" style={styles.agreeLabel}>
              {consentCopy.agreeLabel}
            </ThemedText>
          </Pressable>

          <PillButton tone="primary" disabled={!agreed || busy} onPress={() => void onAgree()}>
            {busy ? 'Saving…' : consentCopy.cta}
          </PillButton>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Platform.OS === 'web' ? Spacing.six : Spacing.five,
    gap: Spacing.three,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    textAlign: 'center',
  },
  point: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pointText: {
    flex: 1,
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: Radius.control,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agreeLabel: {
    flex: 1,
  },
});
