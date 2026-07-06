import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, PennyBadge } from '@/components/penny-ui';
import { PopOnChange } from '@/components/penny-motion';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { PennyInsight } from '@/domain/penny-insights';
import { useTheme } from '@/hooks/use-theme';

/**
 * Penny's briefing: the top computed insights, one at a time, with paging dots.
 * Every line in here came from arithmetic on the user's own data
 * (src/domain/penny-insights.ts) — if there's nothing true and specific to say,
 * the card doesn't render at all, which is what keeps it trustworthy.
 */
export function PennyBriefing({ insights }: { insights: PennyInsight[] }) {
  const theme = useTheme();
  const [index, setIndex] = useState(0);

  if (insights.length === 0) return null;
  const current = insights[Math.min(index, insights.length - 1)];
  const advance = () => setIndex((value) => (value + 1) % insights.length);

  return (
    <Pressable
      onPress={insights.length > 1 ? advance : undefined}
      accessibilityRole={insights.length > 1 ? 'button' : undefined}
      accessibilityLabel={
        insights.length > 1 ? 'Penny’s briefing — tap for the next insight' : 'Penny’s briefing'
      }>
      <Card style={styles.card}>
        <View style={styles.head}>
          <PennyBadge expression={current.expression} size={46} />
          <View style={styles.headCopy}>
            <ThemedText type="smallBold" style={{ color: theme.secondary }}>
              PENNY&apos;S BRIEFING
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Computed from your own numbers, just now
            </ThemedText>
          </View>
          {insights.length > 1 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {index + 1}/{insights.length}
            </ThemedText>
          ) : null}
        </View>
        <PopOnChange trigger={current.id}>
          <View style={styles.body}>
            <ThemedText type="smallBold" style={styles.headline}>
              {current.headline}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {current.detail}
            </ThemedText>
          </View>
        </PopOnChange>
        {insights.length > 1 ? (
          <View style={styles.dots}>
            {insights.map((insight, dotIndex) => (
              <View
                key={insight.id}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      dotIndex === index ? theme.primary : theme.backgroundSelected,
                    width: dotIndex === index ? 18 : 6,
                  },
                ]}
              />
            ))}
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  body: {
    gap: Spacing.one,
  },
  headline: {
    fontSize: 15,
    lineHeight: 21,
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
