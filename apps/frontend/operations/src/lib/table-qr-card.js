/**
 * Print-quality table QR card (PNG), drawn fresh at full size rather than screenshotting the
 * on-screen preview.
 *
 * The QR comes from the preview's <svg> (vector, so it scales sharply). Its <image> is removed:
 * browsers don't load external images inside an SVG drawn to a canvas. Instead we draw our own
 * logo badge exactly over the hole the QR left for it (the QR uses error correction "H", so it
 * still scans).
 */

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 1500;

const QR_SIZE = 820;
const ACCENT = '#FBBF24';
const INK = '#18181B';
const MUTED = '#71717A';
const FONT = '"Inter", "Segoe UI", system-ui, -apple-system, Arial, sans-serif';

export const DEFAULT_QR_LOGO = '/logo.png';

function loadImage(src, { crossOrigin } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Another site's logo must allow CORS, or the finished card couldn't be saved
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const logoCache = new Map();
/** The logo for the middle of the code: the given one if it loads, otherwise ours */
const loadLogo = (src = DEFAULT_QR_LOGO) => {
  if (!logoCache.has(src)) {
    const external = src !== DEFAULT_QR_LOGO;
    logoCache.set(src, loadImage(src, { crossOrigin: external })
      .catch(() => (external ? loadImage(DEFAULT_QR_LOGO) : null))
      .catch(() => null));
  }
  return logoCache.get(src);
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Shrinks the font until the text fits the width */
function fitText(ctx, text, maxWidth, size, weight) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    s -= 2;
  } while (s > 12);
}

/**
 * @param {SVGSVGElement} svgEl the table's QR preview (QRCodeSVG with an excavated logo)
 * @returns {Promise<string|null>} PNG data URL
 */
export async function renderTableQrCard(svgEl, { tableNumber, storeName, logoSrc }) {
  if (!svgEl) return null;
  if (document.fonts?.ready) await document.fonts.ready.catch(() => {});

  // Vector copy of the QR without the logo image, at print size
  const clone = svgEl.cloneNode(true);
  const numCells = Number(clone.getAttribute('viewBox')?.split(/\s+/)[2]) || 0;
  const imageEl = clone.querySelector('image');
  let hole = null;
  if (imageEl && numCells) {
    const x = Number(imageEl.getAttribute('x'));
    const y = Number(imageEl.getAttribute('y'));
    const w = Number(imageEl.getAttribute('width'));
    const h = Number(imageEl.getAttribute('height'));
    // Same whole-cell rounding the QR used when it cleared the space
    hole = { x: Math.floor(x), y: Math.floor(y), w: Math.ceil(x + w) - Math.floor(x), h: Math.ceil(y + h) - Math.floor(y) };
    imageEl.remove();
  }
  clone.setAttribute('width', QR_SIZE);
  clone.setAttribute('height', QR_SIZE);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const svgText = new XMLSerializer().serializeToString(clone);
  const qrImg = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`);
  const logo = await loadLogo(logoSrc);

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  const cx = CARD_WIDTH / 2;

  // Card with a light cut line
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.strokeStyle = '#E4E4E7';
  ctx.lineWidth = 4;
  roundRect(ctx, 2, 2, CARD_WIDTH - 4, CARD_HEIGHT - 4, 48);
  ctx.stroke();

  // Header
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (storeName) {
    ctx.fillStyle = MUTED;
    fitText(ctx, storeName.toUpperCase(), CARD_WIDTH - 200, 40, 600);
    ctx.fillText(storeName.toUpperCase(), cx, 140);
  }
  ctx.fillStyle = INK;
  ctx.font = `800 84px ${FONT}`;
  ctx.fillText('Scan to order', cx, storeName ? 240 : 200);

  // QR (the card's white space around it is the scanner's quiet zone)
  const qrX = (CARD_WIDTH - QR_SIZE) / 2;
  const qrY = 300;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrImg, qrX, qrY, QR_SIZE, QR_SIZE);
  ctx.imageSmoothingEnabled = true;

  // Logo badge in the space the QR left for it
  if (hole && logo) {
    const cell = QR_SIZE / numCells;
    const bx = qrX + hole.x * cell;
    const by = qrY + hole.y * cell;
    const bw = hole.w * cell;
    const bh = hole.h * cell;
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, bx, by, bw, bh, Math.min(bw, bh) * 0.18);
    ctx.fill();
    const pad = Math.min(bw, bh) * 0.14;
    const scale = Math.min((bw - pad * 2) / logo.width, (bh - pad * 2) / logo.height);
    const lw = logo.width * scale;
    const lh = logo.height * scale;
    ctx.drawImage(logo, bx + (bw - lw) / 2, by + (bh - lh) / 2, lw, lh);
  }

  // Table number in a yellow pill
  const label = `Table ${tableNumber}`;
  ctx.font = `800 96px ${FONT}`;
  const pillW = Math.max(420, ctx.measureText(label).width + 140);
  const pillH = 150;
  const pillY = qrY + QR_SIZE + 60;
  ctx.fillStyle = ACCENT;
  roundRect(ctx, cx - pillW / 2, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, pillY + pillH / 2 + 4);

  // Footer
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = MUTED;
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText('Point your phone camera at the code', cx, CARD_HEIGHT - 70);

  return canvas.toDataURL('image/png');
}
