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

export type ImportCell = string | number | boolean | Date | null | undefined;

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
  direction?: number;
};

const DATE_HEADERS = /^(date|transaction date|trans\.? date|posted date|post date|posting date)$/i;
const DESCRIPTION_HEADERS = /^(description|merchant|merchant name|name|payee|memo|original description)$/i;
const WEAK_DESCRIPTION_HEADERS = /^(details|detail|transaction|transaction details)$/i;
const AMOUNT_HEADERS = /^(amount|transaction amount|net|value)$/i;
const DEBIT_HEADERS = /^(debit|money out|withdrawal|withdrawals|outflow|spent)$/i;
const CREDIT_HEADERS = /^(credit|money in|deposit|deposits|inflow|received)$/i;
const DIRECTION_HEADERS = /^(details|type|transaction type|debit\/credit|credit\/debit)$/i;
const DIRECTION_VALUES = /^(debit|credit|debit_card|ach_debit|ach_credit|misc_debit|quickpay_debit|acct_xfer|atm|check)$/i;

function cellText(cell: ImportCell): string {
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell ?? '').trim();
}

function sampleColumn(rows: ImportCell[][], index: number) {
  return rows.map((row) => cellText(row[index])).filter(Boolean);
}

function ratio(values: string[], predicate: (value: string) => boolean) {
  if (values.length === 0) return 0;
  return values.filter(predicate).length / values.length;
}

function looksLikeDate(value: string) {
  return normalizeDate(value) !== null;
}

function looksLikeMoney(value: string) {
  return parseMoney(value) !== null;
}

function columnScore(
  header: string[],
  sampleRows: ImportCell[][],
  index: number,
  headerPattern: RegExp,
  samplePredicate: (value: string) => boolean
) {
  const heading = cellText(header[index]);
  const values = sampleColumn(sampleRows, index);
  return (headerPattern.test(heading) ? 4 : 0) + ratio(values, samplePredicate) * 6;
}

function bestColumn(
  header: string[],
  sampleRows: ImportCell[][],
  headerPattern: RegExp,
  samplePredicate: (value: string) => boolean,
  minScore = 4
) {
  let best = { index: -1, score: 0 };
  for (let index = 0; index < header.length; index += 1) {
    const score = columnScore(header, sampleRows, index, headerPattern, samplePredicate);
    if (score > best.score) best = { index, score };
  }
  return best.score >= minScore ? best.index : -1;
}

function bestDescriptionColumn(header: string[], sampleRows: ImportCell[][]) {
  let best = { index: -1, score: 0 };
  for (let index = 0; index < header.length; index += 1) {
    const heading = cellText(header[index]);
    const values = sampleColumn(sampleRows, index);
    const avgLength =
      values.reduce((sum, value) => sum + value.length, 0) / Math.max(values.length, 1);
    const hasLetters = ratio(values, (value) => /[a-z]/i.test(value));
    const typeLike = ratio(values, (value) => DIRECTION_VALUES.test(value));
    const uniqueRatio = values.length > 0 ? new Set(values.map((value) => value.toLowerCase())).size / values.length : 0;
    let score = 0;
    if (DESCRIPTION_HEADERS.test(heading)) score += 8;
    if (WEAK_DESCRIPTION_HEADERS.test(heading)) score += 2;
    score += Math.min(avgLength / 8, 4);
    score += hasLetters * 3;
    score += uniqueRatio * 2;
    score -= typeLike * 9;
    if (DATE_HEADERS.test(heading) || AMOUNT_HEADERS.test(heading) || DEBIT_HEADERS.test(heading) || CREDIT_HEADERS.test(heading)) {
      score -= 8;
    }
    if (score > best.score) best = { index, score };
  }
  return best.score >= 5 ? best.index : -1;
}

function mapColumns(header: string[], sampleRows: ImportCell[][]): ColumnMap | null {
  const date = bestColumn(header, sampleRows, DATE_HEADERS, looksLikeDate);
  const description = bestDescriptionColumn(header, sampleRows);
  const amount = bestColumn(header, sampleRows, AMOUNT_HEADERS, looksLikeMoney);
  const debit = bestColumn(header, sampleRows, DEBIT_HEADERS, looksLikeMoney);
  const credit = bestColumn(header, sampleRows, CREDIT_HEADERS, looksLikeMoney);
  const direction = bestColumn(header, sampleRows, DIRECTION_HEADERS, (value) => DIRECTION_VALUES.test(value), 5);

  if (date === -1 || description === -1) return null;
  if (amount === -1 && debit === -1 && credit === -1) return null;

  return {
    date,
    description,
    amount: amount === -1 ? undefined : amount,
    debit: debit === -1 ? undefined : debit,
    credit: credit === -1 ? undefined : credit,
    direction: direction === -1 ? undefined : direction,
  };
}

/** Normalizes common bank date formats to YYYY-MM-DD; returns null when unreadable. */
function normalizeDate(raw: ImportCell): string | null {
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === 'number' && raw > 20000 && raw < 80000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(epoch.getTime() + raw * 86400000);
    return date.toISOString().slice(0, 10);
  }

  const value = cellText(raw);
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

function parseMoney(raw: ImportCell): number | null {
  if (typeof raw === 'number') return raw;
  const value = cellText(raw);
  if (!value) return null;
  const negativeParens = /^\(.*\)$/.test(value);
  const cleaned = value.replace(/[()$,\s]/g, '');
  if (!cleaned || cleaned === '-') return null;
  const parsed = Number(cleaned);
  if (Number.isNaN(parsed)) return null;
  return negativeParens ? -Math.abs(parsed) : parsed;
}

function findHeaderRow(rows: ImportCell[][]) {
  let best = { index: -1, score: 0 };
  const scanLimit = Math.min(rows.length, 15);

  for (let index = 0; index < scanLimit; index += 1) {
    const row = rows[index].map(cellText);
    const sampleRows = rows.slice(index + 1, index + 16);
    const hasDate = bestColumn(row, sampleRows, DATE_HEADERS, looksLikeDate) !== -1;
    const hasDescription = bestDescriptionColumn(row, sampleRows) !== -1;
    const hasAmount =
      bestColumn(row, sampleRows, AMOUNT_HEADERS, looksLikeMoney) !== -1 ||
      bestColumn(row, sampleRows, DEBIT_HEADERS, looksLikeMoney) !== -1 ||
      bestColumn(row, sampleRows, CREDIT_HEADERS, looksLikeMoney) !== -1;
    const knownHeaders = row.filter((cell) =>
      DATE_HEADERS.test(cell) ||
      DESCRIPTION_HEADERS.test(cell) ||
      WEAK_DESCRIPTION_HEADERS.test(cell) ||
      AMOUNT_HEADERS.test(cell) ||
      DEBIT_HEADERS.test(cell) ||
      CREDIT_HEADERS.test(cell) ||
      DIRECTION_HEADERS.test(cell)
    ).length;
    const score = knownHeaders + (hasDate ? 4 : 0) + (hasDescription ? 4 : 0) + (hasAmount ? 4 : 0);
    if (score > best.score) best = { index, score };
  }

  return best.score >= 8 ? best.index : -1;
}

function normalizeMerchantName(raw: string) {
  return raw
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, ' ')
    .replace(/\b\d{5,}\b/g, ' ')
    .replace(/\b(PPD ID|WEB ID|transaction#):?\s*\S+/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
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

export function buildImportPreviewFromRows(
  rawRows: ImportCell[][],
  existing: StoredTransaction[],
  guessCategory: (item: string) => { category: string; subcategory: string | null } | null
): ImportPreview | { error: string } {
  const headerIndex = findHeaderRow(rawRows);
  const rows = headerIndex === -1 ? rawRows : rawRows.slice(headerIndex);
  if (rows.length < 2) {
    return { error: 'That file looks empty — it needs a header row plus at least one transaction.' };
  }

  const header = rows[0].map(cellText);
  const sampleRows = rows.slice(1, 21);
  const columns = mapColumns(header, sampleRows);
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
    const date = normalizeDate(row[columns.date]);
    const item = normalizeMerchantName(cellText(row[columns.description]));
    if (!date || !item) {
      skippedRows += 1;
      continue;
    }

    // Single amount column: negative = money out (the most common convention,
    // parentheses treated as negative). Debit/credit pairs are unambiguous.
    let signedAmount: number | null = null;
    if (columns.amount !== undefined) {
      signedAmount = parseMoney(row[columns.amount]);
      const direction = columns.direction !== undefined ? cellText(row[columns.direction]) : '';
      if (signedAmount !== null && signedAmount > 0 && /^debit/i.test(direction)) {
        signedAmount = -signedAmount;
      } else if (signedAmount !== null && signedAmount < 0 && /^credit/i.test(direction)) {
        signedAmount = Math.abs(signedAmount);
      }
    } else {
      const debit = columns.debit !== undefined ? parseMoney(row[columns.debit]) : null;
      const credit = columns.credit !== undefined ? parseMoney(row[columns.credit]) : null;
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
    const guess = guessCategory(item);
    const isTransfer = guess?.category === 'Transfers' || guess?.subcategory === 'Transfers';
    if (isExpense && !guess) uncategorized += 1;

    transactions.push({
      id,
      date,
      item,
      moneyIn: isExpense ? 0 : signedAmount,
      moneyOut: isExpense ? Math.abs(signedAmount) : 0,
      amount: signedAmount,
      category: isTransfer ? 'Transfers' : isExpense ? (guess?.category ?? 'Uncategorized') : 'Income',
      subcategory: isTransfer ? 'Transfers' : isExpense ? (guess?.subcategory ?? null) : null,
      type: isTransfer ? 'transfer' : isExpense ? 'expense' : 'income',
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

export function buildImportPreview(
  csvText: string,
  existing: StoredTransaction[],
  guessCategory: (item: string) => { category: string; subcategory: string | null } | null
): ImportPreview | { error: string } {
  return buildImportPreviewFromRows(parseCsv(csvText), existing, guessCategory);
}
