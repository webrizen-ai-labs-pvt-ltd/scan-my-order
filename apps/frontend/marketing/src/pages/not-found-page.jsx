import { Link } from 'react-router-dom';
import { Button } from '@smo/ui';
import { usePageMeta } from '../lib/use-page-meta';

export default function NotFoundPage() {
  usePageMeta({ title: 'Page not found — Scan My Order' });

  return (
    <section className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-24 text-center md:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-700 dark:text-yellow-400">404</p>
      <h1 className="mt-3 font-elsie text-4xl md:text-5xl">This table isn’t set.</h1>
      <p className="mt-4 max-w-md text-muted-foreground text-pretty">
        The page you’re looking for doesn’t exist or has moved.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link to="/">Back to home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/contact">Contact us</Link>
        </Button>
      </div>
    </section>
  );
}
