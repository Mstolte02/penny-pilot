import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import type {
  BankAccount,
  BankInstitution,
  Budget,
  BudgetLine,
  Category,
  Entitlement,
  ForecastSnapshot,
  Goal,
  MerchantRule,
  SetupPreferences,
  Subcategory,
  Transaction,
  UserProfile,
} from '@/domain/finance';
import type {
  AuthService,
  BankSyncService,
  CategorizationService,
  CategorizationSuggestion,
  FinanceDataService,
  ForecastService,
} from '@/services/contracts';
import { supabase } from '@/services/supabase-client';

WebBrowser.maybeCompleteAuthSession();

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase service requested while EXPO_PUBLIC_DATA_SOURCE is not set to supabase.');
  }

  return supabase;
}

async function getFunctionErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const response = (error as { context?: Response }).context;
  if (response) {
    try {
      const payload = (await response.clone().json()) as { error?: unknown; message?: unknown };
      if (typeof payload.error === 'string') return payload.error;
      if (typeof payload.message === 'string') return payload.message;
    } catch {
      // Supabase function errors do not always include a JSON body.
    }
  }

  return error.message;
}

function mapProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    displayName: (row.display_name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    authProviders: [],
    planTier: row.plan_tier as UserProfile['planTier'],
    onboardingCompletedAt: (row.onboarding_completed_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

async function startOAuth(provider: 'apple' | 'google') {
  const client = requireSupabase();
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  if (!data.url) {
    throw new Error(`Could not start ${provider} sign-in.`);
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    throw new Error(`${provider} sign-in was cancelled or could not complete.`);
  }

  const parsedUrl = new URL(result.url);
  const code = parsedUrl.searchParams.get('code');
  if (!code) {
    throw new Error(`${provider} sign-in did not return an authorization code.`);
  }

  const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    throw exchangeError;
  }
}

export async function completeSupabaseOAuthCallback(code: string) {
  const client = requireSupabase();
  const { error } = await client.auth.exchangeCodeForSession(code);

  if (error) {
    throw error;
  }
}

export const supabaseAuthService: AuthService = {
  async getCurrentUser() {
    const client = requireSupabase();
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError) {
      if (authError.message.toLowerCase().includes('auth session missing')) {
        return null;
      }

      throw authError;
    }
    if (!authData.user) {
      return null;
    }

    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return mapProfile(data);
    }

    const profile = {
      id: authData.user.id,
      email: authData.user.email ?? null,
      display_name: authData.user.user_metadata?.full_name ?? null,
    };

    const { data: created, error: createError } = await client
      .from('profiles')
      .insert(profile)
      .select('*')
      .single();

    if (createError) {
      throw createError;
    }

    return mapProfile(created);
  },
  async signInWithApple() {
    await startOAuth('apple');
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('Apple sign-in completed, but no user profile loaded.');
    }

    return user;
  },
  async signInWithGoogle() {
    await startOAuth('google');
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('Google sign-in completed, but no user profile loaded.');
    }

    return user;
  },
  async signOut() {
    const client = requireSupabase();
    const { error } = await client.auth.signOut();
    if (error) {
      throw error;
    }
  },
};

export const supabaseBankSyncService: BankSyncService = {
  async createLinkToken() {
    const client = requireSupabase();
    const { data, error } = await client.functions.invoke('plaid-create-link-token');
    if (error) {
      throw new Error(await getFunctionErrorMessage(error, 'Could not create Plaid Link token.'));
    }
    return data as { linkToken: string };
  },
  async exchangePublicToken(publicToken) {
    const client = requireSupabase();
    const { data, error } = await client.functions.invoke('plaid-exchange-public-token', {
      body: { publicToken },
    });
    if (error) {
      throw new Error(await getFunctionErrorMessage(error, 'Could not finish bank connection.'));
    }
    return data as BankInstitution;
  },
  async syncTransactions(institutionId) {
    const client = requireSupabase();
    const { data, error } = await client.functions.invoke('plaid-sync-transactions', {
      body: { institutionId },
    });
    if (error) {
      throw new Error(await getFunctionErrorMessage(error, 'Could not sync transactions.'));
    }
    return data as { added: number; modified: number; removed: number };
  },
  async listAccounts() {
    const client = requireSupabase();
    const { data, error } = await client.from('bank_accounts').select('*').eq('hidden', false);
    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      institutionId: row.plaid_item_id,
      providerAccountId: row.provider_account_id,
      name: row.name,
      officialName: row.official_name,
      mask: row.mask,
      kind: row.kind,
      currentBalance: row.current_balance,
      availableBalance: row.available_balance,
      isoCurrencyCode: row.iso_currency_code,
      hidden: row.hidden,
    })) as BankAccount[];
  },
};

export const supabaseFinanceDataService: FinanceDataService = {
  async getSetupPreferences() {
    const client = requireSupabase();
    const { data, error } = await client.from('setup_preferences').select('*').maybeSingle();
    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      userId: data.user_id,
      budgetStyle: data.budget_style,
      selectedCategoryTemplateIds: data.selected_category_template_ids,
      selectedGoalKinds: data.selected_goal_kinds,
      guidanceTone: data.guidance_tone,
      bankSyncIntent: data.bank_sync_intent,
      completedAt: data.completed_at,
    } as SetupPreferences;
  },
  async saveSetupPreferences(preferences) {
    const client = requireSupabase();
    const { error } = await client.from('setup_preferences').upsert({
      user_id: preferences.userId,
      budget_style: preferences.budgetStyle,
      selected_category_template_ids: preferences.selectedCategoryTemplateIds,
      selected_goal_kinds: preferences.selectedGoalKinds,
      guidance_tone: preferences.guidanceTone,
      bank_sync_intent: preferences.bankSyncIntent,
      completed_at: preferences.completedAt,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }
  },
  async listCategories() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('categories')
      .select('*, subcategories(*)')
      .is('archived_at', null)
      .order('sort_order');

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      kind: row.kind,
      sortOrder: row.sort_order,
      archivedAt: row.archived_at,
      subcategories: (row.subcategories ?? []).map((subcategory: Record<string, unknown>) => ({
        id: subcategory.id,
        userId: subcategory.user_id,
        categoryId: subcategory.category_id,
        name: subcategory.name,
        sortOrder: subcategory.sort_order,
        archivedAt: subcategory.archived_at,
      })),
    })) as (Category & { subcategories: Subcategory[] })[];
  },
  async listTransactionsNeedingReview() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('transactions')
      .select('*')
      .eq('needs_review', true)
      .order('date', { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      accountId: row.account_id,
      providerTransactionId: row.provider_transaction_id,
      date: row.date,
      merchantName: row.merchant_name,
      originalDescription: row.original_description,
      amount: row.amount,
      kind: row.kind,
      categoryId: row.category_id,
      subcategoryId: row.subcategory_id,
      categoryConfidence: row.category_confidence,
      needsReview: row.needs_review,
      pending: row.pending,
      excludedFromBudget: row.excluded_from_budget,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })) as Transaction[];
  },
  async listBudgets() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('budgets')
      .select('*, budget_lines(*)')
      .order('month', { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      month: row.month,
      style: row.style,
      incomeTarget: row.income_target,
      savingsTarget: row.savings_target,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lines: (row.budget_lines ?? []).map((line: Record<string, unknown>) => ({
        id: line.id,
        userId: line.user_id,
        budgetId: line.budget_id,
        categoryId: line.category_id,
        subcategoryId: line.subcategory_id,
        kind: line.kind,
        name: line.name,
        plannedAmount: line.planned_amount,
        actualAmount: line.actual_amount,
        sortOrder: line.sort_order,
      })),
    })) as (Budget & { lines: BudgetLine[] })[];
  },
  async listGoals() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('goals')
      .select('*')
      .eq('status', 'active')
      .order('created_at');

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      kind: row.kind,
      name: row.name,
      targetAmount: row.target_amount,
      currentAmount: row.current_amount,
      targetDate: row.target_date,
      monthlyContributionTarget: row.monthly_contribution_target,
      linkedAccountId: row.linked_account_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })) as Goal[];
  },
  async listEntitlements() {
    const client = requireSupabase();
    const { data, error } = await client.from('entitlements').select('*').eq('active', true);
    if (error) {
      throw error;
    }
    return (data ?? []).map((row) => ({
      userId: row.user_id,
      key: row.key,
      active: row.active,
      source: row.source,
      expiresAt: row.expires_at,
    })) as Entitlement[];
  },
};

export const supabaseCategorizationService: CategorizationService = {
  async suggestCategory(transaction): Promise<CategorizationSuggestion> {
    const client = requireSupabase();
    const { data, error } = await client.functions.invoke('categorize-transaction', {
      body: { transactionId: transaction.id },
    });
    if (error) {
      throw error;
    }
    return data as CategorizationSuggestion;
  },
  async confirmCategory(suggestion): Promise<MerchantRule | null> {
    const client = requireSupabase();
    const { data, error } = await client.functions.invoke('confirm-category', {
      body: suggestion,
    });
    if (error) {
      throw error;
    }
    return data as MerchantRule | null;
  },
  async overrideCategory(input): Promise<MerchantRule | null> {
    const client = requireSupabase();
    const { data, error } = await client.functions.invoke('override-category', {
      body: input,
    });
    if (error) {
      throw error;
    }
    return data as MerchantRule | null;
  },
};

export const supabaseForecastService: ForecastService = {
  async createGoalForecast(goalId): Promise<ForecastSnapshot> {
    const client = requireSupabase();
    const { data, error } = await client.functions.invoke('create-goal-forecast', {
      body: { goalId },
    });
    if (error) {
      throw error;
    }
    return data as ForecastSnapshot;
  },
  async chooseBestModel(subjectId) {
    const client = requireSupabase();
    const { data, error } = await client.functions.invoke('choose-best-forecast-model', {
      body: { subjectId },
    });
    if (error) {
      throw error;
    }
    return data.model as ForecastSnapshot['model'];
  },
};
