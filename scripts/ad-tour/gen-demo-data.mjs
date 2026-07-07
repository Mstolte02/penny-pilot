#!/usr/bin/env node
// Generates believable demo finance data for the Penny Pilot browser demo profile.
// Categories/subcategories match src/data/personal-finance-template.ts match rules so
// seeded plan lines pick the history up automatically.

let seed = 42;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const between = (lo, hi) => lo + rand() * (hi - lo);
const pad = (n) => String(n).padStart(2, '0');

const NOW = new Date('2026-07-05T12:00:00');
const months = [];
for (let i = 6; i >= 0; i--) {
  const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1);
  months.push({ ym: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, days: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() });
}

const transactions = [];
let n = 0;
const add = (ym, day, item, amount, category, subcategory, type = 'expense') => {
  const date = `${ym}-${pad(day)}`;
  if (date > '2026-07-05') return; // current month is partial
  n += 1;
  const value = Math.round(amount * 100) / 100;
  transactions.push({
    id: `demo-${n}`,
    date,
    item,
    moneyIn: type === 'income' ? value : 0,
    moneyOut: type === 'expense' ? value : 0,
    amount: type === 'income' ? value : -value,
    category,
    subcategory,
    type,
    source: 'import',
  });
};

const weekendDay = (ym, days) => {
  // pick a Saturday/Sunday in the month
  for (let attempt = 0; attempt < 20; attempt++) {
    const day = Math.ceil(between(1, days));
    const dow = new Date(`${ym}-${pad(day)}T12:00:00`).getDay();
    if (dow === 0 || dow === 6) return day;
  }
  return 6;
};

for (const { ym, days } of months) {
  // Income
  add(ym, 1, 'ACME CO PAYROLL', 1950, 'Income', null, 'income');
  add(ym, 15, 'ACME CO PAYROLL', 1950, 'Income', null, 'income');
  add(ym, 5, 'NORTHWIND LLC PAYROLL', 1500, 'Income', null, 'income');

  // Fixed essentials
  add(ym, 1, 'Rent', 1498, 'Essentials', 'Rent');
  add(ym, 7, 'City Power & Light', between(98, 132), 'Essentials', 'Electricity');
  add(ym, 9, 'City Water Utility', 30, 'Essentials', 'Water');
  add(ym, 12, 'Fiber Internet', 65, 'Essentials', 'Internet');
  add(ym, 3, 'Auto Insurance Co', 155, 'Essentials', 'Auto Insurance');
  add(ym, 18, 'Mint Mobile', 20, 'Essentials', 'Phone');

  // Gas 3x
  for (let i = 0; i < 3; i++) {
    add(ym, Math.ceil(between(2, days - 1)), 'SHELL OIL', between(36, 58), 'Essentials', 'Transportation: Gas');
  }

  // Groceries 6x
  for (let i = 0; i < 6; i++) {
    add(ym, Math.ceil(between(1, days)), i % 2 ? 'KROGER' : "TRADER JOE'S", between(42, 128), 'Food', 'Groceries');
  }

  // Dining out — weekends heavier
  for (let i = 0; i < 3; i++) {
    add(ym, weekendDay(ym, days), ['LOCAL THAI KITCHEN', 'EL CAMINO TACOS', 'BRICK OVEN PIZZA'][i % 3], between(34, 78), 'Food', 'Dining Out');
  }
  for (let i = 0; i < 2; i++) {
    add(ym, Math.ceil(between(2, days - 2)), 'CHIPOTLE', between(14, 24), 'Food', 'Dining Out');
  }

  // Coffee 8x
  for (let i = 0; i < 8; i++) {
    add(ym, Math.ceil(between(1, days)), 'BLUE BOTTLE COFFEE', between(4.5, 8.5), 'Food', 'Snacks');
  }

  // Subscriptions
  add(ym, 3, 'NETFLIX.COM', 15.49, 'Subscriptions & Fun', 'Streaming');
  add(ym, 6, 'Spotify USA', 11.99, 'Subscriptions & Fun', 'Streaming');
  add(ym, 4, 'Planet Fitness', 18, 'Subscriptions & Fun', 'Memberships');

  // Fun money — weekend heavy
  for (let i = 0; i < 3; i++) {
    add(ym, weekendDay(ym, days), ['STEAM GAMES', 'AMC THEATRES', 'BOOKSHOP.ORG'][i % 3], between(18, 72), 'Subscriptions & Fun', 'Fun Money');
  }

  // Daily living
  add(ym, Math.ceil(between(3, days)), 'TARGET', between(18, 52), 'Daily Living', 'Household Consumables');
  add(ym, Math.ceil(between(3, days)), 'TARGET', between(12, 38), 'Daily Living', 'Household Consumables');

  // Debt
  add(ym, 21, 'Dept of Education Loan', 299, 'Debt', 'Student Loans');

  // Health occasionally
  if (rand() > 0.5) add(ym, Math.ceil(between(5, days)), 'CVS PHARMACY', between(18, 60), 'Health', 'Medical / Rx');
}

const goals = [
  {
    id: 'goal-house',
    name: 'House down payment',
    target: 30000,
    current: 12450,
    monthlyTarget: 400,
    mode: 'track',
    targetDate: '2029-06',
  },
];

process.stdout.write(
  JSON.stringify({
    'penny:db:transactions': transactions,
    'penny:db:goals': goals,
    'penny:setupComplete': 'true',
  })
);
