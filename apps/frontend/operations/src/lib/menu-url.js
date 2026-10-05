const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/** Where the QR menu app lives */
function menuBaseUrl() {
  const configured = import.meta.env.VITE_MENU_URL;
  if (configured) return configured.replace(/\/$/, '');
  // Development: the menu app runs on :5175 on this same machine. Using the address this panel was
  // opened on (e.g. a LAN IP) lets a phone on the same Wi-Fi open the QR codes.
  if (import.meta.env.DEV) return `${window.location.protocol}//${window.location.hostname}:5175`;
  return 'https://menu.scanmyorder.com';
}

/** Public QR-menu address of a store */
export function menuUrlFor(brandSlug, storeSlug) {
  return `${menuBaseUrl()}/${brandSlug}/${storeSlug}`;
}

/** True when QR codes would point at this computer only (phones can't open them) */
export function menuUrlIsLocalOnly() {
  try {
    return LOCAL_HOSTS.includes(new URL(menuBaseUrl()).hostname);
  } catch {
    return false;
  }
}
