import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, getApiErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { Button, Input } from '../../components/ui';

export function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const accessToken = useAuthStore((s) => s.accessToken);
  const setSession = useAuthStore((s) => s.setSession);
  const addToast = useUiStore((s) => s.addToast);
  const navigate = useNavigate();

  const handleAccept = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/workspaces/invitations/accept', { token });
      const { workspace, member } = res.data.data;
      setSession({ workspace, role: member.role });
      addToast({ title: `Joined ${workspace.name}`, type: 'success' });
      navigate('/dashboard');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0D12] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#171B25] border border-[#1F2533] rounded-2xl p-7 space-y-4">
        <h1 className="text-lg font-bold text-white">Accept Workspace Invitation</h1>
        {!accessToken ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Sign in with the invited email address to accept this workspace invitation.
            </p>
            <Link to="/login" className="block">
              <Button className="w-full">Sign In to Continue</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleAccept} className="space-y-4">
            <Input
              label="Invitation Token"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            {error && <p className="text-xs text-[#FB7185]">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              Accept &amp; Switch Workspace
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
