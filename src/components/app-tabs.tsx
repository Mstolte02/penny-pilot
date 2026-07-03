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
            <TabButton icon="⌂" label="Overview" />
          </TabTrigger>
          <TabTrigger name="transactions" href="/transactions" asChild>
            <TabButton icon="▤" label="Transactions" />
          </TabTrigger>
          <TabTrigger name="afford" href="/afford" asChild>
            <AffordButton />
          </TabTrigger>
          <TabTrigger name="budget" href="/budget" asChild>
            <TabButton icon="▦" label="Plan" />
          </TabTrigger>
          <TabTrigger name="logbook" href="/logbook" asChild>
            <TabButton icon="⌁" label="Logbook" />
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

function TabButton({
  icon,
  label,
  isFocused,
  ...props
}: TabTriggerSlotProps & { icon: string; label: string }) {
  const theme = useTheme();

  return (
    <Pressable
      {...props}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.tabButton,
        isFocused && [
          styles.tabButtonActive,
          {
            backgroundColor: theme.backgroundSelected,
            borderColor: theme.primary,
            shadowColor: theme.primary,
          },
        ],
        pressed && styles.pressed,
      ]}>
      <View
        style={[
          styles.iconTile,
          {
            backgroundColor: isFocused ? theme.primary : theme.background,
            borderColor: isFocused ? theme.primaryHover : theme.border,
          },
        ]}
      >
        <ThemedText style={[styles.tabIcon, { color: isFocused ? theme.onPrimary : theme.secondary }]}>
          {icon}
        </ThemedText>
      </View>
      {isFocused ? (
        <ThemedText
          type="smallBold"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          style={{ color: theme.primary, fontSize: 11.5 }}>
          {label}
        </ThemedText>
      ) : null}
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
            borderColor: isFocused ? theme.primaryHover : theme.backgroundElement,
            shadowColor: theme.primary,
          },
        ]}>
        <ThemedText style={[styles.affordGlyph, { color: theme.onPrimary }]}>$?</ThemedText>
      </View>
      <ThemedText
        type="smallBold"
        numberOfLines={1}
        style={{ color: isFocused ? theme.primary : theme.textSecondary, fontSize: 10.5 }}>
        Afford?
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
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
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
    minHeight: 68,
    borderWidth: 1,
    borderRadius: Radius.card + 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    shadowColor: '#3A2E20',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  tabButton: {
    flex: 0.82,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 52,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: Radius.control,
    paddingVertical: Spacing.one,
    shadowOpacity: 0,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  tabButtonActive: {
    flex: 1.35,
    shadowOpacity: 0.16,
  },
  iconTile: {
    width: 34,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 18,
    lineHeight: 21,
    fontWeight: '900',
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
