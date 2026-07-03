import type { StoredTransaction } from '@/services/finance-store';

/**
 * Client-side bank-export parsing: the privacy path. Handles the flexible column
 * names banks actually use (Date/Transaction Date, Description/Merchant/Payee,
 * Amount or Debit+Credit pairs) and never sends a byte anywhere.
 */

export type ImportPreview = {
  transactions: StoredTransaction[];
  total: number;
  duplicates: number;
  uncategorized: number;
  dateRange: { from: string; to: string } | null;
  warnings: string[];
};

/** RFC-4180-ish CSV parsing: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      field = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim() !== '')) rows.push(row);

  return rows;
}

type ColumnMap = {
  date: number;
  description: number;
  amount?: number;
  debit?: number;
  credit?: number;
};

const DATE_HEADERS = /^(date|transaction date|trans\.? date|posted date|post date|posting date)$/i;
const DESCRIPTION_HEADERS = /^(description|merchant|merchant name|name|payee|details|memo)$/i;
const AMOUNT_HEADERS = /^(amount|transaction amount)$/i;
const DEBIT_HEADERS = /^(debit|money out|withdrawal|withdrawals|outflow|spent)$/i;
const CREDIT_HEADERS = /^(credit|money in|deposit|deposits|inflow|received)$/i;

function mapColumns(header: string[]): ColumnMap | null {
  const find = (pattern: RegExp) =>
    header.findIndex((column) => pattern.test(column.trim()));

  const date = find(DATE_HEADERS);
  const description = find(DESCRIPTION_HEADERS);
  const amount = find(AMOUNT_HEADERS);
  const debit = find(DEBIT_HEADERS);
  const credit = find(CREDIT_HEADERS);

  if (date === -1 || description === -1) return null;
  if (amount === -1 && debit === -1 && credit === -1) return null;

  return {
    date,
    description,
    amount: amount === -1 ? undefined : amount,
    debit: debit === -1 ? undefined : debit,
    credit: credit === -1 ? undefined : credit,
  };
}

/** Normalizes common bank date formats to YYYY-MM-DD; returns null when unreadable. */
function normalizeDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }

  const us = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (us) {
    const year = us[3].length === 2 ? `20${us[3]}` : us[3];
    return `${year}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(
      parsed.getDate()
    ).padStart(2, '0')}`;
  }

  return null;
}

function parseMoney(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  const negativeParens = /^\(.*\)$/.test(value);
  const cleaned = value.replace(/[()$,\s]/g, '');
  if (!cleaned || cleaned === '-') return null;
  const parsed = Number(cleaned);
  if (Number.isNaN(parsed)) return null;
  return negativeParens ? -Math.abs(parsed) : parsed;
}

/** Stable id from row content so re-importing the same file skips duplicates. */
function rowId(date: string, item: string, amount: number, occurrence: number) {
  const raw = `${date}|${item.toLowerCase()}|${amount.toFixed(2)}|${occurrence}`;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) | 0;
  }
  return `import-${Math.abs(hash).toString(36)}`;
}

export function buildImportPreview(
  csvText: string,
  existing: StoredTransaction[],
  guessCategory: (item: string) => { category: string; subcategory: string | null } | null
): ImportPreview | { error: string } {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return { error: 'That file looks empty — it needs a header row plus at least one transaction.' };
  }

  const columns = mapColumns(rows[0]);
  if (!columns) {
    return {
      error:
        'Could not find the expected columns. Penny looks for a date, a description/merchant, and either an amount or debit/credit columns.',
    };
  }

  const existingIds = new Set(existing.map((transaction) => transaction.id));
  const warnings: string[] = [];
  const transactions: StoredTransaction[] = [];
  const occurrences = new Map<string, number>();
  let duplicates = 0;
  let uncategorized = 0;
  let skippedRows = 0;

  for (const row of rows.slice(1)) {
    const date = normalizeDate(row[columns.date] ?? '');
    const item = (row[columns.description] ?? '').trim();
    if (!date || !item) {
      skippedRows += 1;
      continue;
    }

    // Single amount column: negative = money out (the most common convention,
    // parentheses treated as negative). Debit/credit pairs are unambiguous.
    let signedAmount: number | null = null;
    if (columns.amount !== undefined) {
      signedAmount = parseMoney(row[columns.amount] ?? '');
    } else {
      const debit = columns.debit !== undefined ? parseMoney(row[columns.debit] ?? '') : null;
      const credit = columns.credit !== undefined ? parseMoney(row[columns.credit] ?? '') : null;
      if (debit !== null && debit !== 0) signedAmount = -Math.abs(debit);
      else if (credit !== null && credit !== 0) signedAmount = Math.abs(credit);
    }
    if (signedAmount === null || signedAmount === 0) {
      skippedRows += 1;
      continue;
    }

    const occurrenceKey = `${date}|${item.toLowerCase()}|${signedAmount.toFixed(2)}`;
    const occurrence = occurrences.get(occurrenceKey) ?? 0;
    occurrences.set(occurrenceKey, occurrence + 1);
    const id = rowId(date, item, signedAmount, occurrence);

    if (existingIds.has(id)) {
      duplicates += 1;
      continue;
    }

    const isExpense = signedAmount < 0;
    const guess = isExpense ? guessCategory(item) : null;
    if (isExpense && !guess) uncategorized += 1;

    transactions.push({
      id,
      date,
      item,
      moneyIn: isExpense ? 0 : signedAmount,
      moneyOut: isExpense ? Math.abs(signedAmount) : 0,
      amount: signedAmount,
      category: isExpense ? (guess?.category ?? 'Uncategorized') : 'Income',
      subcategory: isExpense ? (guess?.subcategory ?? null) : null,
      type: isExpense ? 'expense' : 'income',
      source: 'import',
    });
  }

  if (skippedRows > 0) {
    warnings.push(`${skippedRows} ${skippedRows === 1 ? 'row' : 'rows'} skipped (unreadable date or amount).`);
  }

  const dates = transactions.map((transaction) => transaction.date).sort();

  return {
    transactions,
    total: transactions.length,
    duplicates,
    uncategorized,
    dateRange: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
    warnings,
  };
}
