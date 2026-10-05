import type { PlanLine, StoredTransaction } from '@/services/finance-store';

/**
 * Bank feed: turns the rows Plaid synced to the server into the phone's own
 * transactions, categorized against the user's budget lines.
 *
 * Category order, strongest first:
 *   1. the user's own choice for this transaction (kept across every re-sync),
 *   2. a category the user approved on the server review queue,
 *   3. what the user picked before for the same merchant,
 *   4. Plaid's personal finance category, mapped onto a budget line by name,
 *   5. otherwise "Uncategorized", which puts it on the review radar.
 * Transfers between the user's own accounts and card payments never count as spending.
 */

export type BankFeedRow = {
  id: string;
  date: string;
  merchantName: string;
  originalDescription: string;
  amount: number;
  kind: 'income' | 'expense' | 'transfer';
  pending: boolean;
  excludedFromBudget: boolean;
  serverCategory: string | null;
  serverSubcategory: string | null;
  pfcPrimary: string | null;
  pfcDetailed: string | null;
  pfcConfidence: string | null;
};

export type CategorySource = 'user' | 'server' | 'history' | 'plaid' | 'none';

export type BankTransaction = StoredTransaction & {
  source: 'bank';
  categorySource: CategorySource;
};

export const BANK_ID_PREFIX = 'bank-';

type Choice = { category: string; subcategory: string | null };

/** Keyword hints per Plaid category, most specific first. Line names win over sections. */
const PFC_HINTS: Record<string, { lines: string[]; sections: string[] }> = {
  FOOD_AND_DRINK_GROCERIES: { lines: ['grocer'], sections: ['food'] },
  FOOD_AND_DRINK_FAST_FOOD: { lines: ['dining', 'restaurant', 'eating out', 'fast food', 'takeout'], sections: ['food', 'dining'] },
  FOOD_AND_DRINK_RESTAURANT: { lines: ['dining', 'restaurant', 'eating out'], sections: ['food', 'dining'] },
  FOOD_AND_DRINK_COFFEE: { lines: ['coffee', 'snack', 'dining'], sections: ['food'] },
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: { lines: ['alcohol', 'liquor', 'dining', 'fun'], sections: ['food', 'fun'] },
  FOOD_AND_DRINK_VENDING_MACHINES: { lines: ['snack', 'coffee'], sections: ['food'] },
  FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK: { lines: ['dining', 'snack', 'grocer'], sections: ['food'] },
  RENT_AND_UTILITIES_RENT: { lines: ['rent', 'mortgage', 'housing'], sections: ['housing', 'essentials', 'home'] },
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: { lines: ['electric', 'utilit', 'power', 'energy'], sections: ['housing', 'utilit', 'essentials'] },
  RENT_AND_UTILITIES_WATER: { lines: ['water', 'utilit'], sections: ['housing', 'utilit', 'essentials'] },
  RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: { lines: ['trash', 'waste', 'sewer', 'utilit'], sections: ['housing', 'utilit', 'essentials'] },
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: { lines: ['internet', 'wifi', 'cable'], sections: ['housing', 'utilit', 'essentials'] },
  RENT_AND_UTILITIES_TELEPHONE: { lines: ['phone', 'cell', 'mobile'], sections: ['utilit', 'essentials'] },
  RENT_AND_UTILITIES_OTHER_UTILITIES: { lines: ['utilit'], sections: ['housing', 'utilit', 'essentials'] },
  TRANSPORTATION_GAS: { lines: ['gas', 'fuel'], sections: ['transport', 'auto', 'car', 'essentials'] },
  TRANSPORTATION_PARKING: { lines: ['parking'], sections: ['transport', 'auto', 'car'] },
  TRANSPORTATION_PUBLIC_TRANSIT: { lines: ['transit', 'bus', 'train'], sections: ['transport'] },
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: { lines: ['ride', 'uber', 'lyft', 'taxi'], sections: ['transport'] },
  TRANSPORTATION_TOLLS: { lines: ['toll'], sections: ['transport', 'auto', 'car'] },
  TRANSPORTATION_OTHER_TRANSPORTATION: { lines: ['transport'], sections: ['transport', 'auto', 'car'] },
  GENERAL_SERVICES_AUTOMOTIVE: { lines: ['maintenance', 'repair', 'auto service'], sections: ['transport', 'auto', 'car', 'essentials'] },
  GENERAL_SERVICES_INSURANCE: { lines: ['insurance'], sections: ['insurance', 'essentials', 'housing', 'transport'] },
  GENERAL_SERVICES_CHILDCARE: { lines: ['childcare', 'daycare', 'kids'], sections: ['kids', 'family'] },
  GENERAL_SERVICES_EDUCATION: { lines: ['education', 'tuition', 'school'], sections: ['education'] },
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: { lines: ['cloth', 'apparel'], sections: ['daily', 'shopping', 'personal'] },
  GENERAL_MERCHANDISE_SUPERSTORES: { lines: ['household', 'consumable', 'shopping', 'grocer'], sections: ['daily', 'shopping', 'food'] },
  GENERAL_MERCHANDISE_DISCOUNT_STORES: { lines: ['household', 'consumable', 'shopping'], sections: ['daily', 'shopping'] },
  GENERAL_MERCHANDISE_CONVENIENCE_STORES: { lines: ['snack', 'convenience', 'household'], sections: ['food', 'daily'] },
  GENERAL_MERCHANDISE_ONLINE_MARKETPLACES: { lines: ['household', 'shopping', 'online'], sections: ['daily', 'shopping'] },
  GENERAL_MERCHANDISE_PET_SUPPLIES: { lines: ['pet'], sections: ['pet'] },
  GENERAL_MERCHANDISE_OFFICE_SUPPLIES: { lines: ['office', 'household'], sections: ['daily', 'shopping'] },
  GENERAL_MERCHANDISE_ELECTRONICS: { lines: ['electronic', 'tech', 'shopping'], sections: ['shopping', 'fun'] },
  GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES: { lines: ['gift'], sections: ['giving', 'gift', 'fun'] },
  HOME_IMPROVEMENT_FURNITURE: { lines: ['furnish', 'furniture', 'home'], sections: ['home'] },
  HOME_IMPROVEMENT_HARDWARE: { lines: ['home', 'repair', 'maintenance'], sections: ['home', 'housing'] },
  HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE: { lines: ['repair', 'maintenance', 'home'], sections: ['home', 'housing'] },
  MEDICAL_PHARMACIES_AND_SUPPLEMENTS: { lines: ['rx', 'pharm', 'medical'], sections: ['health', 'medical'] },
  MEDICAL_PRIMARY_CARE: { lines: ['medical', 'doctor', 'health'], sections: ['health', 'medical'] },
  MEDICAL_DENTAL_CARE: { lines: ['dental', 'medical'], sections: ['health', 'medical'] },
  MEDICAL_EYE_CARE: { lines: ['eye', 'vision', 'medical'], sections: ['health', 'medical'] },
  PERSONAL_CARE_HAIR_AND_BEAUTY: { lines: ['hair', 'appearance', 'beauty'], sections: ['daily', 'personal'] },
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: { lines: ['gym', 'fitness', 'membership'], sections: ['subscription', 'health', 'fun'] },
  PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING: { lines: ['laundry', 'household'], sections: ['daily'] },
  ENTERTAINMENT_TV_AND_MOVIES: { lines: ['streaming', 'movie', 'tv'], sections: ['subscription', 'fun', 'entertainment'] },
  ENTERTAINMENT_MUSIC_AND_AUDIO: { lines: ['streaming', 'music'], sections: ['subscription', 'fun', 'entertainment'] },
  ENTERTAINMENT_VIDEO_GAMES: { lines: ['game', 'fun'], sections: ['fun', 'entertainment', 'subscription'] },
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS: { lines: ['fun', 'entertainment', 'event'], sections: ['fun', 'entertainment'] },
  ENTERTAINMENT_CASINOS_AND_GAMBLING: { lines: ['fun'], sections: ['fun', 'entertainment'] },
  LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT: { lines: ['student'], sections: ['debt', 'loan'] },
  LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT: { lines: ['personal loan', 'loan'], sections: ['debt', 'loan'] },
  LOAN_PAYMENTS_CAR_PAYMENT: { lines: ['car payment', 'auto loan', 'car loan'], sections: ['debt', 'transport', 'auto'] },
  LOAN_PAYMENTS_MORTGAGE_PAYMENT: { lines: ['mortgage', 'rent'], sections: ['housing', 'essentials'] },
  GOVERNMENT_AND_NON_PROFIT_DONATIONS: { lines: ['giving', 'donation', 'charity', 'tithe'], sections: ['giving'] },
  GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT: { lines: ['tax'], sections: ['tax'] },
};

const PRIMARY_HINTS: Record<string, { lines: string[]; sections: string[] }> = {
  FOOD_AND_DRINK: { lines: ['dining', 'grocer'], sections: ['food'] },
  RENT_AND_UTILITIES: { lines: ['utilit', 'rent'], sections: ['housing', 'utilit', 'essentials'] },
  TRANSPORTATION: { lines: ['gas', 'transport'], sections: ['transport', 'auto', 'car'] },
  GENERAL_MERCHANDISE: { lines: ['household', 'shopping'], sections: ['daily', 'shopping'] },
  HOME_IMPROVEMENT: { lines: ['home', 'furnish'], sections: ['home'] },
  MEDICAL: { lines: ['medical', 'rx', 'health'], sections: ['health', 'medical'] },
  PERSONAL_CARE: { lines: ['appearance', 'hair', 'personal'], sections: ['daily', 'personal'] },
  ENTERTAINMENT: { lines: ['fun', 'streaming', 'entertainment'], sections: ['fun', 'entertainment', 'subscription'] },
  TRAVEL: { lines: ['travel', 'vacation', 'trip'], sections: ['travel', 'fun'] },
  LOAN_PAYMENTS: { lines: ['loan'], sections: ['debt'] },
  GENERAL_SERVICES: { lines: ['service'], sections: ['essentials'] },
  GOVERNMENT_AND_NON_PROFIT: { lines: ['giving', 'tax'], sections: ['giving'] },
};

const TRANSFER_PRIMARIES = new Set(['TRANSFER_IN', 'TRANSFER_OUT', 'BANK_FEES_TRANSFER']);
const TRANSFER_DETAILED = new Set([
  'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT',
  'TRANSFER_IN_ACCOUNT_TRANSFER',
  'TRANSFER_OUT_ACCOUNT_TRANSFER',
  'TRANSFER_IN_SAVINGS',
  'TRANSFER_OUT_SAVINGS',
  'TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS',
  'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS',
]);

const lower = (value: string) => value.toLowerCase();

/** The [category, subcategory] pair a budget line counts transactions under. */
function lineTarget(line: PlanLine): Choice {
  const match = line.match?.[0];
  return match
    ? { category: match[0], subcategory: match[1] }
    : { category: line.section, subcategory: line.name };
}

/** Finds the budget line Plaid's category belongs to, by keyword on the user's own line names. */
export function lineForPlaidCategory(
  detailed: string | null,
  primary: string | null,
  planLines: PlanLine[]
): Choice | null {
  const hints = (detailed && PFC_HINTS[detailed]) || (primary && PRIMARY_HINTS[primary]);
  if (!hints || planLines.length === 0) return null;

  for (const keyword of hints.lines) {
    const line = planLines.find((candidate) => lower(candidate.name).includes(keyword));
    if (line) return lineTarget(line);
  }
  for (const keyword of hints.sections) {
    const sectionLines = planLines.filter((candidate) => lower(candidate.section).includes(keyword));
    if (sectionLines.length > 0) {
      const flexible = sectionLines.find((candidate) => candidate.type === 'flexible');
      return lineTarget(flexible ?? sectionLines[0]);
    }
  }
  return null;
}

/** Maps a category the user approved on the server onto the matching budget line. */
function lineForServerCategory(
  category: string | null,
  subcategory: string | null,
  planLines: PlanLine[]
): Choice | null {
  if (!category) return null;
  const sub = subcategory ? lower(subcategory) : null;
  const cat = lower(category);
  const byName =
    (sub && planLines.find((line) => lower(line.name) === sub)) ||
    (sub && planLines.find((line) => lower(line.name).includes(sub) || sub.includes(lower(line.name))));
  if (byName) return lineTarget(byName);
  const bySection = planLines.find((line) => lower(line.section) === cat);
  if (bySection) return lineTarget(bySection);
  return { category, subcategory };
}

export function isTransferRow(row: BankFeedRow) {
  return (
    row.kind === 'transfer' ||
    row.excludedFromBudget ||
    (row.pfcDetailed !== null && TRANSFER_DETAILED.has(row.pfcDetailed)) ||
    (row.pfcPrimary !== null && TRANSFER_PRIMARIES.has(row.pfcPrimary))
  );
}

/**
 * Rebuilds the bank rows of the local store from the server feed. Rows the user
 * categorized keep that category; everything else is recategorized from scratch so
 * a new merchant choice or a better Plaid category flows through on the next sync.
 */
export function buildBankTransactions(
  rows: BankFeedRow[],
  existing: StoredTransaction[],
  planLines: PlanLine[],
  merchantChoice: (merchant: string) => Choice | null
): BankTransaction[] {
  const previous = new Map(
    existing
      .filter((transaction) => transaction.source === 'bank')
      .map((transaction) => [transaction.id, transaction as BankTransaction])
  );

  return rows
    .filter((row) => !row.pending)
    .map((row) => {
      const id = `${BANK_ID_PREFIX}${row.id}`;
      const kept = previous.get(id);
      const keptByUser = kept?.categorySource === 'user';
      // The user's call on transfer / income / spending wins over Plaid's.
      const transfer = keptByUser ? kept.type === 'transfer' : isTransferRow(row);
      const income = keptByUser ? kept.type === 'income' : !transfer && row.kind === 'income';
      const type = transfer ? 'transfer' : income ? 'income' : 'expense';
      const amount = Math.abs(row.amount);

      let choice: Choice = { category: 'Uncategorized', subcategory: null };
      let categorySource: CategorySource = 'none';

      if (keptByUser) {
        choice = { category: kept.category, subcategory: kept.subcategory };
        categorySource = 'user';
      } else if (transfer) {
        choice = { category: 'Transfers', subcategory: 'Transfers' };
        categorySource = 'plaid';
      } else if (income) {
        choice = { category: 'Income', subcategory: null };
        categorySource = 'plaid';
      } else {
        const server = lineForServerCategory(row.serverCategory, row.serverSubcategory, planLines);
        const history = server ? null : merchantChoice(row.merchantName);
        const plaid =
          server || history ? null : lineForPlaidCategory(row.pfcDetailed, row.pfcPrimary, planLines);
        if (server) {
          choice = server;
          categorySource = 'server';
        } else if (history) {
          choice = history;
          categorySource = 'history';
        } else if (plaid) {
          choice = plaid;
          categorySource = 'plaid';
        }
      }

      // Direction comes from the server's sign-based kind, so a transfer keeps it too.
      const outflow = row.kind !== 'income';

      return {
        id,
        date: row.date,
        item: row.merchantName || row.originalDescription,
        moneyIn: outflow ? 0 : amount,
        moneyOut: outflow ? amount : 0,
        amount: outflow ? -amount : amount,
        category: choice.category,
        subcategory: choice.subcategory,
        type,
        source: 'bank' as const,
        categorySource,
      };
    });
}
