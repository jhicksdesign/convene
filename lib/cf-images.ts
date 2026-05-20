// Cloudflare Images URL transformer.
//
// When CF_IMAGES_ACCOUNT_HASH is set, point any served avatar/flyer URL at
//   https://imagedelivery.net/<account_hash>/<image_id>/<variant>
// Otherwise return the source URL unchanged.
//
// For this app we use the "URL-based transformations" pattern: source images
// live in R2, and Cloudflare Images proxies + caches resized variants via
// /cdn-cgi/image/<options>/<source>. That keeps the integration zero-config
// once a Cloudflare zone fronts the R2 hostname.

interface TransformOpts {
  width?: number;
  height?: number;
  fit?: "scale-down" | "cover" | "contain" | "crop";
  quality?: number;
  format?: "auto" | "webp" | "avif";
}

const CF_ZONE = process.env.CF_IMAGES_ZONE_URL; // e.g. https://files.your-domain.com

function buildOpts(opts: TransformOpts): string {
  const parts: string[] = [];
  if (opts.width) parts.push(`width=${opts.width}`);
  if (opts.height) parts.push(`height=${opts.height}`);
  if (opts.fit) parts.push(`fit=${opts.fit}`);
  if (opts.quality) parts.push(`quality=${opts.quality}`);
  if (opts.format) parts.push(`format=${opts.format}`);
  else parts.push("format=auto");
  return parts.join(",");
}

export function cfImage(srcUrl: string | null | undefined, opts: TransformOpts = {}): string | null {
  if (!srcUrl) return null;
  if (!CF_ZONE) return srcUrl;
  // Cloudflare's URL-based transformations: prepend /cdn-cgi/image/<opts>/.
  const optStr = buildOpts(opts);
  // Strip protocol+host from srcUrl if it lives on the same zone; otherwise pass full URL.
  return `${CF_ZONE.replace(/\/$/, "")}/cdn-cgi/image/${optStr}/${srcUrl}`;
}

/** Common variants used across the app. */
export const variants = {
  avatarSmall: (url: string | null | undefined) =>
    cfImage(url, { width: 64, height: 64, fit: "cover", quality: 80 }),
  avatarLarge: (url: string | null | undefined) =>
    cfImage(url, { width: 256, height: 256, fit: "cover", quality: 85 }),
  flyer: (url: string | null | undefined) =>
    cfImage(url, { width: 1200, fit: "scale-down", quality: 80 }),
  flyerThumb: (url: string | null | undefined) =>
    cfImage(url, { width: 320, fit: "scale-down", quality: 75 }),
};
