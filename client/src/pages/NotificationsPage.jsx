import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from '../components/ui';

export function NotificationsPage() {
  const workspace = useAuthStore((s) => s.activeWorkspace);
  const addToast = useUiStore((s) => s.addToast);
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['notifications', workspace?._id],
    queryFn: async () => (await api.get('/notifications')).data.data,
    enabled: Boolean(workspace?._id),
  });

  const markOneMutation = useMutation({
    mutationFn: async (id) => (await api.patch(`/notifications/${id}/read`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: async () => (await api.post('/notifications/read-all')).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      addToast({ title: 'All notifications marked read', type: 'success' });
    },
  });

  if (isLoading) return <Skeleton className="h-56 rounded-2xl" />;
  if (isError) return <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />;

  const items = data?.items || [];
  const activities = data?.activities || [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Notifications &amp; Audit Activity</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time budget alerts, invoice payments &amp; workspace feed
          </p>
        </div>
        {items.some((n) => !n.readAt) && (
          <Button
            variant="secondary"
            size="sm"
            loading={markAllMutation.isPending}
            onClick={() => markAllMutation.mutate()}
          >
            <CheckCheck className="w-4 h-4" /> Mark All Read
          </Button>
        )}
      </div>

      <Card title="Alerts">
        {items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications"
            description="Budget threshold alerts and invoice payment events appear here."
          />
        ) : (
          <div className="divide-y divide-[#1F2533]">
            {items.map((n) => (
              <div key={n._id} className="py-3.5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{n.title}</span>
                    {!n.readAt && <Badge variant="rose">NEW</Badge>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{n.message}</p>
                </div>
                {!n.readAt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markOneMutation.mutate(n._id)}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Recent Workspace Activity">
        {activities.length === 0 ? (
          <EmptyState title="No recent activity" />
        ) : (
          <div className="divide-y divide-[#1F2533]">
            {activities.map((a) => (
              <div key={a._id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-white">{a.title}</p>
                  <p className="text-xs text-slate-400">{a.message}</p>
                </div>
                <span className="text-xs text-slate-500 tabular-nums">
                  {new Date(a.createdAt).toISOString().slice(0, 10)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
