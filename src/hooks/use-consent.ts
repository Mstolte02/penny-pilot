import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  type ConsentMethod,
  type ConsentRecord,
  type ConsentType,
} from '@/constants/consent';
import { consentService } from '@/services';

type ConsentStatus = 'loading' | 'needed' | 'granted';

async function readLocalConsent(): Promise<ConsentRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConsentRecord;
  } catch {
    return null;
  }
}

/**
 * Consent gate state. A user must have a locally-recorded consent for the current
 * CONSENT_VERSION before the app is usable; that local record is the offline-safe
 * source of truth (the app works with no account). When a session exists, the same
 * consent is mirrored to the server-side audit trail on a best-effort basis.
 */
export function useConsent() {
  const [status, setStatus] = useState<ConsentStatus>('loading');

  useEffect(() => {
    let mounted = true;
    readLocalConsent().then((record) => {
      if (!mounted) return;
      setStatus(record?.version === CONSENT_VERSION ? 'granted' : 'needed');
    });
    return () => {
      mounted = false;
    };
  }, []);

  const grant = useCallback(
    async (types: ConsentType[], method: ConsentMethod = 'in_app_gate') => {
      const record: ConsentRecord = {
        version: CONSENT_VERSION,
        acceptedAt: new Date().toISOString(),
        types,
        method,
      };
      await AsyncStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
      setStatus('granted');
      // Mirror to the server audit trail if signed in; safe no-op otherwise.
      await consentService
        .recordConsent({ types, version: CONSENT_VERSION, method })
        .catch(() => undefined);
    },
    []
  );

  /**
   * Pushes the locally-stored consent to the server. Call after sign-in so a user
   * who consented before authenticating still lands in the server-side trail.
   */
  const syncToServer = useCallback(async () => {
    const record = await readLocalConsent();
    if (!record) return;
    await consentService
      .recordConsent({ types: record.types, version: record.version, method: record.method })
      .catch(() => undefined);
  }, []);

  return { status, grant, syncToServer };
}
