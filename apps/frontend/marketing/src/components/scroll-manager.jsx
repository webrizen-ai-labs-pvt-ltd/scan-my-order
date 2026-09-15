import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Scrolls to the `#hash` target after a route change (so `/#features`
 * works from any page), otherwise resets to the top on navigation.
 */
export function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return;
    }
    // Wait a frame so the target page has rendered.
    const id = requestAnimationFrame(() => {
      document.querySelector(hash)?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(id);
  }, [pathname, hash]);

  return null;
}
