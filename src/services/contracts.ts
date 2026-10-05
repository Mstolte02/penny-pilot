import type { ConsentMethod, ConsentType } from '@/constants/consent';
import type { BankFeedRow } from '@/services/bank-feed';
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
  /**
   * Permanently deletes the signed-in user's account and every dependent record
   * (transactions, accounts, budgets, goals, bank connections), revokes any active
   * Plaid connection, and ends the session. Irreversible.
   */
  deleteAccount(): Promise<void>;
}

export interface ConsentService {
  /**
   * Persists a consent record server-side for the signed-in user. No-op (resolves)
   * when there is no active session — local consent still governs app access, and
   * this is retried after sign-in.
   */
  recordConsent(input: {
    types: ConsentType[];
    version: string;
    method: ConsentMethod;
  }): Promise<void>;
}

export interface BankSyncService {
  createLinkToken(): Promise<{ linkToken: string }>;
  exchangePublicToken(publicToken: string): Promise<BankInstitution>;
  syncTransactions(institutionId: Id): Promise<{ added: number; modified: number; removed: number }>;
  listAccounts(): Promise<BankAccount[]>;
  /** Pulls new transactions for every connected bank. */
  syncAll(): Promise<{ added: number; modified: number; removed: number }>;
  /** Every synced bank transaction, with Plaid's category and any server-side review. */
  listBankFeed(): Promise<BankFeedRow[]>;
  /** The phone now owns review, so clear the server-side review flags. */
  clearServerReviewQueue(): Promise<void>;
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
