import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="today" href="/" asChild>
            <TabButton>Today</TabButton>
          </TabTrigger>
          <TabTrigger name="budget" href="/budget" asChild>
            <TabButton>Budget</TabButton>
          </TabTrigger>
          <TabTrigger name="transactions" href="/transactions" asChild>
            <TabButton>Review</TabButton>
          </TabTrigger>
          <TabTrigger name="goals" href="/goals" asChild>
            <TabButton>Goals</TabButton>
          </TabTrigger>
          <TabTrigger name="setup" href="/setup" asChild>
            <TabButton>Setup</TabButton>
          </TabTrigger>
          <TabTrigger name="auth" href="/auth" asChild>
            <TabButton>Sign in</TabButton>
          </TabTrigger>
          <TabTrigger name="authCallback" href="/auth/callback" asChild>
            <View style={styles.hiddenTab} />
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const { width } = useWindowDimensions();
  const compact = width < 620;

  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView
        type="backgroundElement"
        style={[
          styles.innerContainer,
          compact && styles.innerContainerCompact,
        ]}>
        {!compact && (
          <ThemedText type="smallBold" style={styles.brandText}>
            Penny Pilot
          </ThemedText>
        )}

        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  innerContainerCompact: {
    paddingHorizontal: Spacing.two,
    justifyContent: 'center',
    gap: Spacing.one,
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  hiddenTab: {
    display: 'none',
  },
});
