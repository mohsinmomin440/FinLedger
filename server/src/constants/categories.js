export const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Rent & Housing',
  'Utilities',
  'Travel & Transport',
  'Software & SaaS',
  'Office Supplies',
  'Salaries & Payroll',
  'Marketing',
  'Healthcare',
  'Entertainment',
  'Taxes',
  'Other',
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Client Invoice',
  'Consulting & Sales',
  'Investments',
  'Reimbursement',
  'Other Income',
];

export const ALL_CATEGORIES = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, 'Transfer'])];
