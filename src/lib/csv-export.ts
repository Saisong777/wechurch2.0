// Quote every cell; quoting alone does not prevent spreadsheet formulas.
export function serializeCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map(row => row.map(value => {
    const text = String(value ?? '');
    const safe = /^[\s\p{Cc}]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text)
      ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
}
