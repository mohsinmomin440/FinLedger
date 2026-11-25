import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, getApiErrorMessage } from '../../lib/api';
import { Button } from '../../components/ui';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [status, setStatus] = useState(token ? 'verifying' : 'missing');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    api
      .post('/auth/verify-email', { token })
      .then(() => {
        setStatus('verified');
        setMessage('Your email has been verified.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(getApiErrorMessage(err, 'Verification token invalid or expired'));
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-[#0B0D12] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#171B25] border border-[#1F2533] rounded-2xl p-7 text-center space-y-4">
        <h1 className="text-lg font-bold text-white">Email Verification</h1>
        {status === 'verifying' && <p className="text-sm text-slate-400">Verifying your email...</p>}
        {status === 'verified' && <p className="text-sm text-[#34D399]">{message}</p>}
        {(status === 'error' || status === 'missing') && (
          <p className="text-sm text-[#FB7185]">
            {message || 'No verification token found in URL.'}
          </p>
        )}
        <Link to="/dashboard" className="inline-block">
          <Button variant="secondary" size="sm">
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
