import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        secondary:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        destructive: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400',
        outline:     'border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400',
        success:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
        warning:     'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400',
        blue:        'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400',
        live:        'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
