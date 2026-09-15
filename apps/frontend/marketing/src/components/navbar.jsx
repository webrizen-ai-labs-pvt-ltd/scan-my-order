import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button, AnimatedThemeToggler } from '@smo/ui';
import { cn } from '@smo/ui/lib/utils';
import { navLinks, links } from '../data/site';
import { Brand } from './brand';

const BLOB_CLIP =
  'polygon(74.8% 41.9%, 97.2% 73.2%, 100% 34.9%, 92.5% 0.4%, 87.5% 0%, 75% 28.6%, 58.5% 54.6%, 50.1% 56.8%, 46.9% 44%, 48.3% 17.4%, 24.7% 53.9%, 0% 27.9%, 11.9% 74.2%, 24.9% 54.1%, 68.6% 100%, 74.8% 41.9%)';

function EcosystemBanner({ onDismiss }) {
  return (
    <div className="relative isolate flex items-center gap-x-6 overflow-hidden bg-zinc-900 px-4 py-2.5 text-zinc-100 sm:px-6 lg:px-8">
      <div
        aria-hidden="true"
        className="absolute left-[max(-7rem,calc(50%-52rem))] top-1/2 -z-10 hidden -translate-y-1/2 transform-gpu blur-2xl sm:block"
      >
        <div
          style={{ clipPath: BLOB_CLIP }}
          className="aspect-[577/310] w-[36rem] bg-gradient-to-r from-yellow-300 to-amber-500 opacity-30"
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute left-[max(45rem,calc(50%+8rem))] top-1/2 -z-10 hidden -translate-y-1/2 transform-gpu blur-2xl sm:block"
      >
        <div
          style={{ clipPath: BLOB_CLIP }}
          className="aspect-[577/310] w-[36rem] bg-gradient-to-r from-yellow-300 to-amber-500 opacity-30"
        />
      </div>

      <p className="flex-1 text-xs leading-6 sm:text-sm">
        <strong className="font-semibold">The Webrizen Ecosystem</strong>
        <svg viewBox="0 0 2 2" aria-hidden="true" className="mx-2 inline h-0.5 w-0.5 fill-current">
          <circle r={1} cx={1} cy={1} />
        </svg>
        <span className="hidden md:inline">
          From employee HR to complete hotel management, we build software that scales with you.
        </span>
        <span className="md:hidden">Software that scales with your business.</span>
        <a href={links.ecosystem} className="ml-1.5 text-xs font-semibold underline underline-offset-2 opacity-80 hover:opacity-100">
          See all products
        </a>
      </p>

      <button
        type="button"
        onClick={onDismiss}
        className="-m-3 flex h-11 w-11 items-center justify-center focus-visible:-outline-offset-4"
        aria-label="Dismiss banner"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

const Navbar = () => {
  const [navIsOpened, setNavIsOpened] = useState(false);
  const [isBannerVisible, setIsBannerVisible] = useState(true);
  const location = useLocation();

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setNavIsOpened(false);
  }, [location.pathname, location.hash]);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setNavIsOpened(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Lock body scroll while the drawer is open
  useEffect(() => {
    document.body.style.overflow = navIsOpened ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [navIsOpened]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') setNavIsOpened(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const closeNavbar = () => setNavIsOpened(false);
  const toggleNavbar = () => setNavIsOpened((prev) => !prev);

  const isActive = (to) => {
    const [path] = to.split('#');
    return path !== '/' && location.pathname === path;
  };

  return (
    <>
      {isBannerVisible && <EcosystemBanner onDismiss={() => setIsBannerVisible(false)} />}

      <div
        aria-hidden="true"
        onClick={closeNavbar}
        className={cn(
          'fixed inset-0 z-30 bg-zinc-900/40 transition-opacity duration-300 lg:hidden',
          navIsOpened ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />

      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 py-2 backdrop-blur-xl [backdrop-filter:blur(20px)_saturate(180%)]">
        <nav className="container relative mx-auto flex w-full items-center justify-between gap-x-5 px-4 sm:px-6 lg:px-8" aria-label="Primary">
          <div className="flex min-w-max items-center">
            <Brand onClick={closeNavbar} />
          </div>

          <div
            id="primary-navigation"
            className={cn(
              'absolute left-0 top-full w-full border-b border-border/60 bg-background/95 px-4 py-4 backdrop-blur-xl sm:px-6',
              'max-h-[calc(100vh-4rem)] overflow-y-auto transition-all duration-300 ease-in-out',
              'lg:relative lg:top-0 lg:flex lg:max-h-none lg:justify-between lg:overflow-visible lg:border-none lg:bg-transparent lg:px-0 lg:py-0 lg:dark:bg-transparent',
              navIsOpened
                ? 'visible translate-y-0 opacity-100'
                : 'invisible -translate-y-2 opacity-0 lg:visible lg:translate-y-0 lg:opacity-100'
            )}
          >
            <ul className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300 lg:w-full lg:flex-row lg:items-center lg:justify-center lg:gap-6">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    onClick={closeNavbar}
                    aria-current={isActive(link.to) ? 'page' : undefined}
                    className={cn(
                      'relative block py-2.5 duration-300 ease-linear hover:text-yellow-700 dark:hover:text-yellow-400',
                      'after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-yellow-600 after:duration-300 after:ease-linear hover:after:scale-100',
                      isActive(link.to) && 'text-zinc-950 after:scale-100 dark:text-white'
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center lg:ml-4 lg:mt-0 lg:min-w-max">
              <AnimatedThemeToggler className="border-none" />
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <a href={links.admin}>Sign in</a>
              </Button>
              <Button asChild className="w-full depth-1 sm:w-auto">
                <Link to="/contact" onClick={closeNavbar}>
                  Get started
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex items-center lg:hidden">
            <button
              type="button"
              onClick={toggleNavbar}
              aria-label={navIsOpened ? 'Close menu' : 'Open menu'}
              aria-expanded={navIsOpened}
              aria-controls="primary-navigation"
              className="relative flex h-11 w-11 items-center justify-center border-l border-l-zinc-200 pl-3 outline-none focus-visible:ring-1 focus-visible:ring-ring dark:border-l-zinc-800"
            >
              <span className="flex flex-col gap-2">
                <span
                  aria-hidden="true"
                  className={cn('flex h-0.5 w-5 bg-zinc-800 transition duration-300 dark:bg-zinc-300', navIsOpened && 'translate-y-[0.3125rem] rotate-45')}
                />
                <span
                  aria-hidden="true"
                  className={cn('flex h-0.5 w-5 bg-zinc-800 transition duration-300 dark:bg-zinc-300', navIsOpened && '-translate-y-[0.3125rem] -rotate-45')}
                />
              </span>
            </button>
          </div>
        </nav>
      </header>
    </>
  );
};

export { Navbar };
