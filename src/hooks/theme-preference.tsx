import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';

const THEME_PREFERENCE_KEY = 'penny:themePreference';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemePreferenceValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** The scheme actually in effect after applying the preference. */
  scheme: 'light' | 'dark';
};

const ThemePreferenceContext = createContext<ThemePreferenceValue>({
  preference: 'system',
  setPreference: () => {},
  scheme: 'light',
});

/**
 * App-wide light/dark choice: follow the OS by default, or pin one from settings.
 * The preference persists across launches via AsyncStorage.
 */
export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_PREFERENCE_KEY)
      .then((value) => {
        if (value === 'light' || value === 'dark' || value === 'system') {
          setPreferenceState(value);
        }
      })
      .catch(() => {});
  }, []);

  const value = useMemo<ThemePreferenceValue>(() => {
    const setPreference = (next: ThemePreference) => {
      setPreferenceState(next);
      AsyncStorage.setItem(THEME_PREFERENCE_KEY, next).catch(() => {});
    };
    const scheme =
      preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
    return { preference, setPreference, scheme };
  }, [preference, system]);

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}
