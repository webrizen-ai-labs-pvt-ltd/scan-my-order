import React from 'react';
import { Sheet, SheetContent, SheetTitle } from '@smo/ui';
import { LinkSquare02Icon } from 'hugeicons-react';

/**
 * How to play a dish's video link.
 * @returns {{ kind: 'file'|'embed'|'link', src: string, vertical?: boolean } | null}
 */
function videoSourceFor(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.)/, '');
  const parts = u.pathname.split('/').filter(Boolean);

  // YouTube (watch, youtu.be, shorts, embed)
  let youtubeId = null;
  if (host === 'youtu.be') youtubeId = parts[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (parts[0] === 'watch') youtubeId = u.searchParams.get('v');
    else if (['shorts', 'embed', 'live'].includes(parts[0])) youtubeId = parts[1];
  }
  if (youtubeId) {
    return {
      kind: 'embed',
      src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?autoplay=1&playsinline=1&rel=0&modestbranding=1`,
      vertical: parts[0] === 'shorts',
    };
  }

  // Vimeo
  if (host === 'vimeo.com' && /^\d+$/.test(parts[0] || '')) {
    return { kind: 'embed', src: `https://player.vimeo.com/video/${parts[0]}?autoplay=1&playsinline=1` };
  }
  if (host === 'player.vimeo.com') return { kind: 'embed', src: url };

  // Google Drive file
  if (host === 'drive.google.com' && parts[0] === 'file' && parts[1] === 'd' && parts[2]) {
    return { kind: 'embed', src: `https://drive.google.com/file/d/${parts[2]}/preview` };
  }

  // A video file
  if (/\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(u.pathname)) return { kind: 'file', src: url };

  return { kind: 'link', src: url };
}

const Player = ({ source, title }) => {
  if (source.kind === 'file') {
    return (
      <video
        src={source.src}
        controls
        autoPlay
        playsInline
        preload="metadata"
        className="max-h-[70vh] w-full bg-black object-contain"
      />
    );
  }
  if (source.kind === 'embed') {
    return (
      <div className={`relative w-full bg-black ${source.vertical ? 'mx-auto aspect-[9/16] max-h-[70vh] max-w-[min(100%,calc(70vh*9/16))]' : 'aspect-video'}`}>
        <iframe
          src={source.src}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    );
  }
  return null;
};

/**
 * Bottom sheet that plays a dish's video. Nothing loads until it opens, and closing it stops
 * playback (the player is removed).
 */
export const ItemVideoSheet = ({ item, onClose, onAdd, inCart, brandColor }) => {
  const source = item?.videoUrl ? videoSourceFor(item.videoUrl) : null;
  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="mx-auto w-full overflow-hidden rounded-t-3xl border-zinc-200 bg-white p-0 sm:max-w-md dark:border-zinc-800 dark:bg-zinc-900">
        {item && (
          <>
            {source && source.kind !== 'link' ? (
              <Player source={source} title={`${item.name} video`} />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-zinc-950 p-6 text-center">
                <p className="text-sm text-zinc-300">This video opens on its own site.</p>
                <a
                  href={item.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-zinc-900"
                >
                  <LinkSquare02Icon size={16} /> Open video
                </a>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="min-w-0">
                <SheetTitle className="truncate text-base font-extrabold text-zinc-900 dark:text-zinc-50">{item.name}</SheetTitle>
                <p className="text-sm font-bold text-zinc-600 dark:text-zinc-300">₹{item.price}</p>
              </div>
              <button
                type="button"
                onClick={() => onAdd(item)}
                className="shrink-0 rounded-xl px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-white transition-transform active:scale-95"
                style={{ backgroundColor: brandColor }}
              >
                {inCart ? 'Add one more' : 'Add'}
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
