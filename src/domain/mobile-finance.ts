export type MobileTransactionType = 'income' | 'expense';

export type MobileTransaction = {
  id: string;
  date: string;
  item: string;
  moneyIn: number;
  moneyOut: number;
  amount: number;
  category: string;
  subcategory: string | null;
  type: MobileTransactionType;
};

export type BudgetLineForecastMethod = 'avg3' | 'avg6' | 'avg9' | 'avg12' | 'ewma';

export type BudgetPlanLine = {
  name: string;
  type: 'fixed' | 'variable';
  monthly?: number;
  match?: [string, string][];
  forecast?: {
    method: BudgetLineForecastMethod;
    alpha?: number;
  };
};

export type BudgetPlanSection = {
  title: string;
  lines: BudgetPlanLine[];
};

export type BudgetPlan = {
  income: { name: string; biweekly: number; monthly: number }[];
  sections: BudgetPlanSection[];
};

export type SavingsConfig = {
  currentSavings: number;
  asOfDate: string;
  monthlySavingsTarget: number;
  plannedExpenses: { date: string; description: string; amount: number }[];
  recurringExpenses: {
    description: string;
    amount: number;
    startDate: string;
    endDate: string | null;
  }[];
  allocation: { account: string; biweekly: number; monthly: number; yearly: number; pct: number }[];
  mortgage: {
    aprDefault: number;
    termYears: number;
    propertyTaxRate: number;
    homeInsuranceYearly: number;
    closingCostRate: number;
  };
  homePriceTargetDefault: number;
  downPaymentPctDefault: number;
  savingsApy: number;
};

export type BudgetSectionSummary = {
  title: string;
  fixedTotal: number;
  variableTotal: number;
  total: number;
  lines: {
    name: string;
    type: BudgetPlanLine['type'];
    amount: number;
    method: string;
  }[];
};

export type BudgetSummary = {
  monthlyIncome: number;
  fixedTotal: number;
  variableTotal: number;
  totalExpenses: number;
  monthlySavingsTarget: number;
  sections: BudgetSectionSummary[];
};

export type GoalForecast = {
  currentSavings: number;
  cashNeeded: number;
  downPayment: number;
  closingCosts: number;
  monthlyPayment: number;
  monthlySavingsPace: number;
  monthsToGoal: number | null;
  targetDateLabel: string;
  progress: number;
};

export const EWMA_ALPHA = 0.35;

export function formatMoney(value: number, maximumFractionDigits = 0) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
  });
}

export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function daysInMonthOf(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);

  return new Date(year, monthNumber, 0).getDate();
}

export type SafeToSpend = {
  month: string;
  flexBudget: number;
  flexSpent: number;
  remaining: number;
  daysLeft: number;
  perDay: number;
  dailyTarget: number;
};

/**
 * "Safe to spend today" = the flexible (non-fixed) budget you have left this month,
 * spread across the days remaining. Fixed obligations (rent, insurance, loans) are
 * excluded on both sides so the daily number reflects only discretionary money.
 *
 * Anchored to the real current month/day: early in the month you see close to the full
 * daily allowance, and it draws down as real spending lands. `now` is injectable for tests.
 */
export function safeToSpendToday(
  plan: BudgetPlan,
  transactions: MobileTransaction[],
  now: Date = new Date()
): SafeToSpend {
  const budget = summarizeBudget(plan, transactions);
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Flexible = variable budget lines only. Measure actual flexible spend directly from the
  // transactions that match those lines (fixed bills are excluded and may not all be logged).
  const variablePairs: [string, string][] = [];
  for (const section of plan.sections) {
    for (const line of section.lines) {
      if (line.type !== 'variable') continue;
      if (line.match?.length) {
        variablePairs.push(...line.match);
      } else {
        variablePairs.push([section.title, line.name]);
      }
    }
  }
  const isFlexible = (transaction: MobileTransaction) => {
    if (transaction.type !== 'expense') return false;
    const sub = transaction.subcategory ?? 'Uncategorized';
    return variablePairs.some(
      ([category, subcategory]) =>
        transaction.category === category &&
        (sub === subcategory || sub.startsWith(`${subcategory}:`))
    );
  };

  const flexBudget = budget.variableTotal;
  const flexSpent = transactions
    .filter((transaction) => monthKey(transaction.date) === month && isFlexible(transaction))
    .reduce((sum, transaction) => sum + transaction.moneyOut, 0);
  const remaining = flexBudget - flexSpent;

  const totalDays = daysInMonthOf(month) || 30;
  const dayOfMonth = Math.min(totalDays, Math.max(1, now.getDate()));
  const daysLeft = Math.max(1, totalDays - dayOfMonth + 1);

  return {
    month,
    flexBudget,
    flexSpent,
    remaining,
    daysLeft,
    perDay: remaining / daysLeft,
    dailyTarget: totalDays > 0 ? flexBudget / totalDays : 0,
  };
}

export function uniqueMonths(transactions: MobileTransaction[]) {
  return Array.from(new Set(transactions.map((transaction) => monthKey(transaction.date)))).sort();
}

export function addMonths(month: string, count: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + count, 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);

  return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

export function monthlySpend(transactions: MobileTransaction[]) {
  const rows = new Map<string, { month: string; total: number; byCategory: Record<string, number> }>();

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;

    const month = monthKey(transaction.date);
    const row = rows.get(month) ?? { month, total: 0, byCategory: {} };
    row.total += transaction.moneyOut;
    row.byCategory[transaction.category] =
      (row.byCategory[transaction.category] ?? 0) + transaction.moneyOut;
    rows.set(month, row);
  }

  return Array.from(rows.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export function monthlyIncome(transactions: MobileTransaction[]) {
  const income: Record<string, number> = {};

  for (const transaction of transactions) {
    if (transaction.type !== 'income') continue;

    const month = monthKey(transaction.date);
    income[month] = (income[month] ?? 0) + transaction.moneyIn;
  }

  return income;
}

export function actualMonthlyNet(transactions: MobileTransaction[]) {
  const income = monthlyIncome(transactions);
  const spend = monthlySpend(transactions);
  const months = uniqueMonths(transactions);
  const net: Record<string, number> = {};

  for (const month of months) {
    net[month] = (income[month] ?? 0) - (spend.find((row) => row.month === month)?.total ?? 0);
  }

  return net;
}

export function mean(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function avgForecast(values: number[], window: number) {
  if (values.length === 0) return 0;

  return mean(values.slice(Math.max(0, values.length - window)));
}

export function ewmaForecast(values: number[], alpha = EWMA_ALPHA) {
  let ewma: number | null = null;

  for (const value of values) {
    ewma = ewma === null ? value : alpha * value + (1 - alpha) * ewma;
  }

  return ewma ?? 0;
}

export function avgActualMonthlySavings(transactions: MobileTransaction[], windowMonths = 6) {
  const net = actualMonthlyNet(transactions);
  const months = uniqueMonths(transactions).slice(-windowMonths);

  return mean(months.map((month) => net[month] ?? 0));
}

export function ewmaMonthlySavings(transactions: MobileTransaction[], alpha = EWMA_ALPHA) {
  const net = actualMonthlyNet(transactions);

  return ewmaForecast(uniqueMonths(transactions).map((month) => net[month] ?? 0), alpha);
}

function lineMatchesTransaction(
  transaction: MobileTransaction,
  sectionTitle: string,
  line: BudgetPlanLine
) {
  if (transaction.type !== 'expense') return false;

  if (line.match?.length) {
    return line.match.some(
      ([category, subcategory]) =>
        transaction.category === category &&
        ((transaction.subcategory ?? 'Uncategorized') === subcategory ||
          (transaction.subcategory ?? '').startsWith(`${subcategory}:`))
    );
  }

  return transaction.category === sectionTitle && transaction.subcategory === line.name;
}

function budgetLineMonthlyActuals(
  line: BudgetPlanLine,
  transactions: MobileTransaction[],
  sectionTitle: string
) {
  const months = uniqueMonths(transactions);
  const byMonth: Record<string, number> = {};

  for (const transaction of transactions) {
    if (!lineMatchesTransaction(transaction, sectionTitle, line)) continue;

    const month = monthKey(transaction.date);
    byMonth[month] = (byMonth[month] ?? 0) + transaction.moneyOut;
  }

  return months.map((month) => byMonth[month] ?? 0);
}

function budgetLineAmount(
  line: BudgetPlanLine,
  transactions: MobileTransaction[],
  sectionTitle: string
) {
  if (line.type === 'fixed') {
    return line.monthly ?? 0;
  }

  const forecast = line.forecast ?? { method: 'avg6', alpha: EWMA_ALPHA };
  const values = budgetLineMonthlyActuals(line, transactions, sectionTitle);

  if (forecast.method === 'ewma') {
    return ewmaForecast(values, forecast.alpha ?? EWMA_ALPHA);
  }

  const window = Number(forecast.method.replace('avg', ''));

  return avgForecast(values, window);
}

export function forecastMethodLabel(line: BudgetPlanLine) {
  const forecast = line.forecast ?? { method: 'avg6', alpha: EWMA_ALPHA };

  if (line.type === 'fixed') return 'Fixed';
  if (forecast.method === 'ewma') return `EWMA ${((forecast.alpha ?? EWMA_ALPHA) * 100).toFixed(0)}%`;

  return `${forecast.method.replace('avg', '')}-mo avg`;
}

export function summarizeBudget(plan: BudgetPlan, transactions: MobileTransaction[]): BudgetSummary {
  const sections = plan.sections.map((section) => {
    const lines = section.lines.map((line) => ({
      name: line.name,
      type: line.type,
      amount: budgetLineAmount(line, transactions, section.title),
      method: forecastMethodLabel(line),
    }));
    const fixedTotal = lines
      .filter((line) => line.type === 'fixed')
      .reduce((sum, line) => sum + line.amount, 0);
    const variableTotal = lines
      .filter((line) => line.type === 'variable')
      .reduce((sum, line) => sum + line.amount, 0);

    return {
      title: section.title,
      fixedTotal,
      variableTotal,
      total: fixedTotal + variableTotal,
      lines,
    };
  });
  const monthlyIncome = plan.income.reduce((sum, income) => sum + income.monthly, 0);
  const fixedTotal = sections.reduce((sum, section) => sum + section.fixedTotal, 0);
  const variableTotal = sections.reduce((sum, section) => sum + section.variableTotal, 0);
  const totalExpenses = fixedTotal + variableTotal;

  return {
    monthlyIncome,
    fixedTotal,
    variableTotal,
    totalExpenses,
    monthlySavingsTarget: monthlyIncome - totalExpenses,
    sections,
  };
}

export function budgetGaps(plan: BudgetPlan, transactions: MobileTransaction[], minMonths = 2) {
  const covered = new Set<string>();

  for (const section of plan.sections) {
    for (const line of section.lines) {
      covered.add(`${section.title}||${line.name}`);
      for (const [category, subcategory] of line.match ?? []) covered.add(`${category}||${subcategory}`);
    }
  }

  const totals = new Map<
    string,
    { category: string; subcategory: string; byMonth: Record<string, number>; total: number }
  >();

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;

    const subcategory = transaction.subcategory ?? 'Uncategorized';
    const key = `${transaction.category}||${subcategory}`;
    if (covered.has(key)) continue;

    const row = totals.get(key) ?? {
      category: transaction.category,
      subcategory,
      byMonth: {},
      total: 0,
    };
    const month = monthKey(transaction.date);
    row.byMonth[month] = (row.byMonth[month] ?? 0) + transaction.moneyOut;
    row.total += transaction.moneyOut;
    totals.set(key, row);
  }

  return Array.from(totals.values())
    .map((row) => {
      const activeMonths = Object.keys(row.byMonth).filter((month) => row.byMonth[month] > 0).length;
      const avg = activeMonths > 0 ? row.total / activeMonths : 0;

      return {
        category: row.category,
        subcategory: row.subcategory,
        months: activeMonths,
        avg,
        total: row.total,
        suggestedMonthly: Math.ceil(avg),
      };
    })
    .filter((row) => row.months >= minMonths)
    .sort((a, b) => b.avg - a.avg);
}

function recurringForMonth(
  recurring: SavingsConfig['recurringExpenses'],
  month: string
) {
  return recurring.reduce((sum, item) => {
    const start = item.startDate.slice(0, 7);
    const end = item.endDate?.slice(0, 7) ?? null;
    const active = month >= start && (end === null || month <= end);

    return active ? sum + item.amount : sum;
  }, 0);
}

export function projectSavings(input: {
  startBalance: number;
  startDate: string;
  months: number;
  budgetedMonthly: number;
  actualMonthly: number;
  plannedExpenses: SavingsConfig['plannedExpenses'];
  recurringExpenses: SavingsConfig['recurringExpenses'];
  apyMonthly?: number;
}) {
  const [year, monthNumber] = input.startDate.split('-').map(Number);
  const points: { month: string; budgeted: number; actual: number; planned: number | null }[] = [];
  const rate = input.apyMonthly ?? 0;
  let budgeted = input.startBalance;
  let actual = input.startBalance;

  for (let index = 0; index <= input.months; index += 1) {
    const date = new Date(year, monthNumber - 1 + index, 1);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (index > 0) {
      const recurring = recurringForMonth(input.recurringExpenses, month);
      budgeted = budgeted * (1 + rate) + input.budgetedMonthly - recurring;
      actual = actual * (1 + rate) + input.actualMonthly - recurring;
    }

    const planned = input.plannedExpenses
      .filter((expense) => expense.date.slice(0, 7) === month)
      .reduce((sum, expense) => sum + expense.amount, 0);

    if (planned > 0) {
      budgeted -= planned;
      actual -= planned;
    }

    points.push({
      month,
      budgeted: Math.round(budgeted),
      actual: Math.round(actual),
      planned: planned > 0 ? planned : null,
    });
  }

  return points;
}

export function monthlyMortgagePayment(
  homePrice: number,
  downPaymentPct: number,
  mortgage: SavingsConfig['mortgage']
) {
  const principal = homePrice * (1 - downPaymentPct);
  const rate = mortgage.aprDefault / 12;
  const term = mortgage.termYears * 12;
  const principalAndInterest =
    rate === 0 ? principal / term : (principal * rate) / (1 - Math.pow(1 + rate, -term));
  const tax = (homePrice * mortgage.propertyTaxRate) / 12;
  const insurance = mortgage.homeInsuranceYearly / 12;

  return principalAndInterest + tax + insurance;
}

export function cashNeeded(homePrice: number, downPaymentPct: number, closingRate: number) {
  return homePrice * downPaymentPct + homePrice * closingRate;
}

export function monthsToAfford(input: {
  currentSavings: number;
  monthlySavings: number;
  target: number;
  startDate: string;
  plannedExpenses: SavingsConfig['plannedExpenses'];
  recurringExpenses: SavingsConfig['recurringExpenses'];
}) {
  let balance = input.currentSavings;
  const [year, monthNumber] = input.startDate.split('-').map(Number);

  for (let index = 0; index <= 600; index += 1) {
    const date = new Date(year, monthNumber - 1 + index, 1);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (index > 0) {
      balance += input.monthlySavings - recurringForMonth(input.recurringExpenses, month);
    }

    for (const expense of input.plannedExpenses) {
      if (expense.date.slice(0, 7) === month) balance -= expense.amount;
    }

    if (balance >= input.target) return index;
  }

  return null;
}

export function dateAfterMonths(startDate: string, count: number) {
  const [year, monthNumber, day] = startDate.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + count, day || 1);

  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function homeGoalForecast(input: {
  transactions: MobileTransaction[];
  savings: SavingsConfig;
  homePrice?: number;
  downPaymentPct?: number;
}) {
  const homePrice = input.homePrice ?? input.savings.homePriceTargetDefault;
  const downPaymentPct = input.downPaymentPct ?? input.savings.downPaymentPctDefault;
  const monthlySavingsPace = ewmaMonthlySavings(input.transactions);
  const months = uniqueMonths(input.transactions);
  const startMonth = months[months.length - 1] ?? input.savings.asOfDate.slice(0, 7);
  const budgetedMonthly = input.savings.monthlySavingsTarget;
  const currentProjection = projectSavings({
    startBalance: input.savings.currentSavings,
    startDate: input.savings.asOfDate,
    months: 240,
    budgetedMonthly,
    actualMonthly: monthlySavingsPace,
    plannedExpenses: input.savings.plannedExpenses,
    recurringExpenses: input.savings.recurringExpenses,
    apyMonthly: input.savings.savingsApy / 12,
  });
  const currentSavings =
    currentProjection.find((point) => point.month === startMonth)?.actual ??
    input.savings.currentSavings;
  const downPayment = homePrice * downPaymentPct;
  const closingCosts = homePrice * input.savings.mortgage.closingCostRate;
  const target = cashNeeded(homePrice, downPaymentPct, input.savings.mortgage.closingCostRate);
  const monthsToGoal = monthsToAfford({
    currentSavings,
    monthlySavings: monthlySavingsPace,
    target,
    startDate: `${startMonth}-01`,
    plannedExpenses: input.savings.plannedExpenses,
    recurringExpenses: input.savings.recurringExpenses,
  });

  return {
    currentSavings,
    cashNeeded: target,
    downPayment,
    closingCosts,
    monthlyPayment: monthlyMortgagePayment(homePrice, downPaymentPct, input.savings.mortgage),
    monthlySavingsPace,
    monthsToGoal,
    targetDateLabel:
      monthsToGoal === null ? 'Needs more savings pace' : dateAfterMonths(`${startMonth}-01`, monthsToGoal),
    progress: target > 0 ? Math.min(currentSavings / target, 1) : 0,
  } satisfies GoalForecast;
}
