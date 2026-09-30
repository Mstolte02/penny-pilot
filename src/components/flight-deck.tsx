import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import type { ComponentProps, ReactNode } from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useThemePreference } from '@/hooks/theme-preference';
import { useTheme } from '@/hooks/use-theme';

// Shared Penny Pilot illustration pieces, ported from the web app's penny.tsx: the
// landscape banner, the compass, brass medallions, panel headers, the stitched strap,
// luggage tags and ticket stubs.
//
// Everything here is plain Views and PNGs (assets/flight-deck, rendered from the web
// app's SVG). No native SVG module, so it runs in Expo Go, any existing dev build and
// the web alike without a native rebuild.

const art = {
  scene: require('@/assets/flight-deck/scene.png'),
  compass: require('@/assets/flight-deck/compass.png'),
  washLight: require('@/assets/flight-deck/wash-light.png'),
  washDark: require('@/assets/flight-deck/wash-dark.png'),
  shine: require('@/assets/flight-deck/medal-shine.png'),
  stitch: require('@/assets/flight-deck/stitch.png'),
  dash: require('@/assets/flight-deck/dash.png'),
};

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type MedalTone = 'copper' | 'sky' | 'green' | 'navy' | 'brass' | 'red';

const MEDAL_TONES: Record<MedalTone, string> = {
  copper: '#B8652F',
  sky: '#4FA3C7',
  green: '#2F7A55',
  navy: '#2A3A5E',
  brass: '#C99A3E',
  red: '#B8433A',
};

/** Layered sky → mountains → hills → runway, with a plane on a dotted flight path. */
export function Scene({ style }: { style?: StyleProp<ImageStyle> }) {
  return (
    <ExpoImage
      source={art.scene}
      contentFit="cover"
      contentPosition="bottom"
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
      accessible={false}
    />
  );
}

/** Paper wash over the left of a scene so copy stays readable on top of it. */
export function SceneWash() {
  const { scheme } = useThemePreference();

  return (
    <ExpoImage
      source={scheme === 'dark' ? art.washDark : art.washLight}
      contentFit="fill"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
    />
  );
}

/** The stitched leather strap down the left edge of every document. */
export function Strap({ width = 7 }: { width?: number }) {
  const theme = useTheme();

  return (
    <View
      pointerEvents="none"
      style={[
        styles.strap,
        { width, backgroundColor: theme.leather, borderRightColor: theme.leatherDark },
      ]}>
      <Image
        source={art.stitch}
        resizeMode="repeat"
        style={[styles.stitch, { left: Math.round(width / 2) - 1 }]}
      />
    </View>
  );
}

/** A dashed rule, like the perforation under each document header. */
export function DashedRule({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.rule, style]}>
      <Image source={art.dash} resizeMode="repeat" style={styles.ruleImage} />
    </View>
  );
}

/** Brass-ringed icon medallion used on every panel header. */
export function Medal({
  icon,
  tone = 'copper',
  color,
  size = 44,
}: {
  icon: IoniconName;
  tone?: MedalTone;
  /** Any category colour; overrides `tone`. */
  color?: string;
  size?: number;
}) {
  const theme = useTheme();
  const outer = size + 10;

  return (
    <View
      style={[
        styles.medalRing,
        { width: outer, height: outer, borderRadius: outer / 2, backgroundColor: theme.brass },
      ]}>
      <View
        style={[
          styles.medalRing,
          {
            width: outer - 4,
            height: outer - 4,
            borderRadius: (outer - 4) / 2,
            backgroundColor: theme.backgroundElement,
          },
        ]}>
        <View
          style={[
            styles.medalFace,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color ?? MEDAL_TONES[tone],
            },
          ]}>
          <Image source={art.shine} style={StyleSheet.absoluteFill} resizeMode="stretch" />
          <Ionicons name={icon} size={Math.round(size * 0.48)} color="#FFFFFF" />
        </View>
      </View>
    </View>
  );
}

/** Document header: medallion, serif title, small-caps tagline, dashed rule under. */
export function PanelHead({
  icon,
  tone,
  title,
  tagline,
  action,
}: {
  icon: IoniconName;
  tone?: MedalTone;
  title: string;
  tagline?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.panelHead}>
      <View style={styles.panelHeadRow}>
        <Medal icon={icon} tone={tone} />
        <View style={styles.panelHeadCopy}>
          <ThemedText type="section" style={styles.panelTitle}>
            {title}
          </ThemedText>
          {tagline ? (
            <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.panelTagline}>
              {tagline}
            </ThemedText>
          ) : null}
        </View>
        {action}
      </View>
      <DashedRule />
    </View>
  );
}

/** Round compass with a runway inset; the headline number sits in the middle. */
export function Compass({
  kicker,
  value,
  note,
  noteColor,
  size = 280,
  valueColor,
}: {
  kicker: string;
  value: ReactNode;
  note?: string;
  noteColor?: string;
  size?: number;
  valueColor?: string;
}) {
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <ExpoImage
        source={art.compass}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        accessible={false}
      />
      <View style={[styles.compassCopy, { top: size * 0.3, left: size * 0.2, right: size * 0.2 }]}>
        <ThemedText type="eyebrow" style={{ color: '#1B2742', fontSize: 10.5 }} numberOfLines={1}>
          {kicker}
        </ThemedText>
        {typeof value === 'string' ? (
          <ThemedText
            type="hero"
            numberOfLines={1}
            style={{ color: valueColor ?? '#1B2742', fontSize: size * 0.15, lineHeight: size * 0.18 }}>
            {value}
          </ThemedText>
        ) : (
          value
        )}
        {note ? (
          <ThemedText
            type="smallBold"
            numberOfLines={2}
            style={{ color: noteColor ?? '#2F7A55', fontSize: 12.5, lineHeight: 16, textAlign: 'center' }}>
            {note}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

type StubTone = 'gold' | 'navy' | 'green' | 'red' | 'sky';

/** Ticket-stub label: a small tinted slip with a notch punched out of each end. */
export function Stub({ label, tone = 'gold' }: { label: string; tone?: StubTone }) {
  const theme = useTheme();
  const palette: Record<StubTone, { bg: string; fg: string }> = {
    gold: { bg: theme.goldTint, fg: '#7A5C12' },
    navy: { bg: theme.cloud, fg: theme.navy },
    green: { bg: theme.greenTint, fg: theme.success },
    red: { bg: theme.redTint, fg: theme.danger },
    sky: { bg: theme.skyTint, fg: theme.info },
  };
  const { bg, fg } = palette[tone];

  return (
    <View style={[styles.stub, { backgroundColor: bg }]}>
      <View style={[styles.stubNotch, { left: -4, backgroundColor: theme.backgroundElement }]} />
      <ThemedText
        type="eyebrow"
        numberOfLines={1}
        style={{ color: fg, fontSize: 10.5, letterSpacing: 0.8 }}>
        {label}
      </ThemedText>
      <View style={[styles.stubNotch, { right: -4, backgroundColor: theme.backgroundElement }]} />
    </View>
  );
}

/** Luggage tag: a pointed tag with a punched hole, for a panel's headline total. */
export function LuggageTag({
  children,
  color,
  height = 44,
}: {
  children: ReactNode;
  color?: string;
  height?: number;
}) {
  const theme = useTheme();
  const bg = color ?? theme.info;
  const point = Math.round(height * 0.42);

  return (
    <View style={[styles.tag, { height }]}>
      {/* Border triangle for the pointed end. */}
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: height / 2,
          borderBottomWidth: height / 2,
          borderRightWidth: point,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderRightColor: bg,
        }}
      />
      <View
        style={[
          styles.tagHole,
          { left: point * 0.72 - 3, top: height / 2 - 3, backgroundColor: theme.backgroundElement },
        ]}
      />
      <View style={[styles.tagBody, { backgroundColor: bg }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  strap: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderRightWidth: 1,
    overflow: 'hidden',
  },
  stitch: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    height: '100%',
  },
  rule: {
    height: 1,
    overflow: 'hidden',
  },
  ruleImage: {
    width: '100%',
    height: 1,
  },
  medalRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalFace: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  panelHead: {
    gap: Spacing.two + 2,
    marginBottom: Spacing.one,
  },
  panelHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
  },
  panelHeadCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  panelTitle: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: 800,
  },
  panelTagline: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.6,
  },
  compassCopy: {
    position: 'absolute',
    alignItems: 'center',
    gap: 2,
  },
  stub: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  stubNotch: {
    position: 'absolute',
    top: '50%',
    marginTop: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tag: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  tagHole: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    zIndex: 1,
  },
  tagBody: {
    flexShrink: 1,
    justifyContent: 'center',
    paddingLeft: 4,
    paddingRight: 16,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
});
