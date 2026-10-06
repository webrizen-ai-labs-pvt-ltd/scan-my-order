/** Where the QR menu app lives (same rules as the operations panel) */
function menuBaseUrl() {
  const configured = import.meta.env.VITE_MENU_URL;
  if (configured) return configured.replace(/\/$/, '');
  // Development: the menu app runs on :5175 on this machine; using this page's host lets a phone
  // on the same Wi-Fi open the code
  if (import.meta.env.DEV) return `${window.location.protocol}//${window.location.hostname}:5175`;
  return 'https://menu.scanmyorder.com';
}

/** A venue's single QR address: every counter in one place */
export const venueUrlFor = (slug) => `${menuBaseUrl()}/v/${slug}`;

/** True when the QR would only open on this computer */
export function venueUrlIsLocalOnly() {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(menuBaseUrl()).hostname);
  } catch {
    return false;
  }
}
