import type { BudgetPlan, MobileTransaction, SavingsConfig } from '@/domain/mobile-finance';

export const mobileBudgetPlan: BudgetPlan = {
  income: [
    { name: 'Primary income', biweekly: 1800, monthly: 3900 },
    { name: 'Partner or secondary income', biweekly: 1390, monthly: 3012 },
  ],
  sections: [
    {
      title: 'Essentials',
      lines: [
        { name: 'Rent', type: 'fixed', monthly: 1498 },
        { name: 'Electricity', type: 'fixed', monthly: 110 },
        { name: 'Water', type: 'fixed', monthly: 30 },
        { name: 'Internet', type: 'fixed', monthly: 65 },
        { name: 'Renters Insurance', type: 'fixed', monthly: 7 },
        { name: 'Gas', type: 'variable', match: [['Essentials', 'Transportation: Gas']] },
        {
          name: 'Maintenance / Repairs',
          type: 'variable',
          match: [['Essentials', 'Transportation: Maintenance/Repairs']],
        },
        { name: 'Auto Insurance', type: 'fixed', monthly: 155 },
        { name: 'Phone', type: 'fixed', monthly: 20 },
      ],
    },
    {
      title: 'Food',
      lines: [
        { name: 'Groceries', type: 'variable', match: [['Food', 'Groceries']] },
        { name: 'Dining Out', type: 'variable', match: [['Food', 'Dining Out']] },
        { name: 'Coffee / Snacks', type: 'variable', match: [['Food', 'Snacks']] },
      ],
    },
    {
      title: 'Debt',
      lines: [
        { name: 'Student Loans', type: 'fixed', monthly: 299 },
        { name: 'Personal Loans', type: 'fixed', monthly: 169 },
        { name: 'Medical Payments', type: 'fixed', monthly: 200 },
      ],
    },
    {
      title: 'Daily Living',
      lines: [
        {
          name: 'Household Consumables',
          type: 'variable',
          match: [['Daily Living', 'Household Consumables']],
        },
        { name: 'Appearance / Hair', type: 'variable', match: [['Daily Living', 'Appearance']] },
        { name: 'Clothing', type: 'variable', match: [['Daily Living', 'Clothing']] },
      ],
    },
    {
      title: 'Subscriptions & Fun',
      lines: [
        { name: 'Fun Money', type: 'fixed', monthly: 560 },
        { name: 'Streaming', type: 'fixed', monthly: 26 },
        { name: 'Memberships', type: 'fixed', monthly: 18 },
      ],
    },
    {
      title: 'Health',
      lines: [{ name: 'Medical / Rx', type: 'fixed', monthly: 500 }],
    },
    {
      title: 'Home',
      lines: [{ name: 'Home Furnishings', type: 'fixed', monthly: 0 }],
    },
  ],
};

export const mobileSavingsConfig: SavingsConfig = {
  currentSavings: 11933,
  asOfDate: '2026-02-07',
  monthlySavingsTarget: 1359,
  plannedExpenses: [{ date: '2026-06-09', description: 'Major planned event', amount: 9028 }],
  recurringExpenses: [],
  allocation: [
    { account: 'Retirement', biweekly: 269, monthly: 538, yearly: 7000, pct: 0.434 },
    { account: 'House Fund', biweekly: 200, monthly: 400, yearly: 5200, pct: 0.3224 },
    { account: 'General Investment', biweekly: 100, monthly: 200, yearly: 2600, pct: 0.1612 },
    { account: 'High-Yield Savings', biweekly: 51, monthly: 102, yearly: 1329, pct: 0.0824 },
  ],
  mortgage: {
    aprDefault: 0.0675,
    termYears: 30,
    propertyTaxRate: 0.011,
    homeInsuranceYearly: 1500,
    closingCostRate: 0.03,
  },
  homePriceTargetDefault: 300000,
  downPaymentPctDefault: 0.1,
  savingsApy: 0.045,
};

const pad = (value: number) => String(value).padStart(2, '0');

function makeIncome(ym: string, day: number, item: string, amount: number, n: number): MobileTransaction {
  return {
    id: `income-${ym}-${n}`,
    date: `${ym}-${pad(day)}`,
    item,
    moneyIn: amount,
    moneyOut: 0,
    amount,
    category: 'Income',
    subcategory: null,
    type: 'income',
  };
}

function makeExpense(
  ym: string,
  day: number,
  item: string,
  amount: number,
  category: string,
  subcategory: string,
  key: string
): MobileTransaction {
  return {
    id: `${key}-${ym}`,
    date: `${ym}-${pad(day)}`,
    item,
    moneyIn: 0,
    moneyOut: amount,
    amount: -amount,
    category,
    subcategory,
    type: 'expense',
  };
}

// 12 months of sample history (Jul 2025 -> Jun 2026) generated deterministically so the
// trend charts have something to say. Multiple subcategories per category set up drill-downs.
function buildMobileTransactions(): MobileTransaction[] {
  const out: MobileTransaction[] = [];

  for (let i = 0; i < 12; i += 1) {
    const date = new Date(2025, 6 + i, 1);
    const ym = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    const wiggle = (baseValue: number, amp: number, phase = 0) =>
      Math.max(0, Math.round(baseValue + Math.sin(i * 0.9 + phase) * amp));

    out.push(makeIncome(ym, 15, 'Primary paycheck', 3900, 1));
    out.push(makeIncome(ym, 15, 'Secondary paycheck', 3012, 2));

    out.push(makeExpense(ym, 1, 'Rent', 1498, 'Essentials', 'Rent', 'rent'));
    // True subscriptions: steady amount, monthly cadence. Cloud storage intentionally
    // has no matching budget line so the "not in current budget" flow has a real case.
    out.push(makeExpense(ym, 3, 'Spotify', 11.99, 'Subscriptions & Fun', 'Streaming', 'spotify'));
    out.push(makeExpense(ym, 5, 'Gym membership', 24, 'Subscriptions & Fun', 'Memberships', 'gym'));
    out.push(makeExpense(ym, 9, 'Cloud storage', 2.99, 'Subscriptions & Fun', 'Software', 'cloud'));
    out.push(makeExpense(ym, 6, 'Grocery store', wiggle(560, 70), 'Food', 'Groceries', 'grocery'));
    out.push(makeExpense(ym, 12, 'Coffee & snacks', wiggle(72, 24, 1), 'Food', 'Snacks', 'snacks'));
    out.push(
      makeExpense(ym, 17, 'Restaurant', wiggle(330 + i * 9, 55, 2), 'Food', 'Dining Out', 'dining')
    );
    out.push(
      makeExpense(ym, 20, 'Gas station', wiggle(190, 42, 3), 'Essentials', 'Transportation: Gas', 'gas')
    );
    out.push(
      makeExpense(
        ym,
        24,
        'Household supplies',
        wiggle(120, 45, 4),
        'Daily Living',
        'Household Consumables',
        'household'
      )
    );

    if (i % 3 === 1) {
      out.push(makeExpense(ym, 26, 'Hair appointment', 96, 'Daily Living', 'Appearance', 'appearance'));
    }
    if (i % 4 === 2) {
      out.push(makeExpense(ym, 27, 'Clothing', wiggle(180, 60, 5), 'Daily Living', 'Clothing', 'clothing'));
    }
    if (i === 8) {
      out.push(
        makeExpense(
          ym,
          14,
          'Car repair',
          640,
          'Essentials',
          'Transportation: Maintenance/Repairs',
          'maintenance'
        )
      );
    }
  }

  return out;
}

export const mobileTransactions: MobileTransaction[] = buildMobileTransactions();
