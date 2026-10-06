/**
 * Print-quality venue QR card (PNG): one code for every counter in a mall or food court.
 * Same approach as the table cards in the operations panel: the QR is the preview's vector <svg>
 * drawn large, with our own logo badge over the space the code (error correction "H") leaves for it.
 */

const WIDTH = 1200;
const HEIGHT = 1500;
const QR_SIZE = 820;
const ACCENT = '#FBBF24';
const INK = '#18181B';
const MUTED = '#71717A';
const FONT = '"Inter", "Segoe UI", system-ui, -apple-system, Arial, sans-serif';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitFont(ctx, text, maxWidth, size, weight) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    s -= 2;
  } while (s > 14);
}

/**
 * @param {SVGSVGElement} svgEl the venue QR preview (QRCodeSVG, level "H", excavated logo)
 * @param {{ venueName: string, city?: string }} info
 * @returns {Promise<string|null>} PNG data URL
 */
export async function renderVenueQrCard(svgEl, { venueName, city }) {
  if (!svgEl) return null;
  if (document.fonts?.ready) await document.fonts.ready.catch(() => {});

  const clone = svgEl.cloneNode(true);
  const numCells = Number(clone.getAttribute('viewBox')?.split(/\s+/)[2]) || 0;
  const imageEl = clone.querySelector('image');
  let hole = null;
  if (imageEl && numCells) {
    const x = Number(imageEl.getAttribute('x'));
    const y = Number(imageEl.getAttribute('y'));
    const w = Number(imageEl.getAttribute('width'));
    const h = Number(imageEl.getAttribute('height'));
    hole = { x: Math.floor(x), y: Math.floor(y), w: Math.ceil(x + w) - Math.floor(x), h: Math.ceil(y + h) - Math.floor(y) };
    imageEl.remove();
  }
  clone.setAttribute('width', QR_SIZE);
  clone.setAttribute('height', QR_SIZE);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const qrImg = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`);
  const logo = await loadImage('/logo.png').catch(() => null);

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  const cx = WIDTH / 2;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = '#E4E4E7';
  ctx.lineWidth = 4;
  roundRect(ctx, 2, 2, WIDTH - 4, HEIGHT - 4, 48);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = MUTED;
  ctx.font = `600 36px ${FONT}`;
  ctx.fillText('ORDER FROM ANY COUNTER', cx, 120);
  ctx.fillStyle = INK;
  fitFont(ctx, venueName, WIDTH - 160, 84, 800);
  ctx.fillText(venueName, cx, 215);

  const qrX = (WIDTH - QR_SIZE) / 2;
  const qrY = 270;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrImg, qrX, qrY, QR_SIZE, QR_SIZE);
  ctx.imageSmoothingEnabled = true;

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
    ctx.drawImage(logo, bx + (bw - logo.width * scale) / 2, by + (bh - logo.height * scale) / 2, logo.width * scale, logo.height * scale);
  }

  // "Scan to order" in a yellow pill
  const label = 'Scan to order';
  ctx.font = `800 80px ${FONT}`;
  const pillW = ctx.measureText(label).width + 140;
  const pillH = 140;
  const pillY = qrY + QR_SIZE + 55;
  ctx.fillStyle = ACCENT;
  roundRect(ctx, cx - pillW / 2, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, pillY + pillH / 2 + 4);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = MUTED;
  const footer = `Pay on your phone · collect at the counter${city ? ` · ${city}` : ''}`;
  fitFont(ctx, footer, WIDTH - 120, 34, 500);
  ctx.fillText(footer, cx, HEIGHT - 70);

  return canvas.toDataURL('image/png');
}
