import React from 'react';
import { cn } from '@smo/ui/lib/utils';

export function BentoGrid({ className, children }) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6", className)}>
      {children}
    </div>
  );
}

export function BentoGridItem({ className, children, colSpan = 1, rowSpan = 1 }) {
  return (
    <div
      className={cn(
        "soft-border bg-card relative overflow-hidden",
        "shadow-soft-in dark:shadow-soft-in-dark", 
        colSpan === 2 && "md:col-span-2",
        colSpan === 3 && "md:col-span-3",
        colSpan === 4 && "md:col-span-4",
        rowSpan === 2 && "md:row-span-2",
        className
      )}
    >
      {children}
    </div>
  );
}
