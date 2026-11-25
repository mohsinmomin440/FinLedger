import { describe, it, expect } from 'vitest';
import { buildCsv, sanitizeCsvCell } from '../../src/utils/csv.js';

describe('Formula-Safe CSV Utility', () => {
  it('neutralizes leading spreadsheet formula characters (=, +, -, @, tab, cr)', () => {
    expect(sanitizeCsvCell('=CMD()')).toBe("'=CMD()");
    expect(sanitizeCsvCell('+1')).toBe("'+1");
    expect(sanitizeCsvCell('-1')).toBe("'-1");
    expect(sanitizeCsvCell('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");
    expect(sanitizeCsvCell('\t123')).toBe("'\t123");
    expect(sanitizeCsvCell('\r456')).toBe('"\'\r456"');
  });

  it('quotes cells containing commas or double quotes while preserving leading quote neutralization', () => {
    expect(sanitizeCsvCell('=SUM(A1,B1)')).toBe('"\'=SUM(A1,B1)"');
    expect(sanitizeCsvCell('Coffee, "Latte"')).toBe('"Coffee, ""Latte"""');
  });

  it('builds valid CRLF CSV documents', () => {
    const csv = buildCsv(['Desc', 'Amount'], [['=CMD()', '100'], ['Coffee', '250']]);
    expect(csv).toBe("Desc,Amount\r\n'=CMD(),100\r\nCoffee,250");
  });
});
