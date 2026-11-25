import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getApiErrorMessage } from '../../lib/api';
import { Button, Input } from '../../components/ui';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0D12] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#171B25] border border-[#1F2533] rounded-2xl p-7">
        <h1 className="text-lg font-bold text-white mb-1">Reset Password</h1>
        <p className="text-xs text-slate-400 mb-6">
          Enter your email to receive password reset instructions.
        </p>

        {submitted ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 text-xs text-[#34D399]">
              If an account exists for <strong>{email}</strong>, a reset link has been dispatched.
            </div>
            <Link to="/login" className="block text-center text-xs text-[#8B7CFF] hover:underline">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="text-xs text-[#FB7185]">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              Send Reset Link
            </Button>
            <Link to="/login" className="block text-center text-xs text-slate-400 hover:text-white">
              Back to Sign In
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
