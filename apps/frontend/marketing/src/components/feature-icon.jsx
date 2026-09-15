import {
  QrCodeIcon,
  Invoice01Icon,
  ChefHatIcon,
  Table01Icon,
  Package01Icon,
  WaiterIcon,
  StarIcon,
  CouponPercentIcon,
  Store01Icon,
} from 'hugeicons-react';
import { cn } from '@smo/ui/lib/utils';

const ICONS = {
  qr: QrCodeIcon,
  pos: Invoice01Icon,
  kds: ChefHatIcon,
  floor: Table01Icon,
  inventory: Package01Icon,
  waiter: WaiterIcon,
  review: StarIcon,
  promo: CouponPercentIcon,
  multi: Store01Icon,
};

/** Decorative feature glyph on a small lit tile. */
export function FeatureIcon({ name, className }) {
  const Icon = ICONS[name] ?? QrCodeIcon;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
        'bg-gradient-to-b from-primary/30 to-primary/10 text-yellow-800 dark:text-yellow-300',
        'border border-primary/30 sheen depth-1',
        className
      )}
    >
      <Icon size={22} strokeWidth={1.75} />
    </span>
  );
}
