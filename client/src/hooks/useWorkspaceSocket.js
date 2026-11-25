import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectWorkspaceSocket, disconnectWorkspaceSocket } from '../lib/socket';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';

export function useWorkspaceSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const workspaceId = useAuthStore((s) => s.activeWorkspace?._id);
  const qc = useQueryClient();
  const addToast = useUiStore((s) => s.addToast);

  useEffect(() => {
    if (!accessToken || !workspaceId) {
      disconnectWorkspaceSocket();
      return undefined;
    }

    const socket = connectWorkspaceSocket({ accessToken, workspaceId });
    if (!socket) return undefined;

    const invalidateAllFinance = () => {
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
      qc.invalidateQueries({ queryKey: ['budgets'] });
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    };

    const onTxCreated = () => invalidateAllFinance();
    const onGroupUpdate = () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    };
    const onInvoicePaid = (payload) => {
      invalidateAllFinance();
      if (payload?.invoiceNumber) {
        addToast({
          title: `Payment received (${payload.invoiceNumber})`,
          type: 'success',
        });
      }
    };
    const onBudgetCrossed = (payload) => {
      invalidateAllFinance();
      addToast({
        title: `Budget Alert: ${payload?.category}`,
        message: `${payload?.percentUsed}% of monthly cap used`,
        type: 'warning',
      });
    };
    const onNotification = () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    };

    socket.on('transaction:created', onTxCreated);
    socket.on('group:expense_added', onGroupUpdate);
    socket.on('group:settled', onGroupUpdate);
    socket.on('invoice:paid', onInvoicePaid);
    socket.on('budget:threshold_crossed', onBudgetCrossed);
    socket.on('notification:new', onNotification);

    return () => {
      socket.off('transaction:created', onTxCreated);
      socket.off('group:expense_added', onGroupUpdate);
      socket.off('group:settled', onGroupUpdate);
      socket.off('invoice:paid', onInvoicePaid);
      socket.off('budget:threshold_crossed', onBudgetCrossed);
      socket.off('notification:new', onNotification);
    };
  }, [accessToken, workspaceId, qc, addToast]);
}
