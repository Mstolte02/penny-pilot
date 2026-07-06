import { Ionicons } from '@expo/vector-icons';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Bottom tab bar: five equal destinations. Icons pair an outline (resting) with a
 * filled variant (active) so the current tab reads at a glance. Settings live
 * behind the gear in each screen's header, not in the bar.
 */
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <TabBar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon="home" label="Overview" />
          </TabTrigger>
          <TabTrigger name="transactions" href="/transactions" asChild>
            <TabButton icon="receipt" label="Transactions" />
          </TabTrigger>
          <TabTrigger name="afford" href="/afford" asChild>
            <TabButton icon="calculator" label="Afford" />
          </TabTrigger>
          <TabTrigger name="budget" href="/budget" asChild>
            <TabButton icon="wallet" label="Plan" />
          </TabTrigger>
          <TabTrigger name="logbook" href="/logbook" asChild>
            <TabButton icon="book" label="Logbook" />
          </TabTrigger>

          {/* Reachable routes without a tab of their own. */}
          <TabTrigger name="hangar" href="/hangar" asChild>
            <View style={styles.hiddenTab} />
          </TabTrigger>
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
  const iconName = (isFocused ? icon : `${icon}-outline`) as IoniconName;

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
        ]}>
        <Ionicons name={iconName} size={18} color={isFocused ? theme.onPrimary : theme.secondary} />
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
  pressed: {
    opacity: 0.75,
  },
  hiddenTab: {
    display: 'none',
  },
});
