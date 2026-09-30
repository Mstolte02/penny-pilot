import {
  formatMoney,
  mean,
  monthKey,
  monthlyIncome,
  monthlySpend,
  uniqueMonths,
  type MobileTransaction,
} from '@/domain/mobile-finance';

export type PennyExpression =
  | 'default'
  | 'happy'
  | 'onTrack'
  | 'thinking'
  | 'concerned'
  | 'celebrating';

export type PennyInsight = {
  id: string;
  /** Which face Penny makes while saying it. */
  expression: PennyExpression;
  /** Higher surfaces first. Ties keep generator order. */
  priority: number;
  /** The one-liner Penny says. */
  headline: string;
  /** A second sentence of grounding — where the number came from, or what to do. */
  detail: string;
};

type GoalLike = {
  name: string;
  target: number;
  current: number;
  monthlyTarget: number;
};

type InsightInput = {
  transactions: MobileTransaction[];
  goals: GoalLike[];
  /** Total flexible budget for the current month and what's been spent against it. */
  flexBudget: number;
  flexSpent: number;
  now?: Date;
};

const CREEP_EXCLUDED = new Set(['Income', 'Transfers', 'Uncategorized']);

function currentMonthKey(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function expensesIn(transactions: MobileTransaction[], month: string) {
  return transactions.filter(
    (transaction) => transaction.type === 'expense' && monthKey(transaction.date) === month
  );
}

/** Average monthly spend per category over the given prior months (excluding `month`). */
function categoryBaselines(
  transactions: MobileTransaction[],
  month: string,
  windowMonths: number
) {
  const months = uniqueMonths(transactions)
    .filter((m) => m < month)
    .slice(-windowMonths);
  if (months.length === 0) return { months: 0, byCategory: new Map<string, number>() };

  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    if (CREEP_EXCLUDED.has(transaction.category)) continue;
    const m = monthKey(transaction.date);
    if (!months.includes(m)) continue;
    totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + transaction.moneyOut);
  }
  const byCategory = new Map<string, number>();
  for (const [category, total] of totals) byCategory.set(category, total / months.length);
  return { months: months.length, byCategory };
}

/**
 * Category pace: this month's spend in each category, scaled to a full-month run rate,
 * compared with the user's own recent baseline. Flags the biggest mover in dollars.
 */
function categoryPaceInsight(input: InsightInput, now: Date): PennyInsight | null {
  const month = currentMonthKey(now);
  const dayOfMonth = now.getDate();
  if (dayOfMonth < 7) return null; // too early in the month to project a run rate honestly

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsed = dayOfMonth / daysInMonth;
  const { months, byCategory } = categoryBaselines(input.transactions, month, 6);
  if (months < 2) return null;

  const spentNow = new Map<string, number>();
  for (const transaction of expensesIn(input.transactions, month)) {
    if (CREEP_EXCLUDED.has(transaction.category)) continue;
    spentNow.set(
      transaction.category,
      (spentNow.get(transaction.category) ?? 0) + transaction.moneyOut
    );
  }

  let best: { category: string; projected: number; usual: number } | null = null;
  for (const [category, usual] of byCategory) {
    if (usual < 80) continue; // tiny categories produce noisy, unhelpful callouts
    const projected = (spentNow.get(category) ?? 0) / elapsed;
    const delta = projected - usual;
    if (!best || Math.abs(delta) > Math.abs(best.projected - best.usual)) {
      best = { category, projected, usual };
    }
  }
  if (!best) return null;

  const delta = best.projected - best.usual;
  if (Math.abs(delta) < Math.max(40, best.usual * 0.15)) {
    return {
      id: 'category-pace-steady',
      expression: 'onTrack',
      priority: 30,
      headline: `Every category is within 15% of your usual pace. Steady flying.`,
      detail: `Compared against your average month over the last ${months} months.`,
    };
  }
  if (delta > 0) {
    return {
      id: 'category-pace-over',
      expression: 'thinking',
      priority: 80,
      headline: `${best.category} is pacing toward ${formatMoney(best.projected)} this month, about ${formatMoney(delta)} over your usual.`,
      detail: `Your last ${months} months averaged ${formatMoney(best.usual)}. Mid-month is still early enough to fix it.`,
    };
  }
  return {
    id: 'category-pace-under',
    expression: 'happy',
    priority: 55,
    headline: `${best.category} is pacing ${formatMoney(Math.abs(delta))} under your usual month.`,
    detail: `If the pace holds, that's ${formatMoney(Math.abs(delta))} you could put toward a goal.`,
  };
}

/** Savings rate this month vs the user's own recent norm. */
function savingsRateInsight(input: InsightInput, now: Date): PennyInsight | null {
  const spendRows = monthlySpend(input.transactions);
  const spendFor = (m: string) => spendRows.find((row) => row.month === m)?.total ?? 0;
  const incomeByMonth = monthlyIncome(input.transactions);
  const month = currentMonthKey(now);
  const priorMonths = uniqueMonths(input.transactions)
    .filter((m) => m < month)
    .slice(-6);
  if (priorMonths.length < 3) return null;

  const rates = priorMonths
    .map((m) => {
      const income = incomeByMonth[m] ?? 0;
      return income > 0 ? (income - spendFor(m)) / income : null;
    })
    .filter((rate): rate is number => rate !== null);
  if (rates.length < 3) return null;

  const typical = mean(rates);
  const lastMonth = priorMonths[priorMonths.length - 1];
  const lastIncome = incomeByMonth[lastMonth] ?? 0;
  const lastSpend = spendFor(lastMonth);
  if (lastIncome <= 0) return null;
  const lastRate = (lastIncome - lastSpend) / lastIncome;

  const pct = (value: number) => `${Math.round(value * 100)}%`;
  if (lastRate >= typical + 0.05) {
    return {
      id: 'savings-rate-up',
      expression: 'celebrating',
      priority: 70,
      headline: `Last month you kept ${pct(lastRate)} of your income, above your usual ${pct(typical)}.`,
      detail: `Nice work. The Logbook tab shows which categories made room.`,
    };
  }
  if (lastRate <= typical - 0.05) {
    return {
      id: 'savings-rate-down',
      expression: 'thinking',
      priority: 65,
      headline: `Last month ${pct(Math.max(0, lastRate))} of income stayed with you, under your usual ${pct(typical)}.`,
      detail: `One month is just weather. If it happens twice in a row, check the Logbook.`,
    };
  }
  return {
    id: 'savings-rate-steady',
    expression: 'onTrack',
    priority: 35,
    headline: `You're keeping about ${pct(typical)} of your income month over month.`,
    detail: `A steady rate beats one big month followed by a slide.`,
  };
}

/** No-spend days this month — a small, real win users don't notice on their own. */
function noSpendInsight(input: InsightInput, now: Date): PennyInsight | null {
  const month = currentMonthKey(now);
  const expenses = expensesIn(input.transactions, month);
  const dayOfMonth = now.getDate();
  if (dayOfMonth < 5) return null;
  // No activity at all this month means we can't distinguish "spent nothing" from
  // "hasn't imported yet" — say nothing rather than something flattering and false.
  if (expenses.length === 0) return null;

  const daysWithSpend = new Set(expenses.map((transaction) => transaction.date.slice(8, 10)));
  const noSpendDays = dayOfMonth - daysWithSpend.size;
  if (noSpendDays < 3) return null;

  return {
    id: 'no-spend-days',
    expression: 'happy',
    priority: 45,
    headline: `${noSpendDays} no-spend ${noSpendDays === 1 ? 'day' : 'days'} so far this month.`,
    detail: `Days when nothing left your accounts. Quiet, but they add up.`,
  };
}

/** Biggest single merchant this month, with share of flexible spending. */
function topMerchantInsight(input: InsightInput, now: Date): PennyInsight | null {
  const month = currentMonthKey(now);
  const expenses = expensesIn(input.transactions, month).filter(
    (transaction) => !CREEP_EXCLUDED.has(transaction.category)
  );
  if (expenses.length < 5) return null;

  const byMerchant = new Map<string, { total: number; count: number }>();
  for (const transaction of expenses) {
    const entry = byMerchant.get(transaction.item) ?? { total: 0, count: 0 };
    entry.total += transaction.moneyOut;
    entry.count += 1;
    byMerchant.set(transaction.item, entry);
  }
  const [top] = [...byMerchant.entries()].sort((a, b) => b[1].total - a[1].total);
  if (!top || top[1].count < 2) return null;

  return {
    id: 'top-merchant',
    expression: 'default',
    priority: 40,
    headline: `${top[0]} has taken ${formatMoney(top[1].total)} across ${top[1].count} visits this month.`,
    detail: `No judgment. Just a number worth knowing before it surprises you.`,
  };
}

/** Goal arithmetic: months to arrival at the planned rate, said concretely. */
function goalInsight(input: InsightInput): PennyInsight | null {
  const goal = input.goals.find((g) => g.target > g.current && g.monthlyTarget > 0);
  if (!goal) return null;

  const remaining = goal.target - goal.current;
  const monthsLeft = Math.ceil(remaining / goal.monthlyTarget);
  const progress = Math.round((goal.current / goal.target) * 100);
  if (monthsLeft <= 1) {
    return {
      id: 'goal-close',
      expression: 'celebrating',
      priority: 85,
      headline: `${goal.name} is one month of saving away. ${formatMoney(remaining)} to go.`,
      detail: `At ${formatMoney(goal.monthlyTarget)}/month, you're on final approach.`,
    };
  }
  return {
    id: 'goal-pace',
    expression: 'onTrack',
    priority: 50,
    headline: `${goal.name}: ${progress}% funded, ${monthsLeft} months out at your current plan.`,
    detail: `Every ${formatMoney(goal.monthlyTarget)} month moves the arrival a full month closer. Skipped months push it back the same way.`,
  };
}

/** Weekend vs weekday burn — a pattern most people have never actually measured. */
function weekendInsight(input: InsightInput, now: Date): PennyInsight | null {
  const months = uniqueMonths(input.transactions).slice(-3);
  if (months.length < 2) return null;

  let weekend = 0;
  let weekday = 0;
  let weekendDays = 0;
  let weekdayDays = 0;
  const seen = new Set<string>();
  for (const transaction of input.transactions) {
    if (transaction.type !== 'expense') continue;
    if (CREEP_EXCLUDED.has(transaction.category)) continue;
    if (!months.includes(monthKey(transaction.date))) continue;
    const day = new Date(`${transaction.date}T12:00:00`).getDay();
    const isWeekend = day === 0 || day === 6;
    if (isWeekend) weekend += transaction.moneyOut;
    else weekday += transaction.moneyOut;
    if (!seen.has(transaction.date)) {
      seen.add(transaction.date);
      if (isWeekend) weekendDays += 1;
      else weekdayDays += 1;
    }
  }
  if (weekendDays < 4 || weekdayDays < 10) return null;

  const weekendPerDay = weekend / weekendDays;
  const weekdayPerDay = weekday / weekdayDays;
  if (weekdayPerDay <= 0) return null;
  const ratio = weekendPerDay / weekdayPerDay;
  if (ratio < 1.4) return null;

  return {
    id: 'weekend-burn',
    expression: 'thinking',
    priority: 42,
    headline: `Your weekend days cost about ${ratio.toFixed(1)}× a weekday (${formatMoney(weekendPerDay)} vs ${formatMoney(weekdayPerDay)}).`,
    detail: `Based on your last ${months.length} months. Planning one meal out per weekend, not three, usually closes most of that gap.`,
  };
}

/** Month budget position — the classic, said with a number instead of a vibe. */
function budgetPositionInsight(input: InsightInput, now: Date): PennyInsight | null {
  if (input.flexBudget <= 0) return null;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsed = now.getDate() / daysInMonth;
  const burn = input.flexSpent / input.flexBudget;
  const daysLeft = daysInMonth - now.getDate() + 1;
  const remaining = Math.max(0, input.flexBudget - input.flexSpent);

  if (burn > 1) {
    return {
      id: 'budget-over',
      expression: 'concerned',
      priority: 95,
      headline: `The flexible budget is spent with ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} still on the clock.`,
      detail: `It happens. Move money from a quieter category on the Plan tab to finish the month.`,
    };
  }
  if (burn > elapsed + 0.08) {
    const cushionPerDay = remaining / daysLeft;
    return {
      id: 'budget-ahead-of-calendar',
      expression: 'thinking',
      priority: 75,
      headline: `Spending is ${Math.round((burn - elapsed) * 100)} points ahead of the calendar. Keep it to ${formatMoney(cushionPerDay)}/day to stay green this month.`,
      detail: `${formatMoney(remaining)} left across ${daysLeft} days. The gauge on this screen updates as you go.`,
    };
  }
  if (elapsed > 0.5 && burn < elapsed - 0.1) {
    return {
      id: 'budget-under',
      expression: 'celebrating',
      priority: 60,
      headline: `You're ${Math.round((elapsed - burn) * 100)} points under the calendar pace with ${formatMoney(remaining)} still in the tank.`,
      detail: `You don't have to spend the rest. Moving even half to a goal is a real win.`,
    };
  }
  return null;
}

const GENERATORS: ((input: InsightInput, now: Date) => PennyInsight | null)[] = [
  budgetPositionInsight,
  categoryPaceInsight,
  (input) => goalInsight(input),
  savingsRateInsight,
  weekendInsight,
  topMerchantInsight,
  noSpendInsight,
];

/**
 * Computes every insight that has enough data behind it, best first. Callers show
 * the top one and let users page through the rest. Everything here is arithmetic
 * on the user's own numbers — no canned filler; a generator that can't say
 * something true and specific says nothing.
 */
export function pennyInsights(input: InsightInput): PennyInsight[] {
  const now = input.now ?? new Date();
  const results: PennyInsight[] = [];
  for (const generate of GENERATORS) {
    const insight = generate(input, now);
    if (insight) results.push(insight);
  }
  return results.sort((a, b) => b.priority - a.priority);
}
