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

const starterCategoryTemplates: {
  name: string;
  kind: Category['kind'];
  subcategories: string[];
}[] = [
  { name: 'Housing', kind: 'fixed', subcategories: ['Rent', 'Utilities', 'Internet', 'Repairs'] },
  {
    name: 'Food',
    kind: 'variable',
    subcategories: ['Groceries', 'Dining out', 'Coffee'],
  },
  {
    name: 'Transportation',
    kind: 'variable',
    subcategories: ['Gas', 'Car payment', 'Insurance', 'Maintenance'],
  },
  {
    name: 'Shopping',
    kind: 'variable',
    subcategories: ['Household', 'Clothing', 'Personal care'],
  },
  {
    name: 'Goals',
    kind: 'savings',
    subcategories: ['Home fund', 'Car fund', 'Loan payoff'],
  },
];

function mapCategory(row: Record<string, unknown>): Category & { subcategories: Subcategory[] } {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    kind: row.kind as Category['kind'],
    sortOrder: row.sort_order as number,
    archivedAt: (row.archived_at as string | null) ?? null,
    subcategories: ((row.subcategories as Record<string, unknown>[] | null) ?? []).map(
      (subcategory) => ({
        id: subcategory.id as string,
        userId: subcategory.user_id as string,
        categoryId: subcategory.category_id as string,
        name: subcategory.name as string,
        sortOrder: subcategory.sort_order as number,
        archivedAt: (subcategory.archived_at as string | null) ?? null,
      })
    ),
  };
}

function mapTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    accountId: row.account_id as string,
    providerTransactionId: (row.provider_transaction_id as string | null) ?? null,
    date: row.date as string,
    merchantName: row.merchant_name as string,
    originalDescription: row.original_description as string,
    amount: Number(row.amount),
    kind: row.kind as Transaction['kind'],
    categoryId: (row.category_id as string | null) ?? null,
    subcategoryId: (row.subcategory_id as string | null) ?? null,
    categoryConfidence: row.category_confidence as Transaction['categoryConfidence'],
    needsReview: Boolean(row.needs_review),
    pending: Boolean(row.pending),
    excludedFromBudget: Boolean(row.excluded_from_budget),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function normalizeMerchantName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function mapMerchantRule(row: Record<string, unknown>): MerchantRule {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    normalizedMerchant: row.normalized_merchant as string,
    categoryId: row.category_id as string,
    subcategoryId: (row.subcategory_id as string | null) ?? null,
    confidence: row.confidence as MerchantRule['confidence'],
    timesApplied: row.times_applied as number,
    lastAppliedAt: (row.last_applied_at as string | null) ?? null,
  };
}

async function getCurrentSupabaseUserId() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error('Sign in before reviewing transactions.');
  }

  return data.user.id;
}

async function markTransactionReviewed(input: {
  transactionId: string;
  categoryId: string;
  subcategoryId: string | null;
  confidence: Transaction['categoryConfidence'];
  rememberMerchant: boolean;
}) {
  const client = requireSupabase();
  const { data: transaction, error: fetchError } = await client
    .from('transactions')
    .select('id, user_id, merchant_name, normalized_merchant')
    .eq('id', input.transactionId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  const { error: updateError } = await client
    .from('transactions')
    .update({
      category_id: input.categoryId,
      subcategory_id: input.subcategoryId,
      category_confidence: input.confidence,
      needs_review: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.transactionId);

  if (updateError) {
    throw updateError;
  }

  if (!input.rememberMerchant) {
    return null;
  }

  const normalizedMerchant =
    (transaction.normalized_merchant as string | null) ||
    normalizeMerchantName(transaction.merchant_name as string);

  const { data: existingRule, error: existingRuleError } = await client
    .from('merchant_rules')
    .select('*')
    .eq('normalized_merchant', normalizedMerchant)
    .maybeSingle();

  if (existingRuleError) {
    throw existingRuleError;
  }

  if (existingRule) {
    const { data: updatedRule, error: ruleUpdateError } = await client
      .from('merchant_rules')
      .update({
        category_id: input.categoryId,
        subcategory_id: input.subcategoryId,
        confidence: 'high',
        times_applied: (existingRule.times_applied as number) + 1,
        last_applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingRule.id)
      .select('*')
      .single();

    if (ruleUpdateError) {
      throw ruleUpdateError;
    }

    return mapMerchantRule(updatedRule);
  }

  const { data: createdRule, error: ruleCreateError } = await client
    .from('merchant_rules')
    .insert({
      user_id: transaction.user_id,
      normalized_merchant: normalizedMerchant,
      category_id: input.categoryId,
      subcategory_id: input.subcategoryId,
      confidence: 'high',
      times_applied: 1,
      last_applied_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (ruleCreateError) {
    throw ruleCreateError;
  }

  return mapMerchantRule(createdRule);
}

async function createStarterCategories() {
  const client = requireSupabase();
  const userId = await getCurrentSupabaseUserId();

  const categoryRows = starterCategoryTemplates.map((category, index) => ({
    user_id: userId,
    name: category.name,
    kind: category.kind,
    sort_order: index,
  }));

  const { data: createdCategories, error: categoryError } = await client
    .from('categories')
    .insert(categoryRows)
    .select('*');

  if (categoryError) {
    throw categoryError;
  }

  const subcategoryRows = (createdCategories ?? []).flatMap((category) => {
    const template = starterCategoryTemplates.find((item) => item.name === category.name);
    return (template?.subcategories ?? []).map((subcategory, index) => ({
      user_id: userId,
      category_id: category.id,
      name: subcategory,
      sort_order: index,
    }));
  });

  if (subcategoryRows.length === 0) {
    return;
  }

  const { error: subcategoryError } = await client.from('subcategories').insert(subcategoryRows);

  if (subcategoryError) {
    throw subcategoryError;
  }
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
    const loadCategories = () =>
      client
        .from('categories')
        .select('*, subcategories(*)')
        .is('archived_at', null)
        .order('sort_order');

    let { data, error } = await loadCategories();

    if (error) {
      throw error;
    }

    if ((data ?? []).length === 0) {
      await createStarterCategories();
      const reloaded = await loadCategories();
      data = reloaded.data;
      error = reloaded.error;

      if (error) {
        throw error;
      }
    }

    return (data ?? []).map(mapCategory);
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

    return (data ?? []).map(mapTransaction);
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
    const categories = await supabaseFinanceDataService.listCategories();
    const firstVariableCategory =
      categories.find((category) => category.kind === 'variable') ?? categories[0];

    if (!firstVariableCategory) {
      throw new Error('Add at least one category before reviewing transactions.');
    }

    const normalizedMerchant = normalizeMerchantName(transaction.merchantName);
    const client = requireSupabase();
    const { data: rule, error: ruleError } = await client
      .from('merchant_rules')
      .select('*')
      .eq('normalized_merchant', normalizedMerchant)
      .maybeSingle();

    if (ruleError) {
      throw ruleError;
    }

    if (rule) {
      return {
        transactionId: transaction.id,
        categoryId: rule.category_id,
        subcategoryId: rule.subcategory_id,
        confidence: 'high',
        source: 'merchant-rule',
        rationale: 'Matched a merchant rule you previously approved.',
      } as CategorizationSuggestion;
    }

    return {
      transactionId: transaction.id,
      categoryId: transaction.categoryId ?? firstVariableCategory.id,
      subcategoryId:
        transaction.subcategoryId ?? firstVariableCategory.subcategories[0]?.id ?? null,
      confidence: transaction.categoryConfidence === 'none' ? 'low' : transaction.categoryConfidence,
      source: 'user-default',
      rationale: 'Starter guess until Penny has enough merchant history for this user.',
    };
  },
  async confirmCategory(suggestion): Promise<MerchantRule | null> {
    return markTransactionReviewed({
      transactionId: suggestion.transactionId,
      categoryId: suggestion.categoryId,
      subcategoryId: suggestion.subcategoryId,
      confidence: suggestion.confidence === 'none' ? 'medium' : suggestion.confidence,
      rememberMerchant: true,
    });
  },
  async overrideCategory(input): Promise<MerchantRule | null> {
    return markTransactionReviewed({
      transactionId: input.transactionId,
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId,
      confidence: 'high',
      rememberMerchant: input.rememberMerchant,
    });
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
