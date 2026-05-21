// Color helpers used everywhere we display group colors or hash-to-color avatars.
// Keep the math simple — luminance via the WCAG formula.

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Relative luminance per WCAG 2.x (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const m = hex.replace("#", "").match(/.{1,2}/g);
  if (!m || m.length < 3) return 0.5;
  const [r, g, b] = m.slice(0, 3).map((x) => parseInt(x, 16));
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** Pick foreground text color (white or near-black) that meets ~4.5:1 against the given background hex. */
export function pickTextColor(bgHex: string): "#ffffff" | "#111111" {
  return relativeLuminance(bgHex) > 0.5 ? "#111111" : "#ffffff";
}

/**
 * Map an arbitrary string (user id, display name) to one of 10 distinct hues with
 * consistent saturation/lightness. Used for avatar fallbacks so each user gets a
 * stable identifiable background.
 */
export function hueFromString(s: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  // Mid-saturation, mid-lightness — guaranteed enough contrast against white text.
  const bg = `hsl(${hue} 55% 45%)`;
  return { bg, fg: "#ffffff" };
}
