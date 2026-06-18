import { cn } from '../../lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded bg-slate-200/80 dark:bg-slate-700/60', className)}
      {...props}
    />
  );
}
