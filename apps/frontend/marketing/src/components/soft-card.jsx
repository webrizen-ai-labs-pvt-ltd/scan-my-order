import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@smo/ui/lib/utils';

export function SoftCard({ className, children, ...props }) {
  return (
    <motion.div
      whileHover={{ backgroundColor: "hsl(var(--muted) / 0.5)" }} 
      transition={{ duration: 0.3 }}
      className={cn(
        "relative soft-border bg-card p-8 flex flex-col",
        "shadow-soft-in dark:shadow-soft-in-dark",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
