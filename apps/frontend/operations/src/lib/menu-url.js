/** Public QR-menu address of a store (the menu app runs on :5175 in development) */
export function menuUrlFor(brandSlug, storeSlug) {
  const base = import.meta.env.VITE_MENU_URL
    || (window.location.hostname === 'localhost' ? 'http://localhost:5175' : 'https://menu.scanmyorder.com');
  return `${base.replace(/\/$/, '')}/${brandSlug}/${storeSlug}`;
}
