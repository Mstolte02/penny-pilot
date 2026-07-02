import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Bottom tab bar: 4 destinations + the center "Can I afford this?" action button.
 * Everything stays one thumb-tap away; the forecast check gets the most valuable
 * real estate in the app. Settings/account intentionally have no tab — they live
 * behind Penny's avatar in each screen's top corner.
 */
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <TabBar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>Cockpit</TabButton>
          </TabTrigger>
          <TabTrigger name="transactions" href="/transactions" asChild>
            <TabButton>Radar</TabButton>
          </TabTrigger>
          <TabTrigger name="afford" href="/afford" asChild>
            <AffordButton />
          </TabTrigger>
          <TabTrigger name="budget" href="/budget" asChild>
            <TabButton>Flight Plan</TabButton>
          </TabTrigger>
          <TabTrigger name="logbook" href="/logbook" asChild>
            <TabButton>Logbook</TabButton>
          </TabTrigger>

          {/* Reachable routes without a tab of their own. */}
          <TabTrigger name="setup" href="/setup" asChild>
            <View style={styles.hiddenTab} />
          </TabTrigger>
          <TabTrigger name="auth" href="/auth" asChild>
            <View style={styles.hiddenTab} />
          </TabTrigger>
          <TabTrigger name="authCallback" href="/auth/callback" asChild>
            <View style={styles.hiddenTab} />
          </TabTrigger>
        </TabBar>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();

  return (
    <Pressable
      {...props}
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <View
        style={[
          styles.tabDot,
          { backgroundColor: isFocused ? theme.primary : 'transparent' },
        ]}
      />
      <ThemedText
        type="smallBold"
        numberOfLines={1}
        style={{ color: isFocused ? theme.primary : theme.textSecondary, fontSize: 12.5 }}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

/** The center action: a gold circle that opens the affordability forecast. */
function AffordButton({ isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();

  return (
    <Pressable
      {...props}
      accessibilityLabel="Can I afford this?"
      style={({ pressed }) => [styles.affordSlot, pressed && styles.pressed]}>
      <View
        style={[
          styles.affordCircle,
          {
            backgroundColor: theme.primary,
            borderColor: isFocused ? theme.text : theme.ink,
            shadowColor: theme.primary,
          },
        ]}>
        <ThemedText style={[styles.affordGlyph, { color: theme.onPrimary }]}>$?</ThemedText>
      </View>
      <ThemedText
        type="smallBold"
        numberOfLines={1}
        style={{ color: isFocused ? theme.primary : theme.textSecondary, fontSize: 10.5 }}>
        Afford this?
      </ThemedText>
    </Pressable>
  );
}

function TabBar(props: TabListProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View {...props} style={[styles.tabBarContainer, { bottom: insets.bottom + Spacing.two }]}>
      <View
        style={[
          styles.tabBarInner,
          { backgroundColor: theme.ink, borderColor: theme.borderStrong },
        ]}>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
  },
  tabBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: MaxContentWidth,
    minHeight: 66,
    borderWidth: 1,
    borderRadius: Radius.card + 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  tabButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: Spacing.one,
  },
  tabDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  affordSlot: {
    alignItems: 'center',
    gap: 2,
    marginTop: -Spacing.four,
  },
  affordCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  affordGlyph: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: 800,
  },
  pressed: {
    opacity: 0.75,
  },
  hiddenTab: {
    display: 'none',
  },
});
