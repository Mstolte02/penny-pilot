import { Platform } from 'react-native';

import {
  buildImportPreview,
  buildImportPreviewFromRows,
  type ImportCell,
  type ImportPreview,
} from '@/services/csv-import';
import type { StoredTransaction } from '@/services/finance-store';

type GuessCategory = (item: string) => { category: string; subcategory: string | null } | null;

type PickedAsset = {
  name?: string | null;
  uri: string;
  mimeType?: string | null;
  file?: {
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
  };
};

export function importFailureNeedsRebuild(error: unknown) {
  return (
    error instanceof Error &&
    /native module|requireNativeModule|ExpoDocumentPicker|ExpoFileSystem/i.test(error.message)
  );
}

function isExcelAsset(asset: PickedAsset) {
  const name = asset.name?.toLowerCase() ?? '';
  const mime = asset.mimeType?.toLowerCase() ?? '';
  return (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    mime.includes('spreadsheet') ||
    mime.includes('excel')
  );
}

async function readText(asset: PickedAsset) {
  if (Platform.OS === 'web' && asset.file) return asset.file.text();
  const { File: FsFile } = await import('expo-file-system');
  return new FsFile(asset.uri).text();
}

async function readArrayBuffer(asset: PickedAsset) {
  if (Platform.OS === 'web' && asset.file) return asset.file.arrayBuffer();
  const { File: FsFile } = await import('expo-file-system');
  return new FsFile(asset.uri).arrayBuffer();
}

async function previewExcel(
  asset: PickedAsset,
  existing: StoredTransaction[],
  guessCategory: GuessCategory
) {
  const XLSX = await import('xlsx');
  const buffer = await readArrayBuffer(asset);
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!sheet) {
    return { error: "Penny couldn't read the first sheet of that workbook." };
  }

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
    raw: false,
  }) as ImportCell[][];
  return buildImportPreviewFromRows(rows, existing, guessCategory);
}

export async function pickImportPreview(
  existing: StoredTransaction[],
  guessCategory: GuessCategory
): Promise<ImportPreview | { error: string } | null> {
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'text/csv',
      'text/comma-separated-values',
      'text/plain',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0] as PickedAsset;
  if (isExcelAsset(asset)) {
    return previewExcel(asset, existing, guessCategory);
  }

  const text = await readText(asset);
  return buildImportPreview(text, existing, guessCategory);
}
