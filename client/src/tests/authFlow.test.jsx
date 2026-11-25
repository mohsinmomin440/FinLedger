import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from '../components/layout/RouteGuards';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';

function renderWithProviders(ui, initialEntries = ['/']) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Auth Flow & Protected Route Guards', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('redirects unauthenticated users from protected route to /login', () => {
    useAuthStore.setState({ accessToken: null, isAuthReady: true });

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<div>Login Gate</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Secret Dashboard</div>} />
        </Route>
      </Routes>,
      ['/dashboard']
    );

    expect(screen.getByText('Login Gate')).toBeInTheDocument();
    expect(screen.queryByText('Secret Dashboard')).not.toBeInTheDocument();
  });

  it('signs in via LoginPage and stores JWT strictly in memory (never localStorage)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'post').mockResolvedValueOnce({
      data: {
        data: {
          user: { id: 'u1', name: 'Ada', email: 'ada@finledger.io' },
          workspace: { _id: 'w1', name: 'Ada Ledger', baseCurrency: 'USD' },
          workspaces: [{ _id: 'w1', name: 'Ada Ledger', baseCurrency: 'USD', role: 'OWNER' }],
          accessToken: 'memory.jwt.token',
          csrfToken: 'csrf.token',
        },
      },
    });

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>Dashboard Loaded</div>} />
      </Routes>,
      ['/login']
    );

    await user.type(screen.getByLabelText(/email address/i), 'ada@finledger.io');
    await user.type(screen.getByLabelText(/password/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Dashboard Loaded')).toBeInTheDocument();
    });

    expect(useAuthStore.getState().accessToken).toBe('memory.jwt.token');
    expect(localStorage.length).toBe(0);
  });

  it('validates and submits registration with base currency & workspace type', async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
      data: {
        data: {
          user: { id: 'u2', name: 'Grace', email: 'grace@finledger.io' },
          workspace: { _id: 'w2', name: 'Grace Studio', baseCurrency: 'EUR' },
          accessToken: 'reg.jwt.token',
          csrfToken: 'csrf.reg',
        },
      },
    });

    renderWithProviders(
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<div>Dashboard Welcome</div>} />
      </Routes>,
      ['/register']
    );

    await user.type(screen.getByLabelText(/full name/i), 'Grace Hopper');
    await user.type(screen.getByLabelText(/email address/i), 'grace@finledger.io');
    await user.type(screen.getByLabelText(/password/i), 'Password123!');
    await user.selectOptions(screen.getByLabelText(/base currency/i), 'EUR');
    await user.selectOptions(screen.getByLabelText(/workspace type/i), 'BUSINESS');
    await user.type(screen.getByLabelText(/workspace name/i), 'Grace Studio');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Dashboard Welcome')).toBeInTheDocument();
    });

    expect(postSpy).toHaveBeenCalledWith(
      '/auth/register',
      expect.objectContaining({
        defaultCurrency: 'EUR',
        workspaceType: 'BUSINESS',
        workspaceName: 'Grace Studio',
      })
    );
  });
});
