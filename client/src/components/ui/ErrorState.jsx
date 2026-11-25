import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

export function ErrorState({
  title = 'Failed to load data',
  message = 'An unexpected error occurred while communicating with the server.',
  onRetry = null,
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 bg-[#171B25] border border-[#F43F5E]/30 rounded-2xl">
      <div className="w-11 h-11 rounded-2xl bg-[#F43F5E]/15 flex items-center justify-center text-[#FB7185] mb-3">
        <AlertCircle className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <p className="text-xs text-slate-400 max-w-md mt-1">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-4">
          Try Again
        </Button>
      )}
    </div>
  );
}
