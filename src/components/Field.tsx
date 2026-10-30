import { Label } from './ui/label';
import { cn } from '@/lib/utils';

// Label + control, stacked — the standard form row.
export function Field({ label, span2, children }: { label: string; span2?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-1.5 min-w-0', span2 && 'col-span-2')}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
