import {
  budgetLines as sampleBudgetLines,
  categories as sampleCategories,
  goals as sampleGoals,
  reviewTransactions,
} from '@/data/sample-finance';
import type {
  BankAccount,
  Budget,
  BudgetLine,
  Category,
  Entitlement,
  ForecastSnapshot,
  Goal,
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

const now = new Date().toISOString();
const mockUserId = 'user_demo';
const mockBudgetId = 'budget_2026_06';

const mockUser: UserProfile = {
  id: mockUserId,
  displayName: 'Penny Pilot Demo',
  email: 'demo@pennypilot.app',
  authProviders: ['apple', 'google'],
  planTier: 'free',
  onboardingCompletedAt: null,
  createdAt: now,
  updatedAt: now,
};

const mockCategories: (Category & { subcategories: Subcategory[] })[] = sampleCategories.map(
  (category, categoryIndex) => {
    const categoryId = `cat_${category.name.toLowerCase().replaceAll(' ', '_')}`;

    return {
      id: categoryId,
      userId: mockUserId,
      name: category.name,
      kind: category.name === 'Goals' ? 'savings' : category.name === 'Housing' ? 'fixed' : 'variable',
      sortOrder: categoryIndex,
      archivedAt: null,
      subcategories: category.subcategories.map((subcategory, subcategoryIndex) => ({
        id: `sub_${subcategory.toLowerCase().replaceAll(' ', '_').replaceAll('/', '_')}`,
        userId: mockUserId,
        categoryId,
        name: subcategory,
        sortOrder: subcategoryIndex,
        archivedAt: null,
      })),
    };
  }
);

const mockGoals: Goal[] = sampleGoals.map((goal) => ({
  id: `goal_${goal.id}`,
  userId: mockUserId,
  kind: goal.id === 'home' ? 'home' : goal.id === 'car' ? 'car' : 'loan-payoff',
  name: goal.name,
  targetAmount: goal.target,
  currentAmount: goal.saved,
  targetDate: null,
  monthlyContributionTarget: goal.monthlyPace,
  linkedAccountId: null,
  status: 'active',
  createdAt: now,
  updatedAt: now,
}));

const mockBudget: Budget & { lines: BudgetLine[] } = {
  id: mockBudgetId,
  userId: mockUserId,
  name: 'June plan',
  month: '2026-06',
  style: 'guided-flexible',
  incomeTarget: 6800,
  savingsTarget: 1450,
  createdAt: now,
  updatedAt: now,
  lines: sampleBudgetLines.map((line, index) => {
    const matchingCategory = mockCategories.find((category) =>
      category.subcategories.some((subcategory) => subcategory.name === line.name)
    );
    const matchingSubcategory = matchingCategory?.subcategories.find(
      (subcategory) => subcategory.name === line.name
    );

    return {
      id: `budget_line_${line.id}`,
      userId: mockUserId,
      budgetId: mockBudgetId,
      categoryId: matchingCategory?.id ?? mockCategories[0].id,
      subcategoryId: matchingSubcategory?.id ?? null,
      kind: line.kind,
      name: line.name,
      plannedAmount: line.planned,
      actualAmount: line.spent,
      sortOrder: index,
    };
  }),
};

let mockTransactions: Transaction[] = reviewTransactions.map((transaction) => ({
  id: transaction.id,
  userId: mockUserId,
  accountId: 'acct_checking',
  providerTransactionId: `plaid_${transaction.id}`,
  date: '2026-06-29',
  merchantName: transaction.merchant,
  originalDescription: transaction.merchant,
  amount: transaction.amount,
  kind: 'expense',
  categoryId: null,
  subcategoryId: null,
  categoryConfidence: transaction.confidence,
  needsReview: true,
  pending: false,
  excludedFromBudget: false,
  createdAt: now,
  updatedAt: now,
}));

let setupPreferences: SetupPreferences | null = null;

export const mockAuthService: AuthService = {
  async getCurrentUser() {
    return mockUser;
  },
  async signInWithApple() {
    return mockUser;
  },
  async signInWithGoogle() {
    return mockUser;
  },
  async signOut() {},
};

export const mockBankSyncService: BankSyncService = {
  async createLinkToken() {
    return { linkToken: 'link-sandbox-demo-token' };
  },
  async exchangePublicToken() {
    return {
      id: 'inst_demo',
      userId: mockUserId,
      provider: 'plaid',
      providerInstitutionId: 'ins_109508',
      name: 'Demo Bank',
      logoUrl: null,
      status: 'healthy',
      lastSyncedAt: now,
    };
  },
  async syncTransactions() {
    return { added: 3, modified: 0, removed: 0 };
  },
  async listAccounts(): Promise<BankAccount[]> {
    return [
      {
        id: 'acct_checking',
        userId: mockUserId,
        institutionId: 'inst_demo',
        providerAccountId: 'plaid_account_demo',
        name: 'Everyday Checking',
        officialName: null,
        mask: '4242',
        kind: 'checking',
        currentBalance: 4280,
        availableBalance: 4190,
        isoCurrencyCode: 'USD',
        hidden: false,
      },
    ];
  },
};

export const mockFinanceDataService: FinanceDataService = {
  async getSetupPreferences() {
    return setupPreferences;
  },
  async saveSetupPreferences(preferences) {
    setupPreferences = preferences;
  },
  async listCategories() {
    return mockCategories;
  },
  async listTransactionsNeedingReview() {
    return mockTransactions.filter((transaction) => transaction.needsReview);
  },
  async listBudgets() {
    return [mockBudget];
  },
  async listGoals() {
    return mockGoals;
  },
  async listEntitlements(): Promise<Entitlement[]> {
    return [
      {
        userId: mockUserId,
        key: 'advanced-forecasting',
        active: false,
        source: 'free',
        expiresAt: null,
      },
    ];
  },
};

export const mockCategorizationService: CategorizationService = {
  async suggestCategory(transaction): Promise<CategorizationSuggestion> {
    const foodCategory = mockCategories.find((category) => category.name === 'Food') ?? mockCategories[0];
    const coffeeSubcategory =
      foodCategory.subcategories.find((subcategory) => subcategory.name === 'Coffee') ?? null;

    return {
      transactionId: transaction.id,
      categoryId: foodCategory.id,
      subcategoryId: coffeeSubcategory?.id ?? null,
      confidence: transaction.categoryConfidence,
      source: 'ai',
      rationale: 'Mock AI matched the merchant against your Food category and Coffee subcategory.',
    };
  },
  async confirmCategory(suggestion) {
    mockTransactions = mockTransactions.map((transaction) =>
      transaction.id === suggestion.transactionId
        ? {
            ...transaction,
            needsReview: false,
            categoryId: suggestion.categoryId,
            subcategoryId: suggestion.subcategoryId,
            categoryConfidence: suggestion.confidence,
          }
        : transaction
    );
    return null;
  },
  async overrideCategory(input) {
    mockTransactions = mockTransactions.map((transaction) =>
      transaction.id === input.transactionId
        ? {
            ...transaction,
            needsReview: false,
            categoryId: input.categoryId,
            subcategoryId: input.subcategoryId,
            categoryConfidence: 'high',
          }
        : transaction
    );
    return null;
  },
};

export const mockForecastService: ForecastService = {
  async createGoalForecast(goalId): Promise<ForecastSnapshot> {
    return {
      id: `forecast_${goalId}`,
      userId: mockUserId,
      subjectType: 'goal',
      subjectId: goalId,
      model: 'simple-moving-average',
      visibility: 'friendly',
      projectedAmount: 60000,
      projectedDate: '2028-03-01',
      errorScore: null,
      metadata: { reason: 'Mock forecast until user history exists.' },
      createdAt: now,
    };
  },
  async chooseBestModel() {
    return 'simple-moving-average';
  },
};
