const FORMULA_INJECTION_REGEX = /^[=+\-@\t\r]/;

/**
 * Neutralizes spreadsheet formula injection (CSV/Excel/Sheets) by prefixing
 * dangerous leading characters with a single quote ('), then applying RFC 4180 quoting.
 */
export function sanitizeCsvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);
  if (FORMULA_INJECTION_REGEX.test(str)) {
    str = `'${str}`;
  }

  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function buildCsv(headers, rows) {
  const headerLine = headers.map(sanitizeCsvCell).join(',');
  const rowLines = rows.map((row) => row.map(sanitizeCsvCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}
