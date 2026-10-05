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
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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
          <TabTrigger name="plaidOauth" href="/plaid/oauth" asChild>
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
  // Five tabs share one row. Size every label so the longest one ("Transactions", 12
  // letters) fits its tab on one line; Nunito ExtraBold runs about 0.54em per letter.
  const screenWidth = Math.min(useWindowDimensions().width, MaxContentWidth);
  const tabWidth = (screenWidth - Spacing.two * 2 - Spacing.one * 4) / 5 - 2;
  const labelSize = Math.min(11, Math.floor((tabWidth / (12 * 0.54)) * 2) / 2);
  const iconName = (isFocused ? icon : `${icon}-outline`) as IoniconName;

  return (
    <Pressable
      {...props}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.tabButton,
        isFocused && {
          backgroundColor: theme.backgroundSelected,
          borderColor: theme.borderStrong,
          borderBottomColor: theme.plateEdge,
        },
        pressed && styles.pressed,
      ]}>
      <View
        style={[
          styles.iconTile,
          isFocused
            ? { backgroundColor: theme.primary, borderColor: theme.brass }
            : { backgroundColor: 'transparent', borderColor: 'transparent' },
        ]}>
        <Ionicons name={iconName} size={18} color={isFocused ? '#FFFFFF' : theme.textSecondary} />
      </View>
      <ThemedText
        type="smallBold"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={{ color: isFocused ? theme.primary : theme.textSecondary, fontSize: labelSize, fontWeight: 800 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Docked paper tab bar with a leather edge on top (the web app's mobile tab bar). */
function TabBar(props: TabListProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      {...props}
      style={[
        styles.tabBarContainer,
        {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.leather,
          paddingBottom: Math.max(insets.bottom, Spacing.two),
        },
      ]}>
      <View style={styles.tabBarInner}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    borderTopWidth: 3,
    paddingTop: Spacing.one + 2,
    shadowColor: '#3C230F',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  tabBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.two,
    gap: Spacing.one,
  },
  tabButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 54,
    borderWidth: 1,
    borderBottomWidth: 3,
    borderColor: 'transparent',
    borderRadius: Radius.control,
    paddingVertical: Spacing.one,
  },
  iconTile: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
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
