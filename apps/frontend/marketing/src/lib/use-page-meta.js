import { useEffect } from 'react';

const DEFAULT_TITLE = 'Scan My Order - Next-Gen POS & QR Dining Platform';

/** Sets document title / meta description per route (SPA, no head manager). */
export function usePageMeta({ title, description }) {
  useEffect(() => {
    const prevTitle = document.title;
    const meta = document.querySelector('meta[name="description"]');
    const prevDescription = meta?.getAttribute('content');

    document.title = title || DEFAULT_TITLE;
    if (meta && description) meta.setAttribute('content', description);

    return () => {
      document.title = prevTitle;
      if (meta && prevDescription != null) meta.setAttribute('content', prevDescription);
    };
  }, [title, description]);
}
