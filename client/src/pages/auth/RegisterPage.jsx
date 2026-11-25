import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, getApiErrorMessage } from '../../lib/api';
import { CURRENCIES } from '../../lib/money';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { Button, Input, Select } from '../../components/ui';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  defaultCurrency: z.enum(['INR', 'USD', 'EUR', 'GBP']),
  workspaceName: z.string().trim().min(2, 'Workspace name must be at least 2 characters'),
  workspaceType: z.enum(['PERSONAL', 'BUSINESS']),
});

export function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const addToast = useUiStore((s) => s.addToast);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      defaultCurrency: 'INR',
      workspaceName: '',
      workspaceType: 'PERSONAL',
    },
  });

  const onSubmit = async (values) => {
    try {
      const res = await api.post('/auth/register', values);
      const data = res.data.data;
      setSession({
        user: data.user,
        workspace: data.workspace,
        workspaces: [{ ...data.workspace, role: 'OWNER' }],
        accessToken: data.accessToken,
        csrfToken: data.csrfToken,
        role: 'OWNER',
      });
      addToast({ title: 'Account & ledger initialized', type: 'success' });
      navigate('/dashboard');
    } catch (err) {
      setError('root', { message: getApiErrorMessage(err, 'Registration failed') });
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0D12] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#171B25] border border-[#1F2533] rounded-2xl p-7 shadow-2xl">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B7CFF] to-[#10B981] flex items-center justify-center font-bold text-white">
            FL
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Create your FinLedger Workspace</h1>
            <p className="text-xs text-slate-400">
              Auto-provisions double-entry chart of accounts in your base currency
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              placeholder="Ada Lovelace"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="Email Address"
              type="email"
              placeholder="ada@studio.io"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>

          <Input
            label="Password"
            type="password"
            placeholder="Minimum 8 characters"
            error={errors.password?.message}
            {...register('password')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <Select
                label="Base Currency"
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                error={errors.defaultCurrency?.message}
                {...register('defaultCurrency')}
              />
            </div>
            <div className="sm:col-span-1">
              <Select
                label="Workspace Type"
                options={[
                  { value: 'PERSONAL', label: 'Personal' },
                  { value: 'BUSINESS', label: 'Business' },
                ]}
                error={errors.workspaceType?.message}
                {...register('workspaceType')}
              />
            </div>
            <div className="sm:col-span-1">
              <Input
                label="Workspace Name"
                placeholder="My Ledger"
                error={errors.workspaceName?.message}
                {...register('workspaceName')}
              />
            </div>
          </div>

          {errors.root?.message && (
            <div className="p-3 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-xs text-[#FB7185]">
              {errors.root.message}
            </div>
          )}

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Create Account &amp; Launch Ledger
          </Button>

          <p className="text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-[#8B7CFF] hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
