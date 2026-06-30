export type BudgetKind = 'fixed' | 'variable';

export type BudgetLine = {
  id: string;
  name: string;
  kind: BudgetKind;
  planned: number;
  spent: number;
};

export type ReviewTransaction = {
  id: string;
  merchant: string;
  amount: number;
  date: string;
  guess: string;
  confidence: 'high' | 'medium' | 'low';
};

export type Goal = {
  id: string;
  name: string;
  type: string;
  target: number;
  saved: number;
  monthlyPace: number;
  eta: string;
};

export const budgetLines: BudgetLine[] = [
  { id: 'rent', name: 'Rent', kind: 'fixed', planned: 1850, spent: 1850 },
  { id: 'internet', name: 'Internet', kind: 'fixed', planned: 70, spent: 70 },
  { id: 'student-loan', name: 'Student loan', kind: 'fixed', planned: 310, spent: 310 },
  { id: 'groceries', name: 'Groceries', kind: 'variable', planned: 560, spent: 392 },
  { id: 'dining', name: 'Dining out', kind: 'variable', planned: 320, spent: 286 },
  { id: 'travel', name: 'Travel fund', kind: 'variable', planned: 250, spent: 125 },
];

export const reviewTransactions: ReviewTransaction[] = [
  {
    id: 'tx-1',
    merchant: 'Blue Bottle Coffee',
    amount: 6.42,
    date: 'Today',
    guess: 'Food > Coffee',
    confidence: 'high',
  },
  {
    id: 'tx-2',
    merchant: 'Target T-2381',
    amount: 84.19,
    date: 'Yesterday',
    guess: 'Shopping > Household',
    confidence: 'medium',
  },
  {
    id: 'tx-3',
    merchant: 'Shell Oil',
    amount: 42.11,
    date: 'Jun 28',
    guess: 'Transportation > Gas',
    confidence: 'high',
  },
];

export const goals: Goal[] = [
  {
    id: 'home',
    name: 'First home',
    type: 'Home buying',
    target: 60000,
    saved: 18400,
    monthlyPace: 1450,
    eta: 'March 2028',
  },
  {
    id: 'car',
    name: 'Reliable car',
    type: 'Big purchase',
    target: 12000,
    saved: 3600,
    monthlyPace: 500,
    eta: 'November 2027',
  },
  {
    id: 'loan',
    name: 'Student loan payoff',
    type: 'Debt payoff',
    target: 8400,
    saved: 2100,
    monthlyPace: 350,
    eta: 'December 2027',
  },
];

export const categories = [
  {
    name: 'Housing',
    subcategories: ['Rent', 'Utilities', 'Internet', 'Repairs'],
  },
  {
    name: 'Food',
    subcategories: ['Groceries', 'Dining out', 'Coffee'],
  },
  {
    name: 'Transportation',
    subcategories: ['Gas', 'Car payment', 'Insurance', 'Maintenance'],
  },
  {
    name: 'Goals',
    subcategories: ['Home fund', 'Car fund', 'Loan payoff'],
  },
];

export function formatMoney(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function progress(current: number, target: number) {
  if (target <= 0) {
    return 0;
  }

  return Math.min(current / target, 1);
}
