/** Order statuses in lifecycle order, and their badge colours */
export const ORDER_STATUSES = ['DRAFT', 'PENDING_VERIFICATION', 'PROCESSING', 'READY', 'SERVED', 'SETTLED', 'CANCELLED'];

export const statusTone = (s) => {
  switch (s) {
    case 'SETTLED': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'CANCELLED': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'PROCESSING':
    case 'READY':
    case 'SERVED': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    default: return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300';
  }
};
