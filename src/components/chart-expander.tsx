import { Ionicons } from '@expo/vector-icons';
import { PropsWithChildren, ReactNode, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Makes any inline chart expandable: tap it (or the corner glyph) and it opens
 * full-screen with room for per-point numbers. The inline chart stays compact —
 * the full data lives one tap away instead of crowding the card.
 */
export function ExpandableChart({
  title,
  subtitle,
  children,
  renderExpanded,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  /** Full-screen content: usually the same chart, taller, plus a value table. */
  renderExpanded: () => ReactNode;
}>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Expand ${title} chart`}>
        <View pointerEvents="none">{children}</View>
        <View
          style={[
            styles.expandBadge,
            { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
          ]}>
          <Ionicons name="expand" size={13} color={theme.secondary} />
          <ThemedText type="small" style={{ color: theme.secondary, fontSize: 10.5 }}>
            Tap to expand
          </ThemedText>
        </View>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}>
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.sheetSafe}>
            <View style={styles.sheetHead}>
              <View style={styles.sheetHeadCopy}>
                <ThemedText type="section">{title}</ThemedText>
                {subtitle ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {subtitle}
                  </ThemedText>
                ) : null}
              </View>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close expanded chart"
                style={[
                  styles.closeButton,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                ]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetBody}>
              {open ? renderExpanded() : null}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

/** Simple label/values table for expanded charts — every number, one row per point. */
export function ChartValueTable({
  columns,
  rows,
  highlightLast,
}: {
  columns: string[];
  rows: string[][];
  highlightLast?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.table, { borderColor: theme.border }]}>
      <View style={[styles.tableRow, { backgroundColor: theme.backgroundSelected }]}>
        {columns.map((column, index) => (
          <ThemedText
            key={column}
            type="smallBold"
            numberOfLines={1}
            style={[styles.tableCell, index > 0 && styles.tableCellNum, { color: theme.secondary }]}>
            {column}
          </ThemedText>
        ))}
      </View>
      {rows.map((row, rowIndex) => {
        const isLast = rowIndex === rows.length - 1;
        return (
          <View
            key={rowIndex}
            style={[
              styles.tableRow,
              { borderTopWidth: 1, borderTopColor: theme.border },
              highlightLast && isLast && { backgroundColor: theme.backgroundSelected },
            ]}>
            {row.map((cell, cellIndex) => (
              <ThemedText
                key={cellIndex}
                type={cellIndex === 0 ? 'small' : 'smallBold'}
                numberOfLines={1}
                style={[
                  styles.tableCell,
                  cellIndex > 0 && styles.tableCellNum,
                  cellIndex > 0 && { fontVariant: ['tabular-nums'] },
                ]}>
                {cell}
              </ThemedText>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  expandBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sheet: {
    flex: 1,
  },
  sheetSafe: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sheetHeadCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  table: {
    borderWidth: 1,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  tableCell: {
    flex: 1,
    minWidth: 0,
  },
  tableCellNum: {
    textAlign: 'right',
  },
});
