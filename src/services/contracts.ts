import type {
  BankAccount,
  BankInstitution,
  Budget,
  BudgetLine,
  Category,
  Entitlement,
  ForecastSnapshot,
  Goal,
  Id,
  MerchantRule,
  SetupPreferences,
  Subcategory,
  Transaction,
  UserProfile,
} from '@/domain/finance';

export interface AuthService {
  getCurrentUser(): Promise<UserProfile | null>;
  signInWithApple(): Promise<UserProfile>;
  signInWithGoogle(): Promise<UserProfile>;
  signOut(): Promise<void>;
}

export interface BankSyncService {
  createLinkToken(): Promise<{ linkToken: string }>;
  exchangePublicToken(publicToken: string): Promise<BankInstitution>;
  syncTransactions(institutionId: Id): Promise<{ added: number; modified: number; removed: number }>;
  listAccounts(): Promise<BankAccount[]>;
}

export interface FinanceDataService {
  getSetupPreferences(): Promise<SetupPreferences | null>;
  saveSetupPreferences(preferences: SetupPreferences): Promise<void>;
  listCategories(): Promise<(Category & { subcategories: Subcategory[] })[]>;
  listTransactionsNeedingReview(): Promise<Transaction[]>;
  listBudgets(): Promise<(Budget & { lines: BudgetLine[] })[]>;
  listGoals(): Promise<Goal[]>;
  listEntitlements(): Promise<Entitlement[]>;
}

export interface CategorizationSuggestion {
  transactionId: Id;
  categoryId: Id;
  subcategoryId: Id | null;
  confidence: Transaction['categoryConfidence'];
  source: 'merchant-rule' | 'normalized-merchant' | 'plaid' | 'ai' | 'user-default';
  rationale: string;
}

export interface CategorizationService {
  suggestCategory(transaction: Transaction): Promise<CategorizationSuggestion>;
  confirmCategory(suggestion: CategorizationSuggestion): Promise<MerchantRule | null>;
  overrideCategory(input: {
    transactionId: Id;
    categoryId: Id;
    subcategoryId: Id | null;
    rememberMerchant: boolean;
  }): Promise<MerchantRule | null>;
}

export interface ForecastService {
  createGoalForecast(goalId: Id): Promise<ForecastSnapshot>;
  chooseBestModel(subjectId: Id): Promise<ForecastSnapshot['model']>;
}
