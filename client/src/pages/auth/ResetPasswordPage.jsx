import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, getApiErrorMessage } from '../../lib/api';
import { Button, Input } from '../../components/ui';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0D12] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#171B25] border border-[#1F2533] rounded-2xl p-7">
        <h1 className="text-lg font-bold text-white mb-1">Set New Password</h1>
        <p className="text-xs text-slate-400 mb-6">
          All active refresh sessions will be invalidated upon reset.
        </p>

        {done ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 text-xs text-[#34D399]">
              Password updated successfully.
            </div>
            <Link to="/login" className="block text-center text-xs text-[#8B7CFF] hover:underline">
              Continue to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Reset Token"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <Input
              label="New Password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-xs text-[#FB7185]">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              Reset Password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
