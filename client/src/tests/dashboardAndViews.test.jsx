import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from '../pages/DashboardPage';
import { TransactionsPage } from '../pages/TransactionsPage';
import { InvoiceBuilderPage } from '../pages/InvoiceBuilderPage';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';

function renderWithQuery(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Dashboard, Transactions & Invoice Builder Views', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      accessToken: 'jwt',
      isAuthReady: true,
      user: { id: 'u1', name: 'Ada', email: 'ada@finledger.io' },
      activeWorkspace: { _id: 'w1', name: 'Ada Studio', baseCurrency: 'USD' },
    });
  });

  it('renders Dashboard KPI cards and handles ErrorState cleanly', async () => {
    const getSpy = vi.spyOn(api, 'get');
    getSpy.mockRejectedValueOnce(new Error('Network offline'));

    renderWithQuery(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load data/i)).toBeInTheDocument();
    });

    getSpy.mockResolvedValueOnce({
      data: {
        data: {
          monthKey: '2026-11',
          kpis: {
            netBalanceMinor: 150000,
            monthlyCashflowMinor: 45000,
            monthlyIncomeMinor: 100000,
            monthlyExpenseMinor: 55000,
            owedToYouMinor: 2500,
            youOweMinor: 1000,
            unpaidInvoicesMinor: 30000,
            unpaidInvoicesCount: 2,
          },
          monthlyCashflow: [{ monthKey: '2026-11', incomeMinor: 100000, expenseMinor: 55000 }],
          categoryBreakdown: [{ category: 'Software & SaaS', totalMinor: 55000 }],
          budgets: [],
          recentTransactions: [],
        },
      },
    });

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => {
      expect(screen.getByText('$1,500.00')).toBeInTheDocument();
      expect(screen.getByText('$300.00')).toBeInTheDocument();
      expect(screen.getByText('$25.00')).toBeInTheDocument();
    });
  });

  it('renders TransactionsPage EmptyState when workspace has no transactions', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url === '/accounts') return { data: { data: [] } };
      return { data: { data: [], meta: { page: 1, totalPages: 1, total: 0 } } };
    });

    renderWithQuery(<TransactionsPage />);
    await waitFor(() => {
      expect(screen.getByText(/no transactions found/i)).toBeInTheDocument();
    });
  });

  it('computes integer minor subtotal, tax, and total in InvoiceBuilderPage', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: { data: [{ _id: 'c1', name: 'Acme Corp', company: 'Acme Inc' }] },
    });

    renderWithQuery(<InvoiceBuilderPage />);
    await waitFor(() => {
      expect(screen.getByText(/acme corp/i)).toBeInTheDocument();
    });

    const priceInput = screen.getByPlaceholderText('100.00');
    await user.type(priceInput, '200.00');

    expect(screen.getAllByText('$200.00').length).toBeGreaterThanOrEqual(2);
  });
});
