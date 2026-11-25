import { assertMinorInt } from './money.js';

/**
 * Simplifies group debts into the minimum set of settlement transfers using
 * greedy matching between largest net debtor and largest net creditor.
 * Enforces exact zero-sum invariance: sum(balanceMinor) === 0.
 *
 * @param {Array<{ memberId: string, name?: string, balanceMinor: number }>} memberBalances
 * @returns {Array<{ fromMemberId: string, toMemberId: string, fromName?: string, toName?: string, amountMinor: number }>}
 */
export function simplifyGroupDebts(memberBalances) {
  if (!Array.isArray(memberBalances)) {
    throw new Error('memberBalances must be an array');
  }

  let totalSum = 0;
  const creditors = [];
  const debtors = [];

  for (const item of memberBalances) {
    const memberId = String(item.memberId);
    const balanceMinor = assertMinorInt(item.balanceMinor, `balanceMinor(${memberId})`);
    totalSum += balanceMinor;

    if (balanceMinor > 0) {
      creditors.push({
        memberId,
        name: item.name,
        amount: balanceMinor,
      });
    } else if (balanceMinor < 0) {
      debtors.push({
        memberId,
        name: item.name,
        amount: -balanceMinor,
      });
    }
  }

  if (totalSum !== 0) {
    throw new Error(
      `Debt simplification zero-sum invariant failed: sum of net balances is ${totalSum}, expected 0`
    );
  }

  const transfers = [];

  const sortDesc = (a, b) => {
    if (b.amount !== a.amount) return b.amount - a.amount;
    return a.memberId.localeCompare(b.memberId);
  };

  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort(sortDesc);
    creditors.sort(sortDesc);

    const debtor = debtors[0];
    const creditor = creditors[0];
    const settleAmount = Math.min(debtor.amount, creditor.amount);

    transfers.push({
      fromMemberId: debtor.memberId,
      toMemberId: creditor.memberId,
      ...(debtor.name ? { fromName: debtor.name } : {}),
      ...(creditor.name ? { toName: creditor.name } : {}),
      amountMinor: settleAmount,
    });

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount === 0) debtors.shift();
    if (creditor.amount === 0) creditors.shift();
  }

  return transfers;
}
