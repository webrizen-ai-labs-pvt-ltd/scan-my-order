import { Link } from 'react-router-dom';

/** Wordmark: "Scan [logo] Order". Shared by navbar and footer. */
export function Brand({ onClick }) {
  return (
    <Link to="/" onClick={onClick} aria-label="Scan My Order — home" className="inline-flex items-center gap-1.5">
      <span className="font-elsie text-lg text-[#050f2c] dark:text-white">Scan</span>
      <img src="/logo.png" alt="" width={32} height={32} className="h-8 w-8 object-contain" />
      <span className="font-elsie text-lg text-[#050f2c] dark:text-white">Order</span>
    </Link>
  );
}
