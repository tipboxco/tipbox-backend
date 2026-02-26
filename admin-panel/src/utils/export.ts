/**
 * Export utilities for downloading data in various formats
 */

/**
 * Convert data to CSV format and trigger download
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[]
) {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  // Use provided columns or infer from first data item
  const headers = columns
    ? columns
    : (Object.keys(data[0]) as (keyof T)[]).map((key) => ({
        key,
        label: String(key),
      }));

  // Create CSV header row
  const headerRow = headers.map((h) => h.label).join(',');

  // Create CSV data rows
  const dataRows = data.map((row) => {
    return headers
      .map((h) => {
        const value = row[h.key];
        // Handle null, undefined, objects, arrays
        let cellValue = '';
        if (value === null || value === undefined) {
          cellValue = '';
        } else if (typeof value === 'object') {
          cellValue = JSON.stringify(value);
        } else {
          cellValue = String(value);
        }
        // Escape quotes and wrap in quotes if contains comma, newline, or quote
        if (cellValue.includes(',') || cellValue.includes('\n') || cellValue.includes('"')) {
          cellValue = `"${cellValue.replace(/"/g, '""')}"`;
        }
        return cellValue;
      })
      .join(',');
  });

  const csv = [headerRow, ...dataRows].join('\n');

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Convert data to JSON format and trigger download
 */
export function exportToJSON<T>(data: T[], filename: string) {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * Convert data to Excel-compatible CSV format and trigger download
 * (Excel can open CSV files with .xlsx extension)
 */
export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[]
) {
  // Excel prefers UTF-8 with BOM
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  const headers = columns
    ? columns
    : (Object.keys(data[0]) as (keyof T)[]).map((key) => ({
        key,
        label: String(key),
      }));

  const headerRow = headers.map((h) => h.label).join('\t');

  const dataRows = data.map((row) => {
    return headers
      .map((h) => {
        const value = row[h.key];
        let cellValue = '';
        if (value === null || value === undefined) {
          cellValue = '';
        } else if (typeof value === 'object') {
          cellValue = JSON.stringify(value);
        } else {
          cellValue = String(value);
        }
        // Tab-separated for Excel
        return cellValue.replace(/\t/g, ' ');
      })
      .join('\t');
  });

  const tsv = [headerRow, ...dataRows].join('\n');

  // Add UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + tsv], { type: 'text/tab-separated-values;charset=utf-8;' });
  downloadBlob(blob, `${filename}.xls`);
}

/**
 * Helper function to trigger file download
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Format date for export (convert ISO string to readable format)
 */
export function formatDateForExport(date: string | Date | null | undefined): string {
  if (!date) return '';
  try {
    return new Date(date).toLocaleString('en-US');
  } catch {
    return String(date);
  }
}

/**
 * Sanitize filename (remove invalid characters)
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}
