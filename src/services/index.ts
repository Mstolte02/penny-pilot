import { env } from '@/config/env';
import {
  mockAuthService,
  mockBankSyncService,
  mockCategorizationService,
  mockConsentService,
  mockFinanceDataService,
  mockForecastService,
} from '@/services/mock-finance-service';
import {
  supabaseAuthService,
  supabaseBankSyncService,
  supabaseCategorizationService,
  supabaseConsentService,
  supabaseFinanceDataService,
  supabaseForecastService,
} from '@/services/supabase-services';

const useSupabase = env.dataSource === 'supabase';

export const authService = useSupabase ? supabaseAuthService : mockAuthService;
export const consentService = useSupabase ? supabaseConsentService : mockConsentService;
export const bankSyncService = useSupabase ? supabaseBankSyncService : mockBankSyncService;
export const financeDataService = useSupabase
  ? supabaseFinanceDataService
  : mockFinanceDataService;
export const categorizationService = useSupabase
  ? supabaseCategorizationService
  : mockCategorizationService;
export const forecastService = useSupabase ? supabaseForecastService : mockForecastService;
