export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const escape = (val: string | number): string => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const header = columns.map((c) => escape(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => escape(c.accessor(r))).join(',')).join('\n');
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatDateForCsv(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toISOString().split('T')[0];
}
