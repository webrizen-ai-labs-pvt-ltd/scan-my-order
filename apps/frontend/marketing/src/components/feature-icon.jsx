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

/** Decorative feature glyph in a soft yellow tile. */
export function FeatureIcon({ name, className }) {
  const Icon = ICONS[name] ?? QrCodeIcon;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center',
        'bg-yellow-400/20 text-yellow-800 dark:bg-yellow-300/10 dark:text-yellow-300',
        'soft-border',
        className
      )}
    >
      <Icon size={22} strokeWidth={1.75} />
    </span>
  );
}
