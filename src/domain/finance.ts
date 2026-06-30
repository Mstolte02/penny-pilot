export type Id = string;
export type IsoDate = string;
export type IsoMonth = string;
export type IsoTimestamp = string;

export type AuthProvider = 'apple' | 'google';
export type PlanTier = 'free' | 'plus' | 'pro';
export type SyncProvider = 'plaid';
export type AccountKind =
  | 'checking'
  | 'savings'
  | 'credit'
  | 'loan'
  | 'investment'
  | 'cash'
  | 'other';

export type TransactionKind = 'income' | 'expense' | 'transfer';
export type CategoryKind = 'income' | 'fixed' | 'variable' | 'savings' | 'debt' | 'transfer';
export type CategoryConfidence = 'high' | 'medium' | 'low' | 'none';
export type BudgetStyle = 'guided-flexible' | 'fifty-thirty-twenty' | 'zero-based' | 'envelopes';
export type GoalKind =
  | 'home'
  | 'car'
  | 'emergency-fund'
  | 'vacation'
  | 'wedding'
  | 'moving'
  | 'loan-payoff'
  | 'credit-card-payoff'
  | 'custom';

export type ForecastModel = 'simple-moving-average' | 'ewma' | 'random-walk-drift';
export type ForecastVisibility = 'friendly' | 'advanced';
export type EntitlementKey =
  | 'unlimited-goals'
  | 'advanced-forecasting'
  | 'scenario-planning'
  | 'subscription-detection'
  | 'bill-reminders'
  | 'household-sharing';

export interface UserProfile {
  id: Id;
  displayName: string | null;
  email: string | null;
  authProviders: AuthProvider[];
  planTier: PlanTier;
  onboardingCompletedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface SetupPreferences {
  userId: Id;
  budgetStyle: BudgetStyle;
  selectedCategoryTemplateIds: Id[];
  selectedGoalKinds: GoalKind[];
  guidanceTone: 'gentle' | 'balanced' | 'direct';
  bankSyncIntent: 'now' | 'later';
  completedAt: IsoTimestamp | null;
}

export interface BankInstitution {
  id: Id;
  userId: Id;
  provider: SyncProvider;
  providerInstitutionId: string;
  name: string;
  logoUrl: string | null;
  status: 'healthy' | 'needs-reconnect' | 'syncing' | 'error';
  lastSyncedAt: IsoTimestamp | null;
}

export interface BankAccount {
  id: Id;
  userId: Id;
  institutionId: Id;
  providerAccountId: string;
  name: string;
  officialName: string | null;
  mask: string | null;
  kind: AccountKind;
  currentBalance: number | null;
  availableBalance: number | null;
  isoCurrencyCode: string;
  hidden: boolean;
}

export interface Category {
  id: Id;
  userId: Id;
  name: string;
  kind: CategoryKind;
  sortOrder: number;
  archivedAt: IsoTimestamp | null;
}

export interface Subcategory {
  id: Id;
  userId: Id;
  categoryId: Id;
  name: string;
  sortOrder: number;
  archivedAt: IsoTimestamp | null;
}

export interface Transaction {
  id: Id;
  userId: Id;
  accountId: Id;
  providerTransactionId: string | null;
  date: IsoDate;
  merchantName: string;
  originalDescription: string;
  amount: number;
  kind: TransactionKind;
  categoryId: Id | null;
  subcategoryId: Id | null;
  categoryConfidence: CategoryConfidence;
  needsReview: boolean;
  pending: boolean;
  excludedFromBudget: boolean;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface MerchantRule {
  id: Id;
  userId: Id;
  normalizedMerchant: string;
  categoryId: Id;
  subcategoryId: Id | null;
  confidence: CategoryConfidence;
  timesApplied: number;
  lastAppliedAt: IsoTimestamp | null;
}

export interface Budget {
  id: Id;
  userId: Id;
  name: string;
  month: IsoMonth;
  style: BudgetStyle;
  incomeTarget: number;
  savingsTarget: number;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface BudgetLine {
  id: Id;
  userId: Id;
  budgetId: Id;
  categoryId: Id;
  subcategoryId: Id | null;
  kind: Extract<CategoryKind, 'fixed' | 'variable' | 'savings' | 'debt'>;
  name: string;
  plannedAmount: number;
  actualAmount: number;
  sortOrder: number;
}

export interface Goal {
  id: Id;
  userId: Id;
  kind: GoalKind;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: IsoDate | null;
  monthlyContributionTarget: number | null;
  linkedAccountId: Id | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface ForecastSnapshot {
  id: Id;
  userId: Id;
  subjectType: 'goal' | 'category' | 'budget';
  subjectId: Id;
  model: ForecastModel;
  visibility: ForecastVisibility;
  projectedAmount: number;
  projectedDate: IsoDate | null;
  errorScore: number | null;
  metadata: Record<string, unknown>;
  createdAt: IsoTimestamp;
}

export interface Entitlement {
  userId: Id;
  key: EntitlementKey;
  active: boolean;
  source: 'free' | 'subscription' | 'promo' | 'admin';
  expiresAt: IsoTimestamp | null;
}
