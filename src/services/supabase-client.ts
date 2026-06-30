import 'react-native-url-polyfill/auto';

import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { assertSupabaseEnv, env } from '@/config/env';

const secureStorageAdapter = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      return globalThis.localStorage?.getItem(key) ?? null;
    }

    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value);
      return;
    }

    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key);
      return;
    }

    await SecureStore.deleteItemAsync(key);
  },
};

export function createPennySupabaseClient() {
  assertSupabaseEnv();

  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: secureStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
}

export const supabase = env.dataSource === 'supabase' ? createPennySupabaseClient() : null;
