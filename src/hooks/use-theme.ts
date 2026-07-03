import { Colors } from '@/constants/theme';
import { useThemePreference } from '@/hooks/theme-preference';

/** Palette for the effective scheme (OS setting unless pinned in app settings). */
export function useTheme() {
  const { scheme } = useThemePreference();

  return Colors[scheme];
}
