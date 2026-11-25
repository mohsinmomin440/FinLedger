import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export function Pagination({ page, totalPages, onPageChange }) {
  if (!totalPages || totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-4 border-t border-[#1F2533] text-xs text-slate-400">
      <span>
        Page <strong className="text-slate-200">{page}</strong> of{' '}
        <strong className="text-slate-200">{totalPages}</strong>
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Prev
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
