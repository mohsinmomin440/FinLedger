import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SplitExpenseModal } from '../components/SplitExpenseModal';

const MOCK_GROUP = {
  _id: 'grp1',
  name: 'Goa Trip',
  currency: 'USD',
  members: [
    { _id: 'm1', name: 'Alice' },
    { _id: 'm2', name: 'Bob' },
    { _id: 'm3', name: 'Carol' },
  ],
};

describe('SplitExpenseModal Interactive Penny-Exact Splitter', () => {
  it('distributes odd equal totals (1.00 across 3 members -> $0.34, $0.33, $0.33) and submits exact splits', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({});

    render(
      <SplitExpenseModal
        open={true}
        onClose={() => {}}
        group={MOCK_GROUP}
        onSubmitExpense={onSubmit}
      />
    );

    await user.type(screen.getByLabelText(/expense title/i), 'Coffee Run');
    await user.type(screen.getByLabelText(/total amount/i), '1.00');

    expect(screen.getByText('Exact Sum Validated')).toBeInTheDocument();
    expect(screen.getByText('$0.34')).toBeInTheDocument();
    expect(screen.getAllByText('$0.33')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /save split expense/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Coffee Run',
        paidByMemberId: 'm1',
        originalAmountMinor: 100,
        originalCurrency: 'USD',
        splitType: 'EQUAL',
        splits: [
          { memberId: 'm1', shareValue: 1 },
          { memberId: 'm2', shareValue: 1 },
          { memberId: 'm3', shareValue: 1 },
        ],
      });
    });
  });

  it('validates EXACT mode mismatch and computes PERCENTAGE mode splits accurately', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({});

    render(
      <SplitExpenseModal
        open={true}
        onClose={() => {}}
        group={MOCK_GROUP}
        onSubmitExpense={onSubmit}
      />
    );

    await user.type(screen.getByLabelText(/expense title/i), 'Team Dinner');
    await user.type(screen.getByLabelText(/total amount/i), '100.00');

    // Switch to EXACT mode -> currently 0.00 sum -> mismatch error
    await user.click(screen.getByRole('button', { name: 'EXACT' }));
    expect(screen.getByText(/exact splits differ by \$100\.00/i)).toBeInTheDocument();

    // Switch to PERCENTAGE mode -> auto-distributes to 100.00%
    await user.click(screen.getByRole('button', { name: 'PERCENTAGE' }));
    expect(screen.getByText('Exact Sum Validated')).toBeInTheDocument();

    // Update percentages to 50%, 30%, 20%
    const alicePct = screen.getByLabelText(/percentage for alice/i);
    const bobPct = screen.getByLabelText(/percentage for bob/i);
    const carolPct = screen.getByLabelText(/percentage for carol/i);

    await user.clear(alicePct);
    await user.type(alicePct, '50');
    await user.clear(bobPct);
    await user.type(bobPct, '30');
    await user.clear(carolPct);
    await user.type(carolPct, '20');

    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText('$30.00')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();
  });
});
