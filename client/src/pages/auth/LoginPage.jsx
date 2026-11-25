import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, getApiErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { Button, Input } from '../../components/ui';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const addToast = useUiStore((s) => s.addToast);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values) => {
    try {
      const res = await api.post('/auth/login', values);
      const data = res.data.data;
      setSession({
        user: data.user,
        workspace: data.workspace,
        workspaces: data.workspaces || [],
        accessToken: data.accessToken,
        csrfToken: data.csrfToken,
        role: data.workspaces?.find((w) => w._id === data.workspace?._id)?.role || 'OWNER',
      });
      addToast({ title: `Welcome back, ${data.user.name}`, type: 'success' });
      navigate('/dashboard');
    } catch (err) {
      setError('root', { message: getApiErrorMessage(err, 'Invalid credentials') });
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0D12] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#171B25] border border-[#1F2533] rounded-2xl p-7 shadow-2xl">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B7CFF] to-[#10B981] flex items-center justify-center font-bold text-white">
            FL
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Sign in to FinLedger</h1>
            <p className="text-xs text-slate-400">Expense Splitting, Invoicing &amp; Ledger</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="you@company.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
          />

          {errors.root?.message && (
            <div className="p-3 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-xs text-[#FB7185]">
              {errors.root.message}
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <Link to="/forgot-password" className="text-[#8B7CFF] hover:underline">
              Forgot password?
            </Link>
            <Link to="/register" className="text-slate-300 hover:text-white">
              Create account
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}
